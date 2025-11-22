"""
Authenticated Timetable Scraper using Playwright.
Handles Microsoft SSO authentication with TOTP-based 2FA and Cloudflare evasion.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import datetime
import random
import traceback
from pathlib import Path
from typing import Optional, Dict, List, Any

# Third-party imports
import pyotp
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext, TimeoutError as PlaywrightTimeout
from playwright_stealth import stealth_sync
from bs4 import BeautifulSoup
from postgrest.exceptions import APIError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
load_dotenv(".env.local", override=True)

# Local imports
from db_connection import get_supabase_client

# --- Constants ---
BASE_URL = "https://my.uowdubai.ac.ae/timetable/viewer"
DEFAULT_TIMEOUT = 60000  # 60 seconds
MAX_RETRIES = 3

# --- Helper Functions ---
def normalize_whitespace(text: Optional[str]) -> str:
    """Replaces consecutive whitespace chars with a single space."""
    if not isinstance(text, str):
        return ""
    return " ".join(text.split())

def format_time_to_hh_mm(time_str: Optional[str]) -> str:
    """Converts a time string to 'HH:mm'."""
    if time_str is None:
        return ""
    normalized_time = normalize_whitespace(time_str)
    if not normalized_time:
        return ""
    try:
        dt_obj = datetime.datetime.strptime(normalized_time, "%H:%M")
        return dt_obj.strftime("%H:%M")
    except ValueError:
        return normalized_time

def generate_totp(secret: str) -> str:
    """Generate a TOTP code."""
    totp = pyotp.TOTP(secret)
    return totp.now()

def human_type(element, text: str, min_delay: float = 0.05, max_delay: float = 0.15):
    """Type text with human-like delays."""
    for char in text:
        element.type(char)
        time.sleep(random.uniform(min_delay, max_delay))

# --- Supabase ---
try:
    supabase = get_supabase_client()
    print("Connected to Supabase.")
except Exception as exc:
    print(f"Supabase init failed: {exc}")
    sys.exit(1)

def fetch_room_mapping() -> Dict[str, str]:
    """Fetches room ShortCode to Name mapping from Supabase."""
    print("Fetching room mapping...")
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
                sc = normalize_whitespace(row.get("ShortCode"))
                nm = normalize_whitespace(row.get("Name"))
                if sc and nm:
                    room_mapping[sc] = nm
            # Sort by length descending to match longest prefixes first
            sorted_keys = sorted(room_mapping.keys(), key=len, reverse=True)
            return {key: room_mapping[key] for key in sorted_keys}
    except Exception as e:
        print(f"Error fetching room mapping: {e}")
    return room_mapping

ROOM_MAPPING = fetch_room_mapping()

class TimetableScraper:
    def __init__(self, email: str, password: str, totp_secret: str, headless: bool = True):
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    def start_browser(self):
        """Initialize Playwright with stealth settings."""
        print("[BROWSER] Starting Playwright...")
        self.playwright = sync_playwright().start()

        # Launch args to reduce detection
        args = [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
        ]

        print(f"[BROWSER] Launching browser (headless={self.headless})...")
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=args
        )

        print("[BROWSER] Creating context...")
        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id='Asia/Dubai',
        )

        print("[BROWSER] Creating new page...")
        self.page = self.context.new_page()

        print("[BROWSER] Applying playwright-stealth...")
        # Apply playwright-stealth for advanced fingerprint evasion
        stealth_sync(self.page)

        # Random mouse movements to simulate human
        self.page.mouse.move(random.randint(0, 500), random.randint(0, 500))
        print("[BROWSER] ✓ Browser ready with stealth mode")

    def close(self):
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if hasattr(self, 'playwright'):
            self.playwright.stop()

    def handle_cloudflare(self):
        """Check for and handle Cloudflare challenge."""
        time.sleep(3)
        try:
            title = self.page.title().lower()
            url = self.page.url
            print(f"[CF-CHECK] URL: {url}")
            print(f"[CF-CHECK] Title: '{title}'")

            # Check if Cloudflare challenge text is visible
            just_a_moment_visible = False
            verify_human_visible = False

            try:
                just_a_moment_visible = self.page.get_by_text("Just a moment").is_visible()
                print(f"[CF-CHECK] 'Just a moment' visible: {just_a_moment_visible}")
            except Exception as e:
                print(f"[CF-CHECK] Error checking 'Just a moment': {e}")

            try:
                verify_human_visible = self.page.get_by_text("Verify you are human").is_visible()
                print(f"[CF-CHECK] 'Verify you are human' visible: {verify_human_visible}")
            except Exception as e:
                print(f"[CF-CHECK] Error checking 'Verify you are human': {e}")

            if (just_a_moment_visible or verify_human_visible or
                "challenge" in title or "just a moment" in title):

                print("[CF] ⚠️ Challenge detected! Starting bypass...")

                # Try to click the Turnstile checkbox if it exists
                try:
                    print("[CF] Looking for Turnstile iframe...")
                    self.page.wait_for_selector("iframe[src*='turnstile']", timeout=5000)
                    frames = self.page.frames
                    print(f"[CF] Found {len(frames)} frames")
                    for i, frame in enumerate(frames):
                        frame_url = frame.url
                        if "turnstile" in frame_url:
                            print(f"[CF] ✓ Turnstile frame found at index {i}")
                            frame.click("body", timeout=2000)
                            time.sleep(1)
                            print(f"[CF] ✓ Clicked Turnstile")
                        else:
                            print(f"[CF] Frame {i}: {frame_url}")
                except Exception as e:
                    print(f"[CF] No Turnstile or click failed: {str(e)[:100]}")

                # Wait for the challenge to clear using a polling loop
                print("[CF] Waiting for challenge to clear...")
                max_wait = 120  # seconds
                start_time = time.time()
                iteration = 0

                while time.time() - start_time < max_wait:
                    iteration += 1
                    elapsed = time.time() - start_time

                    try:
                        current_title = self.page.title().lower()
                        current_url = self.page.url

                        # Log every 10 iterations
                        if iteration % 10 == 0:
                            print(f"[CF-POLL] Iter {iteration} ({elapsed:.1f}s) | Title: '{current_title}' | URL: {current_url}")

                        if "just a moment" not in current_title:
                            # Double-check the text isn't visible
                            try:
                                still_visible = self.page.get_by_text("Just a moment").is_visible(timeout=1000)
                                if not still_visible:
                                    print(f"[CF] ✅ Cleared after {elapsed:.1f}s ({iteration} iters)")
                                    print(f"[CF] Final URL: {current_url}")
                                    print(f"[CF] Final Title: '{current_title}'")
                                    time.sleep(3)
                                    return
                            except:
                                print(f"[CF] ✅ Cleared after {elapsed:.1f}s ({iteration} iters)")
                                print(f"[CF] Final URL: {current_url}")
                                print(f"[CF] Final Title: '{current_title}'")
                                time.sleep(3)
                                return
                    except Exception as e:
                        if iteration % 10 == 0:
                            print(f"[CF-POLL] Error: {str(e)[:50]}")

                    time.sleep(1)

                # Timeout reached
                final_url = self.page.url
                final_title = self.page.title()
                print(f"[CF] ⚠️ TIMEOUT after {max_wait}s ({iteration} iterations)")
                print(f"[CF] Final URL: {final_url}")
                print(f"[CF] Final Title: '{final_title}'")

                if "just a moment" not in final_title.lower():
                    print(f"[CF] ℹ️ Title OK despite timeout - may have succeeded")

                time.sleep(2)
            else:
                print(f"[CF-CHECK] ✓ No challenge")

        except Exception as e:
            print(f"[CF-ERROR] {e}")
            traceback.print_exc()

    def login(self) -> bool:
        """Handle the login flow."""
        print("\n" + "="*70)
        print("[LOGIN] Starting authentication flow")
        print("="*70)

        try:
            # Navigate to base URL
            print(f"[LOGIN] Navigating to {BASE_URL}")
            self.page.goto(BASE_URL, timeout=DEFAULT_TIMEOUT)
            print(f"[LOGIN] ✓ Loaded. URL: {self.page.url}")
            self.handle_cloudflare()

            # Wait for page load
            print(f"[LOGIN] Waiting for DOM...")
            self.page.wait_for_load_state("domcontentloaded", timeout=DEFAULT_TIMEOUT)
            print(f"[LOGIN] ✓ DOM loaded. URL: {self.page.url}")

            # Step 1: Check for "Timetable Viewer is restricted"
            print(f"\n[STEP 1] Checking for restricted message...")
            try:
                restricted_visible = self.page.get_by_text("Timetable Viewer is restricted").is_visible()
                print(f"[STEP 1] Restricted message visible: {restricted_visible}")

                if restricted_visible:
                    print(f"[STEP 1] Clicking 'here' link...")
                    self.page.get_by_text("here").click()
                    time.sleep(2)
                    self.page.wait_for_load_state("domcontentloaded")
                    print(f"[STEP 1] ✓ Clicked. New URL: {self.page.url}")
                    self.handle_cloudflare()
                else:
                    print(f"[STEP 1] No restricted message - skipping")
            except Exception as e:
                print(f"[STEP 1] Error: {e}")

            # Step 2: Check for UOWD Login Button
            print(f"\n[STEP 2] Checking for UOWD Login button...")
            try:
                login_button = self.page.locator("button.btn-danger:has-text('Login')")
                login_visible = login_button.is_visible()
                print(f"[STEP 2] Login button visible: {login_visible}")

                if login_visible:
                    print(f"[STEP 2] Clicking Login button...")
                    login_button.click()
                    time.sleep(5)
                    self.page.wait_for_load_state("domcontentloaded")
                    print(f"[STEP 2] ✓ Clicked. New URL: {self.page.url}")
                    self.handle_cloudflare()
                else:
                    print(f"[STEP 2] No Login button - skipping")
            except Exception as e:
                print(f"[STEP 2] Error: {e}")

            # Step 3: Microsoft SSO - Email
            print(f"\n[STEP 3] Microsoft SSO - Email")
            print(f"[STEP 3] Current URL: {self.page.url}")

            try:
                email_input = self.page.locator('input[type="email"]')
                email_visible = email_input.is_visible(timeout=15000)
                print(f"[STEP 3] Email input visible: {email_visible}")

                if email_visible:
                    print(f"[STEP 3] Filling email: {self.email}")
                    email_input.fill(self.email)
                    time.sleep(1)

                    print(f"[STEP 3] Clicking Next...")
                    self.page.locator('input[type="submit"]').click()
                    time.sleep(2)
                    print(f"[STEP 3] ✓ Submitted. URL: {self.page.url}")
                    self.handle_cloudflare()
                else:
                    print(f"[STEP 3] ⚠️ Email input not found")
            except Exception as e:
                print(f"[STEP 3] ⚠️ Error: {e}")

            # Step 4: Microsoft SSO - Password
            print(f"\n[STEP 4] Microsoft SSO - Password")
            print(f"[STEP 4] Current URL: {self.page.url}")

            try:
                print(f"[STEP 4] Waiting for password field...")
                self.page.wait_for_selector('input[type="password"]', state="visible", timeout=10000)
                print(f"[STEP 4] ✓ Password field appeared")
            except Exception as e:
                print(f"[STEP 4] Password field wait failed: {e}")

            try:
                password_input = self.page.locator('input[type="password"]')
                password_visible = password_input.is_visible(timeout=10000)
                print(f"[STEP 4] Password input visible: {password_visible}")

                if password_visible:
                    print(f"[STEP 4] Filling password...")
                    password_input.fill(self.password)
                    time.sleep(1)

                    print(f"[STEP 4] Clicking Sign in...")
                    self.page.locator('input[type="submit"]').click()
                    time.sleep(2)
                    print(f"[STEP 4] ✓ Submitted. URL: {self.page.url}")
                    self.handle_cloudflare()
                else:
                    print(f"[STEP 4] ⚠️ Password input not found")
            except Exception as e:
                print(f"[STEP 4] ⚠️ Error: {e}")

            # Step 5: Microsoft SSO - TOTP
            print(f"\n[STEP 5] Microsoft SSO - TOTP")
            print(f"[STEP 5] Current URL: {self.page.url}")

            try:
                print(f"[STEP 5] Waiting for TOTP field...")
                self.page.wait_for_selector('input[name="otc"], input[id*="OTC"]', state="visible", timeout=10000)
                print(f"[STEP 5] ✓ TOTP field appeared")
            except Exception as e:
                print(f"[STEP 5] TOTP field wait failed: {e}")

            try:
                totp_input = self.page.locator('input[name="otc"], input[id*="OTC"]')
                totp_visible = totp_input.is_visible(timeout=10000)
                print(f"[STEP 5] TOTP input visible: {totp_visible}")

                if totp_visible:
                    code = generate_totp(self.totp_secret)
                    print(f"[STEP 5] Generated TOTP: {code}")
                    totp_input.fill(code)
                    time.sleep(1)

                    print(f"[STEP 5] Clicking Verify...")
                    verify_btn = self.page.locator('input[type="submit"]')
                    if verify_btn.is_visible():
                        verify_btn.click()
                        print(f"[STEP 5] ✓ Clicked Verify button")
                    else:
                        totp_input.press("Enter")
                        print(f"[STEP 5] ✓ Pressed Enter")

                    time.sleep(4)
                    print(f"[STEP 5] URL: {self.page.url}")
                    self.handle_cloudflare()
                else:
                    print(f"[STEP 5] ⚠️ TOTP input not found")
            except Exception as e:
                print(f"[STEP 5] ⚠️ Error: {e}")

            # Step 6: Stay signed in
            print(f"\n[STEP 6] Stay signed in")
            print(f"[STEP 6] Current URL: {self.page.url}")

            try:
                stay_signed_in = self.page.locator('input[value="Yes"], button:has-text("Yes")')
                stay_visible = stay_signed_in.is_visible(timeout=5000)
                print(f"[STEP 6] 'Stay signed in' visible: {stay_visible}")

                if stay_visible:
                    print(f"[STEP 6] Clicking Yes...")
                    stay_signed_in.click()
                    time.sleep(3)
                    self.page.wait_for_load_state("networkidle")
                    print(f"[STEP 6] ✓ Clicked. URL: {self.page.url}")
                    self.handle_cloudflare()
                else:
                    print(f"[STEP 6] No prompt - skipping")
            except Exception as e:
                print(f"[STEP 6] Error: {e}")

            # Verification
            print(f"\n[VERIFY] Checking login success...")
            final_url = self.page.url
            print(f"[VERIFY] Final URL: {final_url}")

            try:
                print(f"[VERIFY] Looking for label elements...")
                self.page.wait_for_selector("label", timeout=10000)
                print(f"[VERIFY] ✓ Found labels")

                in_uowd = "uowdubai.ac.ae" in final_url
                in_microsoft = "microsoft" in final_url
                print(f"[VERIFY] In UOWD domain: {in_uowd}")
                print(f"[VERIFY] In Microsoft domain: {in_microsoft}")

                if in_uowd and not in_microsoft:
                    print(f"\n[LOGIN] ✅ SUCCESS!")
                    print("="*70 + "\n")
                    return True
                else:
                    print(f"\n[VERIFY] ⚠️ URL check failed")
            except Exception as e:
                print(f"[VERIFY] ⚠️ Label check failed: {e}")

            print(f"\n[LOGIN] ❌ FAILED")
            print("="*70 + "\n")
            return False

        except Exception as e:
            print(f"\n[LOGIN] ❌ EXCEPTION: {e}")
            traceback.print_exc()
            print("="*70 + "\n")
            return False

    def get_semester_id(self) -> Optional[str]:
        """Determine the correct semester ID."""
        today = datetime.datetime.now()
        year = today.year
        month = today.month
        week = (today.day - 1) // 7 + 1

        sem_name = "Unknown"
        if month in [1, 2]: sem_name = f"Winter {year}"
        elif month == 3: sem_name = f"Winter {year}" if week <= 3 else f"Spring {year}"
        elif month in [4, 5]: sem_name = f"Spring {year}"
        elif month == 6: sem_name = f"Spring {year}"
        elif month == 7: sem_name = f"Summer {year}"
        elif month == 8: sem_name = f"Summer {year}" if week <= 2 else f"Autumn {year}"
        elif month in [9, 10, 11]: sem_name = f"Autumn {year}"
        elif month == 12: sem_name = f"Autumn {year}" if week <= 1 else f"Winter {year}"

        print(f"[SEMESTER] Target: {sem_name}")

        try:
            self.page.wait_for_selector("label", timeout=5000)
        except:
            print("[SEMESTER] Timeout waiting for labels")

        labels = self.page.locator("label").all()
        target_id = None

        if not labels:
            print("[SEMESTER] No labels found!")

        print("[SEMESTER] Available:")
        for label in labels:
            text = label.inner_text().strip()
            print(f"[SEMESTER]  - {text}")
            if sem_name.lower() in text.lower():
                parent = label.locator("..")
                radio = parent.locator("input[type='radio']")
                if radio.count() > 0:
                    target_id = radio.get_attribute("value")
                    print(f"[SEMESTER]  ✓ Found ID: {target_id}")
                    break

        if not target_id:
            first_radio = self.page.locator("input[type='radio']").first
            if first_radio.count() > 0:
                target_id = first_radio.get_attribute("value")
                print(f"[SEMESTER] Fallback ID: {target_id}")

        return target_id

    def scrape_data(self, output_path: Path):
        """Scrape the data and save to CSV."""
        if not self.login():
            raise Exception("Authentication failed")

        print(f"[SCRAPE] Navigating to timetable viewer...")
        self.page.goto(BASE_URL, wait_until="domcontentloaded")
        self.handle_cloudflare()

        sem_id = self.get_semester_id()
        if not sem_id:
            raise Exception("Could not find semester ID")

        print(f"[SCRAPE] Loading semester {sem_id}...")
        self.page.goto(f"{BASE_URL}?semester={sem_id}", wait_until="networkidle")

        # Extract JSON from script tag
        content = self.page.content()
        match = re.search(r"timetableData\s*=\s*(\[.*\])\s*;", content, re.DOTALL | re.MULTILINE)
        if not match:
            raise Exception("Could not find timetableData in page source")

        data = json.loads(match.group(1))
        print(f"[SCRAPE] Extracted {len(data)} records")

        # Write CSV
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"])
            writer.writeheader()

            for item in data:
                locs = [normalize_whitespace(l) for l in item.get("location", "").split(";") if l.strip()] or ["Unknown"]
                teachers = [normalize_whitespace(t) for t in item.get("lecturer", "").split(";") if t.strip()] or ["Unknown"]

                for loc in locs:
                    room = loc
                    for sc, name in ROOM_MAPPING.items():
                        if loc.startswith(sc):
                            room = name
                            break

                    for teacher in teachers:
                        writer.writerow({
                            "SubCode": item.get("subject_code", "").replace(" ", ""),
                            "Class": normalize_whitespace(item.get("type_with_section", "")),
                            "Day": normalize_whitespace(item.get("week_day", "")),
                            "StartTime": format_time_to_hh_mm(item.get("start_time")),
                            "EndTime": format_time_to_hh_mm(item.get("end_time")),
                            "Room": room,
                            "Teacher": teacher
                        })
        print(f"[SCRAPE] ✓ Saved to {output_path}")

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
        print("Missing credentials.")
        sys.exit(1)

    scraper = TimetableScraper(email, password, totp, args.headless)
    try:
        scraper.start_browser()
        scraper.scrape_data(args.output)
    except Exception as e:
        print(f"Scraping failed: {e}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        scraper.close()

if __name__ == "__main__":
    main()
