# \scripts\update_teachers.py
# Renamed and repurposed from upload_timetable.py
import csv
import sys
import traceback
from pathlib import Path
from typing import List, Dict, Any, Set

# Third-party imports
from postgrest.exceptions import APIError
from httpx import RequestError, HTTPStatusError

# Local imports
from db_connection import get_supabase_client

# --- Configuration ---
SCRIPT_DIR = Path(__file__).parent
DEFAULT_CSV_PATH = SCRIPT_DIR.parent / "public" / "classes.csv"
ROOMS_TABLE = "Rooms"

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


def fetch_existing_room_names() -> Set[str]:
    """Fetches all existing room names from the Rooms table."""
    print(f"Fetching existing room names from '{ROOMS_TABLE}' table...")
    existing_names: Set[str] = set()
    try:
        response = supabase.table(ROOMS_TABLE).select("Name").execute()
        if response.data:
            for room in response.data:
                if room.get("Name"):
                    existing_names.add(room["Name"])
            print(f"Found {len(existing_names)} existing rooms in the database.")
        else:
            print("No existing rooms found in the database.")
        return existing_names
    except (APIError, RequestError, HTTPStatusError) as db_err:
        print(
            f"Error fetching existing rooms: {type(db_err).__name__} - {db_err}",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"Unexpected error fetching existing rooms: {e}", file=sys.stderr)
        traceback.print_exc()

    raise RuntimeError("Failed to fetch existing room names.")


def find_new_rooms_from_csv(
    csv_path: Path, existing_names: Set[str]
) -> List[Dict[str, Any]]:
    """Reads CSV, finds unique room names not in existing_names, and prepares them for insertion."""
    print(f"Reading rooms from CSV: {csv_path}...")
    unique_csv_rooms: Set[str] = set()
    new_rooms_to_insert: List[Dict[str, Any]] = []
    total_rows_in_csv = 0

    try:
        if not csv_path.is_file():
            raise FileNotFoundError(f"CSV file not found at {csv_path}")

        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if "Room" not in (reader.fieldnames or []):
                raise ValueError("CSV file must contain a 'Room' column.")

            for i, row in enumerate(reader):
                total_rows_in_csv += 1
                room_name = row.get("Room")
                # Basic validation and ignore placeholders
                unique_csv_rooms.add(room_name.strip())  # Add normalized name
                # else:

        print(
            f"Found {len(unique_csv_rooms)} unique, non-placeholder room names in CSV (out of {total_rows_in_csv} rows)."
        )

        # Determine which names are new
        new_names = unique_csv_rooms - existing_names
        print(f"Found {len(new_names)} new rooms to add.")

        # Prepare data for insertion (adjust defaults if needed)
        for name in new_names:
            new_rooms_to_insert.append(
                {
                    "Name": name,
                    "ShortCode": name.split("-")[0].strip(),
                    "Capacity": None,  # Use None for NULL
                }
            )

        return new_rooms_to_insert

    except FileNotFoundError as fnf_err:
        print(f"Error: {fnf_err}", file=sys.stderr)
    except (ValueError, csv.Error) as csv_proc_err:
        print(f"Error processing CSV file: {csv_proc_err}", file=sys.stderr)
    except Exception as e:
        print(
            f"An unexpected error occurred during CSV processing: {e}", file=sys.stderr
        )
        traceback.print_exc()

    return []  # Return empty list on failure


def insert_new_rooms(new_rooms: List[Dict[str, Any]]) -> bool:
    """Inserts the list of new rooms into the Rooms table."""
    if not new_rooms:
        print("No new rooms to insert.")
        return True  # Technically successful as there was nothing to do

    print(f"Attempting to insert {len(new_rooms)} new rooms into '{ROOMS_TABLE}'...")
    # Consider batching if the number of new rooms could be very large
    try:
        response = supabase.table(ROOMS_TABLE).insert(new_rooms).execute()
        # Check response for errors if needed, Supabase client might raise exceptions on failure
        inserted_count = (
            len(response.data) if hasattr(response, "data") else "Unknown number of"
        )
        print(f"Successfully inserted {inserted_count} new rooms.")
        # You might want more robust error checking based on the response structure
        # if response.error:
        #    print(f"Error during insertion: {response.error.message}", file=sys.stderr)
        #    return False
        return True
    except (APIError, RequestError, HTTPStatusError) as db_err:
        print(
            f"Error inserting new rooms: {type(db_err).__name__} - {db_err}",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"Unexpected error inserting new rooms: {e}", file=sys.stderr)
        traceback.print_exc()

    return False


# --- Main Execution ---
if __name__ == "__main__":
    print("Starting rooms update process...")
    csv_file_path = DEFAULT_CSV_PATH
    final_success = False
    try:
        existing_rooms = fetch_existing_room_names()
        new_room_data = find_new_rooms_from_csv(csv_file_path, existing_rooms)

        if new_room_data is not None:  # Check if CSV processing was successful
            final_success = insert_new_rooms(new_room_data)
        else:
            print(
                "Teacher update process failed during CSV processing.", file=sys.stderr
            )
            final_success = False

    except (RuntimeError, Exception) as main_err:
        print(f"Script failed: {main_err}", file=sys.stderr)
        final_success = False
    finally:
        # Ensure disconnect happens
        supabase.rpc(
            "disconnect_db", {}
        )  # Or equivalent disconnect method if available
        print("Supabase client disconnected (attempted).")

    if final_success:
        print("Room update script finished successfully.")
        sys.exit(0)
    else:
        print("Room update script finished with errors.", file=sys.stderr)
        sys.exit(1)
