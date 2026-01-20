#!/usr/bin/env python3
"""
Standalone Test Simulation for student@devskill.com
This script generates test coding sessions by querying the backend for the real userId.
"""

import requests
import random
import time
from datetime import datetime

# --- Configuration ---
BACKEND_URL = "http://127.0.0.1:8000/analyze"
BACKEND_USER_LOOKUP_URL = "http://127.0.0.1:8000/get-user-id"
TARGET_EMAIL = "student@devskill.com"
TARGET_SKILL = "Advanced"  # Forcing Advanced level as per test_simulation.py

# Target student information (will be populated from backend)
TARGET_STUDENT = None

# Code snippets by skill level (from original test_simulation.py)
CODE_SNIPPETS = {
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
        "import asyncio\nasync def main():\n  await asyncio.sleep(1)",
        # Additional Advanced snippets for variety
        "@decorator\ndef timed_function(func):\n  import time\n  start = time.time()\n  result = func()\n  print(f'Took {time.time() - start}s')\n  return result",
        "class Stack:\n  def __init__(self):\n    self.items = []\n  def push(self, item):\n    self.items.append(item)\n  def pop(self):\n    return self.items.pop() if self.items else None"
    ]
}

def fetch_student_user_id(email):
    """Fetch the real userId (Firebase Auth UID) for the given email via backend API."""
    print(f"🔍 Searching for user: {email}")

    try:
        response = requests.get(f"{BACKEND_USER_LOOKUP_URL}/{email}", timeout=5)

        if response.status_code == 200:
            result = response.json()
            user_id = result.get("userId")
            print(f"✅ Found user: {email}")
            print(f"   → userId: {user_id}")
            return user_id
        elif response.status_code == 404:
            print(f"❌ User not found: {email}")
            print("\n💡 Make sure the user is registered in your system.")
            print("   You can register at: http://localhost:3000/signup")
            return None
        else:
            print(f"❌ Backend returned error: {response.status_code}")
            print(f"   → {response.text}")
            return None

    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to backend")
        print("\n💡 Make sure the backend server is running:")
        print("   cd /home/user/FYP/backend")
        print("   python3 main.py")
        return None
    except Exception as e:
        print(f"❌ Error querying backend: {e}")
        return None

def generate_session(student, skill_level, session_num):
    """Generate a single test session for the student."""
    code_text = random.choice(CODE_SNIPPETS.get(skill_level, CODE_SNIPPETS["Beginner"]))

    # Generate realistic metrics
    duration = random.randint(30, 300)  # 30-300 seconds
    keystrokes = random.randint(50, 500)  # 50-500 keystrokes

    payload = {
        "userId": student["userId"],
        "email": student["email"],
        "code": code_text,
        "language": "python",
        "fileName": f"task_{random.randint(100, 999)}.py",
        "duration": duration,
        "keystrokes": keystrokes
    }

    return payload

def run_simulation(num_sessions=2):
    """Run the simulation for student@devskill.com."""
    global TARGET_STUDENT

    print("=" * 60)
    print("🎯 Test Simulation for student@devskill.com")
    print("=" * 60)
    print()

    # Fetch real userId from Firestore
    user_id = fetch_student_user_id(TARGET_EMAIL)

    if not user_id:
        print("\n❌ Cannot proceed without valid userId")
        return False

    # Populate TARGET_STUDENT with real data
    TARGET_STUDENT = {
        "userId": user_id,
        "email": TARGET_EMAIL,
        "skill": TARGET_SKILL
    }

    print(f"\nTarget: {TARGET_STUDENT['email']}")
    print(f"Skill Level: {TARGET_STUDENT['skill']}")
    print(f"Sessions to Generate: {num_sessions}")
    print(f"Backend URL: {BACKEND_URL}")
    print()

    # Check backend connectivity
    print("🔍 Checking backend connectivity...")
    try:
        response = requests.get("http://127.0.0.1:8000/docs", timeout=2)
        print("✅ Backend is running")
    except Exception as e:
        print(f"❌ Backend is not accessible: {e}")
        print("\n💡 Please start the backend server first:")
        print("   cd /home/user/FYP/backend")
        print("   python3 main.py")
        return False

    print(f"\n🚀 Starting simulation...")
    print("-" * 60)

    successful_sessions = 0
    failed_sessions = 0

    for i in range(num_sessions):
        print(f"\n📝 Session {i + 1}/{num_sessions}")

        # Generate session payload
        payload = generate_session(TARGET_STUDENT, TARGET_STUDENT["skill"], i + 1)

        print(f"   Code Type: {TARGET_STUDENT['skill']}")
        print(f"   Duration: {payload['duration']}s")
        print(f"   Keystrokes: {payload['keystrokes']}")
        print(f"   File: {payload['fileName']}")

        # Send to backend
        try:
            response = requests.post(BACKEND_URL, json=payload, timeout=10)

            if response.status_code == 200:
                result = response.json()
                stats = result.get("stats", {})
                print(f"   ✅ Success!")
                print(f"      → Detected Skill: {stats.get('skillLevel', 'N/A')}")
                print(f"      → Confidence: {stats.get('confidence', 0):.1f}%")
                print(f"      → AI Probability: {stats.get('aiProbability', 0):.1f}%")
                successful_sessions += 1
            else:
                print(f"   ❌ Failed - Status {response.status_code}")
                print(f"      → Error: {response.text}")
                failed_sessions += 1

        except requests.exceptions.Timeout:
            print(f"   ❌ Timeout - Backend took too long to respond")
            failed_sessions += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            failed_sessions += 1

        # Small delay between sessions
        if i < num_sessions - 1:
            time.sleep(0.3)

    # Summary
    print("\n" + "=" * 60)
    print("📊 Simulation Complete!")
    print("=" * 60)
    print(f"✅ Successful: {successful_sessions}")
    print(f"❌ Failed: {failed_sessions}")
    print(f"📈 Success Rate: {(successful_sessions/num_sessions)*100:.1f}%")
    print()

    if successful_sessions > 0:
        print("💾 Sessions have been saved to Firestore 'sessions' collection")
        print("🎮 View them in the admin dashboard or directly in Firebase Console")

    return successful_sessions > 0

if __name__ == "__main__":
    import sys

    # Allow custom number of sessions via command line
    num_sessions = 2
    if len(sys.argv) > 1:
        try:
            num_sessions = int(sys.argv[1])
            if num_sessions < 1 or num_sessions > 50:
                print("⚠️  Number of sessions must be between 1 and 50")
                num_sessions = 2
        except ValueError:
            print("⚠️  Invalid number, using default (2 sessions)")

    success = run_simulation(num_sessions)
    sys.exit(0 if success else 1)
