// src/pages/api/available-soon.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { DateTime } from "luxon"; // Import Luxon DateTime

// Types and constants...
interface RequestBody {
  durationMinutes?: number;
}
interface AvailableRoomInfo {
  name: string;
  shortCode: string;
  capacity: number | null;
}
type ResponseData =
  | { checkedAtFutureTime: string; rooms: AvailableRoomInfo[] }
  | { error: string };
const DUBAI_TIMEZONE = "Asia/Dubai";
const roomGroupings: Record<string, string[]> = {
  "4.467": ["4.46", "4.47"],
  "5.134": ["5.13", "5.14"],
  "6.345": ["6.34", "6.35"],
};
const mainGroupRooms = Object.keys(roomGroupings);
const EXCLUDED_ROOM_PATTERNS = ["consultation", "online"];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // 1. Get Duration from Request Body
    const { durationMinutes = 30 } = req.body as RequestBody;
    if (typeof durationMinutes !== "number" || durationMinutes < 0) {
      return res
        .status(400)
        .json({ error: "Invalid durationMinutes parameter." });
    }

    // 2. Calculate Future Time in Dubai using Luxon
    const nowLuxon = DateTime.now().setZone(DUBAI_TIMEZONE); // Get current time zoned to Dubai
    const futureTimeLuxon = nowLuxon.plus({ minutes: durationMinutes }); // Add duration

    // Get components needed for the query from the zoned future DateTime object
    const checkDayDubai = futureTimeLuxon.toFormat("EEEE"); // Format as full day name
    const checkTimeDubai = futureTimeLuxon.toFormat("HH:mm"); // Format as HH:mm

    console.log(
      `[API Available Soon] Using Luxon. Checking for Day: ${checkDayDubai}, Future Time: ${checkTimeDubai} in ${DUBAI_TIMEZONE} (${durationMinutes} mins from now)`,
    );
    if (!checkDayDubai) {
      return res
        .status(500)
        .json({ error: "Internal server error: Cannot determine check day." });
    }

    // 3. Find NAMES of Rooms Occupied *at the Future Time*
    const bookedRoomsResult = await prisma.timings.findMany({
      where: {
        Day: checkDayDubai,
        StartTime: { lte: checkTimeDubai },
        EndTime: { gt: checkTimeDubai },
      },
      select: { Room: true },
      distinct: ["Room"],
      orderBy: { Room: "asc" },
    });
    const occupiedRoomNames = bookedRoomsResult.map(
      (timing: { Room: string }) => timing.Room,
    );
    console.log(
      "[API Available Soon] Occupied Room Names at future time:",
      occupiedRoomNames,
    );

    // 4. Find Room Details for rooms NOT occupied at future time AND NOT excluded
    const availableRoomsData = await prisma.rooms.findMany({
      where: {
        AND: [
          { Name: { notIn: occupiedRoomNames } },
          ...EXCLUDED_ROOM_PATTERNS.map((pattern) => ({
            NOT: { Name: { contains: pattern, mode: "insensitive" as const } },
          })),
        ],
      },
      select: { Name: true, ShortCode: true, Capacity: true },
      orderBy: { Name: "asc" },
    });

    // 5. Apply Room Grouping Filter
    const initialRooms: AvailableRoomInfo[] = availableRoomsData.map(
      (room) => ({
        name: room.Name,
        shortCode: room.ShortCode,
        capacity: room.Capacity,
      }),
    );
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
      "[API Available Soon] Filtered rooms count:",
      filteredRooms.length,
    );
    // --- End Group Filtering Logic ---

    // 6. Prepare the Response Data
    const responsePayload: ResponseData = {
      checkedAtFutureTime: futureTimeLuxon.toISO() ?? new Date().toISOString(), // Use ISO string from future DateTime object
      rooms: filteredRooms,
    };

    console.log(
      "[API Available Soon] Sending final Available Rooms Count:",
      responsePayload.rooms.length,
    );
    return res.status(200).json(responsePayload);
  } catch (error: any) {
    console.error("[API Available Soon] Error:", error);
    if (error.code) {
      console.error(`[API Available Soon] Prisma Error Code: ${error.code}`);
    }
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    // await prisma.$disconnect().catch(e => console.error("[API Available Soon] Error disconnecting Prisma:", e));
  }
}
