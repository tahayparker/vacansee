# \scripts\scrape_timetable_auth.py

# pylint: disable=invalid-name, too-many-lines, too-many-locals, too-many-statements
# pylint: disable=too-many-branches, broad-except

"""
Authenticated Timetable Scraper using Playwright.
Handles Microsoft SSO authentication with TOTP-based 2FA.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import datetime
import traceback
from pathlib import Path
from typing import Optional, Dict, List, Any

# Third-party imports
import pyotp
import cloudscraper
from playwright.sync_api import sync_playwright, Page, Browser, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup
from postgrest.exceptions import APIError

# Local imports
from db_connection import get_supabase_client

# --- Constants ---
BASE_URL = "https://my.uowdubai.ac.ae/timetable/viewer"
HOME_URL = "https://my.uowdubai.ac.ae"
DEFAULT_TIMEOUT = 45000  # milliseconds for Playwright
MAX_RETRIES = 3
LINE_LENGTH_LIMIT = 99


# --- Helper Functions ---
def normalize_whitespace(text: Optional[str]) -> str:
    """
    Replaces consecutive whitespace chars with a single space
    and strips leading/trailing whitespace. Returns empty string if input is None.
    """
    if not isinstance(text, str):
        return ""
    return " ".join(text.split())


def format_time_to_hh_mm(time_str: Optional[str]) -> str:
    """
    Converts a time string from formats like 'H:mm' or 'HH:mm' to 'HH:mm'.
    Examples: "8:30" -> "08:30", "14:00" -> "14:00".
    """
    if time_str is None:
        return ""

    normalized_time = normalize_whitespace(time_str)
    if not normalized_time:
        return ""

    try:
        dt_obj = datetime.datetime.strptime(normalized_time, "%H:%M")
        return dt_obj.strftime("%H:%M")
    except ValueError:
        print(
            f"Warning: Could not parse time '{normalized_time}' to HH:MM format. "
            "Using the normalized original string."
        )
        return normalized_time


def generate_totp(secret: str) -> str:
    """Generate a TOTP code from the provided secret."""
    totp = pyotp.TOTP(secret)
    return totp.now()


def human_type(element, text: str, min_delay: float = 0.05, max_delay: float = 0.15):
    """Type text with human-like delays between keystrokes."""
    import random
    for char in text:
        element.type(char)
        time.sleep(random.uniform(min_delay, max_delay))


# --- Supabase Client Initialization ---
try:
    supabase = get_supabase_client()
    print("Connected to Supabase (using Service Role Key - RLS bypassed).")
except ValueError as exc:
    print(f"Configuration Error: {exc}")
    sys.exit("Exiting due to missing Supabase configuration.")
except Exception as exc:
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
                if short_code and name:
                    norm_short_code = normalize_whitespace(short_code)
                    norm_name = normalize_whitespace(name)
                    if norm_short_code and norm_name:
                        room_mapping[norm_short_code] = norm_name

            print(
                f"Room mapping (ShortCode -> Name) fetched: "
                f"{len(room_mapping)} entries."
            )
            sorted_keys = sorted(room_mapping.keys(), key=len, reverse=True)
            sorted_room_mapping = {key: room_mapping[key] for key in sorted_keys}
            return sorted_room_mapping
        else:
            print("Warning: No rooms found in Supabase matching criteria for mapping.")
            return {}

    except APIError as api_exc:
        print(f"Supabase API Error fetching room mapping: {api_exc}")
        return {}
    except Exception as gen_exc:
        print(f"Unexpected error fetching room mapping: {gen_exc}")
        traceback.print_exc()
        return {}


# Global room mapping fetched once
ROOM_MAPPING: Dict[str, str] = fetch_room_mapping()


class AuthenticatedTimetableScraper:
    """Scrapes timetable data using authenticated session via Playwright."""

    def __init__(self, email: str, password: str, totp_secret: str, headless: bool = True):
        """Initialize scraper with credentials and browser settings."""
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.scraper = cloudscraper.create_scraper(
            browser={
                "browser": "chrome",
                "platform": "windows",
                "desktop": True,
                "mobile": False,
            }
        )
        print("AuthenticatedTimetableScraper initialized.")

    def bypass_cloudflare_and_get_cookies(self, url: str) -> List[Dict]:
        """Use cloudscraper to bypass Cloudflare and return cookies for Playwright."""
        print(f"Using cloudscraper to bypass Cloudflare for {url}...")
        try:
            response = self.scraper.get(url, timeout=30)
            response.raise_for_status()
            print("Cloudscraper successfully bypassed Cloudflare")

            # Convert requests cookies to Playwright format
            playwright_cookies = []
            for cookie in self.scraper.cookies:
                playwright_cookies.append({
                    'name': cookie.name,
                    'value': cookie.value,
                    'domain': cookie.domain,
                    'path': cookie.path,
                    'expires': cookie.expires if cookie.expires else -1,
                    'httpOnly': cookie.has_nonstandard_attr('HttpOnly'),
                    'secure': cookie.secure,
                    'sameSite': 'Lax'
                })

            return playwright_cookies
        except Exception as e:
            print(f"Cloudscraper failed: {e}")
            return []

    def get_current_semester_text(self) -> str:
        """Return the current semester text based on date."""
        today = datetime.datetime.now()
        year = today.year
        current_month = today.month
        current_week = (today.day - 1) // 7 + 1

        semester_text = "Unknown Semester"

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

        return normalize_whitespace(semester_text)

    def authenticate(self) -> bool:
        """
        Authenticate using Microsoft SSO and TOTP 2FA.
        Returns True if successful, False otherwise.
        """
        print("\n--- Starting Authentication Process ---")

        try:
            # Step 1: Navigate to timetable viewer
            print(f"Navigating to {BASE_URL}...")
            self.page.goto(BASE_URL, wait_until="load", timeout=60000)
            time.sleep(3)

            print(f"Current URL: {self.page.url}")
            page_content = self.page.content()

            # Step 2: Check what page we're on
            # Case 1: Timetable viewer login prompt
            if "Timetable Viewer is restricted" in page_content:
                print("Detected: Timetable viewer login prompt")
                print("Clicking 'here' link to go to login page...")
                try:
                    self.page.click('a:has-text("here")', timeout=10000)
                    print("Waiting for redirect...")
                    time.sleep(5)
                    page_content = self.page.content()
                except Exception as e:
                    print(f"Could not click 'here' link: {e}")
                    return False

            # Case 2: Cloudflare challenge
            if "Just a moment" in page_content or "security of your connection" in page_content.lower() or "cloudflare" in page_content.lower():
                print("Detected: Cloudflare challenge")
                print("Waiting for Cloudflare to complete (up to 60 seconds)...")

                # Try to wait for network idle and page load
                try:
                    self.page.wait_for_load_state("networkidle", timeout=60000)
                    print("Cloudflare check passed - page loaded")
                    time.sleep(3)
                except Exception as e:
                    print(f"Warning: Timeout waiting for Cloudflare bypass: {e}")
                    # Continue anyway, might still work

            # Step 3: Check if we're on MY|UOWD login page
            print(f"Current URL after redirects: {self.page.url}")
            page_content = self.page.content()

            if "MY | UOWD" in page_content or "MY|UOWD" in page_content:
                print("Detected: MY|UOWD login page")
                print("Looking for Login button...")
                try:
                    # Wait for the red Login button
                    login_button = self.page.wait_for_selector('button.btn-danger:has-text("Login")', timeout=15000)
                    if login_button:
                        print("Found Login button, clicking...")
                        login_button.click()
                        print("Waiting for Microsoft SSO redirect...")
                        time.sleep(5)
                except Exception as e:
                    print(f"Could not find or click Login button: {e}")
                    return False

            # Step 4: Check if we're on Microsoft login page
            print(f"Current URL: {self.page.url}")
            if "microsoft" not in self.page.url.lower() and "login.microsoftonline" not in self.page.url.lower():
                print("Warning: Not on Microsoft login page yet")
                print(f"Current page title: {self.page.title()}")
                # Give it more time
                time.sleep(5)
                print(f"Current URL after wait: {self.page.url}")

            # Wait 5 seconds before entering email (appear more human-like)
            print("Waiting before entering email...")
            time.sleep(5)

            # Enter email
            print("Entering email...")
            email_field = self.page.wait_for_selector(
                'input[type="email"], input[name="loginfmt"], input[name="username"]',
                timeout=DEFAULT_TIMEOUT
            )
            human_type(email_field, self.email)
            time.sleep(0.5)

            # Click next/submit
            next_button = self.page.query_selector('input[type="submit"], button[type="submit"]')
            if next_button:
                next_button.click()
                print("Waiting for password page...")
                time.sleep(3)

            # Enter password
            print("Entering password...")
            password_field = self.page.wait_for_selector(
                'input[type="password"], input[name="passwd"], input[name="password"]',
                timeout=DEFAULT_TIMEOUT
            )
            human_type(password_field, self.password)
            time.sleep(0.5)

            # Click sign in
            signin_button = self.page.query_selector('input[type="submit"], button[type="submit"]')
            if signin_button:
                signin_button.click()
                print("Waiting for 2FA page...")
                time.sleep(5)

            # Handle 2FA - Enter TOTP code directly
            print("Looking for TOTP input field...")

            totp_selectors = [
                'input[name="otc"]',
                'input[id="idTxtBx_SAOTCC_OTC"]',
                'input[type="tel"]',
                'input[aria-label*="code"]',
            ]

            totp_field = None
            for selector in totp_selectors:
                try:
                    totp_field = self.page.wait_for_selector(selector, timeout=10000)
                    if totp_field and totp_field.is_visible():
                        print(f"Found TOTP input field")
                        break
                    else:
                        totp_field = None
                except:
                    continue

            if not totp_field:
                print("✗ Could not find TOTP input field")
                return False

            # Enter TOTP code
            totp_code = generate_totp(self.totp_secret)
            print(f"Entering TOTP code...")
            totp_field.fill(totp_code)
            time.sleep(0.5)

            # Click verify
            verify_button = self.page.query_selector('input[type="submit"], button[type="submit"]')
            if verify_button:
                print("Clicking verify button...")
                verify_button.click()
                print("Waiting for verification...")
                time.sleep(5)
            else:
                print("Warning: Could not find verify button, trying Enter key...")
                totp_field.press('Enter')
                time.sleep(5)

            # Handle "Stay signed in?" prompt
            print("Checking for 'Stay signed in?' prompt...")
            stay_signed_in_button = self.page.query_selector('input[type="submit"][value*="Yes"], button:has-text("Yes")')
            if stay_signed_in_button:
                print("Clicking 'Yes' to stay signed in...")
                stay_signed_in_button.click()
                self.page.wait_for_load_state("domcontentloaded", timeout=DEFAULT_TIMEOUT)
                time.sleep(3)

            # Verify we're authenticated by checking if we're redirected back
            current_url = self.page.url
            print(f"Current URL after authentication: {current_url}")

            # Check if we're back at UOWD domain (not Microsoft login)
            if "uowdubai.ac.ae" in current_url and "microsoft" not in current_url.lower():
                print("✓ Authentication successful!")
                return True
            else:
                print("✗ Authentication may have failed - still on external domain")
                return False

        except PlaywrightTimeout as timeout_err:
            print(f"Timeout during authentication: {timeout_err}")
            return False
        except Exception as auth_err:
            print(f"Error during authentication: {auth_err}")
            traceback.print_exc()
            return False

    def extract_semester_ids(self, html_content: str) -> Dict[str, str]:
        """Extract semester IDs and labels from the page HTML."""
        print("Extracting semester IDs...")
        semesters: Dict[str, str] = {}
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            selector = "div.custom-control.custom-radio, div.form-check"

            for div in soup.select(selector):
                radio = div.find(
                    "input", {"type": "radio", "name": re.compile(r"semester", re.I)}
                )
                label = div.find("label")

                if radio and label and radio.has_attr("value"):
                    label_text = normalize_whitespace(label.get_text())
                    value = radio["value"]
                    if label_text and value:
                        semesters[label_text] = value
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

    def get_target_semester_id(self, html_content: str) -> Optional[str]:
        """Find the semester ID that matches the current target semester."""
        print("Determining target semester ID...")
        target_semester_text = self.get_current_semester_text()
        print(f"  Target semester text (normalized): '{target_semester_text}'")
        available_semesters = self.extract_semester_ids(html_content)

        if not available_semesters:
            print("Error: No semesters found on the page.")
            return None

        target_lower = target_semester_text.lower()

        # Try exact match first
        for label, sid in available_semesters.items():
            if target_lower == label.lower():
                print(f"  Found exact match: '{label}' -> ID: {sid}")
                return sid

        # Try partial match
        for label, sid in available_semesters.items():
            if target_lower in label.lower():
                print(f"  Found partial match: '{label}' -> ID: {sid}")
                return sid

        # Fallback to first available
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

    def extract_timetable_data(self, html_content: str) -> Optional[List[Dict]]:
        """Extract timetable data JSON embedded in the page's script tags."""
        print("Extracting timetable data from HTML script...")
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            scripts = soup.find_all("script")

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
        """Process raw data and write to CSV."""
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

                    raw_locations = entry.get("location", "").split(";")
                    locations = [
                        normalize_whitespace(loc)
                        for loc in raw_locations
                        if loc.strip()
                    ] or ["Unknown"]

                    raw_lecturers = entry.get("lecturer", "").split(";")
                    teachers = [
                        normalize_whitespace(t) for t in raw_lecturers if t.strip()
                    ] or [normalize_whitespace("Unknown")]

                    for loc_full_norm in locations:
                        final_room_name = loc_full_norm

                        # Apply room mapping
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
                                break

                        for teacher_norm in teachers:
                            subcode = entry.get("subject_code", "").replace(" ", "")
                            class_type = normalize_whitespace(
                                entry.get("type_with_section", "")
                            )
                            day = normalize_whitespace(entry.get("week_day", ""))

                            raw_start_time = entry.get("start_time")
                            raw_end_time = entry.get("end_time")

                            start_time_str = format_time_to_hh_mm(raw_start_time)
                            end_time_str = format_time_to_hh_mm(raw_end_time)

                            row_data = {
                                "SubCode": subcode,
                                "Class": class_type,
                                "Day": day,
                                "StartTime": start_time_str,
                                "EndTime": end_time_str,
                                "Room": final_room_name,
                                "Teacher": teacher_norm,
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
        print("Starting authenticated timetable scraping process...")
        start_time_proc = time.time()

        playwright_instance = None

        try:
            # Initialize Playwright with stealth settings
            print("\n--- Initializing Browser ---")
            playwright_instance = sync_playwright().start()
            self.browser = playwright_instance.chromium.launch(
                headless=self.headless,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                ]
            )

            # Create context with stealth settings to bypass Cloudflare
            context = self.browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36",
                viewport={'width': 1920, 'height': 1080},
                locale='en-US',
                timezone_id='Asia/Dubai',
                permissions=['geolocation'],
                extra_http_headers={
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            )

            # Add JavaScript to hide webdriver property
            context.add_init_script("""{
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});

                // Disable WebAuthn to prevent Windows Hello/FIDO prompts
                if (window.PublicKeyCredential) {
                    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => Promise.resolve(false);
                    window.PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
                }

                // Remove credentials API entirely
                delete navigator.credentials;

                // Fake permissions
            }""")

            self.page = context.new_page()

            # Get Cloudflare-bypassed cookies from cloudscraper
            print("\n--- Step 0: Bypassing Cloudflare ---")
            cf_cookies = self.bypass_cloudflare_and_get_cookies(BASE_URL)
            if cf_cookies:
                print(f"Adding {len(cf_cookies)} cookies to browser context...")
                context.add_cookies(cf_cookies)
                # Give time for cookies to be set
                time.sleep(2)
            else:
                print("Warning: No Cloudflare cookies obtained, may face challenges")

            # Authenticate
            print("\n--- Step 1: Authentication ---")
            if not self.authenticate():
                raise RuntimeError("Authentication failed. Cannot proceed.")

            # Navigate to timetable viewer
            print("\n--- Step 2: Navigating to Timetable Viewer ---")
            self.page.goto(BASE_URL, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT)
            time.sleep(3)

            # Get page content
            base_html = self.page.content()

            # Determine semester ID
            print("\n--- Step 3: Determining Semester ID ---")
            semester_id = self.get_target_semester_id(base_html)
            if not semester_id:
                raise RuntimeError("Could not determine target semester ID.")

            # Navigate to specific semester
            print("\n--- Step 4: Fetching Timetable Page ---")
            target_url = f"{BASE_URL}?semester={semester_id}"
            self.page.goto(target_url, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT)
            time.sleep(3)

            # Extract timetable data
            print("\n--- Step 5: Extracting Timetable Data ---")
            final_html = self.page.content()
            timetable_data = self.extract_timetable_data(final_html)
            if not timetable_data:
                raise RuntimeError("Failed to extract timetable data from the page.")

            # Process and save
            print("\n--- Step 6: Processing Data and Saving to CSV ---")
            self.process_data_to_csv(timetable_data, output_csv_path)

            end_time_proc = time.time()
            duration = end_time_proc - start_time_proc
            print(f"\n✓ Scraping completed successfully in {duration:.2f} seconds.")
            return True

        except Exception as err:
            end_time_proc = time.time()
            duration = end_time_proc - start_time_proc
            print(
                f"\n✗ Scraping failed after {duration:.2f} seconds: "
                f"{type(err).__name__} - {err}"
            )
            traceback.print_exc()
            return False

        finally:
            # Cleanup
            if self.page:
                self.page.close()
            if self.browser:
                self.browser.close()
            if playwright_instance:
                playwright_instance.stop()
            print("Browser cleanup completed.")


def main():
    """Main script entry point."""
    parser = argparse.ArgumentParser(
        description="Scrape UOW Dubai timetable data with authentication."
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output CSV file path (e.g., ./public/classes.csv)",
        type=Path,
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode (default: True)",
    )
    parser.add_argument(
        "--no-headless",
        action="store_false",
        dest="headless",
        help="Run browser with GUI (for debugging)",
    )

    args = parser.parse_args()
    output_path = args.output.resolve()
    print(f"Output CSV will be saved to: {output_path}")

    # Get credentials from environment
    email = os.getenv("UOWD_EMAIL")
    password = os.getenv("UOWD_PASSWORD")
    totp_secret = os.getenv("UOWD_TOTP_SECRET")

    if not email or not password or not totp_secret:
        print("Error: Missing required environment variables:")
        if not email:
            print("  - UOWD_EMAIL")
        if not password:
            print("  - UOWD_PASSWORD")
        if not totp_secret:
            print("  - UOWD_TOTP_SECRET")
        sys.exit(1)

    scraper = AuthenticatedTimetableScraper(
        email=email,
        password=password,
        totp_secret=totp_secret,
        headless=args.headless
    )
    success = scraper.scrape(output_path)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
