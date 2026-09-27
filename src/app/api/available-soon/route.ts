/**
 * Available Soon API Route (App Router)
 *
 * Returns rooms that will be available after a specified duration
 * from the current time in Dubai timezone.
 *
 * @method POST
 * @auth Required
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  addMinutesToCurrentTime,
  getCurrentTimeString,
  getCurrentDayName,
  getDayNameInDubai,
  getTimeStringInDubai,
  formatDubaiDateToISO,
} from "@/services/timeService";
import { SECURITY_HEADERS, getClientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import type { Room } from "@/types/shared";
import {
  getShortCodeFromName,
  expandBookedShortCodes,
  getRoomNamesForShortCodes,
} from "@/services/roomCombos";

const RequestSchema = z.object({
  durationMinutes: z.number().int().min(0).max(480).optional().default(30),
});

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
    const validationResult = RequestSchema.safeParse(json);
    if (!validationResult.success) {
      throw new ValidationError("Invalid request parameters", {
        errors: validationResult.error.errors,
      });
    }

    const { durationMinutes } = validationResult.data;

    const currentTimeString = getCurrentTimeString();
    const currentDay = getCurrentDayName();

    const futureDate = addMinutesToCurrentTime(durationMinutes);
    const futureTimeString = getTimeStringInDubai(futureDate);
    const futureDay = getDayNameInDubai(futureDate);

    const checkDay = futureDay;

    logger.info("Checking future availability in Dubai timezone", {
      requestId,
      currentTime: currentTimeString,
      currentDay,
      futureTime: futureTimeString,
      futureDay,
      durationMinutes,
      timezone: "Asia/Dubai",
      userId: user.id,
    });

    const bookedRoomsResult = await prisma.timings.findMany({
      where: {
        Day: checkDay,
        StartTime: { lte: futureTimeString },
        EndTime: { gt: futureTimeString },
      },
      select: { Room: true },
      distinct: ["Room"],
      orderBy: { Room: "asc" },
    });

    const occupiedRoomNames = bookedRoomsResult.map((timing) => timing.Room);

    const occupiedShortCodes = new Set(
      occupiedRoomNames.map((name) => getShortCodeFromName(name)),
    );
    const expandedOccupiedShortCodes =
      expandBookedShortCodes(occupiedShortCodes);
    const expandedOccupiedRoomNames = await getRoomNamesForShortCodes(
      prisma,
      Array.from(expandedOccupiedShortCodes),
    );

    const availableRoomsData = await prisma.rooms.findMany({
      where: {
        Name: { notIn: expandedOccupiedRoomNames },
      },
      select: { Name: true, ShortCode: true, Capacity: true },
    });

    const processedRooms: Room[] = availableRoomsData
      .map((room) => ({
        name: room.Name,
        shortCode: room.ShortCode,
        capacity: room.Capacity,
      }))
      .filter(
        (room) =>
          !room.name.toLowerCase().includes("consultation") &&
          !room.name.toLowerCase().includes("online"),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );

    logger.info("Future availability processed", {
      requestId,
      totalRooms: processedRooms.length,
      durationMinutes,
    });

    const checkedAt = formatDubaiDateToISO(futureDate);

    return NextResponse.json(
      {
        checkedAt,
        offsetMinutes: durationMinutes,
        targetTime: futureTimeString,
        rooms: processedRooms,
      },
      { headers: SECURITY_HEADERS },
    );
  } catch (error: any) {
    logger.error("Error in available-soon API", error, { requestId, ip });

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
