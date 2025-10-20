/**
 * Available Now API Route
 *
 * Returns rooms that are currently available based on the
 * current time in Dubai timezone.
 *
 * @method POST
 * @auth Required
 * @returns List of currently available rooms
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getCurrentDubaiTime, getCurrentTimeString, getCurrentDayName, formatDubaiDateToISO } from "@/services/timeService";
import { processRoomsList } from "@/services/roomService";
import { addSecurityHeaders, getClientIP } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import type { AvailableNowResponse } from "@/types/api";
import type { Room } from "@/types/shared";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AvailableNowResponse | { error: string }>,
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
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Authentication check
    const supabase = createSupabaseRouteHandlerClient(req, res);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get current time in Dubai timezone using our timeService
    // All timeService functions automatically use Asia/Dubai timezone
    const currentTimeString = getCurrentTimeString(); // Returns current time in Dubai
    const currentDayName = getCurrentDayName(); // Returns current day in Dubai

    logger.info("Checking current availability in Dubai timezone", {
      requestId,
      day: currentDayName,
      time: currentTimeString,
      timezone: "Asia/Dubai",
      userId: session.user.id,
    });

    // Query booked rooms
    const bookedTimings = await prisma.timings.findMany({
      where: {
        Day: currentDayName,
        StartTime: { lte: currentTimeString },
        EndTime: { gt: currentTimeString },
      },
      select: { Room: true },
      distinct: ["Room"],
    });

    const bookedRoomNames = bookedTimings.map((timing) => timing.Room);

    logger.debug("Booked rooms found", {
      requestId,
      count: bookedRoomNames.length,
    });

    // Query available rooms (filtering happens in processRoomsList)
    const availableRoomsData = await prisma.rooms.findMany({
      where: {
        Name: { notIn: bookedRoomNames },
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
        return a.shortCode.localeCompare(b.shortCode, undefined, { sensitivity: "base" });
      });

    // Apply room filtering and grouping logic
    const processedRooms = processRoomsList(roomsBeforeProcessing);

    logger.info("Available rooms processed", {
      requestId,
      totalRooms: roomsBeforeProcessing.length,
      filteredRooms: processedRooms.length,
    });

    // Get checked timestamp in ISO format
    const checkedAt = formatDubaiDateToISO(getCurrentDubaiTime());

    return res.status(200).json({
      checkedAt,
      rooms: processedRooms,
    });
  } catch (error: any) {
    logger.error("Error in available-now API", error, { requestId, ip });

    // Handle database errors specially
    if (error.code) {
      throw new DatabaseError("Database query failed", {
        code: error.code,
        requestId,
      });
    }

    const { statusCode, body } = handleApiError(error);
    return res.status(statusCode).json({ ...body, requestId } as any);
  }
}
