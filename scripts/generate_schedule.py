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

    for day in DAYS_OF_WEEK:
        print(f"Processing day: {day}")
        day_data: Dict[str, Any] = {"day": day, "rooms": []}
        timings_for_day = timings_by_day_room.get(day, {})
        for room in sorted(rooms_set):
            room_output_data = {"room": room, "availability": []}
            timings_for_this_room = timings_for_day.get(room, [])
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
