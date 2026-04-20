"""
Authenticated Timetable Scraper using DrissionPage.
Uses Chrome DevTools Protocol to bypass Cloudflare and handle Microsoft SSO.
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
from DrissionPage import ChromiumPage, ChromiumOptions
from dotenv import load_dotenv

# Local imports
from db_connection import get_supabase_client

# Load environment variables
load_dotenv()
load_dotenv(".env.local", override=True)

# --- Constants ---
BASE_URL = "https://my.uowdubai.ac.ae/timetable/viewer"
TIMEOUT = 10  # Seconds for element waits

# --- Helper Functions ---
def normalize_whitespace(text: Optional[str]) -> str:
    if not isinstance(text, str): return ""
    return " ".join(text.split())

def format_time_to_hh_mm(time_str: Optional[str]) -> str:
    if time_str is None: return ""
    normalized_time = normalize_whitespace(time_str)
    if not normalized_time: return ""
    try:
        dt_obj = datetime.datetime.strptime(normalized_time, "%H:%M")
        return dt_obj.strftime("%H:%M")
    except ValueError:
        return normalized_time

def generate_totp(secret: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.now()

# --- Supabase Initialization ---
try:
    supabase = get_supabase_client()
    print("✓ Connected to Supabase.")
except Exception as exc:
    print(f"✗ Supabase init failed: {exc}")
    sys.exit(1)

ROOM_MAPPING = {}
try:
    print("Fetching room mapping...")
    response = supabase.table("Rooms").select("Name, ShortCode").neq("Name", "%Consultation%").neq("Name", "%Online%").execute()
    if response.data:
        temp_map = {}
        for row in response.data:
            sc = normalize_whitespace(row.get("ShortCode"))
            nm = normalize_whitespace(row.get("Name"))
            if sc and nm: temp_map[sc] = nm
        # Sort keys by length descending
        ROOM_MAPPING = {k: temp_map[k] for k in sorted(temp_map.keys(), key=len, reverse=True)}
        print(f"✓ Fetched {len(ROOM_MAPPING)} room mappings.")
except Exception as e:
    print(f"✗ Error fetching room mapping: {e}")


class TimetableScraper:
    def __init__(self, email: str, password: str, totp_secret: str, headless: bool = True):
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self.headless = headless
        self.page = None

    def start_browser(self):
        """Initialize DrissionPage with anti-detection settings."""
        print(f"\n[BROWSER] Initializing Chromium (Headless: {self.headless})...")

        co = ChromiumOptions()
        # 'auto_port' ensures parallel runs don't conflict
        co.auto_port()

        # Mac/Linux users might need to specify the browser path if not found automatically
        # co.set_browser_path('/usr/bin/google-chrome')

        if self.headless:
            co.headless(True)
        else:
            co.headless(False)

        # These arguments help bypass detection
        co.set_argument('--no-sandbox')
        co.set_argument('--disable-gpu')
        co.set_argument('--lang=en-US')

        # DrissionPage handles the user-agent and webdriver flags automatically
        self.page = ChromiumPage(co)
        print("[BROWSER] ✓ Browser ready")

    def close(self):
        if self.page:
            self.page.quit()

    def handle_cloudflare(self):
        """Checks for Cloudflare turnstile and handles it."""
        try:
            title = self.page.title.lower()
            if "just a moment" in title or "challenge" in title:
                print("[CLOUDFLARE] Challenge detected. Attempting bypass...")

                # DrissionPage often bypasses purely by being CDP-based.
                # If a Turnstile widget exists, we can try to wait for it or click it.
                # However, usually just waiting is enough with DrissionPage.

                start_time = time.time()
                while time.time() - start_time < 30:
                    if "just a moment" not in self.page.title.lower():
                        print("[CLOUDFLARE] ✓ Cleared.")
                        return True
                    time.sleep(1)

                print("[CLOUDFLARE] ✗ Timeout waiting for challenge.")
                return False
            return True
        except Exception as e:
            print(f"[CLOUDFLARE] Warning: {e}")
            return True

    def login(self) -> bool:
        print("\n[LOGIN] Starting authentication...")
        try:
            self.page.get(BASE_URL)
            self.handle_cloudflare()

            # 1. Check for "Restricted" page
            if self.page.ele("text:Timetable Viewer is restricted", timeout=2):
                print("[LOGIN] Clicking restricted link...")
                self.page.ele("text:here").click()
                self.handle_cloudflare()

            # 2. Check for Login Button
            login_btn = self.page.ele("xpath://button[contains(text(), 'Login')]", timeout=3)
            if login_btn:
                print("[LOGIN] Clicking main Login button...")
                login_btn.click()
                self.handle_cloudflare()

            # 3. Microsoft Email
            if self.page.ele("@type=email", timeout=5):
                print(f"[LOGIN] Entering email: {self.email}")
                self.page.ele("@type=email").input(self.email)
                self.page.ele("@type=submit").click()

            # 4. Microsoft Password
            if self.page.ele("@type=password", timeout=5):
                print("[LOGIN] Entering password...")
                self.page.ele("@type=password").input(self.password)
                self.page.ele("@type=submit").click()

            # 5. Check for TOTP / MFA
            # Wait a moment for page transition
            time.sleep(3)

            # If we are not back at uowdubai yet, check for OTP
            if "uowdubai.ac.ae" not in self.page.url:
                # Look for common OTP inputs
                otp_input = self.page.ele("css:input[name='otc']", timeout=3) or \
                            self.page.ele("css:input[id*='OTC']", timeout=1) or \
                            self.page.ele("css:input[placeholder*='Code']", timeout=1)

                if otp_input:
                    code = generate_totp(self.totp_secret)
                    print(f"[LOGIN] 2FA Prompt detected. Code: {code}")
                    otp_input.input(code)

                    verify_btn = self.page.ele("@type=submit")
                    if verify_btn: verify_btn.click()
                else:
                    print("[LOGIN] No 2FA input found (or not required).")

            # 6. Stay Signed In?
            if self.page.ele("@value=Yes", timeout=5):
                print("[LOGIN] Accepting 'Stay signed in'...")
                self.page.ele("@value=Yes").click()

            # Final check
            self.page.wait.load_start()
            self.handle_cloudflare()

            if "uowdubai.ac.ae" in self.page.url:
                print("[LOGIN] ✅ Success!")
                return True
            else:
                print(f"[LOGIN] ✗ Failed. Current URL: {self.page.url}")
                return False

        except Exception as e:
            print(f"[LOGIN] Error: {e}")
            traceback.print_exc()
            return False

    def get_current_semester_text(self) -> str:
        today = datetime.datetime.now()
        year = today.year
        month = today.month
        week = (today.day - 1) // 7 + 1

        if month in [1, 2]: return f"Winter {year}"
        elif month == 3: return f"Winter {year}" if week <= 3 else f"Spring {year}"
        elif month in [4, 5, 6]: return f"Spring {year}"
        elif month == 7: return f"Summer {year}"
        elif month == 8: return f"Summer {year}" if week <= 2 else f"Autumn {year}"
        elif month in [9, 10, 11]: return f"Autumn {year}"
        elif month == 12: return f"Autumn {year}" if week <= 1 else f"Winter {year}"
        return "Unknown"

    def scrape_data(self, output_path: Path):
        if not self.login():
            raise Exception("Authentication failed")

        print("\n[SCRAPE] Navigating to viewer...")
        self.page.get(BASE_URL)
        self.handle_cloudflare()

        target_sem = self.get_current_semester_text()
        print(f"[SCRAPE] Looking for semester: {target_sem}")

        # Find semester radio button
        sem_id = None
        labels = self.page.eles("tag:label")
        for label in labels:
            if target_sem.lower() in label.text.lower():
                # DrissionPage finds relative elements easily
                try:
                    # Assuming input is inside the label or a sibling
                    # We look for the input inside the parent div usually
                    parent = label.parent()
                    radio = parent.ele("tag:input")
                    if radio:
                        sem_id = radio.attr("value")
                        break
                except: continue

        if not sem_id:
            print("[SCRAPE] Warning: Exact semester not found. Using first available.")
            radio = self.page.ele("tag:input@type=radio")
            if radio: sem_id = radio.attr("value")

        if not sem_id:
            raise Exception("Could not find any semester IDs.")

        print(f"[SCRAPE] Loading Semester ID: {sem_id}")
        self.page.get(f"{BASE_URL}?semester={sem_id}")
        self.handle_cloudflare()

        # Extract JSON from <script>
        print("[SCRAPE] Extracting data...")
        html = self.page.html
        match = re.search(r"timetableData\s*=\s*(\[.*\])\s*;", html, re.DOTALL | re.MULTILINE)

        if not match:
            raise Exception("Data pattern not found in page HTML.")

        data = json.loads(match.group(1))
        print(f"[SCRAPE] Found {len(data)} classes.")

        # Save CSV
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"])
            writer.writeheader()

            count = 0
            for entry in data:
                locs = [normalize_whitespace(l) for l in entry.get("location", "").split(";") if l.strip()] or ["Unknown"]
                teachers = [normalize_whitespace(t) for t in entry.get("lecturer", "").split(";") if t.strip()] or ["Unknown"]

                for loc in locs:
                    room = loc
                    for sc, name in ROOM_MAPPING.items():
                        if loc.startswith(sc):
                            room = name
                            break

                    for teacher in teachers:
                        writer.writerow({
                            "SubCode": entry.get("subject_code", "").replace(" ", ""),
                            "Class": normalize_whitespace(entry.get("type_with_section", "")),
                            "Day": normalize_whitespace(entry.get("week_day", "")),
                            "StartTime": format_time_to_hh_mm(entry.get("start_time")),
                            "EndTime": format_time_to_hh_mm(entry.get("end_time")),
                            "Room": room,
                            "Teacher": teacher
                        })
                        count += 1

        print(f"[SCRAPE] ✓ Saved {count} rows to {output_path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--no-headless", action="store_false", dest="headless")
    args = parser.parse_args()

    email = os.getenv("UOWD_EMAIL")
    password = os.getenv("UOWD_PASSWORD")
    totp = os.getenv("UOWD_TOTP_SECRET")

    if not all([email, password, totp]):
        print("✗ Missing credentials.")
        sys.exit(1)

    scraper = TimetableScraper(email, password, totp, args.headless)
    try:
        scraper.start_browser()
        scraper.scrape_data(args.output)
    except Exception as e:
        print(f"✗ Failed: {e}")
        # traceback.print_exc()
        sys.exit(1)
    finally:
        scraper.close()

if __name__ == "__main__":
    main()