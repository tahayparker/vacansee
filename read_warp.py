import sqlite3
import json

conn = sqlite3.connect(r'E:\vacansee\warp.sqlite')
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]
print("Tables:", tables)
print()

# Get recent conversation data
for table in tables:
    cursor.execute(f"SELECT * FROM {table} ORDER BY rowid DESC LIMIT 5")
    rows = cursor.fetchall()
    if rows:
        print(f"\n=== {table} ===")
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in cursor.fetchall()]
        print("Columns:", columns)
        for row in rows[:2]:  # Show first 2 rows
            print(dict(zip(columns, row)))

conn.close()
