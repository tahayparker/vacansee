/**
 * Check Availability API Route
 *
 * Checks if a specific room is available during a requested time slot.
 * Returns conflict details if the room is occupied.
 *
 * @method POST
 * @auth Required
 * @body { roomName: string, day: string, startTime: string, endTime: string }
 * @returns Availability status with conflict details if unavailable
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { addSecurityHeaders, getClientIP } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import { AvailabilityCheckRequestSchema } from "@/types/api";
import type { AvailabilityCheckResponse } from "@/types/api";
import {
  getShortCodeFromName,
  expandShortCodesForQuery,
  getRoomNamesForShortCodes,
} from "@/services/roomCombos";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AvailabilityCheckResponse | { error: string }>,
) {
  const requestId = generateRequestId();
  const ip = getClientIP(req);

  try {
    // Add security headers
    addSecurityHeaders(res);

    // Rate limiting
    await rateLimit(ip);

    // Method validation
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Authentication check
    const supabase = createSupabaseRouteHandlerClient(req, res);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body with Zod
    const validationResult = AvailabilityCheckRequestSchema.safeParse(req.body);
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
      userId: session.user.id,
    });

    // Extract short code and expand to related rooms
    const shortCode = getShortCodeFromName(roomName);
    const relatedShortCodes = expandShortCodesForQuery(shortCode);
    const relatedRoomNames = await getRoomNamesForShortCodes(
      prisma,
      relatedShortCodes,
    );

    logger.debug("Checking related rooms", {
      requestId,
      originalRoom: roomName,
      shortCode,
      relatedShortCodes,
      relatedRoomNames,
    });

    // Query for overlapping bookings across all related rooms
    // A conflict exists if: (booking starts before request ends) AND (booking ends after request starts)
    const conflicts = await prisma.timings.findMany({
      where: {
        Room: {
          in: relatedRoomNames.length > 0 ? relatedRoomNames : [roomName],
        },
        Day: day,
        StartTime: { lt: endTime }, // Booking starts before requested end time
        EndTime: { gt: startTime }, // Booking ends after requested start time
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

    // Prepare response with checked parameters
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

      return res.status(200).json({
        available: true,
        checked: checkedParams,
      });
    } else {
      logger.info("Room has conflicts", {
        requestId,
        roomName,
        day,
        timeSlot: `${startTime}-${endTime}`,
        conflictCount: conflicts.length,
      });

      // Format conflict details for response
      const conflictDetails = conflicts.map((c) => ({
        subject: c.SubCode,
        classType: c.Class,
        professor: c.Teacher,
        startTime: c.StartTime,
        endTime: c.EndTime,
        room: c.Room,
      }));

      return res.status(200).json({
        available: false,
        checked: checkedParams,
        classes: conflictDetails,
      });
    }
  } catch (error: any) {
    logger.error("Error in check-availability API", error, { requestId, ip });

    // Handle database errors specially
    if (error.code) {
      throw new DatabaseError("Database query failed", {
        code: error.code,
        requestId,
      });
    }

    const { statusCode, body } = handleApiError(error);
    return res.status(statusCode).json(body as any);
  } finally {
    await prisma.$disconnect().catch((e) => {
      logger.error("Error disconnecting Prisma", e, { requestId });
    });
  }
}
