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

    def _apply_stealth(self, context: BrowserContext):
        """Apply manual stealth scripts to the browser context."""
        # 1. Override navigator.webdriver
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)

        # 2. Mock languages (Plugins mock removed as it can be detected if done poorly)
        context.add_init_script("""
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        """)

        # 3. WebGL Vendor/Renderer override (optional but good)
        context.add_init_script("""
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                // UNMASKED_VENDOR_WEBGL
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                // UNMASKED_RENDERER_WEBGL
                if (parameter === 37446) {
                    return 'Intel(R) Iris(TM) Plus Graphics 640';
                }
                return getParameter(parameter);
            };
        """)

        # 4. Permissions mock
        context.add_init_script("""
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
        """)

    def start_browser(self):
        """Initialize Playwright with stealth settings."""
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

        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=args
        )

        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id='Asia/Dubai',
        )

        self._apply_stealth(self.context)
        self.page = self.context.new_page()

        # Random mouse movements to simulate human
        self.page.mouse.move(random.randint(0, 500), random.randint(0, 500))

    def close(self):
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if hasattr(self, 'playwright'):
            self.playwright.stop()

    def handle_cloudflare(self):
        """Check for and handle Cloudflare challenge."""
        time.sleep(3)  # Increased wait time as per user feedback
        try:
            # Check for common Cloudflare markers
            title = self.page.title().lower()
            print(f"Checking Cloudflare. Title: '{title}'")

            if (self.page.get_by_text("Just a moment").is_visible() or
                self.page.get_by_text("Verify you are human").is_visible() or
                "challenge" in title or
                "just a moment" in title):

                print("Cloudflare challenge detected. Attempting bypass...")

                # Try to click the Turnstile checkbox if it exists
                try:
                    # Wait for iframe to be available
                    self.page.wait_for_selector("iframe[src*='turnstile']", timeout=5000)
                    frames = self.page.frames
                    for frame in frames:
                        if "turnstile" in frame.url:
                            print("Found Turnstile frame. Clicking...")
                            # Click the checkbox or the body of the widget
                            frame.click("body", timeout=2000)
                            time.sleep(1)
                except:
                    pass

                # Wait for the challenge to clear using a polling loop
                print("Waiting for challenge to clear...")
                max_wait = 120  # seconds (increased for CI environment)
                start_time = time.time()
                while time.time() - start_time < max_wait:
                    try:
                        title = self.page.title().lower()
                        if "just a moment" not in title:
                            # Double-check the text isn't visible
                            if not self.page.get_by_text("Just a moment").is_visible(timeout=1000):
                                print("Cloudflare challenge passed!")
                                time.sleep(3)  # Extra wait after clearing
                                break
                    except:
                        pass
                    time.sleep(1)
                else:
                    print("Warning: Cloudflare challenge may not have cleared within timeout")
                    time.sleep(2)
        except Exception as e:
            print(f"Error in Cloudflare handling (might be false positive): {e}")

    def login(self) -> bool:
        """Handle the login flow."""
        print("Navigating to login page...")
        try:
            self.page.goto(BASE_URL, timeout=DEFAULT_TIMEOUT)
            self.handle_cloudflare()

            # Check for initial redirects or Cloudflare
            self.page.wait_for_load_state("domcontentloaded", timeout=DEFAULT_TIMEOUT)

            # 1. Check for "Timetable Viewer is restricted"
            if self.page.get_by_text("Timetable Viewer is restricted").is_visible():
                print("Clicking 'here' to login...")
                self.page.get_by_text("here").click()
                time.sleep(2)  # Added wait
                self.page.wait_for_load_state("domcontentloaded")
                self.handle_cloudflare()

            # 2. Check for UOWD Login Button
            if self.page.locator("button.btn-danger:has-text('Login')").is_visible():
                print("Clicking UOWD Login button...")
                self.page.locator("button.btn-danger:has-text('Login')").click()
                time.sleep(5)  # Longer wait for redirect to Microsoft
                self.page.wait_for_load_state("domcontentloaded")
                self.handle_cloudflare()

            # 3. Microsoft SSO - Email
            print("Checking for Microsoft login (Email)...")
            email_input = self.page.locator('input[type="email"]')
            if email_input.is_visible(timeout=15000):
                print(f"Entering email: {self.email}")
                email_input.fill(self.email)
                time.sleep(1)
                self.page.locator('input[type="submit"]').click()
                time.sleep(2)
                self.handle_cloudflare()

            # 4. Microsoft SSO - Password
            print("Checking for Microsoft login (Password)...")
            try:
                self.page.wait_for_selector('input[type="password"]', state="visible", timeout=10000)
            except:
                pass

            password_input = self.page.locator('input[type="password"]')
            if password_input.is_visible(timeout=10000):
                print("Entering password...")
                password_input.fill(self.password)
                time.sleep(1)
                self.page.locator('input[type="submit"]').click()
                time.sleep(2)
                self.handle_cloudflare()

            # 5. Microsoft SSO - TOTP
            print("Checking for Microsoft login (TOTP)...")
            try:
                self.page.wait_for_selector('input[name="otc"], input[id*="OTC"]', state="visible", timeout=10000)
            except:
                pass

            totp_input = self.page.locator('input[name="otc"], input[id*="OTC"]')
            if totp_input.is_visible(timeout=10000):
                print("Entering TOTP...")
                code = generate_totp(self.totp_secret)
                totp_input.fill(code)
                time.sleep(1)

                verify_btn = self.page.locator('input[type="submit"]')
                if verify_btn.is_visible():
                    verify_btn.click()
                else:
                    totp_input.press("Enter")
                time.sleep(4)
                self.handle_cloudflare()

            # 6. Stay signed in?
            stay_signed_in = self.page.locator('input[value="Yes"], button:has-text("Yes")')
            if stay_signed_in.is_visible(timeout=5000):
                print("Clicking 'Stay signed in'...")
                stay_signed_in.click()
                time.sleep(3)  # Added wait
                self.page.wait_for_load_state("networkidle")
                self.handle_cloudflare()

            # Verify success
            print("Verifying login success...")
            try:
                # Wait for semester labels or something specific to the timetable page
                self.page.wait_for_selector("label", timeout=10000)
                if "uowdubai.ac.ae" in self.page.url and "microsoft" not in self.page.url:
                    print("Login successful!")
                    return True
            except:
                print("Login verification failed: 'label' not found.")

            print(f"Login might have failed. Current URL: {self.page.url}")
            return False

        except Exception as e:
            print(f"Login failed with error: {e}")
            traceback.print_exc()
            return False

    def get_semester_id(self) -> Optional[str]:
        """Determine the correct semester ID."""
        # Logic: Get current date -> determine semester name -> find radio button
        # Reuse logic from original script but cleaner
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

        print(f"Target Semester: {sem_name}")

        # Find radio buttons
        try:
            self.page.wait_for_selector("label", timeout=5000)
        except:
            print("Timeout waiting for labels.")

        labels = self.page.locator("label").all()
        target_id = None

        if not labels:
            print("No labels found! Dumping page content to debug_page.html")
            with open("debug_page.html", "w", encoding="utf-8") as f:
                f.write(self.page.content())

        print("Available semesters on page:")
        for label in labels:
            text = label.inner_text().strip()
            print(f" - {text}")
            if sem_name.lower() in text.lower():
                # Find associated input
                parent = label.locator("..")
                radio = parent.locator("input[type='radio']")
                if radio.count() > 0:
                    target_id = radio.get_attribute("value")
                    print(f"   -> Found ID {target_id} for {text}")
                    break

        if not target_id:
            # Fallback to first available
            first_radio = self.page.locator("input[type='radio']").first
            if first_radio.count() > 0:
                target_id = first_radio.get_attribute("value")
                print(f"Fallback to first semester ID: {target_id}")

        return target_id

    def scrape_data(self, output_path: Path):
        """Scrape the data and save to CSV."""
        if not self.login():
            raise Exception("Authentication failed")

        # Ensure we are on the timetable viewer page
        print("Navigating to Timetable Viewer page...")
        self.page.goto(BASE_URL, wait_until="domcontentloaded")
        self.handle_cloudflare()

        sem_id = self.get_semester_id()
        if not sem_id:
            raise Exception("Could not find semester ID")

        print(f"Navigating to semester {sem_id}...")
        self.page.goto(f"{BASE_URL}?semester={sem_id}", wait_until="networkidle")

        # Extract JSON from script tag
        content = self.page.content()
        match = re.search(r"timetableData\s*=\s*(\[.*\])\s*;", content, re.DOTALL | re.MULTILINE)
        if not match:
            raise Exception("Could not find timetableData in page source")

        data = json.loads(match.group(1))
        print(f"Extracted {len(data)} records.")

        # Write CSV
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"])
            writer.writeheader()

            for item in data:
                # Process item similar to original script
                locs = [normalize_whitespace(l) for l in item.get("location", "").split(";") if l.strip()] or ["Unknown"]
                teachers = [normalize_whitespace(t) for t in item.get("lecturer", "").split(";") if t.strip()] or ["Unknown"]

                for loc in locs:
                    # Map room
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
        print(f"Saved to {output_path}")

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
