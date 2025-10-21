/**
 * Room Service
 *
 * Centralized business logic for room operations including
 * filtering, grouping, and availability calculations
 */

import { ROOM_GROUPINGS, EXCLUDED_ROOM_PATTERNS } from "@/constants";
import type { Room } from "@/types/shared";

/**
 * Filter out rooms based on exclusion patterns
 *
 * @param rooms - Array of rooms to filter
 * @returns Filtered array of rooms
 */
export function filterExcludedRooms(rooms: Room[]): Room[] {
  return rooms.filter((room) => {
    const roomNameLower = room.name.toLowerCase();
    return !EXCLUDED_ROOM_PATTERNS.some((pattern) =>
      roomNameLower.includes(pattern.toLowerCase()),
    );
  });
}

/**
 * Apply room grouping logic
 * When a main room is unavailable, hide its sub-rooms
 *
 * @param rooms - Array of available rooms
 * @returns Filtered array with grouped rooms removed
 */
export function applyRoomGrouping(rooms: Room[]): Room[] {
  // Create a set of available room short codes for fast lookup
  const availableShortCodes = new Set(rooms.map((room) => room.shortCode));

  // Track which rooms to exclude based on grouping
  const roomsToExclude = new Set<string>();

  // Check each main room in groupings
  Object.entries(ROOM_GROUPINGS).forEach(([mainRoom, subRooms]) => {
    // If main room is NOT available, exclude its sub-rooms
    if (!availableShortCodes.has(mainRoom)) {
      subRooms.forEach((subRoom) => roomsToExclude.add(subRoom));
    }
  });

  // Filter out the excluded rooms
  return rooms.filter((room) => !roomsToExclude.has(room.shortCode));
}

/**
 * Extract room short code from full room name
 *
 * @param roomIdentifier - Full room name or identifier
 * @returns Short code extracted from the room name
 *
 * @example
 * ```ts
 * getRoomShortCode("4.467 - Lecture Hall A") // Returns "4.467"
 * getRoomShortCode("5.13") // Returns "5.13"
 * ```
 */
export function getRoomShortCode(
  roomIdentifier: string | null | undefined,
): string {
  if (!roomIdentifier) return "";

  // Split by common delimiters and return the first part
  const parts = roomIdentifier.split(/[- /]/);
  return parts[0].trim();
}

/**
 * Sort rooms by their short code
 *
 * @param rooms - Array of rooms to sort
 * @returns Sorted array of rooms
 */
export function sortRoomsByShortCode(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const codeA = getRoomShortCode(a.shortCode);
    const codeB = getRoomShortCode(b.shortCode);
    return codeA.localeCompare(codeB, undefined, { numeric: true });
  });
}

/**
 * Process raw room data through all filters and grouping logic
 *
 * This is the main function that should be used for preparing room lists
 * for display. It applies all necessary business rules.
 *
 * @param rooms - Raw array of rooms from database
 * @returns Processed and sorted array of rooms
 */
export function processRoomsList(rooms: Room[]): Room[] {
  // Step 1: Filter out excluded rooms
  let processedRooms = filterExcludedRooms(rooms);

  // Step 2: Apply room grouping logic
  processedRooms = applyRoomGrouping(processedRooms);

  // Step 3: Sort by short code
  processedRooms = sortRoomsByShortCode(processedRooms);

  return processedRooms;
}

/**
 * Check if a room name matches exclusion patterns
 *
 * @param roomName - Name of the room to check
 * @returns True if room should be excluded
 */
export function isRoomExcluded(roomName: string): boolean {
  const nameLower = roomName.toLowerCase();
  return EXCLUDED_ROOM_PATTERNS.some((pattern) =>
    nameLower.includes(pattern.toLowerCase()),
  );
}

/**
 * Get main room for a given sub-room (if it exists in groupings)
 *
 * @param shortCode - Short code of the room to check
 * @returns Main room short code if found, undefined otherwise
 */
export function getMainRoomForSubRoom(shortCode: string): string | undefined {
  for (const [mainRoom, subRooms] of Object.entries(ROOM_GROUPINGS)) {
    if (subRooms.includes(shortCode)) {
      return mainRoom;
    }
  }
  return undefined;
}

/**
 * Get sub-rooms for a given main room
 *
 * @param shortCode - Short code of the main room
 * @returns Array of sub-room short codes, or empty array if not a main room
 */
export function getSubRoomsForMainRoom(shortCode: string): string[] {
  return ROOM_GROUPINGS[shortCode] || [];
}

/**
 * Check if a room is a main room in the grouping system
 *
 * @param shortCode - Short code of the room to check
 * @returns True if room is a main room with sub-rooms
 */
export function isMainRoom(shortCode: string): boolean {
  return shortCode in ROOM_GROUPINGS;
}

/**
 * Check if a room is a sub-room in the grouping system
 *
 * @param shortCode - Short code of the room to check
 * @returns True if room is a sub-room of a larger room
 */
export function isSubRoom(shortCode: string): boolean {
  return getMainRoomForSubRoom(shortCode) !== undefined;
}
