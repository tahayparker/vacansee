# \scripts\generate_schedule.py
# pylint: disable=invalid-name, broad-except, logging-fstring-interpolation

import json
import sys
import traceback
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Any, Tuple, DefaultDict  # Added type hints

# Third-party imports (adjust based on actual client if needed)
from postgrest.exceptions import APIError
from httpx import RequestError

# Local imports
from db_connection import get_supabase_client

# --- Constants ---
DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]
TIME_SLOTS = [
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
]
# Mapping of combined rooms to their individual components.
# Rule:
# - If a combined room is busy, both individual rooms are busy.
# - If one individual room is busy, the combined room is busy, but the other individual room is not.
COMBINED_ROOM_MAP: Dict[str, Tuple[str, str]] = {
    "2.62/63": ("2.62", "2.63"),
    "2.66/67": ("2.66", "2.67"),
    "4.467": ("4.46", "4.47"),
    "5.134": ("5.13", "5.14"),
    "6.345": ("6.34", "6.35"),
}
SCRIPT_DIR = Path(__file__).parent
OUTPUT_JSON_PATH = SCRIPT_DIR.parent / "public" / "scheduleData.json"

# --- Supabase Client Initialization ---
try:
    supabase = get_supabase_client()
except ValueError as config_err:
    print(f"Configuration Error: {config_err}", file=sys.stderr)
    sys.exit("Exiting due to missing Supabase configuration.")
except Exception as init_err:
    print(f"Unexpected error initializing Supabase client: {init_err}", file=sys.stderr)
    sys.exit("Exiting due to Supabase client initialization failure.")

# --- Functions ---

RoomInfo = Dict[str, str]
TimingsDict = DefaultDict[str, DefaultDict[str, List[Tuple[str, str]]]]


