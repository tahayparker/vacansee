// src/pages/api/rooms.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
// Auth check can be added if room list shouldn't be public
// import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

// Define the structure for the response data
interface RoomListData {
  name: string; // Full Name
  shortCode: string; // Short Code
  capacity: number | null;
}

type ResponseData = RoomListData[] | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Optional: Add auth check if needed
  // const supabase = createSupabaseRouteHandlerClient(req, res);
  // const { data: { session } } = await supabase.auth.getSession();
  // if (!session) { return res.status(401).json({ error: 'Authentication required' }); }

  try {
    const rooms = await prisma.rooms.findMany({
      select: {
        Name: true,
        ShortCode: true,
        Capacity: true,
      },
      where: {
        AND: [
          { NOT: { Name: { contains: "consultation", mode: "insensitive" } } },
          { NOT: { Name: { contains: "online", mode: "insensitive" } } },
        ],
      },
      orderBy: {
        Name: "asc", // Order alphabetically by Name
      },
    });

    // Map to the desired response structure
    const responseData: RoomListData[] = rooms.map((room) => ({
      name: room.Name,
      shortCode: room.ShortCode,
      capacity: room.Capacity,
    }));

    console.log(`[API Rooms] Fetched ${responseData.length} rooms.`);
    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error("[API Rooms] Error fetching rooms:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
