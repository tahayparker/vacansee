"""
Authenticated Timetable Scraper using Playwright.
Handles Microsoft SSO authentication with TOTP-based 2FA.
Designed for robust autonomous execution on GitHub Actions.
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
import random as rand_module
import pyotp
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext, TimeoutError as PlaywrightTimeout, Error as PlaywrightError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
load_dotenv(".env.local", override=True)

# Local imports
from db_connection import get_supabase_client

# --- Constants ---
BASE_URL = "https://my.uowdubai.ac.ae/timetable/viewer"
DEFAULT_TIMEOUT = 30000  # 30 seconds
LONG_TIMEOUT = 60000  # 60 seconds for auth flows
MAX_RETRIES = 3
NAVIGATION_TIMEOUT = 90000  # 90 seconds for full page loads

# Rotating User Agents for better evasion
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

# --- Helper Functions ---
def normalize_whitespace(text: Optional[str]) -> str:
    """Replaces consecutive whitespace chars with a single space."""
    if not isinstance(text, str):
        return ""
    return " ".join(text.split())

def format_time_to_hh_mm(time_str: Optional[str]) -> str:
    """Converts a time string to 'HH:mm' format."""
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

# --- Supabase ---
try:
    supabase = get_supabase_client()
    print("✓ Connected to Supabase.")
except Exception as exc:
    print(f"✗ Supabase init failed: {exc}")
    sys.exit(1)

def fetch_room_mapping() -> Dict[str, str]:
    """Fetches room ShortCode to Name mapping from Supabase."""
    print("Fetching room mapping from Supabase...")
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
            sorted_keys = sorted(room_mapping.keys(), key=len, reverse=True)
            result = {key: room_mapping[key] for key in sorted_keys}
            print(f"✓ Fetched {len(result)} room mappings.")
            return result
    except Exception as e:
        print(f"✗ Error fetching room mapping: {e}")
    return room_mapping

ROOM_MAPPING = fetch_room_mapping()


class TimetableScraper:
    """Scrapes authenticated timetable data using Playwright."""

    def __init__(self, email: str, password: str, totp_secret: str, headless: bool = True):
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.playwright = None

    def start_browser(self):
        """Initialize Playwright browser with realistic settings."""
        print("\n[BROWSER] Initializing Playwright...")
        self.playwright = sync_playwright().start()

        print(f"[BROWSER] Launching browser (headless={self.headless})...")
        
        # More comprehensive anti-detection args
        launch_args = [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
        ]
        
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=launch_args,
            chromium_sandbox=False
        )
        
        # Select random user agent
        selected_ua = rand_module.choice(USER_AGENTS)
        print(f"[BROWSER] Using UA: {selected_ua[:50]}...")

        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent=selected_ua,
            locale='en-US',
            timezone_id='Asia/Dubai',
            # Additional anti-detection context options
            has_touch=False,
            is_mobile=False,
            java_script_enabled=True,
            # Permissions and features
            permissions=['geolocation'],
            geolocation={'latitude': 25.2048, 'longitude': 55.2708},  # Dubai coordinates
            color_scheme='light',
        )
        
        # Add extra headers to appear more legitimate
        self.context.set_extra_http_headers({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        })

        self.page = self.context.new_page()
        
        # Advanced automation masking
        self.page.add_init_script("""
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format'},
                    {name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: ''},
                    {name: 'Native Client', filename: 'internal-nacl-plugin', description: ''}
                ]
            });
            
            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // Chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {}
            };
            
            // Permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // WebGL Vendor
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter.apply(this, [parameter]);
            };
        """)
        
        print("[BROWSER] ✓ Browser ready with advanced anti-detection")

    def close(self):
        """Close browser and cleanup resources."""
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    def wait_for_navigation(self, timeout: int = NAVIGATION_TIMEOUT):
        """Wait for page to fully load."""
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
            self.page.wait_for_load_state("networkidle", timeout=timeout)
        except PlaywrightTimeout:
            print("[WARN] Navigation timeout, continuing anyway...")
    
    def check_and_handle_cloudflare(self, max_wait: int = 90) -> bool:
        """Check for and wait for Cloudflare challenge to complete with advanced bypass."""
        try:
            time.sleep(2)  # Initial wait for page to settle
            title = self.page.title().lower()
            
            # Check for Cloudflare challenge indicators
            cf_indicators = [
                "just a moment",
                "checking your browser",
                "verifying you are human",
                "challenge",
                "please wait"
            ]
            
            is_cloudflare = any(indicator in title for indicator in cf_indicators)
            
            if not is_cloudflare:
                # Also check page content and specific elements
                try:
                    # Check for common Cloudflare challenge elements
                    cf_selectors = [
                        "text='Checking your browser'",
                        "text='Just a moment'",
                        "#challenge-running",
                        ".cf-browser-verification"
                    ]
                    for selector in cf_selectors:
                        try:
                            if self.page.locator(selector).is_visible(timeout=1000):
                                is_cloudflare = True
                                break
                        except:
                            continue
                except:
                    pass
            
            if is_cloudflare:
                print(f"[CLOUDFLARE] Challenge detected: '{title}'")
                print(f"[CLOUDFLARE] Waiting up to {max_wait}s for automatic resolution...")
                
                # Try to find and interact with Cloudflare iframe if present
                try:
                    # Look for turnstile/challenge iframe
                    iframe_locator = self.page.frame_locator("iframe[src*='challenges.cloudflare.com']")
                    if iframe_locator:
                        print("[CLOUDFLARE] Found challenge iframe, attempting interaction...")
                        time.sleep(2)
                except:
                    pass
                
                start_time = time.time()
                check_interval = 2
                last_log_time = 0
                
                while time.time() - start_time < max_wait:
                    time.sleep(check_interval)
                    elapsed = time.time() - start_time
                    
                    try:
                        # Check current URL - sometimes redirects on success
                        current_url = self.page.url
                        
                        # If URL changed significantly, challenge might be cleared
                        if "challenge" not in current_url.lower():
                            current_title = self.page.title().lower()
                            
                            # Check if challenge cleared
                            if not any(indicator in current_title for indicator in cf_indicators):
                                # Triple-check by looking for challenge elements
                                challenge_present = False
                                try:
                                    challenge_present = self.page.get_by_text("Just a moment", exact=False).is_visible(timeout=500)
                                except:
                                    pass
                                
                                if not challenge_present:
                                    print(f"[CLOUDFLARE] ✓ Challenge cleared after {elapsed:.1f}s")
                                    time.sleep(3)  # Extra wait for stability
                                    return True
                        
                        # Log progress every 15 seconds
                        if elapsed - last_log_time >= 15:
                            print(f"[CLOUDFLARE] Still waiting... ({int(elapsed)}s / {max_wait}s)")
                            last_log_time = elapsed
                            
                    except Exception as e:
                        # If page context is destroyed, it might have navigated
                        if "context" in str(e).lower() or "destroyed" in str(e).lower():
                            print(f"[CLOUDFLARE] Page context changed, checking result...")
                            time.sleep(2)
                            try:
                                new_title = self.page.title().lower()
                                if not any(indicator in new_title for indicator in cf_indicators):
                                    print(f"[CLOUDFLARE] ✓ Challenge cleared after navigation")
                                    return True
                            except:
                                pass
                
                # Timeout reached - make final determination
                try:
                    final_title = self.page.title().lower()
                    final_url = self.page.url
                    print(f"[CLOUDFLARE] ✗ Challenge did not clear after {max_wait}s")
                    print(f"[CLOUDFLARE] Final title: '{final_title}'")
                    print(f"[CLOUDFLARE] Final URL: {final_url}")
                    
                    # Sometimes Cloudflare clears but page looks stuck
                    if "uowdubai.ac.ae" in final_url and "challenge" not in final_url:
                        print(f"[CLOUDFLARE] ℹ️ On target domain, attempting page refresh...")
                        try:
                            self.page.reload(wait_until="domcontentloaded", timeout=30000)
                            time.sleep(3)
                            refresh_title = self.page.title().lower()
                            if not any(indicator in refresh_title for indicator in cf_indicators):
                                print(f"[CLOUDFLARE] ✓ Challenge cleared after refresh")
                                return True
                        except:
                            pass
                        print(f"[CLOUDFLARE] ℹ️ Assuming success despite timeout (on target domain)")
                        return True
                        
                except:
                    pass
                    
                return False
            
            return True  # No challenge detected
            
        except Exception as e:
            print(f"[CLOUDFLARE] Error checking: {e}")
            # If error but we can still access page, assume OK
            try:
                if "uowdubai.ac.ae" in self.page.url:
                    return True
            except:
                pass
            return True  # Assume no challenge on error

    def login(self) -> bool:
        """Handle the complete login flow with Microsoft SSO."""
        print("\n" + "="*70)
        print("[LOGIN] Starting authentication flow")
        print("="*70)

        try:
            # Step 1: Navigate to base URL
            print("\n[STEP 1] Navigating to timetable viewer...")
            self.page.goto(BASE_URL, timeout=NAVIGATION_TIMEOUT, wait_until="domcontentloaded")
            print(f"[STEP 1] ✓ Loaded: {self.page.url}")
            time.sleep(3)  # Allow page to render
            
            # Check for Cloudflare after initial load
            if not self.check_and_handle_cloudflare():
                print("[STEP 1] ✗ Cloudflare challenge failed")
                return False

            # Step 2: Check for "restricted" message and click login
            print("\n[STEP 2] Checking for login requirement...")
            try:
                # Look for "Timetable Viewer is restricted" text
                if self.page.get_by_text("Timetable Viewer is restricted").is_visible(timeout=5000):
                    print("[STEP 2] Found restricted message, clicking 'here' link...")
                    self.page.get_by_text("here").click()
                    self.wait_for_navigation()
                    print(f"[STEP 2] ✓ Navigated: {self.page.url}")
                    time.sleep(2)
                    
                    # Check for Cloudflare after clicking
                    if not self.check_and_handle_cloudflare():
                        print("[STEP 2] ✗ Cloudflare challenge failed")
                        return False
            except PlaywrightTimeout:
                print("[STEP 2] No restricted message found, continuing...")

            # Step 3: Click the main Login button
            print("\n[STEP 3] Looking for Login button...")
            try:
                login_btn = self.page.locator("button.btn-danger:has-text('Login')").first
                if login_btn.is_visible(timeout=5000):
                    print("[STEP 3] Clicking Login button...")
                    login_btn.click()
                    self.wait_for_navigation()
                    print(f"[STEP 3] ✓ Navigated to: {self.page.url}")
                    time.sleep(2)
                    
                    # Check for Cloudflare after navigation
                    if not self.check_and_handle_cloudflare():
                        print("[STEP 3] ✗ Cloudflare challenge failed")
                        return False
            except PlaywrightTimeout:
                print("[STEP 3] Login button not found or already logged in...")

            # Step 4: Enter email for Microsoft SSO
            print("\n[STEP 4] Entering email for Microsoft SSO...")
            try:
                email_input = self.page.locator('input[type="email"]').first
                email_input.wait_for(state="visible", timeout=DEFAULT_TIMEOUT)
                email_input.click()
                email_input.fill(self.email)
                print(f"[STEP 4] ✓ Entered email: {self.email}")

                # Click Next
                next_btn = self.page.locator('input[type="submit"]').first
                next_btn.click()
                print("[STEP 4] ✓ Clicked Next")
                time.sleep(3)
            except PlaywrightTimeout:
                print("[STEP 4] ✗ Email field not found")
                return False

            # Step 5: Enter password
            print("\n[STEP 5] Entering password...")
            try:
                password_input = self.page.locator('input[type="password"]').first
                password_input.wait_for(state="visible", timeout=DEFAULT_TIMEOUT)
                password_input.click()
                password_input.fill(self.password)
                print("[STEP 5] ✓ Entered password")

                # Click Sign in
                signin_btn = self.page.locator('input[type="submit"]').first
                signin_btn.click()
                print("[STEP 5] ✓ Clicked Sign in")
                time.sleep(3)
            except PlaywrightTimeout:
                print("[STEP 5] ✗ Password field not found")
                return False

            # Step 6: Enter TOTP code or handle alternative auth
            print("\n[STEP 6] Checking for 2FA prompt...")
            time.sleep(3)  # Wait for page to load after password
            
            try:
                current_url = self.page.url
                print(f"[STEP 6] Current URL: {current_url}")
                print(f"[STEP 6] Page title: {self.page.title()}")
                
                # Check if we're already authenticated (no 2FA required)
                if "uowdubai.ac.ae" in current_url:
                    print("[STEP 6] ✓ No 2FA required, already authenticated")
                    return True
                
                # Try to find TOTP input field
                totp_input = None
                selectors = [
                    'input[name="otc"]',
                    'input[id*="idTxtBx_SAOTCC_OTC"]',
                    'input[type="tel"]',
                    'input[aria-label*="code"]',
                    'input[placeholder*="code"]'
                ]
                
                for selector in selectors:
                    try:
                        candidate = self.page.locator(selector).first
                        if candidate.is_visible(timeout=3000):
                            totp_input = candidate
                            print(f"[STEP 6] Found TOTP field with selector: {selector}")
                            break
                    except:
                        continue
                
                if totp_input:
                    code = generate_totp(self.totp_secret)
                    print(f"[STEP 6] Generated TOTP: {code}")
                    
                    totp_input.click()
                    totp_input.fill(code)
                    print("[STEP 6] ✓ Entered TOTP")
                    
                    # Click Verify
                    verify_btn = self.page.locator('input[type="submit"]').first
                    verify_btn.click()
                    print("[STEP 6] ✓ Clicked Verify")
                    time.sleep(5)
                else:
                    # No TOTP field found - check for other auth methods
                    print("[STEP 6] No TOTP field found")
                    
                    # Check for "Use a different verification method" or similar
                    try:
                        diff_method = self.page.get_by_text("different", exact=False).first
                        if diff_method.is_visible(timeout=2000):
                            print("[STEP 6] ℹ️ Alternative verification methods available")
                    except:
                        pass
                    
                    # Wait a bit to see if page redirects automatically
                    print("[STEP 6] Waiting for automatic redirect...")
                    time.sleep(5)
                    
                    if "uowdubai.ac.ae" in self.page.url:
                        print("[STEP 6] ✓ Authenticated without TOTP")
                    else:
                        print(f"[STEP 6] Still at: {self.page.url}")
                        # Try taking a screenshot for debugging
                        try:
                            self.page.screenshot(path="debug_step6.png")
                            print("[STEP 6] Screenshot saved to debug_step6.png")
                        except:
                            pass
                        print("[STEP 6] ✗ Cannot proceed with authentication")
                        return False
                    
            except Exception as e:
                print(f"[STEP 6] ✗ Exception: {e}")
                return False
            
            # Step 7: Handle "Stay signed in?" prompt
            print("\n[STEP 7] Handling 'Stay signed in' prompt...")
            try:
                stay_btn = self.page.locator('input[type="submit"][value="Yes"]').first
                if stay_btn.is_visible(timeout=10000):
                    print("[STEP 7] Clicking Yes...")
                    stay_btn.click()
                    self.wait_for_navigation()
                    print("[STEP 7] ✓ Accepted stay signed in")
                else:
                    print("[STEP 7] No prompt found, continuing...")
            except PlaywrightTimeout:
                print("[STEP 7] No stay signed in prompt")

            # Verification: Check if we're back at UOWD domain
            time.sleep(3)
            final_url = self.page.url
            print(f"\n[VERIFY] Final URL: {final_url}")

            if "uowdubai.ac.ae" in final_url and "microsoft" not in final_url:
                print("\n[LOGIN] ✅ Authentication successful!")
                print("="*70 + "\n")
                return True
            else:
                print("\n[LOGIN] ✗ Authentication may have failed")
                print("="*70 + "\n")
                return False

        except Exception as e:
            print(f"\n[LOGIN] ✗ Exception during login: {e}")
            traceback.print_exc()
            print("="*70 + "\n")
            return False

    def get_current_semester_text(self) -> str:
        """Return the current semester text based on date."""
        today = datetime.datetime.now()
        year = today.year
        month = today.month
        week = (today.day - 1) // 7 + 1

        if month in [1, 2]:
            return f"Winter {year}"
        elif month == 3:
            return f"Winter {year}" if week <= 3 else f"Spring {year}"
        elif month in [4, 5, 6]:
            return f"Spring {year}"
        elif month == 7:
            return f"Summer {year}"
        elif month == 8:
            return f"Summer {year}" if week <= 2 else f"Autumn {year}"
        elif month in [9, 10, 11]:
            return f"Autumn {year}"
        elif month == 12:
            return f"Autumn {year}" if week <= 1 else f"Winter {year}"
        return "Unknown"

    def get_semester_id(self) -> Optional[str]:
        """Determine the correct semester ID from available options."""
        target_semester = self.get_current_semester_text()
        print(f"\n[SEMESTER] Target semester: {target_semester}")

        try:
            # Wait for radio buttons to appear
            self.page.wait_for_selector("input[type='radio']", timeout=DEFAULT_TIMEOUT)

            # Get all labels
            labels = self.page.locator("label").all()
            print(f"[SEMESTER] Found {len(labels)} labels")

            # Find matching semester
            for label in labels:
                text = label.inner_text().strip()
                if target_semester.lower() in text.lower():
                    # Found match, get associated radio value
                    parent = label.locator("..")
                    radio = parent.locator("input[type='radio']").first
                    if radio.count() > 0:
                        semester_id = radio.get_attribute("value")
                        print(f"[SEMESTER] ✓ Found matching ID: {semester_id} for '{text}'")
                        return semester_id

            # Fallback to first available
            print(f"[SEMESTER] No exact match for '{target_semester}', using first available")
            first_radio = self.page.locator("input[type='radio']").first
            semester_id = first_radio.get_attribute("value")
            print(f"[SEMESTER] Fallback ID: {semester_id}")
            return semester_id

        except Exception as e:
            print(f"[SEMESTER] ✗ Error finding semester: {e}")
            return None

    def extract_timetable_data(self) -> Optional[List[Dict]]:
        """Extract timetable data from page script."""
        print("\n[EXTRACT] Extracting timetable data from page...")
        try:
            content = self.page.content()
            match = re.search(r"timetableData\s*=\s*(\[.*\])\s*;", content, re.DOTALL | re.MULTILINE)

            if not match:
                print("[EXTRACT] ✗ Could not find timetableData in page")
                return None

            data = json.loads(match.group(1))
            print(f"[EXTRACT] ✓ Extracted {len(data)} timetable entries")
            return data

        except json.JSONDecodeError as e:
            print(f"[EXTRACT] ✗ JSON decode error: {e}")
            return None
        except Exception as e:
            print(f"[EXTRACT] ✗ Error extracting data: {e}")
            traceback.print_exc()
            return None

    def scrape_data(self, output_path: Path):
        """Main scraping orchestration."""
        print("\n" + "="*70)
        print("[SCRAPE] Starting scrape process")
        print("="*70)

        # Step 1: Authenticate
        if not self.login():
            raise Exception("Authentication failed")

        # Step 2: Navigate to timetable viewer
        print("\n[SCRAPE] Navigating to timetable viewer...")
        self.page.goto(BASE_URL, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT)
        time.sleep(3)
        
        # Check for Cloudflare
        if not self.check_and_handle_cloudflare():
            raise Exception("Cloudflare challenge failed on timetable page")

        # Step 3: Get semester ID
        semester_id = self.get_semester_id()
        if not semester_id:
            raise Exception("Could not determine semester ID")

        # Step 4: Load semester data
        print(f"\n[SCRAPE] Loading semester {semester_id}...")
        semester_url = f"{BASE_URL}?semester={semester_id}"
        self.page.goto(semester_url, wait_until="networkidle", timeout=NAVIGATION_TIMEOUT)
        time.sleep(3)
        
        # Check for Cloudflare on semester page
        if not self.check_and_handle_cloudflare():
            raise Exception("Cloudflare challenge failed on semester page")

        # Step 5: Extract data
        data = self.extract_timetable_data()
        if not data:
            raise Exception("Failed to extract timetable data")

        # Step 6: Process and save to CSV
        print("\n[SCRAPE] Processing and saving data...")
        self.process_data_to_csv(data, output_path)
        print("\n" + "="*70)
        print("[SCRAPE] ✅ Scraping completed successfully")
        print("="*70)

    def process_data_to_csv(self, raw_data: List[Dict[str, Any]], output_path: Path):
        """Process raw timetable data and write to CSV."""
        print(f"[CSV] Writing {len(raw_data)} entries to {output_path}...")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        processed_count = 0

        with output_path.open("w", newline="", encoding="utf-8") as f:
            fieldnames = ["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for entry in raw_data:
                # Extract and normalize locations
                raw_locations = entry.get("location", "").split(";")
                locations = [normalize_whitespace(loc) for loc in raw_locations if loc.strip()] or ["Unknown"]

                # Extract and normalize teachers
                raw_teachers = entry.get("lecturer", "").split(";")
                teachers = [normalize_whitespace(t) for t in raw_teachers if t.strip()] or ["Unknown"]

                for loc in locations:
                    # Apply room mapping
                    room = loc
                    for short_code, full_name in ROOM_MAPPING.items():
                        if loc.startswith(short_code):
                            room = full_name
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
                        processed_count += 1

        print(f"[CSV] ✓ Wrote {processed_count} rows to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Scrape authenticated timetable data")
    parser.add_argument("--output", required=True, type=Path, help="Output CSV file path")
    parser.add_argument("--headless", action="store_true", default=True, help="Run in headless mode")
    parser.add_argument("--no-headless", action="store_false", dest="headless", help="Run with visible browser")
    args = parser.parse_args()

    email = os.getenv("UOWD_EMAIL")
    password = os.getenv("UOWD_PASSWORD")
    totp = os.getenv("UOWD_TOTP_SECRET")

    if not all([email, password, totp]):
        print("✗ Missing credentials in environment variables:")
        print(f"  UOWD_EMAIL: {'✓' if email else '✗'}")
        print(f"  UOWD_PASSWORD: {'✓' if password else '✗'}")
        print(f"  UOWD_TOTP_SECRET: {'✓' if totp else '✗'}")
        sys.exit(1)

    scraper = TimetableScraper(email, password, totp, args.headless)
    try:
        scraper.start_browser()
        scraper.scrape_data(args.output)
        print(f"\n✅ SUCCESS: Data saved to {args.output.resolve()}")
    except Exception as e:
        print(f"\n✗ FAILED: {e}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        scraper.close()

if __name__ == "__main__":
    main()
