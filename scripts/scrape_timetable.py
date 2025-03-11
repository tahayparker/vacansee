import argparse
import json
import cloudscraper
from bs4 import BeautifulSoup
import re
import sys
import csv
import time
import random
from datetime import datetime

ROOMS = {
    "0.17": "0.17-Lecture Theatre",
    "0.201": "0.201-Concrete / Geo Tech Lab",
    # ... (keep your existing ROOMS dictionary)
}

class TimetableScraper:
    def __init__(self):
        self.scraper = self.create_scraper()
        self.semester_cache = {}
        self.headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://my.uowdubai.ac.ae/',
            'DNT': '1',
        }

    def create_scraper(self):
        return cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'desktop': True,
                'mobile': False
            },
            delay=random.uniform(5, 10)
        )

    def get_current_semester_text(self):
        today = datetime.now()
        year = today.year
        return {
            1 <= today.month <= 4: f"Winter {year}",
            5 <= today.month <= 6: f"Spring {year}",
            7 <= today.month <= 8: f"Summer {year}",
        }.get(True, f"Autumn {year}")

    def fetch_page(self, url, max_retries=5):
        for attempt in range(max_retries):
            try:
                response = self.scraper.get(url, headers=self.headers, timeout=30)
                response.raise_for_status()

                # Randomize request timing
                time.sleep(random.uniform(1, 3))

                return response
            except Exception as e:
                print(f"Attempt {attempt+1} failed: {str(e)}")
                if attempt == max_retries - 1:
                    raise

                # Rotate headers and recreate scraper
                self.headers['User-Agent'] = self.random_user_agent()
                self.scraper = self.create_scraper()
                time.sleep(random.uniform(5, 15))

    def random_user_agent(self):
        return random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15...",
        ])

    def extract_semester_ids(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        semesters = {}

        for div in soup.select('div.custom-control.custom-radio.custom-control-inline'):
            radio = div.find('input', {'name': 'semester'})
            label = div.find('label').get_text(strip=True)
            if radio and label:
                semesters[label] = radio['value']

        return semesters

    def get_target_semester_id(self, html):
        current_semester = self.get_current_semester_text()
        semesters = self.extract_semester_ids(html)

        # Find best match that contains current semester text
        for label, sid in semesters.items():
            if current_semester.lower() in label.lower():
                return sid

        # Fallback to first available if no match
        return next(iter(semesters.values()), None)

    def extract_timetable_data(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        scripts = soup.find_all('script')

        for script in scripts:
            if script.string and 'timetableData' in script.string:
                match = re.search(r'timetableData\s*=\s*(\[.*?\]);', script.string, re.DOTALL)
                if match:
                    return json.loads(match.group(1))
        return None

    def process_data(self, raw_data, output_path):
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=[
                "SubCode", "Class", "Day", "StartTime",
                "EndTime", "Room", "Teacher"
            ])
            writer.writeheader()

            for entry in raw_data:
                if not entry.get('subject_code'):
                    continue

                rooms = entry['location'].split(';') if ';' in entry['location'] else [entry['location']]
                teachers = entry['lecturer'].split(';') if ';' in entry['lecturer'] else [entry['lecturer']]

                for room in rooms:
                    room = room.strip()
                    room_code = room.split('-')[0].strip()
                    room_name = ROOMS.get(room_code, room)

                    for teacher in teachers:
                        writer.writerow({
                            'SubCode': entry['subject_code'].replace(' ', ''),
                            'Class': entry['type_with_section'].strip(),
                            'Day': entry['week_day'],
                            'StartTime': entry['start_time'],
                            'EndTime': entry['end_time'],
                            'Room': room_name,
                            'Teacher': teacher.strip()
                        })

    def scrape(self, output_path):
        try:
            # Step 1: Get base page to find semester IDs
            base_response = self.fetch_page('https://my.uowdubai.ac.ae/timetable/viewer')
            semester_id = self.get_target_semester_id(base_response.text)

            if not semester_id:
                raise ValueError("Could not determine semester ID")

            # Step 2: Get timetable data with semester parameter
            target_url = f'https://my.uowdubai.ac.ae/timetable/viewer?semester={semester_id}'
            final_response = self.fetch_page(target_url)

            # Step 3: Extract and process data
            timetable_data = self.extract_timetable_data(final_response.text)
            if not timetable_data:
                raise ValueError("No timetable data found in page")

            self.process_data(timetable_data, output_path)
            return True

        except Exception as e:
            print(f"Scraping failed: {str(e)}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Scrape UOW Dubai timetable data')
    parser.add_argument('--output', required=True, help='Output CSV file path')
    args = parser.parse_args()

    scraper = TimetableScraper()
    success = scraper.scrape(args.output)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()