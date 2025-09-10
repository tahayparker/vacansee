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


def fetch_rooms_data() -> List[RoomInfo]:
    """
    Fetches rooms to include in the schedule from the 'Rooms' table.
    Returns a list of dictionaries, each containing 'short_code' and 'full_name'.
    Excludes rooms where the Name is exactly 'Consultation' or 'Online'.
    """
    print("Fetching rooms data from Supabase (excluding 'Consultation', 'Online')...")
    rooms_info: List[RoomInfo] = []
    try:
        # Fetch ShortCode and Name
        # Use .neq() to exclude specific exact names
        response = (
            supabase.table("Rooms")
            .select("ShortCode, Name")
            .neq("Name", "Consultation")
            .neq("Name", "Online")
            .order("Name", desc=False)
            .execute()
        )

        if response.data:
            for room in response.data:
                if room.get("ShortCode") and room.get("Name"):
                    rooms_info.append(
                        {"short_code": room["ShortCode"], "full_name": room["Name"]}
                    )
            print(f"Filtered rooms fetched: {len(rooms_info)}")
            # print(f"Rooms data: {rooms_info}")
            return rooms_info
        else:
            print("No rooms found matching the criteria.")
            return []
    except (APIError, RequestError) as db_err:
        print(
            f"Error fetching rooms: {type(db_err).__name__} - {db_err}", file=sys.stderr
        )
    except Exception as e:
        print(f"Unexpected error fetching rooms: {e}", file=sys.stderr)
        traceback.print_exc()

    raise RuntimeError("Failed to fetch rooms data.")


def fetch_all_timings() -> TimingsDict:
    """
    Fetches all timings and organizes them by Day and Full Room Name.
    Returns defaultdict: timings_by_day[day][full_room_name] = list of (start, end)
    """
    print("Fetching all timings from Supabase...")
    timings_by_day: TimingsDict = defaultdict(lambda: defaultdict(list))
    try:
        response = (
            supabase.table("Timings").select("Day, Room, StartTime, EndTime").execute()
        )

        if response.data:
            processed_count = 0
            for timing in response.data:
                day = timing.get("Day")
                full_room_name = timing.get("Room")
                start_time = timing.get("StartTime")
                end_time = timing.get("EndTime")

                if day and full_room_name and start_time and end_time:
                    timings_by_day[day][full_room_name].append((start_time, end_time))
                    processed_count += 1

            print(f"Fetched and processed {processed_count} valid timing entries.")
            return timings_by_day
        else:
            print("No timings found in the database.")
            return timings_by_day
    except (APIError, RequestError) as db_err:
        print(
            f"Error fetching timings: {type(db_err).__name__} - {db_err}",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"Unexpected error fetching timings: {e}", file=sys.stderr)
        traceback.print_exc()

    raise RuntimeError("Failed to fetch timings data.")


def parse_time_to_minutes(time_str: str) -> int:
    """
    Convert time string (HH:MM) to minutes since midnight for reliable comparison.
    Returns -1 for invalid time strings.
    """
    try:
        hours, minutes = map(int, time_str.split(':'))
        return hours * 60 + minutes
    except (ValueError, AttributeError):
        return -1


def is_slot_available(
    slot_start: str, slot_end: str, room_timings: List[Tuple[str, str]]
) -> bool:
    """
    Checks if a given time slot overlaps with any existing timings for a room.
    Uses minute-based comparison for more reliable results.
    """
    slot_start_min = parse_time_to_minutes(slot_start)
    slot_end_min = parse_time_to_minutes(slot_end)
    
    # If time parsing failed, assume slot is unavailable for safety
    if slot_start_min == -1 or slot_end_min == -1:
        return False
    
    for timing_start, timing_end in room_timings:
        timing_start_min = parse_time_to_minutes(timing_start)
        timing_end_min = parse_time_to_minutes(timing_end)
        
        # Skip invalid timing entries
        if timing_start_min == -1 or timing_end_min == -1:
            continue
            
        # Check for overlap: timing starts before slot ends AND timing ends after slot starts
        if timing_start_min < slot_end_min and timing_end_min > slot_start_min:
            return False
    return True


