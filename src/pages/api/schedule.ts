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

  const githubUrl =
    "https://raw.githubusercontent.com/tahayparker/vacansee/refs/heads/main/public/scheduleData.json";

  try {
    // First, try to fetch from GitHub
    console.log("[API Schedule] Attempting to fetch from GitHub...");
    const githubResponse = await fetch(githubUrl);

    if (githubResponse.ok) {
      const githubData = await githubResponse.text();
      const scheduleData: FrontendScheduleDay[] = JSON.parse(githubData);

      if (!Array.isArray(scheduleData)) {
        throw new Error(
          "Invalid data format from GitHub: scheduleData is not an array.",
        );
      }

      console.log("[API Schedule] Successfully fetched data from GitHub");
      return res.status(200).json(scheduleData);
    } else {
      console.warn(
        `[API Schedule] GitHub fetch failed with status: ${githubResponse.status}`,
      );
      throw new Error(`GitHub fetch failed: ${githubResponse.status}`);
    }
  } catch (githubError) {
    console.warn(
      "[API Schedule] GitHub fetch failed, falling back to local file:",
      githubError,
    );

    // Fall back to local file
    try {
      const schedulePath = path.join(
        process.cwd(),
        "public",
        "scheduleData.json",
      );

      if (!fs.existsSync(schedulePath)) {
        console.error(`Schedule data file not found at: ${schedulePath}`);
        return res
          .status(404)
          .json({
            error:
              "Schedule data file not found locally and GitHub fetch failed",
          });
      }

      const fileContents = fs.readFileSync(schedulePath, "utf8");
      const scheduleData: FrontendScheduleDay[] = JSON.parse(fileContents);

      if (!Array.isArray(scheduleData)) {
        throw new Error("Invalid data format: scheduleData is not an array.");
      }

      console.log(
        "[API Schedule] Successfully read local scheduleData.json as fallback",
      );
      return res.status(200).json(scheduleData);
    } catch (localError: any) {
      console.error(
        "Error reading or parsing local schedule data:",
        localError,
      );
      if (localError instanceof SyntaxError) {
        return res
          .status(500)
          .json({
            error:
              "Failed to parse schedule data: Invalid JSON format in both GitHub and local sources.",
          });
      }
      return res
        .status(500)
        .json({
          error:
            "Internal Server Error: Both GitHub and local schedule data sources failed",
        });
    }
  }
}
