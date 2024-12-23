import asyncio
import json
import os
import asyncpg
from pathlib import Path

# Define constants
DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
TIME_SLOTS = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
    '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
    '20:30', '21:00', '21:30', '22:00', '22:30'
]

DB_URL = os.getenv("DATABASE_URL")
print(DB_URL)
input()

async def fetch_rooms(connection):
    print("Fetching unique room names from database...")
    query = """
        SELECT DISTINCT "Room"
        FROM "classes"
        ORDER BY "Room" ASC;
    """
    rows = await connection.fetch(query)
    rooms = [row['Room'] for row in rows]
    rooms = [room.split('-')[0] for room in rooms]
    print(f"Rooms fetched: {rooms}")
    return rooms

async def check_room_availability(connection, room, day, start_time, end_time):
    print(f"Checking availability for room {room} on {day} from {start_time} to {end_time}...")

    query = """
        SELECT 1
        FROM "classes"
        WHERE "Room" LIKE $1
          AND "Day" = $2
          AND NOT ("EndTime" <= $3 OR "StartTime" >= $4)
        LIMIT 1;
    """    
    result = await connection.fetchrow(query, f"{room}%", day, start_time, end_time)
    available = result is None
    print(f"Room {room} availability: {'Available' if available else 'Not Available'}")
    return available

async def generate_schedule_data():
    print("Starting schedule data generation...")
    
    # Await the coroutine to get the connection object
    connection = await asyncpg.connect(DB_URL)  
    
    try:
        room_names = await fetch_rooms(connection)
        schedule = []

        for day in DAYS_OF_WEEK:
            print(f"Processing day: {day}")
            day_data = {"day": day, "rooms": []}

            for room in room_names:
                room_data = {"room": room, "availability": []}

                for i in range(len(TIME_SLOTS) - 1):

                    start_time = TIME_SLOTS[i][:-1] + '1'
                    end_time = TIME_SLOTS[i][:-1] + '2'
                    available = await check_room_availability(connection, room, day, start_time, end_time)
                    room_data["availability"].append(1 if available else 0)

                day_data["rooms"].append(room_data)

            schedule.append(day_data)

        return schedule
    finally:
        await connection.close()  # Always close the connection


async def save_schedule_data():
    print("Saving schedule data to JSON file...")
    schedule_data = await generate_schedule_data()
    output_path = Path("./scheduleData.json")
    with output_path.open("w") as file:
        json.dump(schedule_data, file, indent=2)
    print(f"Schedule data saved to {output_path.resolve()}")

if __name__ == "__main__":
    asyncio.run(save_schedule_data())
