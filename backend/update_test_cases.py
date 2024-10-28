import json
import sqlite3
import os
from pathlib import Path

def update_test_cases():
    # Get absolute paths based on script location
    script_dir = Path(__file__).parent
    json_path = script_dir / "evaluation_test_cases.json"
    db_path = script_dir.parent / "data" / "llm_eval.db"
    
    # Read JSON file
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Get criteria IDs
    c.execute("SELECT id, name FROM criteria")
    criteria_map = {name: id for id, name in c.fetchall()}
    
    try:
        # Delete existing test cases
        c.execute("DELETE FROM test_cases")
        
        # Insert new test cases
        for case in data['test_cases']:
            c.execute("""
                INSERT INTO test_cases (id, evaluation_type_id, criterion_id, input, description)
                VALUES (?, 1, ?, ?, ?)
            """, (case['id'], criteria_map[case['criterion']], case['input'], case['description']))
        
        conn.commit()
        print(f"Successfully updated {len(data['test_cases'])} test cases!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating test cases: {e}")
        
    finally:
        conn.close()

if __name__ == "__main__":
    update_test_cases()