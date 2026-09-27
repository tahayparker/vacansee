/**
 * Check Availability API Route (App Router)
 *
 * Checks if a specific room is available during a requested time slot.
 * Returns conflict details if the room is occupied.
 *
 * @method POST
 * @auth Required
 */

import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { SECURITY_HEADERS, getClientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import { AvailabilityCheckRequestSchema } from "@/types/api";
import {
  getShortCodeFromName,
  expandShortCodesForQuery,
  getRoomNamesForShortCodes,
} from "@/services/roomCombos";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const ip = getClientIpFromHeaders(req.headers);

  try {
    await rateLimit(ip);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: SECURITY_HEADERS },
      );
    }

    const json = await req.json().catch(() => ({}));
    const validationResult = AvailabilityCheckRequestSchema.safeParse(json);
    if (!validationResult.success) {
      throw new ValidationError("Invalid request parameters", {
        errors: validationResult.error.errors,
      });
    }

    const { roomName, day, startTime, endTime } = validationResult.data;

    logger.info("Checking room availability", {
      requestId,
      roomName,
      day,
      startTime,
      endTime,
      userId: user.id,
    });

    const shortCode = getShortCodeFromName(roomName);
    const relatedShortCodes = expandShortCodesForQuery(shortCode);
    const relatedRoomNames = await getRoomNamesForShortCodes(
      prisma,
      relatedShortCodes,
    );

    const conflicts = await prisma.timings.findMany({
      where: {
        Room: {
          in: relatedRoomNames.length > 0 ? relatedRoomNames : [roomName],
        },
        Day: day,
        StartTime: { lt: endTime },
        EndTime: { gt: startTime },
      },
      select: {
        SubCode: true,
        Class: true,
        Teacher: true,
        StartTime: true,
        EndTime: true,
        Room: true,
      },
      orderBy: {
        StartTime: "asc",
      },
    });

    const isAvailable = conflicts.length === 0;

    const checkedParams = {
      roomName,
      day,
      startTime,
      endTime,
    };

    if (isAvailable) {
      logger.info("Room is available", {
        requestId,
        roomName,
        day,
        timeSlot: `${startTime}-${endTime}`,
      });

      return NextResponse.json(
        {
          available: true,
          checked: checkedParams,
        },
        { headers: SECURITY_HEADERS },
      );
    } else {
      logger.info("Room has conflicts", {
        requestId,
        roomName,
        day,
        timeSlot: `${startTime}-${endTime}`,
        conflictCount: conflicts.length,
      });

      const conflictDetails = conflicts.map((c) => ({
        subject: c.SubCode,
        classType: c.Class,
        professor: c.Teacher,
        startTime: c.StartTime,
        endTime: c.EndTime,
        room: c.Room,
      }));

      return NextResponse.json(
        {
          available: false,
          checked: checkedParams,
          classes: conflictDetails,
        },
        { headers: SECURITY_HEADERS },
      );
    }
  } catch (error: any) {
    logger.error("Error in check-availability API", error, { requestId, ip });

    if (error.code) {
      const dbError = new DatabaseError("Database query failed", {
        code: error.code,
        requestId,
      });
      const { statusCode, body } = handleApiError(dbError);
      return NextResponse.json(
        { ...body, requestId },
        { status: statusCode, headers: SECURITY_HEADERS },
      );
    }

    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(
      { ...body, requestId },
      { status: statusCode, headers: SECURITY_HEADERS },
    );
  }
}
