// src/pages/api/available-now.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma"; // Import Prisma client from lib
import { DateTime } from "luxon"; // Import Luxon DateTime
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const DUBAI_TIMEZONE = "Asia/Dubai"; // Use standard IANA identifier

// --- Define expected response/error types ---
interface AvailableRoomInfo {
  name: string;
  shortCode: string;
  capacity: number | null;
}
interface ApiResponseData {
  checkedAt: string;
  rooms: AvailableRoomInfo[];
}
interface ApiErrorResponse {
  error: string;
}

// --- Room Groupings & Exclusions (Server-side) ---
const roomGroupings: Record<string, string[]> = {
  "4.467": ["4.46", "4.47"],
  "5.134": ["5.13", "5.14"],
  "6.345": ["6.34", "6.35"],
};
const mainGroupRooms = Object.keys(roomGroupings);
const EXCLUDED_ROOM_PATTERNS = ["consultation", "online"];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponseData | ApiErrorResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Add auth check - available-now requires authentication
  const supabase = createSupabaseRouteHandlerClient(req, res);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    // --- Get Current Time in Dubai using Luxon ---
    const nowLuxon = DateTime.now().setZone(DUBAI_TIMEZONE);
    const currentTimeStringDubai = nowLuxon.toFormat("HH:mm");
    const currentDayNameDubai = nowLuxon.toFormat("EEEE");

    console.log(
      `[API Available Now] Using Luxon. Checking for Day: ${currentDayNameDubai}, Time: ${currentTimeStringDubai} in ${DUBAI_TIMEZONE}`,
    );
    // --- End Time Calculation ---

    // --- Database Query ---
    const bookedTimings = await prisma.timings.findMany({
      where: {
        Day: currentDayNameDubai,
        StartTime: { lte: currentTimeStringDubai },
        EndTime: { gt: currentTimeStringDubai },
      },
      select: { Room: true },
      distinct: ["Room"],
    });
    const bookedRoomNames = bookedTimings.map(
      (timing: { Room: string }) => timing.Room,
    );
    console.log("[API Available Now] Booked Room Names:", bookedRoomNames); // Keep logs minimal if preferred

    const availableRoomsData = await prisma.rooms.findMany({
      where: {
        AND: [
          { Name: { notIn: bookedRoomNames } },
          ...EXCLUDED_ROOM_PATTERNS.map((pattern) => ({
            NOT: { Name: { contains: pattern, mode: "insensitive" as const } },
          })),
        ],
      },
      select: { Name: true, ShortCode: true, Capacity: true },
      orderBy: { Name: "asc" },
    });
    // --- End Database Query ---

    // Map Prisma result to API structure
    const initialRooms: AvailableRoomInfo[] = availableRoomsData.map(
      (room) => ({
        name: room.Name,
        shortCode: room.ShortCode,
        capacity: room.Capacity,
      }),
    );

    // --- Room Grouping Filter (Server-side) ---
    const availableShortCodes = new Set(
      initialRooms.map((room: AvailableRoomInfo) => room.shortCode),
    );
    const relatedRoomsToExclude = new Set<string>();
    mainGroupRooms.forEach((mainRoomCode) => {
      if (!availableShortCodes.has(mainRoomCode)) {
        const relatedCodes = roomGroupings[mainRoomCode];
        if (relatedCodes) {
          relatedCodes.forEach((code) => relatedRoomsToExclude.add(code));
        }
      }
    });
    const filteredRooms = initialRooms.filter(
      (room: AvailableRoomInfo) => !relatedRoomsToExclude.has(room.shortCode),
    );
    console.log(
      "[API Available Now] Filtered rooms count:",
      filteredRooms.length,
    );
    // --- End Room Grouping Filter ---

    // Use the Luxon DateTime object's ISO string for checkedAt
    const checkedAtUTC = nowLuxon.toISO();

    res.status(200).json({
      checkedAt: checkedAtUTC ?? new Date().toISOString(), // Fallback just in case
      rooms: filteredRooms,
    });
  } catch (error: any) {
    console.error("[API Available Now] Error:", error);
    if (error.code) {
      console.error(`[API Available Now] Prisma Error Code: ${error.code}`);
    }
    return res
      .status(500)
      .json({ error: error.message || "Internal Server Error" });
  } finally {
    await prisma
      .$disconnect()
      .catch((e) =>
        console.error("[API Available Now] Error disconnecting Prisma:", e),
      );
  }
}
