/**
 * Rooms List API Route
 *
 * Returns a list of all rooms with their details.
 * Excludes consultation and online rooms.
 *
 * @method GET
 * @auth Required
 * @returns List of rooms with name, shortCode, and capacity
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { addSecurityHeaders, getClientIP } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import { cacheGetOrSet } from "@/lib/cache";
import type { RoomsListResponse } from "@/types/api";
import type { Room } from "@/types/shared";
import { CACHE_TTL } from "@/constants";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RoomsListResponse | { error: string }>,
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

    logger.info("Fetching rooms list", {
      requestId,
      userId: session.user.id,
    });

    // Cache the rooms list since it doesn't change frequently
    const rooms = await cacheGetOrSet(
      `rooms-list-${session.user.id}`,
      async () => {
        // Fetch all rooms from database
        const roomsData = await prisma.rooms.findMany({
          select: {
            Name: true,
            ShortCode: true,
            Capacity: true,
          },
        });

        // Convert to our Room type format and filter out consultation/online rooms
        const roomsList: Room[] = roomsData
          .map((room) => ({
            name: room.Name,
            shortCode: room.ShortCode,
            capacity: room.Capacity,
          }))
          .filter(
            (room) =>
              !room.name.toLowerCase().includes("consultation") &&
              !room.name.toLowerCase().includes("online"),
          );

        // Sort by name lexicographically, ignoring case (matches Notepad++ "Sort Lines Lex. Ascending Ignoring Case")
        roomsList.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );

        return roomsList;
      },
      {
        ttl: CACHE_TTL.ROOMS * 1000,
        staleTime: CACHE_TTL.ROOMS * 0.8 * 1000,
      },
    );

    logger.info("Rooms list fetched successfully", {
      requestId,
      totalRooms: rooms.length,
    });

    // Set cache headers for client-side caching
    res.setHeader(
      "Cache-Control",
      `public, max-age=${CACHE_TTL.ROOMS}, stale-while-revalidate=${CACHE_TTL.ROOMS * 2}`,
    );

    return res.status(200).json({
      total: rooms.length,
      rooms,
    });
  } catch (error: any) {
    logger.error("Error in rooms API", error, { requestId, ip });

    // Handle database errors specially
    if (error.code) {
      throw new DatabaseError("Database query failed", {
        code: error.code,
        requestId,
      });
    }

    const { statusCode, body } = handleApiError(error);
    return res.status(statusCode).json(body as any);
  } finally {
    await prisma.$disconnect().catch((e) => {
      logger.error("Error disconnecting Prisma", e, { requestId });
    });
  }
}
