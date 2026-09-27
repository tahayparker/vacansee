"""
Upload `public/raw_classes.csv` into the `RawTimings` table.

Mirrors the structure of `upload_timetable.py` so the operational pattern
is identical: truncate the target table, then chunked-insert via the
Supabase service-role client. RawTimings preserves the structure that
`upload_timetable.py` (and the legacy `_write_csv`) strip out:
Lecturer/Location are kept with ';' separators, TypeWithSection retains
the section suffix, and the GroupTag / AndOrText columns carry the
AND/OR / cohort information that vordo's parser consumes.

Run:
    python scripts/upload_raw_timings.py
"""

import csv
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List

from httpx import HTTPStatusError, RequestError
from postgrest.exceptions import APIError

from db_connection import get_supabase_client

# --- Configuration ---
SCRIPT_DIR = Path(__file__).parent
DEFAULT_CSV_PATH = SCRIPT_DIR.parent / "public" / "raw_classes.csv"
TARGET_TABLE = "RawTimings"
BATCH_SIZE = 500

EXPECTED_HEADERS = [
    "SubCode",
    "SubName",
    "Type",
    "TypeWithSection",
    "TypeFull",
    "SelectionOption",
    "Day",
    "StartTime",
    "EndTime",
    "Location",
    "Lecturer",
    "SemesterId",
]

# --- Supabase Client Initialization ---
try:
    supabase = get_supabase_client()
except ValueError as config_err:
    print(f"Configuration Error: {config_err}", file=sys.stderr)
    sys.exit("Exiting due to missing Supabase configuration.")
except Exception as init_err:
    print(f"Unexpected error initializing Supabase client: {init_err}", file=sys.stderr)
    sys.exit("Exiting due to Supabase client initialization failure.")


def delete_existing_rows() -> bool:
    """Deletes all existing rows from the target table using the service key."""
    print(f"Deleting all existing data from '{TARGET_TABLE}'...")
    try:
        resp = supabase.table(TARGET_TABLE).delete().gt("id", -1).execute()
        deleted = len(resp.data) if hasattr(resp, "data") else "?"
        print(f"Deleted {deleted} existing rows from '{TARGET_TABLE}'.")
        return True
    except (APIError, RequestError, HTTPStatusError) as db_err:
        print(
            f"Error deleting '{TARGET_TABLE}': {type(db_err).__name__} - {db_err}",
            file=sys.stderr,
        )
    except Exception as exc:
        print(f"Unexpected error deleting '{TARGET_TABLE}': {exc}", file=sys.stderr)
        traceback.print_exc()
    return False


def insert_from_csv(csv_path: Path) -> bool:
    print(f"Reading data from CSV: {csv_path}...")
    if not csv_path.is_file():
        print(f"Error: CSV file not found at {csv_path}", file=sys.stderr)
        return False

    rows_to_insert: List[Dict[str, Any]] = []
    total_read = 0
    inserted = 0
    skipped = 0

    try:
        with csv_path.open("r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)

            csv_headers = set(reader.fieldnames or [])
            expected = set(EXPECTED_HEADERS)
            if not expected.issubset(csv_headers):
                missing = expected - csv_headers
                extra = csv_headers - expected
                msg = "CSV header mismatch."
                if missing:
                    msg += f" Missing: {sorted(missing)}."
                if extra:
                    msg += f" Extra (allowed but unused): {sorted(extra)}."
                if missing:
                    raise ValueError(msg)
                print(msg)
            print(f"CSV headers OK: {reader.fieldnames}")

            for i, row in enumerate(reader):
                total_read += 1
                # Required keys; the optional GroupTag/AndOrText/SubName may
                # be empty strings and that is fine.
                required = ("SubCode", "TypeWithSection", "Day", "StartTime", "EndTime")
                if not all(row.get(k) for k in required):
                    print(f"Warning: skipping row {i + 1} — missing required: {row}")
                    skipped += 1
                    continue

                rows_to_insert.append({k: row.get(k, "") for k in EXPECTED_HEADERS})

                if len(rows_to_insert) >= BATCH_SIZE:
                    print(f"Inserting batch of {len(rows_to_insert)}...")
                    resp = supabase.table(TARGET_TABLE).insert(rows_to_insert).execute()
                    inserted += len(resp.data) if hasattr(resp, "data") else 0
                    rows_to_insert = []

            if rows_to_insert:
                print(f"Inserting final batch of {len(rows_to_insert)}...")
                resp = supabase.table(TARGET_TABLE).insert(rows_to_insert).execute()
                inserted += len(resp.data) if hasattr(resp, "data") else 0

        print("-" * 30)
        print("RawTimings Upload Summary:")
        print(f"  Total rows read   : {total_read}")
        print(f"  Rows skipped      : {skipped}")
        print(f"  Rows inserted     : {inserted}")
        print("-" * 30)
        return True

    except (ValueError, csv.Error) as csv_err:
        print(f"Error processing CSV: {csv_err}", file=sys.stderr)
    except (APIError, RequestError, HTTPStatusError) as db_err:
        print(
            f"Database insertion error: {type(db_err).__name__} - {db_err}",
            file=sys.stderr,
        )
        traceback.print_exc()
    except Exception as exc:
        print(f"Unexpected error during upload: {exc}", file=sys.stderr)
        traceback.print_exc()
    return False


if __name__ == "__main__":
    print("Starting RawTimings upload process...")
    if not delete_existing_rows():
        sys.exit(1)
    if not insert_from_csv(DEFAULT_CSV_PATH):
        sys.exit(1)
    print("Upload script finished successfully.")
    sys.exit(0)
