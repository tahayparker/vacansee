/**
 * Available Now API Route (App Router)
 *
 * Returns rooms that are currently available based on the
 * current time in Dubai timezone.
 *
 * @method POST
 * @auth Required
 * @returns List of currently available rooms
 */

import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentDubaiTime,
  getCurrentTimeString,
  getCurrentDayName,
  formatDubaiDateToISO,
} from "@/services/timeService";
import { SECURITY_HEADERS, getClientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import type { Room } from "@/types/shared";
import {
  getShortCodeFromName,
  expandBookedShortCodes,
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

    const currentTimeString = getCurrentTimeString();
    const currentDayName = getCurrentDayName();

    logger.info("Checking current availability in Dubai timezone", {
      requestId,
      day: currentDayName,
      time: currentTimeString,
      timezone: "Asia/Dubai",
      userId: user.id,
    });

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

    const bookedShortCodes = new Set(
      bookedRoomNames.map((name) => getShortCodeFromName(name)),
    );
    const expandedBookedShortCodes = expandBookedShortCodes(bookedShortCodes);
    const expandedBookedRoomNames = await getRoomNamesForShortCodes(
      prisma,
      Array.from(expandedBookedShortCodes),
    );

    const availableRoomsData = await prisma.rooms.findMany({
      where: {
        Name: { notIn: expandedBookedRoomNames },
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

    logger.info("Available rooms processed", {
      requestId,
      totalRooms: processedRooms.length,
    });

    const checkedAt = formatDubaiDateToISO(getCurrentDubaiTime());

    return NextResponse.json(
      { checkedAt, rooms: processedRooms },
      { headers: SECURITY_HEADERS },
    );
  } catch (error: any) {
    logger.error("Error in available-now API", error, { requestId, ip });

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
