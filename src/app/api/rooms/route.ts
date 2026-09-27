/**
 * Rooms List API Route (App Router)
 *
 * Returns a list of all rooms with their details.
 * Excludes consultation and online rooms.
 *
 * @method GET
 * @auth Required
 */

import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { SECURITY_HEADERS, getClientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";
import { handleApiError, DatabaseError } from "@/lib/errors";
import { logger, generateRequestId } from "@/lib/logger";
import { cacheGetOrSet } from "@/lib/cache";
import type { Room } from "@/types/shared";
import { CACHE_TTL } from "@/constants";

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

    logger.info("Fetching rooms list", {
      requestId,
      userId: user.id,
    });

    const rooms = await cacheGetOrSet(
      `rooms-list-${user.id}`,
      async () => {
        const roomsData = await prisma.rooms.findMany({
          select: {
            Name: true,
            ShortCode: true,
            Capacity: true,
          },
        });

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

    return NextResponse.json(
      {
        total: rooms.length,
        rooms,
      },
      {
        headers: {
          ...SECURITY_HEADERS,
          "Cache-Control": `public, max-age=${CACHE_TTL.ROOMS}, stale-while-revalidate=${CACHE_TTL.ROOMS * 2}`,
        },
      },
    );
  } catch (error: any) {
    logger.error("Error in rooms API", error, { requestId, ip });

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
