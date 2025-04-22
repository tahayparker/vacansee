# \scripts\scrape_timetable.py
# pylint: disable=invalid-name, too-many-lines, too-many-locals, too-many-statements
# pylint: disable=too-many-branches, broad-except

import argparse
import csv
import json
import random
import re
import sys
import time
import datetime
import traceback
from pathlib import Path
from typing import Optional, Dict, List, Any

# Third-party imports
import cloudscraper
from bs4 import BeautifulSoup, Tag  # Added Tag for type hinting
from httpx import RequestError, HTTPStatusError, TimeoutException
from postgrest.exceptions import APIError  # If using supabase-py v1 or similar

# Local imports
from db_connection import get_supabase_client

# --- Constants ---
BASE_URL = "https://my.uowdubai.ac.ae/timetable/viewer"
DEFAULT_TIMEOUT = 45
MAX_RETRIES = 5
LINE_LENGTH_LIMIT = 99


# --- Helper Function ---
def normalize_whitespace(text: Optional[str]) -> str:
    """
    Replaces consecutive whitespace chars with a single space
    and strips leading/trailing whitespace. Returns empty string if input is None.
    """
    if not isinstance(text, str):
        return ""  # Return empty string for None or non-string types
    return " ".join(text.split())


# --- Supabase Client Initialization ---
try:
    supabase = get_supabase_client()
    print("Connected to Supabase (using Service Role Key - RLS bypassed).")
except ValueError as exc:
    print(f"Configuration Error: {exc}")
    sys.exit("Exiting due to missing Supabase configuration.")
except Exception as exc:  # Catch other potential init errors
    print(f"Unexpected error initializing Supabase client: {exc}")
    sys.exit("Exiting due to Supabase client initialization failure.")


# --- Fetch Room Mapping (ShortCode -> Name) ---
def fetch_room_mapping() -> Dict[str, str]:
    """Fetches room ShortCode to Name mapping from Supabase"""
    print("Fetching room mapping (ShortCode -> Name) from Supabase...")
    room_mapping: Dict[str, str] = {}
    try:
        response = (
            supabase.table("Rooms")
            .select("Name, ShortCode")
            .neq("Name", "%Consultation%")
            .neq("Name", "%Online%")
            .execute()
        )

        if response.data:
            for row in response.data:
                short_code = row.get("ShortCode")
                name = row.get("Name")
                # Normalize both before storing/using
                if short_code and name:
                    norm_short_code = normalize_whitespace(short_code)
                    norm_name = normalize_whitespace(name)
                    if (
                        norm_short_code and norm_name
                    ):  # Ensure not empty after normalize
                        # ShortCode is key, Name is value
                        room_mapping[norm_short_code] = norm_name

            print(
                f"Room mapping (ShortCode -> Name) fetched: "
                f"{len(room_mapping)} entries."
            )
            # Sort keys by length descending - helps prioritize longer matches
            sorted_keys = sorted(room_mapping.keys(), key=len, reverse=True)
            sorted_room_mapping = {key: room_mapping[key] for key in sorted_keys}
            # print(f"Mapping fetched (sorted): {sorted_room_mapping}")
            return sorted_room_mapping
        else:
            print(
                "Warning: No rooms found in Supabase matching criteria " "for mapping."
            )
            return {}

    except APIError as api_exc:
        print(f"Supabase API Error fetching room mapping: {api_exc}")
        print(f"  Details: {getattr(api_exc, 'details', 'N/A')}")
        return {}
    except RequestError as req_exc:
        print(f"Network Error fetching room mapping: {req_exc}")
        return {}
    except Exception as gen_exc:  # Catch other unexpected errors during fetch
        print(f"Unexpected error fetching room mapping: {gen_exc}")
        traceback.print_exc()
        return {}


# Global room mapping fetched once (Normalized ShortCode -> Normalized Name), sorted
ROOM_MAPPING: Dict[str, str] = fetch_room_mapping()
# --- End Mapping Fetch ---


