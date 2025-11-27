import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import os
import joblib 
import numpy as np

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

# --- 2. Load the AI Brain ---
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

class CodeSession(BaseModel):
    userId: str
    email: str
    code: str
    language: str
    fileName: str
    duration: float
    keystrokes: int

# --- 4. The Smart Endpoint ---
@app.post("/analyze")
async def analyze_code(session: CodeSession):
    try:
        # Default values
        skill_level = "Beginner"
        confidence = 0.0
        
        # --- A. PREDICT SKILL (Using Scikit-Learn) ---
        if ai_model:
            # Predict the label (Beginner/Intermediate/Advanced)
            skill_level = ai_model.predict([session.code])[0]
            
            # Get the confidence score (probability)
            probs = ai_model.predict_proba([session.code])[0]
            confidence = float(max(probs) * 100)
        else:
            # Fallback if model is missing: Use simple keyword check
            if "class " in session.code or "lambda" in session.code:
                skill_level = "Advanced"
            elif "def " in session.code or "import " in session.code:
                skill_level = "Intermediate"

        # --- B. DETECT AI (Mock Logic for now) ---
        # If code is written abnormally fast (> 5 keystrokes/sec), it's likely AI/Copied
        cps = session.keystrokes / (session.duration + 1) # Characters per second
        ai_probability = 12.5 # Base baseline
        
        if cps > 5.0: 
            ai_probability = 85.0 # Too fast! Likely pasted.
        elif cps > 3.0:
            ai_probability = 45.0 # Fast typist or partial paste

        # --- C. SAVE TO FIRESTORE ---
        doc_data = {
            "userId": session.userId,
            "email": session.email,
            "code": session.code,
            "language": session.language,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "stats": {
                "duration": session.duration,
                "keystrokes": session.keystrokes,
                "complexity": len(session.code.split()), # Simple word count
                "skillLevel": skill_level,      # <--- Now uses AI!
                "confidence": confidence,       
                "aiProbability": ai_probability # <--- Dynamic based on speed
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