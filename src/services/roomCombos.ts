// src/services/roomCombos.ts
// Utilities to handle combined/individual room relationships in DB queries

export const COMBINED_ROOM_MAP: Record<string, [string, string]> = {
  "2.62/63": ["2.62", "2.63"],
  "2.66/67": ["2.66", "2.67"],
  "4.467": ["4.46", "4.47"],
  "5.134": ["5.13", "5.14"],
  "6.345": ["6.34", "6.35"],
};

export function getShortCodeFromName(roomName: string): string {
  if (!roomName) return "";
  const idx = roomName.indexOf("-");
  return (idx >= 0 ? roomName.slice(0, idx) : roomName).trim();
}

export function expandShortCodesForQuery(shortCode: string): string[] {
  if (!shortCode) return [];
  // If shortCode is a combined
  if (shortCode in COMBINED_ROOM_MAP) {
    const [a, b] = COMBINED_ROOM_MAP[shortCode];
    return Array.from(new Set([shortCode, a, b]));
  }
  // If shortCode is an individual under any combined
  for (const [combined, [a, b]] of Object.entries(COMBINED_ROOM_MAP)) {
    if (shortCode === a || shortCode === b) {
      return Array.from(new Set([shortCode, combined])); // include combined, not the sibling
    }
  }
  // Standalone
  return [shortCode];
}

export function expandBookedShortCodes(
  bookedShortCodes: Set<string>,
): Set<string> {
  const expanded = new Set(bookedShortCodes);
  for (const sc of bookedShortCodes) {
    if (sc in COMBINED_ROOM_MAP) {
      const [a, b] = COMBINED_ROOM_MAP[sc];
      expanded.add(a);
      expanded.add(b);
    } else {
      for (const [combined, [a, b]] of Object.entries(COMBINED_ROOM_MAP)) {
        if (sc === a || sc === b) {
          expanded.add(combined); // mark the combined as booked
        }
      }
    }
  }
  return expanded;
}

// Fetch full room names for a set of short codes using Prisma Rooms table
// "prismaLike" should have shape prisma.rooms.findMany
export async function getRoomNamesForShortCodes(
  prismaLike: any,
  shortCodes: string[],
): Promise<string[]> {
  if (!shortCodes || shortCodes.length === 0) return [];
  const rows = await prismaLike.rooms.findMany({
    where: { ShortCode: { in: Array.from(new Set(shortCodes)) } },
    select: { Name: true },
  });
  return rows.map((r: { Name: string }) => r.Name);
}
