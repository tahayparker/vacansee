import argparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium_stealth import stealth
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import json
import csv
import sys
import time
import traceback

def scrape_timetable(output_path):
    driver = None
    try:
        print("Setting up Chrome options...")
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        print("Initializing Chrome driver...")
        service = Service()
        driver = webdriver.Chrome(service=service, options=options)
        
        # Apply stealth settings
        stealth(driver,
            languages=["en-US", "en"],
            vendor="Google Inc.",
            platform="Win32",
            webgl_vendor="Intel Inc.",
            renderer="Intel Iris OpenGL Engine",
            fix_hairline=True,
        )
        
        wait = WebDriverWait(driver, 30)
        
        print("Setting up page load timeout...")
        driver.set_page_load_timeout(30)
        
        print("Navigating to timetable viewer...")
        driver.get('https://my.uowdubai.ac.ae/timetable/viewer')
        
        # Wait for Cloudflare to clear
        print("Waiting for page to load completely...")
        time.sleep(10)
        
        print(f"Current URL: {driver.current_url}")
        
        # Print page source for debugging
        print("Page source snippet:")
        print(driver.page_source[:500])
        
        # First check if we're on the login page
        if 'login.microsoftonline.com' in driver.current_url:
            print("Detected Microsoft login page. Please log in manually first.")
            raise ValueError("Authentication required. Please log in to UOW Dubai first.")
        
        print("Waiting for timetable data...")
        try:
            # Wait for the page to be fully loaded
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # Check for timetable data
            wait.until(lambda d: d.execute_script(
                "return typeof timetableData !== 'undefined' && timetableData !== null"
            ))
        except TimeoutException:
            print("Timeout waiting for timetableData. Current page state:")
            print(f"URL: {driver.current_url}")
            print("Page source snippet:")
            print(driver.page_source[:500])
            raise
        
        print("Extracting timetable data...")
        timetable_data = driver.execute_script("return timetableData")
        
        if not timetable_data:
            print("No timetable data found. Page state:")
            print(f"URL: {driver.current_url}")
            print("Page source snippet:")
            print(driver.page_source[:500])
            raise ValueError("No timetable data found in the page")
        
        print(f"Found {len(timetable_data)} timetable entries")
        
        # Headers for the CSV file
        headers = ["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"]
        
        # Write to CSV file
        print(f"Writing data to {output_path}...")
        with open(output_path, mode="w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            writer.writeheader()
            
            for entry in timetable_data:
                row = {
                    "SubCode": entry.get("subject_code", "").replace(" ", ""),
                    "Class": entry.get("type_with_section", "").strip(),
                    "Day": entry.get("week_day", ""),
                    "StartTime": entry.get("start_time", ""),
                    "EndTime": entry.get("end_time", ""),
                    "Room": entry.get("location", ""),
                    "Teacher": entry.get("lecturer", ""),
                }
                writer.writerow(row)
        
        print("Successfully scraped timetable data")
        return True
        
    except WebDriverException as e:
        print(f"WebDriver error: {str(e)}", file=sys.stderr)
        print("WebDriver error details:", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        print("Full traceback:", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return False
    finally:
        if driver:
            try:
                print("Closing Chrome driver...")
                driver.quit()
            except Exception as e:
                print(f"Error closing driver: {str(e)}", file=sys.stderr)

def main():
    parser = argparse.ArgumentParser(description='Scrape UOW Dubai timetable data')
    parser.add_argument('--output', required=True, help='Output CSV file path')
    
    args = parser.parse_args()
    
    success = scrape_timetable(args.output)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
