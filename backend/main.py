import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud.firestore_v1.base_query import FieldFilter
import os
import joblib
import random

cred_path = "firebase_config/serviceAccountKey.json"

if not os.path.exists(cred_path):
    print(f"❌ Error: Cannot find {cred_path}")
else:
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    print("✅ Firebase Admin Connected")

db = firestore.client()
app = FastAPI(title="DevSkill Tracker API", version="1.0.0")

# Enable CORS for frontend and extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # React dev server
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "vscode-webview://*",         # VS Code extension webview
        "*"                           # Allow all origins for extension
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI Model Loading ---
ai_model = None
try:
    ai_model = joblib.load("ai_models/skill_classifier.pkl")
    print("🧠 AI Model Loaded Successfully")
except Exception as e:
    try:
        ai_model = joblib.load("skill_classifier.pkl")
        print("🧠 AI Model Loaded Successfully (from root)")
    except FileNotFoundError:
        print(f"⚠️ Warning: AI Model not found. ({e})")
    except Exception as ex:
        print(f"⚠️ Warning: AI Model loading failed. ({ex})")

# --- Gamified Quests Data ---
CHALLENGES = {
    "Beginner": [
        {"id": 1, "title": "Loop Logic", "task": "Print numbers 1 to 10 using a for loop.", "xp": 50},
        {"id": 2, "title": "Variable Swap", "task": "Swap two variables without using a third one.", "xp": 40},
        {"id": 3, "title": "Sum Calculator", "task": "Create a function that takes two numbers and returns their sum.", "xp": 45},
        {"id": 4, "title": "Even or Odd", "task": "Write a program that checks if a number is even or odd.", "xp": 50},
        {"id": 5, "title": "String Reversal", "task": "Reverse a string without using built-in reverse functions.", "xp": 60},
        {"id": 6, "title": "Max Finder", "task": "Find the maximum number in a list without using max().", "xp": 55},
        {"id": 7, "title": "FizzBuzz Classic", "task": "Print numbers 1-100, but print 'Fizz' for multiples of 3, 'Buzz' for 5, and 'FizzBuzz' for both.", "xp": 70},
        {"id": 8, "title": "Vowel Counter", "task": "Count the number of vowels in a given string.", "xp": 60},
        {"id": 9, "title": "Palindrome Check", "task": "Check if a given string is a palindrome (reads same forwards and backwards).", "xp": 65},
        {"id": 10, "title": "List Sum", "task": "Calculate the sum of all numbers in a list.", "xp": 50},
        {"id": 11, "title": "Temperature Converter", "task": "Convert temperature from Celsius to Fahrenheit.", "xp": 55},
        {"id": 12, "title": "Grade Calculator", "task": "Create a function that converts a score (0-100) to a letter grade (A, B, C, D, F).", "xp": 60}
    ],
    "Intermediate": [
        {"id": 13, "title": "List Comprehension", "task": "Convert a list of strings to uppercase using list comprehension in one line.", "xp": 100},
        {"id": 14, "title": "Dictionary Merge", "task": "Merge two dictionaries and sum values for common keys.", "xp": 120},
        {"id": 15, "title": "Fibonacci Generator", "task": "Create a function that generates the first n Fibonacci numbers.", "xp": 110},
        {"id": 16, "title": "Anagram Detector", "task": "Write a function to check if two strings are anagrams of each other.", "xp": 105},
        {"id": 17, "title": "Prime Number Checker", "task": "Create an efficient function to check if a number is prime.", "xp": 115},
        {"id": 18, "title": "Word Frequency", "task": "Count the frequency of each word in a sentence and return a dictionary.", "xp": 125},
        {"id": 19, "title": "Binary Search", "task": "Implement binary search algorithm on a sorted list.", "xp": 130},
        {"id": 20, "title": "Duplicate Remover", "task": "Remove duplicates from a list while preserving the original order.", "xp": 110},
        {"id": 21, "title": "Matrix Transpose", "task": "Transpose a 2D matrix (swap rows and columns).", "xp": 120},
        {"id": 22, "title": "Nested Dict Access", "task": "Safely access nested dictionary values with a default fallback.", "xp": 115},
        {"id": 23, "title": "CSV Parser", "task": "Parse a CSV-formatted string into a list of dictionaries.", "xp": 135},
        {"id": 24, "title": "Bubble Sort", "task": "Implement the bubble sort algorithm to sort a list.", "xp": 125}
    ],
    "Advanced": [
        {"id": 25, "title": "Decorator Design", "task": "Write a decorator that logs the execution time of a function.", "xp": 200},
        {"id": 26, "title": "Async Fetch", "task": "Implement a parallel data fetcher using asyncio.gather.", "xp": 250},
        {"id": 27, "title": "LRU Cache", "task": "Implement a Least Recently Used (LRU) cache with get and put operations.", "xp": 220},
        {"id": 28, "title": "Custom Context Manager", "task": "Create a context manager using __enter__ and __exit__ methods.", "xp": 210},
        {"id": 29, "title": "Metaclass Magic", "task": "Create a metaclass that automatically adds a timestamp to class instances.", "xp": 240},
        {"id": 30, "title": "Generator Pipeline", "task": "Build a data processing pipeline using multiple generators.", "xp": 230},
        {"id": 31, "title": "Dependency Injector", "task": "Implement a simple dependency injection container.", "xp": 260},
        {"id": 32, "title": "Retry Decorator", "task": "Create a decorator that retries a function n times with exponential backoff.", "xp": 225},
        {"id": 33, "title": "Tree Traversal", "task": "Implement depth-first and breadth-first tree traversal algorithms.", "xp": 245},
        {"id": 34, "title": "API Rate Limiter", "task": "Build a rate limiter that allows n requests per time window.", "xp": 255},
        {"id": 35, "title": "Custom ORM", "task": "Create a simple ORM-like class that maps Python objects to dictionaries.", "xp": 270},
        {"id": 36, "title": "Async Queue Worker", "task": "Implement an async task queue with worker pool using asyncio.", "xp": 280}
    ]
}

