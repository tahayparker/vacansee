import argparse
import json
import requests
from bs4 import BeautifulSoup
import re
import sys
import csv
import time
import random

rooms = [{"0.17":"0.17-Lecture Theatre"}, {"0.201":"0.201-Concrete / Geo Tech Lab"}, {"1.38":"1.38-Circuits Lab"}, {"1.48":"1.48-Thermal Lab"}, {"1.49":"1.49-Manufacturing & Workshop Lab"}, {"1.52":"1.52-Computer Lab Single"}, {"1.53":"1.53-Chemistry & Materials Science Lab"}, {"2.5":"2.50-Computer Lab Single"}, {"2.51":"2.51-Project Lab"}, {"3.42":"3.42-Classroom B"}, {"3.44":"3.44-Classroom B"}, {"3.45":"3.45-Classroom B"}, {"3.46":"3.46-Classroom A"}, {"3.47":"3.47-Game Dev Lab Dual Screens"}, {"3.48":"3.48-Classroom B"}, {"3.52":"3.52-Computer Lab (Network)"}, {"3.53":"3.53-Physics/Robotics Lab"}, {"4.42":"4.42-Computer Lab (Single Screen)"}, {"4.44":"4.44-Classroom B"}, {"4.45":"4.45-Classroom B"}, {"4.467":"4.467-Classroom A 4.46 & 4.47"}, {"4.48":"4.48-Classroom B"}, {"4.5":"4.50-Classroom B"}, {"4.51":"4.51-Tutorial Room"}, {"4.52":"4.52-Classroom A"}, {"4.53":"4.53-Seminar/Tutorial"}, {"5.08":"5.08-Seminar / Tutorial"}, {"5.1":"5.10-Classroom B"}, {"5.11":"5.11-Classroom B"}, {"5.12":"5.12-Informal Classroom"}, {"5.134":"5.134-Classroom A 5.13 & 5.14"}, {"5.15":"5.15-MAC Lab"}, {"5.17":"5.17-Classroom VC"}, {"5.18":"5.18-Classroom A"}, {"5.19":"5.19-Classroom A"}, {"6.28":"6.28-Seminar/Tutorial"}, {"6.29":"6.29-Multipurpose - Teaching & Research"}, {"6.3":"6.30-Multipurpose - Teaching & Research"}, {"6.32":"6.32-Classroom B"}, {"6.33":"6.33-Classroom B"}, {"6.345":"6.345-Classroom A 6.34 & 6.35"}, {"6.36":"6.36-Computer Lab (Single Screen)"}, {"6.38":"6.38-Classroom B"}, {"6.39":"6.39-Classroom A"}, {"6.4":"6.40-Computer Lab Single"}, {"Consultation":"Consultation"}, {"Online":"Online"}]

def get_random_user_agent():
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
    ]
    return random.choice(user_agents)

def fetch_with_retry(url, max_retries=5):
    session = requests.Session()
    
    headers = {
        'User-Agent': get_random_user_agent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'DNT': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
    
    for attempt in range(max_retries):
        try:
            # Add random delay between attempts
            if attempt > 0:
                time.sleep(random.uniform(2, 5))
            
            print(f"Attempt {attempt + 1} of {max_retries}...")
            response = session.get(url, headers=headers, timeout=30)
            
            # Print response details for debugging
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt == max_retries - 1:
                raise
            
            # If we get a 403, try with a different user agent
            if isinstance(e, requests.exceptions.HTTPError) and e.response.status_code == 403:
                headers['User-Agent'] = get_random_user_agent()

def scrape_timetable(output_path):
    try:
        print("Fetching timetable data...")
        response = fetch_with_retry('https://my.uowdubai.ac.ae/timetable/viewer')
        
        print("Parsing page content...")
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Save the HTML for debugging
        with open('debug_page.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        scripts = soup.find_all('script')
        
        timetable_data = None
        for script in scripts:
            if script.string and 'timetableData' in script.string:
                match = re.search(r'timetableData\s*=\s*(\[.*?\]);', script.string, re.DOTALL)
                if match:
                    timetable_data = json.loads(match.group(1))
                    break
        
        if not timetable_data:
            print("No timetable data found in the page")
            print("Page content snippet:")
            print(response.text[:500])
            return False
        
        print(f"Found {len(timetable_data)} raw entries")
        
        # CSV Headers
        headers = ["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"]
        
        # Transform and write the data
        valid_entries = 0
        with open(output_path, mode='w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            writer.writeheader()
            
            for entry in timetable_data:
                if not entry.get('subject_code'):
                    continue
                    
                row = {
                    'SubCode': entry['subject_code'].replace(' ', ''),
                    'Class': entry['type_with_section'].strip(),
                    'Day': entry['week_day'],
                    'StartTime': entry['start_time'],
                    'EndTime': entry['end_time'],
                    'Room': entry['location'],
                    'Teacher': entry['lecturer']
                }

                # If a room number has a ; in it, split it into two different rows
                if ';' in row['Room']:
                    rooms = row['Room'].split(';')
                    for room in rooms:
                        row['Room'] = room
                        # Since the full name will be cut off, use the first part of the room name and get the full name from the rooms list
                        row['Room'] = next((r['name'] for r in rooms if r['id'] == room.split('-')[0]), None)
                        writer.writerow(row)
                else:
                    writer.writerow(row)
                valid_entries += 1
        
        print(f"Processed {valid_entries} valid entries")
        print(f"Successfully saved data to {output_path}")
        return True
        
    except requests.RequestException as e:
        print(f"Request error: {str(e)}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        print("Full error details:", file=sys.stderr)
        import traceback
        print(traceback.format_exc(), file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description='Scrape UOW Dubai timetable data')
    parser.add_argument('--output', required=True, help='Output CSV file path')
    
    args = parser.parse_args()
    
    success = scrape_timetable(args.output)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