def generate_schedule_data(
    rooms_to_schedule: List[RoomInfo], all_timings: TimingsDict
) -> List[Dict[str, Any]]:
    """
    Generates schedule availability data for given rooms and timings.
    Uses Full Room Name for lookup, but outputs ShortCode in the JSON.
    """
    print("Starting schedule data generation...")
    schedule: List[Dict[str, Any]] = []

    for day in DAYS_OF_WEEK:
        print(f"Processing day: {day}")
        day_data: Dict[str, Any] = {"day": day, "rooms": []}
        timings_for_day: DefaultDict[str, List[Tuple[str, str]]] = all_timings.get(
            day, defaultdict(list)
        )

        for room_info in rooms_to_schedule:
            room_short_code = room_info["short_code"]
            room_full_name = room_info["full_name"]

            room_output_data = {"room": room_short_code, "availability": []}
            timings_for_this_room = timings_for_day.get(room_full_name, [])

            slot_count = len(TIME_SLOTS)
            for i in range(slot_count - 1):
                start_time = TIME_SLOTS[i]
                end_time = TIME_SLOTS[i + 1]
                available = is_slot_available(
                    start_time, end_time, timings_for_this_room
                )
                room_output_data["availability"].append(1 if available else 0)

            day_data["rooms"].append(room_output_data)

        schedule.append(day_data)

    print("Schedule data generation complete.")
    return schedule


def save_schedule_to_json(schedule_data: List[Dict[str, Any]]) -> bool:
    """
    Saves the generated schedule data to a JSON file only if there are substantial changes.
    Returns True on success.
    """
    print(f"Checking if schedule needs updating: {OUTPUT_JSON_PATH}...")
    
    # Check if existing file exists and compare with new data
    if OUTPUT_JSON_PATH.exists():
        try:
            with OUTPUT_JSON_PATH.open("r", encoding="utf-8") as file:
                existing_data = json.load(file)
            
            # Compare the data structures to see if there are meaningful differences
            if existing_data == schedule_data:
                print("No changes detected in schedule data. Skipping update.")
                return True
            
            # Calculate the number of availability changes to detect oscillation
            changes_count = 0
            if len(existing_data) == len(schedule_data):
                for i, day_data in enumerate(schedule_data):
                    if i < len(existing_data) and "rooms" in day_data and "rooms" in existing_data[i]:
                        existing_rooms = existing_data[i]["rooms"]
                        new_rooms = day_data["rooms"]
                        
                        for j, room_data in enumerate(new_rooms):
                            if j < len(existing_rooms) and "availability" in room_data and "availability" in existing_rooms[j]:
                                existing_avail = existing_rooms[j]["availability"]
                                new_avail = room_data["availability"]
                                
                                # Count differing availability slots
                                for k in range(min(len(existing_avail), len(new_avail))):
                                    if existing_avail[k] != new_avail[k]:
                                        changes_count += 1
            
            print(f"Detected {changes_count} availability changes.")
            
            # Only update if there are substantial changes (more than 10% of total slots)
            # This helps prevent minor oscillations from causing constant updates
            total_slots = len(TIME_SLOTS) * len(DAYS_OF_WEEK) * 50  # Approximate total slots
            threshold = max(10, total_slots * 0.1)  # At least 10 changes or 10% of total
            
            if changes_count < threshold:
                print(f"Changes ({changes_count}) below threshold ({threshold:.0f}). Skipping update to prevent oscillation.")
                return True
                
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            print(f"Warning: Could not compare with existing file: {e}. Proceeding with update.")
    
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
        room_info_list = fetch_rooms_data()
        all_timings_data = fetch_all_timings()

        if room_info_list:
            generated_schedule = generate_schedule_data(
                room_info_list, all_timings_data
            )
            final_success = save_schedule_to_json(generated_schedule)
        else:
            print("Cannot generate schedule as no rooms were found or fetched.")
            final_success = False

    except (RuntimeError, Exception) as main_err:
        print(f"Script failed: {main_err}", file=sys.stderr)
        final_success = False

    if final_success:
        print("Script finished successfully.")
        sys.exit(0)
    else:
        print("Script finished with errors.", file=sys.stderr)
        sys.exit(1)
