import sqlite3
import json
from datetime import datetime

conn = sqlite3.connect(r'E:\vacansee\warp.sqlite')
cursor = conn.cursor()

# Get the most recent conversation
cursor.execute("""
    SELECT id, exchange_id, conversation_id, start_ts, input, output_status
    FROM ai_queries 
    WHERE conversation_id = 'ede0b737-e23d-4138-bc4e-bdebf19defe5'
    ORDER BY start_ts DESC
    LIMIT 20
""")

queries = cursor.fetchall()

print("=" * 80)
print("RECENT CONVERSATION: Automate Timetable Login With 2FA")
print("=" * 80)
print()

for query in reversed(queries):
    qid, exchange_id, conv_id, start_ts, input_data, status = query
    
    print(f"Time: {start_ts}")
    print(f"Status: {status}")
    
    # Parse input
    try:
        input_parsed = json.loads(input_data)
        if input_parsed:
            for item in input_parsed:
                if 'Query' in item:
                    print(f"User: {item['Query']['text'][:500]}")
    except:
        pass
    
    # Get AI response
    cursor.execute("SELECT output FROM ai_blocks WHERE exchange_id = ?", (exchange_id,))
    output_row = cursor.fetchone()
    if output_row:
        try:
            output_data = json.loads(output_row[0])
            if 'Received' in output_data:
                output_items = output_data['Received']['output']
                for out in output_items:
                    if 'Text' in out:
                        print(f"AI: {out['Text']['text'][:500]}")
        except:
            pass
    
    print("-" * 80)
    print()

# Get conversation metadata
cursor.execute("""
    SELECT conversation_data 
    FROM agent_conversations 
    WHERE conversation_id = 'ede0b737-e23d-4138-bc4e-bdebf19defe5'
""")
conv_data = cursor.fetchone()
if conv_data:
    conv_info = json.loads(conv_data[0])
    print("\n" + "=" * 80)
    print("TODO LIST:")
    print("=" * 80)
    
    if 'todo_lists' in conv_info and conv_info['todo_lists']:
        todo_list = conv_info['todo_lists'][0]
        
        print("\nCompleted:")
        for item in todo_list.get('completed_items', []):
            print(f"  ✓ {item['title']}")
            print(f"    {item['description']}")
        
        print("\nPending:")
        for item in todo_list.get('pending_items', []):
            print(f"  ○ {item['title']}")
            print(f"    {item['description']}")

conn.close()