def fetch_rooms_data_paginated(page_size=100) -> List[RoomInfo]:
    """
    Fetches rooms from Supabase in paginated fashion. Returns list of dicts with 'short_code' and 'full_name'.
    """
    print(f"Fetching rooms data from Supabase with pagination (page size={page_size})...")
    rooms_info: List[RoomInfo] = []
    offset = 0
    while True:
        try:
            response = (
                supabase.table("Rooms")
                .select("ShortCode, Name")
                .neq("Name", "Consultation")
                .neq("Name", "Online")
                .order("Name", desc=False)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            if response.data:
                for room in response.data:
                    if room.get("ShortCode") and room.get("Name"):
                        rooms_info.append({"short_code": room["ShortCode"], "full_name": room["Name"]})
                if len(response.data) < page_size:
                    break
                offset += page_size
            else:
                break
        except (APIError, RequestError) as db_err:
            print(f"Error fetching rooms: {type(db_err).__name__} - {db_err}", file=sys.stderr)
            break
        except Exception as e:
            print(f"Unexpected error fetching rooms: {e}", file=sys.stderr)
            traceback.print_exc()
            break
    print(f"Total rooms fetched: {len(rooms_info)}")
    return rooms_info


def fetch_all_timings_paginated(page_size=500) -> TimingsDict:
    """
    Fetches all timings from Supabase in paginated fashion. Returns timings_by_day[day][full_room_name] = list of (start, end)
    """
    print(f"Fetching all timings from Supabase with pagination (page size={page_size})...")
    timings_by_day: TimingsDict = defaultdict(lambda: defaultdict(list))
    offset = 0
    processed_count = 0
    while True:
        try:
            response = (
                supabase.table("Timings")
                .select("Day, Room, StartTime, EndTime")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            if response.data:
                for timing in response.data:
                    day = timing.get("Day")
                    full_room_name = timing.get("Room")
                    start_time = timing.get("StartTime")
                    end_time = timing.get("EndTime")
                    if day and full_room_name and start_time and end_time:
                        timings_by_day[day][full_room_name].append((start_time, end_time))
                        processed_count += 1
                if len(response.data) < page_size:
                    break
                offset += page_size
            else:
                break
        except (APIError, RequestError) as db_err:
            print(f"Error fetching timings: {type(db_err).__name__} - {db_err}", file=sys.stderr)
            break
        except Exception as e:
            print(f"Unexpected error fetching timings: {e}", file=sys.stderr)
            traceback.print_exc()
            break
    print(f"Fetched and processed {processed_count} valid timing entries.")
    return timings_by_day


def is_slot_available(
    slot_start: str, slot_end: str, room_timings: List[Tuple[str, str]]
) -> bool:
    """
    Checks if a given time slot overlaps with any existing timings for a room.
    """
    for timing_start, timing_end in room_timings:
        if timing_start < slot_end and timing_end > slot_start:
            return False
    return True


def generate_schedule_data_from_csv(csv_path: Path) -> List[Dict[str, Any]]:
    """
    Generates schedule availability data from CSV file. Supabase is used as fallback if CSV is missing or empty.
    """
    print(f"Generating schedule data from CSV: {csv_path}")
    import csv
    schedule: List[Dict[str, Any]] = []
    # Build: {day: {room: [(start, end), ...]}}
    timings_by_day_room = defaultdict(lambda: defaultdict(list))
    rooms_set = set()
    try:
        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                day = row.get("Day")
                room = row.get("Room")
                start = row.get("StartTime")
                end = row.get("EndTime")
                if day and room and start and end:
                    timings_by_day_room[day][room].append((start, end))
                    rooms_set.add(room)
    except Exception as e:
        print(f"Error reading CSV: {e}. Falling back to Supabase.")
        # fallback to Supabase
        rooms_info = fetch_rooms_data_paginated()
        timings_by_day_room = fetch_all_timings_paginated()
        rooms_set = set()
        for day in timings_by_day_room:
            for room in timings_by_day_room[day]:
                rooms_set.add(room)

    # Helper to extract short code from full room name
    def get_room_short_code(room_name: str) -> str:
        """Extract short code (before first dash) from room name."""
        return room_name.split("-")[0].strip() if "-" in room_name else room_name.strip()

    # Build a mapping from short code to full room names
    shortcode_to_rooms: Dict[str, List[str]] = defaultdict(list)
    for room in rooms_set:
        short_code = get_room_short_code(room)
        shortcode_to_rooms[short_code].append(room)

    # Expand rooms_set to include mapped counterparts
    def expand_rooms_set(base_rooms: set) -> set:
        expanded = set(base_rooms)
        base_shortcodes = {get_room_short_code(r) for r in base_rooms}
        
        for combined_code, (ind_a_code, ind_b_code) in COMBINED_ROOM_MAP.items():
            # If combined room exists in data, add both individuals if they exist
            if combined_code in base_shortcodes:
                expanded.update(shortcode_to_rooms.get(ind_a_code, []))
                expanded.update(shortcode_to_rooms.get(ind_b_code, []))
            # If any individual exists, add the combined room if it exists
            if ind_a_code in base_shortcodes or ind_b_code in base_shortcodes:
                expanded.update(shortcode_to_rooms.get(combined_code, []))
        return expanded

    rooms_set = expand_rooms_set(rooms_set)

    for day in DAYS_OF_WEEK:
        print(f"Processing day: {day}")
        day_data: Dict[str, Any] = {"day": day, "rooms": []}
        timings_for_day = dict(timings_by_day_room.get(day, {}))  # shallow copy

        # Build effective timings for the day honoring combined/individual rules
        effective_timings = defaultdict(list)
        # Start with original timings
        for room_name, intervals in timings_for_day.items():
            # de-duplicate while preserving as list of tuples
            unique = list({(s, e) for (s, e) in intervals})
            effective_timings[room_name].extend(sorted(unique))

        # Apply mapping rules using short codes to match full room names
        for combined_code, (ind_a_code, ind_b_code) in COMBINED_ROOM_MAP.items():
            # Find all full room names that match these short codes
            combined_rooms = shortcode_to_rooms.get(combined_code, [])
            ind_a_rooms = shortcode_to_rooms.get(ind_a_code, [])
            ind_b_rooms = shortcode_to_rooms.get(ind_b_code, [])

            # Collect original busy intervals for each category
            orig_combined = []
            for room in combined_rooms:
                orig_combined.extend(timings_for_day.get(room, []))
            
            orig_a = []
            for room in ind_a_rooms:
                orig_a.extend(timings_for_day.get(room, []))
            
            orig_b = []
            for room in ind_b_rooms:
                orig_b.extend(timings_for_day.get(room, []))

            # Rule: Combined becomes busy if EITHER individual is busy (union)
            union_intervals = set(orig_combined + orig_a + orig_b)
            for combined_room in combined_rooms:
                for s, e in union_intervals:
                    if (s, e) not in effective_timings[combined_room]:
                        effective_timings[combined_room].append((s, e))

            # Rule: Each individual inherits the combined's busy intervals
            combined_intervals = set(orig_combined)
            for ind_room in ind_a_rooms:
                for s, e in combined_intervals:
                    if (s, e) not in effective_timings[ind_room]:
                        effective_timings[ind_room].append((s, e))
            
            for ind_room in ind_b_rooms:
                for s, e in combined_intervals:
                    if (s, e) not in effective_timings[ind_room]:
                        effective_timings[ind_room].append((s, e))

        # Now compute availability using effective_timings and the expanded rooms_set
        for room in sorted(rooms_set):
            room_output_data = {"room": room, "availability": []}
            timings_for_this_room = effective_timings.get(room, [])
            slot_count = len(TIME_SLOTS)
            for i in range(slot_count - 1):
                start_time = TIME_SLOTS[i]
                end_time = TIME_SLOTS[i + 1]
                available = is_slot_available(start_time, end_time, timings_for_this_room)
                room_output_data["availability"].append(1 if available else 0)
            day_data["rooms"].append(room_output_data)
        schedule.append(day_data)
    print("Schedule data generation complete.")
    return schedule


def save_schedule_to_json(schedule_data: List[Dict[str, Any]]) -> bool:
    """Saves the generated schedule data to a JSON file. Returns True on success."""
    print(f"Saving schedule data to JSON file: {OUTPUT_JSON_PATH}...")
    try:
        OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
        with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as file:
            json.dump(schedule_data, file, indent=2)
        print(f"Schedule data saved successfully to {OUTPUT_JSON_PATH.resolve()}")
        return True
    except (IOError, OSError) as file_err:
        print(f"Error saving JSON file: {file_err}", file=sys.stderr)
    except TypeError as json_err:
        print(f"Error converting data to JSON: {json_err}", file=sys.stderr)
    except Exception as e:
        print(f"An unexpected error occurred during JSON saving: {e}", file=sys.stderr)
        traceback.print_exc()

    return False


# --- Main Execution ---
if __name__ == "__main__":
    print("Starting schedule generation process...")
    final_success = False
    try:
        csv_path = SCRIPT_DIR.parent / "public" / "classes.csv"
        generated_schedule = generate_schedule_data_from_csv(csv_path)
        final_success = save_schedule_to_json(generated_schedule)
    except (RuntimeError, Exception) as main_err:
        print(f"Script failed: {main_err}", file=sys.stderr)
        final_success = False
    if final_success:
        print("Script finished successfully.")
        sys.exit(0)
    else:
        print("Script finished with errors.", file=sys.stderr)
        sys.exit(1)
