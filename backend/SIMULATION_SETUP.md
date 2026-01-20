# Test Simulation Setup Guide for student@devskill.com

## Overview
This guide will help you run the test simulation for `student@devskill.com`.

## Prerequisites Checklist

### ✅ Completed
- [x] Backend dependencies installed
- [x] Standalone simulation script created (`test_simulation_student.py`)
- [x] Python 3.11.14 available

### ⏳ Required Actions

#### 1. Add Firebase Service Account Credentials

The simulation requires Firebase Admin SDK credentials to save sessions to Firestore.

**File Location:** `/home/user/FYP/backend/firebase_config/serviceAccountKey.json`

**How to add the file:**

```bash
# Option A: Copy from your local machine (if you have the file)
# Navigate to the firebase_config directory
cd /home/user/FYP/backend/firebase_config/

# Create the serviceAccountKey.json file
# You can:
# 1. Upload it via your IDE/editor
# 2. Copy-paste the content
# 3. Download it from Firebase Console
```

**To get the file from Firebase Console:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `devskill-fyp`
3. Click ⚙️ Settings → Project settings
4. Go to "Service accounts" tab
5. Click "Generate new private key"
6. Save the downloaded JSON file as `serviceAccountKey.json`

#### 2. Verify the Credentials File

Once you've added the file, verify it's valid:

```bash
cd /home/user/FYP/backend
python3 -c "import json; json.load(open('firebase_config/serviceAccountKey.json')); print('✅ Valid JSON file')"
```

## Running the Simulation

### Step 1: Start the Backend Server

```bash
cd /home/user/FYP/backend
python3 main.py
```

You should see:
```
✅ Firebase Admin Connected
🧠 AI Model Loaded Successfully
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 2: Run the Simulation (in a new terminal)

```bash
cd /home/user/FYP/backend
python3 test_simulation_student.py
```

**Custom number of sessions:**
```bash
python3 test_simulation_student.py 5  # Generate 5 sessions
```

## Expected Output

```
============================================================
🎯 Test Simulation for student@devskill.com
============================================================

Target: student@devskill.com
Skill Level: Advanced
Sessions to Generate: 2
Backend URL: http://127.0.0.1:8000/analyze

🔍 Checking backend connectivity...
✅ Backend is running

🚀 Starting simulation...
------------------------------------------------------------

📝 Session 1/2
   Code Type: Advanced
   Duration: 145s
   Keystrokes: 234
   File: task_456.py
   ✅ Success!
      → Detected Skill: Advanced
      → Confidence: 87.3%
      → AI Probability: 12.5%

📝 Session 2/2
   Code Type: Advanced
   Duration: 89s
   Keystrokes: 412
   File: task_789.py
   ✅ Success!
      → Detected Skill: Advanced
      → Confidence: 92.1%
      → AI Probability: 45.0%

============================================================
📊 Simulation Complete!
============================================================
✅ Successful: 2
❌ Failed: 0
📈 Success Rate: 100.0%

💾 Sessions have been saved to Firestore 'sessions' collection
🎮 View them in the admin dashboard or directly in Firebase Console
```

## Verification

### Check Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select `devskill-fyp` project
3. Navigate to Firestore Database
4. Check the `sessions` collection
5. Look for sessions with `email: "student@devskill.com"`

### Check in Admin Dashboard

1. Start the frontend: `cd /home/user/FYP/frontend && npm run dev`
2. Login as admin
3. Navigate to Admin Dashboard
4. View recent sessions for student@devskill.com

## Troubleshooting

### Error: "Cannot find serviceAccountKey.json"
- Ensure the file is at: `/home/user/FYP/backend/firebase_config/serviceAccountKey.json`
- Check filename is exact (case-sensitive)

### Error: "Backend is not accessible"
- Make sure backend is running on http://127.0.0.1:8000
- Check if port 8000 is available
- Try: `curl http://localhost:8000/docs`

### Error: "Invalid JWT Signature"
- Service account key may be expired or revoked
- Generate a new key from Firebase Console
- Replace the old serviceAccountKey.json

## Script Details

### `test_simulation_student.py` Features
- ✅ No Firestore read access required (doesn't fetch students from DB)
- ✅ Generates sessions directly for student@devskill.com
- ✅ Uses Advanced-level code snippets (as per TARGET_EMAILS in original script)
- ✅ Realistic session metrics (duration, keystrokes)
- ✅ Backend connectivity check before running
- ✅ Detailed progress reporting
- ✅ Configurable number of sessions

### Comparison with Original `test_simulation.py`

| Feature | test_simulation.py | test_simulation_student.py |
|---------|-------------------|---------------------------|
| Requires Firestore read | ✅ Yes (fetches all students) | ❌ No |
| Requires Firestore write | ✅ Yes (via backend) | ✅ Yes (via backend) |
| Service account needed | ✅ Yes | ⚠️ Only for backend |
| Target students | All students in DB | student@devskill.com only |
| Sessions per student | 2 (default) | Configurable |

## Next Steps After Simulation

1. ✅ Verify sessions in Firestore
2. ✅ Check admin dashboard for the new sessions
3. ✅ Verify skill level detection (should be "Advanced")
4. ✅ Check AI probability calculations
5. ✅ Test frontend displays the sessions correctly

---

**Created:** 2026-01-20
**For:** Test simulation of student@devskill.com
**Branch:** claude/test-simulation-student-sR4fW
