// src/pages/api/check-availability.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server"; // For Auth

// Define expected request body
interface RequestBody {
  roomName?: string; // Use the Name field from Rooms table for matching Timings.Room
  day?: string;
  startTime?: string; // Expect "HH:mm" format
  endTime?: string; // Expect "HH:mm" format
}

// Define structure for conflicting class details
interface ConflictDetails {
  subject: string;
  professor: string;
  startTime: string;
  endTime: string;
  room: string; // Include room for clarity
  classType: string; // e.g., Lecture, Tutorial
}

// Define response structure
type ResponseData =
  | {
      available: boolean;
      checked: {
        // Include checked parameters for clarity
        roomName: string;
        day: string;
        startTime: string;
        endTime: string;
      };
      classes?: ConflictDetails[]; // Array of conflicts if not available
    }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 1. Authentication Check
  const supabase = createSupabaseRouteHandlerClient(req, res);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: "Authentication required" });
  }
  // Note: Client-side handles allowlist authorization

  // 2. Validate Input
  const { roomName, day, startTime, endTime } = req.body as RequestBody;
  console.log("[API Check Availability] Received:", {
    roomName,
    day,
    startTime,
    endTime,
  });

  if (!roomName || !day || !startTime || !endTime) {
    return res
      .status(400)
      .json({
        error: "Missing required fields: roomName, day, startTime, endTime",
      });
  }
  // Add more validation for time format if needed

  try {
    // 3. Query for Conflicts
    // Find Timings entries that *overlap* with the requested range
    const conflicts = await prisma.timings.findMany({
      where: {
        Room: roomName, // Match based on the Room Name
        Day: day,
        // Overlap condition:
        // A conflict exists if (Booking StartTime < Request EndTime) AND (Booking EndTime > Request StartTime)
        StartTime: { lt: endTime }, // Booking starts before request ends
        EndTime: { gt: startTime }, // Booking ends after request starts
      },
      select: {
        SubCode: true,
        Class: true, // Type of class (Lecture, Tutorial, etc.)
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

    const checkedParams = { roomName, day, startTime, endTime }; // Echo back checked params

    if (isAvailable) {
      console.log(
        `[API Check Availability] Room "${roomName}" is AVAILABLE on ${day} from ${startTime} to ${endTime}`,
      );
      return res.status(200).json({ available: true, checked: checkedParams });
    } else {
      console.log(
        `[API Check Availability] Room "${roomName}" is NOT AVAILABLE on ${day} from ${startTime} to ${endTime}. Conflicts:`,
        conflicts.length,
      );
      // Format conflicting class details
      const conflictDetails: ConflictDetails[] = conflicts.map((c) => ({
        subject: c.SubCode,
        classType: c.Class, // Keep original format or title case if preferred
        professor: c.Teacher,
        startTime: c.StartTime, // Assuming HH:mm format is already correct
        endTime: c.EndTime,
        room: c.Room, // Include room in conflict details
      }));

      return res.status(200).json({
        available: false,
        checked: checkedParams,
        classes: conflictDetails,
      });
    }
  } catch (error: any) {
    console.error("[API Check Availability] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