class CodeSession(BaseModel):
    userId: str
    email: str
    code: str
    language: str
    fileName: str
    duration: float
    keystrokes: int

# --- API Endpoints ---

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "DevSkill Tracker API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/get-user-id/{email}")
async def get_user_id(email: str):
    """Returns the userId (Firebase Auth UID) for a given email address."""
    try:
        users_ref = db.collection("users").where(filter=FieldFilter("email", "==", email)).stream()

        for doc in users_ref:
            return {
                "status": "success",
                "userId": doc.id,
                "email": email
            }

        raise HTTPException(status_code=404, detail=f"User not found: {email}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying user: {str(e)}")

@app.get("/get-quest/{skill_level}")
async def get_quest(skill_level: str):
    """Returns a random challenge based on the detected skill level."""
    quests = CHALLENGES.get(skill_level, CHALLENGES["Beginner"])
    return random.choice(quests)

@app.post("/analyze")
async def analyze_code(session: CodeSession):
    try:
        skill_level = "Beginner"
        confidence = 0.0
        
        if ai_model:
            skill_level = ai_model.predict([session.code])[0]
            probs = ai_model.predict_proba([session.code])[0]
            confidence = float(max(probs) * 100)
        else:
            if "class " in session.code or "lambda" in session.code:
                skill_level = "Advanced"
            elif "def " in session.code or "import " in session.code:
                skill_level = "Intermediate"

        cps = session.keystrokes / (session.duration + 1)
        ai_probability = 12.5
        
        if cps > 5.0: 
            ai_probability = 85.0
        elif cps > 3.0:
            ai_probability = 45.0

        doc_data = {
            "userId": session.userId,
            "email": session.email,
            "code": session.code,
            "language": session.language,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "stats": {
                "duration": session.duration,
                "keystrokes": session.keystrokes,
                "complexity": len(session.code.split()),
                "skillLevel": skill_level,
                "confidence": confidence,       
                "aiProbability": ai_probability 
            }
        }

        db.collection("sessions").add(doc_data)

        return {
            "status": "success",
            "stats": {
                "skillLevel": skill_level,
                "confidence": confidence,
                "aiProbability": ai_probability
            }
        }

    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))