class TimetableScraper:
    """Scrapes timetable data from UOW Dubai website."""

    def __init__(self):
        """Initialize scraper with cloudscraper instance and headers."""
        self.scraper = self.create_scraper()
        # self.semester_cache = {} # Consider removing if unused
        self.headers = {
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;" "q=0.9,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": BASE_URL.split("/timetable", maxsplit=1)[0] + "/",
            "DNT": "1",
            "User-Agent": self.random_user_agent(),
        }
        print("TimetableScraper initialized.")

    def create_scraper(self) -> cloudscraper.CloudScraper:
        """Create a new cloudscraper instance."""
        print("Creating CloudScraper instance...")
        return cloudscraper.create_scraper(
            browser={
                "browser": "chrome",
                "platform": "windows",
                "desktop": True,
                "mobile": False,
            },
            delay=random.uniform(3, 7),
        )

    def random_user_agent(self) -> str:
        """Return a random user agent string from a predefined list."""
        user_agents = [
            (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
            ),
            (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 "
                "Safari/605.1.15"
            ),
            (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:107.0) "
                "Gecko/20100101 Firefox/107.0"
            ),
            (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
            ),
        ]
        return random.choice(user_agents)

    def get_current_semester_text(self) -> str:
        # pylint: disable=too-many-return-statements
        """
        Return the current semester text based on date.
        Normalizes the generated text just in case.
        """
        today = datetime.datetime.now()
        year = today.year
        current_month = today.month
        current_week = (today.day - 1) // 7 + 1

        semester_text = "Unknown Semester"  # Default

        if current_month in [1, 2]:
            semester_text = f"Winter {year}"
        elif current_month == 3:
            semester_text = f"Winter {year}" if current_week <= 3 else f"Spring {year}"
        elif current_month in [4, 5]:
            semester_text = f"Spring {year}"
        elif current_month == 6:
            semester_text = f"Spring {year}"
        elif current_month == 7:
            semester_text = f"Summer {year}"
        elif current_month == 8:
            semester_text = f"Summer {year}" if current_week <= 2 else f"Autumn {year}"
        elif current_month in [9, 10, 11]:
            semester_text = f"Autumn {year}"
        elif current_month == 12:
            semester_text = f"Autumn {year}" if current_week <= 1 else f"Winter {year}"

        if semester_text == "Unknown Semester":
            print("Warning: Could not determine semester for current date.")

        return normalize_whitespace(semester_text)  # Normalize before returning

    def fetch_page(
        self, url: str, max_retries: int = MAX_RETRIES, timeout: int = DEFAULT_TIMEOUT
    ) -> cloudscraper.requests.Response:
        """Fetch a page with retries and handling specific errors."""
        print(f"Attempting to fetch: {url}")
        last_exception: Optional[Exception] = None  # Keep track of the last error

        for attempt in range(max_retries):
            try:
                self.headers["User-Agent"] = self.random_user_agent()
                ua_short = self.headers["User-Agent"][:30]
                print(f"  Attempt {attempt+1}/{max_retries} with UA: {ua_short}...")

                response = self.scraper.get(url, headers=self.headers, timeout=timeout)
                response.raise_for_status()

                print(f"  Successfully fetched {url} (Status: {response.status_code})")
                time.sleep(random.uniform(1, 4))
                return response

            # Specific error handling
            except cloudscraper.exceptions.CloudflareChallengeError as cf_exc:
                print(f"  Attempt {attempt+1} failed: Cloudflare challenge. {cf_exc}")
                print("  Recreating scraper and waiting longer...")
                self.scraper = self.create_scraper()
                wait_time = random.uniform(10, 25)
                time.sleep(wait_time)
                last_exception = cf_exc
            except HTTPStatusError as http_err:
                print(
                    f"  Attempt {attempt+1} failed: HTTP Error "
                    f"{http_err.response.status_code} for url {url}. {http_err}"
                )
                last_exception = http_err
            except TimeoutException as timeout_err:
                print(f"  Attempt {attempt+1} failed: Request timed out. {timeout_err}")
                last_exception = timeout_err
            except RequestError as req_err:
                print(f"  Attempt {attempt+1} failed: Network error. {req_err}")
                last_exception = req_err
            except Exception as exc:
                print(f"  Attempt {attempt+1} failed: Unexpected error. {exc}")
                traceback.print_exc()
                last_exception = exc

            # Wait before retrying if it wasn't the last attempt
            if attempt < max_retries - 1:
                wait_time = random.uniform(5, 15) * (attempt + 1)
                print(f"  Waiting {wait_time:.2f} seconds before retrying...")
                time.sleep(wait_time)
            else:
                print(f"  Max retries reached for {url}. Raising last error.")
                # Raise the last exception encountered if all retries fail
                if last_exception:
                    raise last_exception
                # Should not happen if loop ran, but safety fallback
                raise RuntimeError(
                    f"Failed to fetch {url} after {max_retries} "
                    "attempts, but no exception was recorded."
                )

        # Should only be reached if max_retries is 0 (or logic error)
        raise RuntimeError(f"Loop finished unexpectedly for fetch_page({url}).")

    def extract_semester_ids(self, html_content: str) -> Dict[str, str]:
        """Extract semester IDs and labels from the base page HTML."""
        print("Extracting semester IDs...")
        semesters: Dict[str, str] = {}
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            selector = "div.custom-control.custom-radio, div.form-check"

            for div in soup.select(selector):
                radio: Optional[Tag] = div.find(
                    "input", {"type": "radio", "name": re.compile(r"semester", re.I)}
                )
                label: Optional[Tag] = div.find("label")

                if radio and label and radio.has_attr("value"):
                    # Get text and normalize whitespace immediately
                    label_text = normalize_whitespace(label.get_text())
                    value = radio["value"]
                    if label_text and value:  # Ensure not empty after normalizing
                        semesters[label_text] = value
                        # Log the *normalized* label found
                        print(f"  Found semester: '{label_text}' -> ID: {value}")

            if not semesters:
                print(
                    "Warning: Could not find any semester radio buttons using "
                    f"selector '{selector}'."
                )
            return semesters
        except Exception as exc:
            print(f"Error parsing HTML for semester IDs: {exc}")
            traceback.print_exc()
            return {}

    def get_target_semester_id(self, base_page_html: str) -> Optional[str]:
        """Find the semester ID that matches the current target semester."""
        print("Determining target semester ID...")
        # Ensure target text is also normalized for comparison
        target_semester_text = self.get_current_semester_text()
        print(f"  Target semester text (normalized): '{target_semester_text}'")
        available_semesters = self.extract_semester_ids(base_page_html)

        if not available_semesters:
            print("Error: No semesters found on the page.")
            return None

        # Comparison uses lower case but relies on normalized spacing
        target_lower = target_semester_text.lower()

        # Try exact match first
        for label, sid in available_semesters.items():
            if target_lower == label.lower():
                print(f"  Found exact match: '{label}' -> ID: {sid}")
                return sid

        # Try partial match (contains)
        for label, sid in available_semesters.items():
            if target_lower in label.lower():
                print(f"  Found partial match: '{label}' -> ID: {sid}")
                return sid

        # Fallback to the *first* available semester if no match found
        try:
            fallback_sid = next(iter(available_semesters.values()))
            fallback_label = next(
                key
                for key, value in available_semesters.items()
                if value == fallback_sid
            )
            print(
                f"  Warning: No match found for '{target_semester_text}'. "
                f"Falling back to first available: '{fallback_label}' -> "
                f"ID: {fallback_sid}"
            )
            return fallback_sid
        except StopIteration:
            print(
                f"  Warning: No match found for '{target_semester_text}' "
                "and no fallback available."
            )
            return None

    def extract_timetable_data(self, timetable_page_html: str) -> Optional[List[Dict]]:
        """Extract timetable data JSON embedded in the page's script tags."""
        print("Extracting timetable data from HTML script...")
        try:
            soup = BeautifulSoup(timetable_page_html, "html.parser")
            scripts: List[Tag] = soup.find_all("script")

            for script in scripts:
                if script.string and "timetableData" in script.string:
                    regex = r"timetableData\s*=\s*(\[.*\])\s*;"
                    match = re.search(regex, script.string, re.DOTALL | re.MULTILINE)
                    if match:
                        json_str = match.group(1)
                        try:
                            timetable_data: List[Dict] = json.loads(json_str)
                            count = len(timetable_data)
                            print(
                                f"  Successfully extracted timetableData JSON "
                                f"({count} entries)."
                            )
                            return timetable_data
                        except json.JSONDecodeError as json_err:
                            print(f"Error decoding timetableData JSON: {json_err}")
                            return None
                    else:
                        print(
                            "  Found script with 'timetableData' but regex "
                            "didn't match expected structure."
                        )

            print("Error: Could not find 'timetableData' variable in any script tag.")
            return None
        except Exception as exc:
            print(f"Error parsing HTML for timetable data: {exc}")
            traceback.print_exc()
            return None

    def process_data_to_csv(
        self, raw_data: List[Dict[str, Any]], output_path: Path
    ) -> None:
        # pylint: disable=too-many-nested-blocks
        """Process raw data and write to CSV, using prefix mapping as fallback."""
        print(
            f"Processing {len(raw_data)} raw entries and writing to CSV: "
            f"{output_path}..."
        )
        processed_count = 0
        required_fields = [
            "subject_code",
            "location",
            "week_day",
            "start_time",
            "end_time",
        ]

        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with output_path.open("w", newline="", encoding="utf-8") as csvfile:
                fieldnames = [
                    "SubCode",
                    "Class",
                    "Day",
                    "StartTime",
                    "EndTime",
                    "Room",
                    "Teacher",
                ]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()

                for entry in raw_data:
                    if not all(entry.get(field) for field in required_fields):
                        continue

                    # Normalize locations immediately after splitting and stripping
                    raw_locations = entry.get("location", "").split(";")
                    locations = [
                        normalize_whitespace(loc)
                        for loc in raw_locations
                        if loc.strip()
                    ] or [
                        "Unknown"
                    ]  # Ensure Unknown is also normalized if used

                    # Normalize teachers immediately
                    raw_lecturers = entry.get("lecturer", "").split(";")
                    teachers = [
                        normalize_whitespace(t) for t in raw_lecturers if t.strip()
                    ] or [normalize_whitespace("Unknown")]

                    # Iterate through normalized locations
                    for loc_full_norm in locations:

                        # --- Room Name Logic (Prefix Matching on Normalized) ---
                        final_room_name = loc_full_norm  # Default

                        # Check against normalized mapping keys/values
                        for short_code_norm, full_name_norm in ROOM_MAPPING.items():
                            if loc_full_norm.startswith(short_code_norm):
                                if loc_full_norm != full_name_norm:
                                    print(
                                        f"  Mapping Applied: Scraped/Norm "
                                        f"'{loc_full_norm}' starts with Norm "
                                        f"SC '{short_code_norm}'. Using Norm "
                                        f"FN '{full_name_norm}'."
                                    )
                                    final_room_name = full_name_norm
                                # Found most specific prefix match, stop checking
                                break
                        # --- End Room Name Logic ---

                        # Use normalized teacher names
                        for teacher_norm in teachers:
                            # Normalize other text fields just before writing
                            subcode = entry.get("subject_code", "").replace(" ", "")
                            class_type = normalize_whitespace(
                                entry.get("type_with_section", "")
                            )
                            day = normalize_whitespace(entry.get("week_day", ""))
                            start_time_str = normalize_whitespace(
                                entry.get("start_time", "")
                            )
                            end_time_str = normalize_whitespace(
                                entry.get("end_time", "")
                            )

                            row_data = {
                                "SubCode": subcode,
                                "Class": class_type,
                                "Day": day,
                                "StartTime": start_time_str,
                                "EndTime": end_time_str,
                                "Room": final_room_name,  # Already normalized/mapped
                                "Teacher": teacher_norm,  # Already normalized
                            }
                            writer.writerow(row_data)
                            processed_count += 1

            print(
                f"Successfully processed and wrote {processed_count} rows to "
                f"{output_path.resolve()}"
            )

        except (IOError, OSError) as file_err:
            print(f"Error writing CSV file '{output_path}': {file_err}")
            raise
        except csv.Error as csv_err:
            print(f"Error processing CSV data: {csv_err}")
            raise
        except Exception as proc_err:
            print(f"An unexpected error occurred during data processing: {proc_err}")
            traceback.print_exc()
            raise

    def scrape(self, output_csv_path: Path) -> bool:
        """Main scraping orchestration logic."""
        print("Starting timetable scraping process...")
        start_time = time.time()

        try:
            print("\n--- Step 1: Fetching Base Page ---")
            base_response = self.fetch_page(BASE_URL)

            print("\n--- Step 2: Determining Semester ID ---")
            semester_id = self.get_target_semester_id(base_response.text)
            if not semester_id:
                raise RuntimeError(
                    "Fatal: Could not determine target " "semester ID. Exiting."
                )

            print("\n--- Step 3: Fetching Timetable Page ---")
            target_url = f"{BASE_URL}?semester={semester_id}"
            final_response = self.fetch_page(target_url)

            print("\n--- Step 4: Extracting Timetable Data ---")
            timetable_data = self.extract_timetable_data(final_response.text)
            if not timetable_data:
                raise RuntimeError(
                    "Fatal: Failed to extract timetable data " "from the page. Exiting."
                )

            print("\n--- Step 5: Processing Data and Saving to CSV ---")
            self.process_data_to_csv(timetable_data, output_csv_path)

            end_time = time.time()
            duration = end_time - start_time
            print(f"\nScraping completed successfully in {duration:.2f} seconds.")
            return True

        # Catch specific known errors first
        except (
            RuntimeError,
            IOError,
            csv.Error,
            RequestError,
            HTTPStatusError,
            TimeoutException,
            APIError,
            cloudscraper.exceptions.CloudflareChallengeError,
            json.JSONDecodeError,
        ) as known_err:
            end_time = time.time()
            duration = end_time - start_time
            print(
                f"\nScraping failed after {duration:.2f} seconds: "
                f"{type(known_err).__name__} - {known_err}"
            )
            return False
        except Exception as unknown_err:  # Catch truly unexpected errors
            end_time = time.time()
            duration = end_time - start_time
            print(
                f"\nScraping failed unexpectedly after {duration:.2f} seconds: "
                f"{type(unknown_err).__name__} - {unknown_err}"
            )
            traceback.print_exc()
            return False


def main():
    """Main script entry point: Parse args and run scraper."""
    parser = argparse.ArgumentParser(
        description="Scrape UOW Dubai timetable data and save to CSV."
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output CSV file path (e.g., ./public/classes.csv)",
        type=Path,
    )
    args = parser.parse_args()
    output_path = args.output.resolve()
    print(f"Output CSV will be saved to: {output_path}")

    scraper = TimetableScraper()
    success = scraper.scrape(output_path)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
