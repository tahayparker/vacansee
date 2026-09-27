/**
 * Schedule API Route (App Router)
 *
 * Returns the complete weekly schedule data for all rooms.
 * Data is fetched from GitHub (with local fallback) and cached
 * for optimal performance.
 *
 * @method GET
 * @auth Required
 */

import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { cacheGetOrSet } from "@/lib/cache";
import { SECURITY_HEADERS, getClientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, ExternalServiceError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import { measureAsync } from "@/lib/monitoring";
import type { ScheduleResponse } from "@/types/api";
import { CACHE_TTL, EXTERNAL_URLS } from "@/constants";

export async function GET(req: NextRequest) {
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

    logger.info("Fetching schedule data", {
      requestId,
      userId: user.id,
    });

    const scheduleData = await cacheGetOrSet(
      "schedule-data",
      async () => {
        return await measureAsync("fetch-schedule", async () => {
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
        ttl: CACHE_TTL.SCHEDULE * 1000,
        staleTime: CACHE_TTL.SCHEDULE * 0.8 * 1000,
      },
    );

    logger.info("Schedule data sent successfully", {
      requestId,
      daysCount: scheduleData.length,
    });

    return NextResponse.json(scheduleData, {
      headers: {
        ...SECURITY_HEADERS,
        "Cache-Control": `public, max-age=${CACHE_TTL.SCHEDULE}, stale-while-revalidate=${CACHE_TTL.SCHEDULE * 2}`,
      },
    });
  } catch (error: any) {
    logger.error("Error in schedule API", error, { requestId, ip });

    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(
      { ...body, requestId },
      { status: statusCode, headers: SECURITY_HEADERS },
    );
  }
}
