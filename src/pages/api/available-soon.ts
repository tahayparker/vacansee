/**
 * Available Soon API Route
 *
 * Returns rooms that will be available after a specified duration
 * from the current time in Dubai timezone.
 *
 * @method POST
 * @auth Required
 * @body { durationMinutes?: number } - Duration in minutes (default: 30)
 * @returns List of rooms available at future time
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import {
  addMinutesToCurrentTime,
  getCurrentTimeString,
  getCurrentDayName,
  getDayNameInDubai,
  getTimeStringInDubai,
  formatDubaiDateToISO,
} from "@/services/timeService";
import { processRoomsList } from "@/services/roomService";
import { addSecurityHeaders, getClientIP } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import type { AvailableSoonResponse } from "@/types/api";
import type { Room } from "@/types/shared";

/**
 * Request body validation schema
 */
const RequestSchema = z.object({
  durationMinutes: z.number().int().min(0).max(480).optional().default(30),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AvailableSoonResponse | { error: string }>,
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

    // Validate request body
    const validationResult = RequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError("Invalid request parameters", {
        errors: validationResult.error.errors,
      });
    }

    const { durationMinutes } = validationResult.data;

    // Get current time in Dubai timezone
    // Note: All time functions automatically use Dubai timezone (Asia/Dubai)
    const currentTimeString = getCurrentTimeString(); // Returns time in Dubai timezone
    const currentDay = getCurrentDayName(); // Returns day in Dubai timezone

    // Calculate future time by adding minutes
    // This properly handles day rollovers (e.g., 23:30 + 60min = 00:30 next day)
    const futureDate = addMinutesToCurrentTime(durationMinutes);
    const futureTimeString = getTimeStringInDubai(futureDate); // Get time in Dubai TZ
    const futureDay = getDayNameInDubai(futureDate); // Get day name in Dubai TZ

    // Use the future day for the query (handles day rollovers correctly)
    const checkDay = futureDay;

    logger.info("Checking future availability in Dubai timezone", {
      requestId,
      currentTime: currentTimeString,
      currentDay,
      futureTime: futureTimeString,
      futureDay,
      durationMinutes,
      timezone: "Asia/Dubai",
      userId: session.user.id,
    });

    // Query rooms occupied at future time
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

    logger.debug("Occupied rooms at future time", {
      requestId,
      count: occupiedRoomNames.length,
    });

    // Query available rooms
    const availableRoomsData = await prisma.rooms.findMany({
      where: {
        Name: { notIn: occupiedRoomNames },
      },
      select: { Name: true, ShortCode: true, Capacity: true },
    });

    // Convert to Room type and sort by shortcode as number
    const roomsBeforeProcessing: Room[] = availableRoomsData
      .map((room) => ({
        name: room.Name,
        shortCode: room.ShortCode,
        capacity: room.Capacity,
      }))
      .sort((a, b) => {
        const aNum = parseFloat(a.shortCode);
        const bNum = parseFloat(b.shortCode);
        // If both are valid numbers, compare numerically
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        // Otherwise, compare lexicographically
        return a.shortCode.localeCompare(b.shortCode, undefined, {
          sensitivity: "base",
        });
      });

    // Apply room filtering and grouping logic
    const processedRooms = processRoomsList(roomsBeforeProcessing);

    logger.info("Future availability processed", {
      requestId,
      totalRooms: roomsBeforeProcessing.length,
      filteredRooms: processedRooms.length,
      durationMinutes,
    });

    // Get checked timestamp in ISO format (the future time we're checking)
    const checkedAt = formatDubaiDateToISO(futureDate);

    return res.status(200).json({
      checkedAt,
      offsetMinutes: durationMinutes,
      targetTime: futureTimeString,
      rooms: processedRooms,
    });
  } catch (error: any) {
    logger.error("Error in available-soon API", error, { requestId, ip });

    // Handle database errors specially
    if (error.code) {
      throw new DatabaseError("Database query failed", {
        code: error.code,
        requestId,
      });
    }

    const { statusCode, body } = handleApiError(error);
    return res.status(statusCode).json(body as any);
  }
}
