// src/pages/api/schedule.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
// ** REMOVED: import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server'; **

// Define the expected structure from the JSON file
interface FrontendRoomData {
  room: string;
  availability: number[];
}

interface FrontendScheduleDay {
  day: string;
  rooms: FrontendRoomData[];
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FrontendScheduleDay[] | { error: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --- REMOVED Authentication Check ---
  // Middleware should handle protecting this route if needed.
  // ---

  try {
    const schedulePath = path.join(
      process.cwd(),
      "public",
      "scheduleData.json",
    );
    if (!fs.existsSync(schedulePath)) {
      console.error(`Schedule data file not found at: ${schedulePath}`);
      return res.status(404).json({ error: "Schedule data file not found" });
    }
    const fileContents = fs.readFileSync(schedulePath, "utf8");
    const scheduleData: FrontendScheduleDay[] = JSON.parse(fileContents);
    if (!Array.isArray(scheduleData)) {
      throw new Error("Invalid data format: scheduleData is not an array.");
    }
    console.log("[API Schedule] Successfully read scheduleData.json");
    return res.status(200).json(scheduleData);
  } catch (error: any) {
    console.error("Error reading or parsing schedule data:", error);
    if (error instanceof SyntaxError) {
      return res
        .status(500)
        .json({ error: "Failed to parse schedule data: Invalid JSON format." });
    }
    return res
      .status(500)
      .json({ error: "Internal Server Error reading schedule data" });
  }
}
