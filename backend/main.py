import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import os
import joblib 
import numpy as np
import random # Added for quest selection

cred_path = "firebase_config/serviceAccountKey.json"

if not os.path.exists(cred_path):
    print(f"❌ Error: Cannot find {cred_path}")
else:
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    print("✅ Firebase Admin Connected")

db = firestore.client()
app = FastAPI()

# --- AI Model Loading ---
ai_model = None
try:
    ai_model = joblib.load("ai_models/skill_classifier.pkl")
    print("🧠 AI Model Loaded Successfully")
except Exception as e:
    try:
        ai_model = joblib.load("skill_classifier.pkl")
        print("🧠 AI Model Loaded Successfully (from root)")
    except:
        print(f"⚠️ Warning: AI Model not found. ({e})")

# --- Gamified Quests Data ---
CHALLENGES = {
    "Beginner": [
        {"id": 1, "title": "Loop Logic", "task": "Print numbers 1 to 10 using a for loop.", "xp": 50},
        {"id": 2, "title": "Variable Swap", "task": "Swap two variables without using a third one.", "xp": 40}
    ],
    "Intermediate": [
        {"id": 3, "title": "List Comprehension", "task": "Convert a list of strings to uppercase using one line.", "xp": 100},
        {"id": 4, "title": "Dictionary Merge", "task": "Merge two dictionaries and sum common keys.", "xp": 120}
    ],
    "Advanced": [
        {"id": 5, "title": "Decorator Design", "task": "Write a decorator that logs the execution time of a function.", "xp": 200},
        {"id": 6, "title": "Async Fetch", "task": "Implement a parallel data fetcher using asyncio.gather.", "xp": 250}
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
            "skill": skill_level,
            "ai_prob": ai_probability
        }

    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))