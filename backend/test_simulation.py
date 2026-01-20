import requests
import random
import time
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import os

# --- 1. Setup Firebase ---
cred_path = "firebase_config/serviceAccountKey.json"

if not os.path.exists(cred_path):
    print(f"❌ Error: Cannot find {cred_path}")
    exit(1)

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("🔍 Fetching real students from Firestore...")

# Get all users who are registered as 'student'
students_ref = db.collection("users").where(filter=FieldFilter("role", "==", "student")).stream()

# Define who gets forced "Advanced" sessions
TARGET_EMAILS = ["test@devskill.com", "student@devskill.com"]

real_students = []
for doc in students_ref:
    data = doc.to_dict()
    email = data.get("email", "unknown@example.com")
    
    # DEFAULT: Random skill
    assigned_skill = random.choice(["Beginner", "Intermediate", "Advanced"])
    
    # 🎯 TARGETING LOGIC: Force specific emails to have specific skills
    if email in TARGET_EMAILS:
        assigned_skill = "Advanced"  # <--- FORCED ADVANCED
        print(f"🎯 LOCKED TARGET: {email} will perform {assigned_skill} tasks.")
    
    real_students.append({
        "id": doc.id,
        "email": email,
        "skill": assigned_skill
    })

if not real_students:
    print("⚠️ No real students found.")
    exit()

# --- 2. Configuration ---
url = "http://127.0.0.1:8000/analyze"

snippets = {
    "Beginner": [
        "print('Hello World')",
        "x = 10\ny = 20\nprint(x + y)",
        "for i in range(5):\n  print(i)"
    ],
    "Intermediate": [
        "def factorial(n):\n  return 1 if n == 0 else n * factorial(n-1)",
        "numbers = [x for x in range(10) if x % 2 == 0]",
        "try:\n  file = open('data.txt')\nexcept:\n  print('File not found')"
    ],
    "Advanced": [
        # Complex Class with inheritance
        "class Node:\n  def __init__(self, val):\n    self.val = val\n    self.next = None",
        # Lambda function
        "lambda x, y: x * y + (x / y) if y != 0 else 0",
        # Threading/Async (High complexity keywords)
        "import threading\nt = threading.Thread(target=process_data)\nt.start()",
        "import asyncio\nasync def main():\n  await asyncio.sleep(1)"
    ]
}

print(f"\n🚀 Starting Simulation for {len(real_students)} students...")

# --- 3. Generate Sessions ---
for student in real_students:
    print(f"\n--- Simulating for: {student['email']} [{student['skill']}] ---")
    
    # Generate 2 sessions per student
    for i in range(2): 
        current_skill_attempt = student["skill"]
        
        # Randomness Logic: 
        # If it's a TARGET user, DO NOT randomize. Always send Advanced.
        # For others, keep the 20% randomness for realism.
        if student["email"] not in TARGET_EMAILS:
            if random.random() > 0.8:
                current_skill_attempt = random.choice(["Beginner", "Intermediate", "Advanced"])

        code_text = random.choice(snippets.get(current_skill_attempt, snippets["Beginner"]))

        payload = {
            "userId": student["id"],
            "email": student["email"],
            "code": code_text,
            "language": "python",
            "fileName": f"task_{random.randint(100, 999)}.py",
            "duration": random.randint(30, 300),
            "keystrokes": random.randint(50, 500)
        }

        try:
            response = requests.post(url, json=payload)
            if response.status_code == 200:
                print(f"   ✅ Session {i+1}: Success ({current_skill_attempt} Code)")
            else:
                print(f"   ❌ Session {i+1}: Failed - {response.text}")
        except Exception as e:
            print(f"   ❌ Connection Error: {e}")
        
        time.sleep(0.2) 

print("\n🎉 Simulation Complete!")