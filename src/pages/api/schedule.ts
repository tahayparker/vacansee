/**
 * Schedule API Route
 *
 * Returns the complete weekly schedule data for all rooms.
 * Data is fetched from GitHub (with local fallback) and cached
 * for optimal performance.
 *
 * @method GET
 * @auth Required
 * @returns Weekly schedule data for all rooms
 */

import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { cacheGetOrSet } from "@/lib/cache";
import { addSecurityHeaders, getClientIP } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, ExternalServiceError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import { measureAsync } from "@/lib/monitoring";
import type { ScheduleResponse } from "@/types/api";
import { CACHE_TTL, EXTERNAL_URLS } from "@/constants";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScheduleResponse | { error: string }>,
) {
  const requestId = generateRequestId();
  const ip = getClientIP(req);

  try {
    // Add security headers
    addSecurityHeaders(res);

    // Rate limiting
    await rateLimit(ip);

    // Method validation
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
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

    logger.info("Fetching schedule data", {
      requestId,
      userId: session.user.id,
    });

    // Fetch schedule with caching (stale-while-revalidate)
    const scheduleData = await cacheGetOrSet(
      "schedule-data",
      async () => {
        return await measureAsync("fetch-schedule", async () => {
          // Try to fetch from GitHub first
          logger.debug("Attempting to fetch schedule from GitHub", {
            requestId,
          });

          try {
            const githubResponse = await fetch(
              EXTERNAL_URLS.SCHEDULE_DATA_URL,
              {
                headers: {
                  "User-Agent": "vacansee-app",
                },
              },
            );

            if (githubResponse.ok) {
              const githubData = await githubResponse.text();
              const scheduleData: ScheduleResponse = JSON.parse(githubData);

              if (!Array.isArray(scheduleData)) {
                throw new Error("Invalid data format: not an array");
              }

              logger.info("Successfully fetched schedule from GitHub", {
                requestId,
                daysCount: scheduleData.length,
              });

              return scheduleData;
            } else {
              logger.warn("GitHub fetch failed, trying local fallback", {
                requestId,
                status: githubResponse.status,
              });
              throw new ExternalServiceError("GitHub fetch failed");
            }
          } catch (githubError) {
            // Fall back to local file
            logger.warn("Falling back to local schedule file", {
              requestId,
              error: githubError,
            });

            const schedulePath = path.join(
              process.cwd(),
              "public",
              "scheduleData.json",
            );

            if (!fs.existsSync(schedulePath)) {
              throw new ExternalServiceError(
                "Schedule data not found in GitHub or locally",
              );
            }

            const fileContents = fs.readFileSync(schedulePath, "utf8");
            const scheduleData: ScheduleResponse = JSON.parse(fileContents);

            if (!Array.isArray(scheduleData)) {
              throw new Error("Invalid local data format: not an array");
            }

            logger.info("Successfully loaded local schedule", {
              requestId,
              daysCount: scheduleData.length,
            });

            return scheduleData;
          }
        });
      },
      {
        ttl: CACHE_TTL.SCHEDULE * 1000, // Convert to milliseconds
        staleTime: CACHE_TTL.SCHEDULE * 0.8 * 1000, // 80% of TTL
      },
    );

    // Add cache headers for browser caching
    res.setHeader(
      "Cache-Control",
      `public, max-age=${CACHE_TTL.SCHEDULE}, stale-while-revalidate=${CACHE_TTL.SCHEDULE * 2}`,
    );

    logger.info("Schedule data sent successfully", {
      requestId,
      daysCount: scheduleData.length,
    });

    return res.status(200).json(scheduleData);
  } catch (error: any) {
    logger.error("Error in schedule API", error, { requestId, ip });

    const { statusCode, body } = handleApiError(error);
    return res.status(statusCode).json(body as any);
  }
}
