import requests
import random
import time
import firebase_admin
from firebase_admin import credentials, firestore
import os

# --- 1. Setup Firebase to Fetch Real Users ---
# We reuse the same key you generated for the backend
cred_path = "firebase_config/serviceAccountKey.json"

if not os.path.exists(cred_path):
    print(f"❌ Error: Cannot find {cred_path}. Make sure you are in the 'backend' folder.")
    exit(1)

# Initialize Firebase (Check if already initialized to avoid errors)
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("🔍 Fetching real students from Firestore...")

# Get all users who are registered as 'student'
students_ref = db.collection("users").where("role", "==", "student").stream()

real_students = []
for doc in students_ref:
    data = doc.to_dict()
    real_students.append({
        "id": doc.id,
        "email": data.get("email", "unknown@example.com"),
        # We assign a random 'target skill' to them for this simulation
        "skill": random.choice(["Beginner", "Intermediate", "Advanced"]) 
    })

if not real_students:
    print("⚠️ No real students found in Firestore! (Did you register any via the React App?)")
    print("   -> Switching to Mock Data for testing.")
    real_students = [
        {"id": "MOCK_001", "email": "mock_alice@devskill.com", "skill": "Beginner"},
        {"id": "MOCK_002", "email": "mock_bob@devskill.com", "skill": "Advanced"}
    ]
else:
    print(f"✅ Found {len(real_students)} real students.")

# --- 2. Configuration ---
url = "http://127.0.0.1:8000/analyze"

snippets = {
    "Beginner": [
        "print('Hello World')",
        "x = 10\ny = 20\nprint(x + y)",
        "name = input('Enter your name: ')",
        "for i in range(5):\n  print(i)"
    ],
    "Intermediate": [
        "def factorial(n):\n  return 1 if n == 0 else n * factorial(n-1)",
        "numbers = [x for x in range(10) if x % 2 == 0]",
        "try:\n  file = open('data.txt')\nexcept:\n  print('File not found')",
        "import random\nprint(random.randint(1, 100))"
    ],
    "Advanced": [
        "class Node:\n  def __init__(self, val):\n    self.val = val\n    self.next = None",
        "lambda x, y: x * y + (x / y) if y != 0 else 0",
        "import threading\nt = threading.Thread(target=process_data)\nt.start()",
        "import asyncio\nasync def main():\n  await asyncio.sleep(1)"
    ]
}

print("\n🚀 Starting Real-User Simulation...")

# --- 3. Generate Sessions ---
# We will generate 2 sessions for EACH student found
for student in real_students:
    print(f"\n--- Simulating for: {student['email']} ---")
    
    for i in range(2): # 2 sessions per student
        # Logic: 80% chance they write code matching their assigned skill level
        current_skill_attempt = student["skill"]
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
            print("      (Make sure your backend server is running!)")
        
        time.sleep(0.2) 

print("\n🎉 Simulation Complete! Check your Admin Dashboard.")