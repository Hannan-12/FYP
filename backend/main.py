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

# --- Gamified Quests Data with Test Cases ---
CHALLENGES = {
    "Beginner": [
        {
            "id": 1, "title": "Loop Logic",
            "task": "Print numbers 1 to 10 using a for loop.",
            "xp": 50,
            "testCases": [
                {"type": "output_contains", "expected": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]},
                {"type": "code_contains", "expected": ["for"]}
            ]
        },
        {
            "id": 2, "title": "Variable Swap",
            "task": "Swap two variables without using a third one.",
            "xp": 40,
            "testCases": [
                {"type": "code_contains", "expected": ["="]},
                {"type": "code_not_contains", "expected": ["temp", "tmp", "third"]}
            ]
        },
        {
            "id": 3, "title": "Sum Calculator",
            "task": "Create a function that takes two numbers and returns their sum.",
            "xp": 45,
            "testCases": [
                {"type": "function_test", "function": "sum_calculator", "inputs": [[2, 3], [10, 20], [-5, 5]], "expected": [5, 30, 0]},
                {"type": "code_contains", "expected": ["def", "return"]}
            ]
        },
        {
            "id": 4, "title": "Even or Odd",
            "task": "Write a program that checks if a number is even or odd.",
            "xp": 50,
            "testCases": [
                {"type": "code_contains", "expected": ["%", "2"]},
                {"type": "code_contains_any", "expected": ["even", "odd", "Even", "Odd"]}
            ]
        },
        {
            "id": 5, "title": "String Reversal",
            "task": "Reverse a string without using built-in reverse functions.",
            "xp": 60,
            "testCases": [
                {"type": "function_test", "function": "reverse_string", "inputs": [["hello"], ["world"], ["abc"]], "expected": ["olleh", "dlrow", "cba"]},
                {"type": "code_not_contains", "expected": ["[::-1]", ".reverse()", "reversed("]}
            ]
        },
        {
            "id": 6, "title": "Max Finder",
            "task": "Find the maximum number in a list without using max().",
            "xp": 55,
            "testCases": [
                {"type": "function_test", "function": "find_max", "inputs": [[[1,5,3,9,2]], [[10,20,5]], [[-1,-5,-2]]], "expected": [9, 20, -1]},
                {"type": "code_not_contains", "expected": ["max("]}
            ]
        },
        {
            "id": 7, "title": "FizzBuzz Classic",
            "task": "Print numbers 1-100, but print 'Fizz' for multiples of 3, 'Buzz' for 5, and 'FizzBuzz' for both.",
            "xp": 70,
            "testCases": [
                {"type": "output_contains", "expected": ["Fizz", "Buzz", "FizzBuzz"]},
                {"type": "code_contains", "expected": ["%"]}
            ]
        },
        {
            "id": 8, "title": "Vowel Counter",
            "task": "Count the number of vowels in a given string.",
            "xp": 60,
            "testCases": [
                {"type": "function_test", "function": "count_vowels", "inputs": [["hello"], ["aeiou"], ["xyz"]], "expected": [2, 5, 0]},
                {"type": "code_contains_any", "expected": ["aeiou", "AEIOU", "'a'", "\"a\""]}
            ]
        },
        {
            "id": 9, "title": "Palindrome Check",
            "task": "Check if a given string is a palindrome (reads same forwards and backwards).",
            "xp": 65,
            "testCases": [
                {"type": "function_test", "function": "is_palindrome", "inputs": [["radar"], ["hello"], ["level"]], "expected": [True, False, True]},
                {"type": "code_contains", "expected": ["def"]}
            ]
        },
        {
            "id": 10, "title": "List Sum",
            "task": "Calculate the sum of all numbers in a list.",
            "xp": 50,
            "testCases": [
                {"type": "function_test", "function": "list_sum", "inputs": [[[1,2,3,4,5]], [[10,20,30]], [[]]], "expected": [15, 60, 0]},
                {"type": "code_contains", "expected": ["for"]}
            ]
        },
        {
            "id": 11, "title": "Temperature Converter",
            "task": "Convert temperature from Celsius to Fahrenheit.",
            "xp": 55,
            "testCases": [
                {"type": "function_test", "function": "celsius_to_fahrenheit", "inputs": [[0], [100], [-40]], "expected": [32, 212, -40]},
                {"type": "code_contains", "expected": ["*", "9", "5", "32"]}
            ]
        },
        {
            "id": 12, "title": "Grade Calculator",
            "task": "Create a function that converts a score (0-100) to a letter grade (A, B, C, D, F).",
            "xp": 60,
            "testCases": [
                {"type": "function_test", "function": "get_grade", "inputs": [[95], [85], [75], [65], [50]], "expected": ["A", "B", "C", "D", "F"]},
                {"type": "code_contains", "expected": ["def", "return"]}
            ]
        }
    ],
    "Intermediate": [
        {
            "id": 13, "title": "List Comprehension",
            "task": "Convert a list of strings to uppercase using list comprehension in one line.",
            "xp": 100,
            "testCases": [
                {"type": "code_contains", "expected": ["[", "for", "in", "]", ".upper()"]},
                {"type": "code_line_count", "max_lines": 5}
            ]
        },
        {
            "id": 14, "title": "Dictionary Merge",
            "task": "Merge two dictionaries and sum values for common keys.",
            "xp": 120,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "return"]},
                {"type": "code_contains_any", "expected": ["+", "get(", "items()"]}
            ]
        },
        {
            "id": 15, "title": "Fibonacci Generator",
            "task": "Create a function that generates the first n Fibonacci numbers.",
            "xp": 110,
            "testCases": [
                {"type": "function_test", "function": "fibonacci", "inputs": [[5], [8]], "expected": [[0,1,1,2,3], [0,1,1,2,3,5,8,13]]},
                {"type": "code_contains", "expected": ["def"]}
            ]
        },
        {
            "id": 16, "title": "Anagram Detector",
            "task": "Write a function to check if two strings are anagrams of each other.",
            "xp": 105,
            "testCases": [
                {"type": "function_test", "function": "is_anagram", "inputs": [["listen", "silent"], ["hello", "world"]], "expected": [True, False]},
                {"type": "code_contains", "expected": ["def"]}
            ]
        },
        {
            "id": 17, "title": "Prime Number Checker",
            "task": "Create an efficient function to check if a number is prime.",
            "xp": 115,
            "testCases": [
                {"type": "function_test", "function": "is_prime", "inputs": [[7], [10], [13], [1]], "expected": [True, False, True, False]},
                {"type": "code_contains", "expected": ["%"]}
            ]
        },
        {
            "id": 18, "title": "Word Frequency",
            "task": "Count the frequency of each word in a sentence and return a dictionary.",
            "xp": 125,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "return", "{"]},
                {"type": "code_contains_any", "expected": ["split", "count", "get("]}
            ]
        },
        {
            "id": 19, "title": "Binary Search",
            "task": "Implement binary search algorithm on a sorted list.",
            "xp": 130,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "while", "//"]},
                {"type": "code_contains_any", "expected": ["mid", "middle", "left", "right", "low", "high"]}
            ]
        },
        {
            "id": 20, "title": "Duplicate Remover",
            "task": "Remove duplicates from a list while preserving the original order.",
            "xp": 110,
            "testCases": [
                {"type": "function_test", "function": "remove_duplicates", "inputs": [[[1,2,2,3,1,4]], [["a","b","a","c"]]], "expected": [[1,2,3,4], ["a","b","c"]]},
                {"type": "code_contains", "expected": ["def"]}
            ]
        },
        {
            "id": 21, "title": "Matrix Transpose",
            "task": "Transpose a 2D matrix (swap rows and columns).",
            "xp": 120,
            "testCases": [
                {"type": "function_test", "function": "transpose", "inputs": [[[[1,2],[3,4]]]], "expected": [[[1,3],[2,4]]]},
                {"type": "code_contains", "expected": ["def"]}
            ]
        },
        {
            "id": 22, "title": "Nested Dict Access",
            "task": "Safely access nested dictionary values with a default fallback.",
            "xp": 115,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "return"]},
                {"type": "code_contains_any", "expected": ["get(", "try", "except", "or"]}
            ]
        },
        {
            "id": 23, "title": "CSV Parser",
            "task": "Parse a CSV-formatted string into a list of dictionaries.",
            "xp": 135,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "split", "return"]},
                {"type": "code_contains_any", "expected": ["\\n", "newline", "lines"]}
            ]
        },
        {
            "id": 24, "title": "Bubble Sort",
            "task": "Implement the bubble sort algorithm to sort a list.",
            "xp": 125,
            "testCases": [
                {"type": "function_test", "function": "bubble_sort", "inputs": [[[5,2,8,1,9]], [[3,1,2]]], "expected": [[1,2,5,8,9], [1,2,3]]},
                {"type": "code_contains", "expected": ["for", "for"]}
            ]
        }
    ],
    "Advanced": [
        {
            "id": 25, "title": "Decorator Design",
            "task": "Write a decorator that logs the execution time of a function.",
            "xp": 200,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "def", "wrapper", "return"]},
                {"type": "code_contains_any", "expected": ["time", "perf_counter", "datetime"]}
            ]
        },
        {
            "id": 26, "title": "Async Fetch",
            "task": "Implement a parallel data fetcher using asyncio.gather.",
            "xp": 250,
            "testCases": [
                {"type": "code_contains", "expected": ["async", "await", "asyncio.gather"]}
            ]
        },
        {
            "id": 27, "title": "LRU Cache",
            "task": "Implement a Least Recently Used (LRU) cache with get and put operations.",
            "xp": 220,
            "testCases": [
                {"type": "code_contains", "expected": ["class", "def get", "def put"]},
                {"type": "code_contains_any", "expected": ["OrderedDict", "dict", "{}"]}
            ]
        },
        {
            "id": 28, "title": "Custom Context Manager",
            "task": "Create a context manager using __enter__ and __exit__ methods.",
            "xp": 210,
            "testCases": [
                {"type": "code_contains", "expected": ["class", "__enter__", "__exit__"]}
            ]
        },
        {
            "id": 29, "title": "Metaclass Magic",
            "task": "Create a metaclass that automatically adds a timestamp to class instances.",
            "xp": 240,
            "testCases": [
                {"type": "code_contains", "expected": ["class", "type", "__new__"]},
                {"type": "code_contains_any", "expected": ["timestamp", "time", "datetime"]}
            ]
        },
        {
            "id": 30, "title": "Generator Pipeline",
            "task": "Build a data processing pipeline using multiple generators.",
            "xp": 230,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "yield"]},
                {"type": "code_count", "pattern": "yield", "min_count": 2}
            ]
        },
        {
            "id": 31, "title": "Dependency Injector",
            "task": "Implement a simple dependency injection container.",
            "xp": 260,
            "testCases": [
                {"type": "code_contains", "expected": ["class", "def", "register", "resolve"]}
            ]
        },
        {
            "id": 32, "title": "Retry Decorator",
            "task": "Create a decorator that retries a function n times with exponential backoff.",
            "xp": 225,
            "testCases": [
                {"type": "code_contains", "expected": ["def", "def", "wrapper", "return"]},
                {"type": "code_contains_any", "expected": ["sleep", "time", "**", "2"]}
            ]
        },
        {
            "id": 33, "title": "Tree Traversal",
            "task": "Implement depth-first and breadth-first tree traversal algorithms.",
            "xp": 245,
            "testCases": [
                {"type": "code_contains", "expected": ["def"]},
                {"type": "code_contains_any", "expected": ["stack", "queue", "deque", "append", "pop"]}
            ]
        },
        {
            "id": 34, "title": "API Rate Limiter",
            "task": "Build a rate limiter that allows n requests per time window.",
            "xp": 255,
            "testCases": [
                {"type": "code_contains", "expected": ["class", "def"]},
                {"type": "code_contains_any", "expected": ["time", "window", "count", "limit"]}
            ]
        },
        {
            "id": 35, "title": "Custom ORM",
            "task": "Create a simple ORM-like class that maps Python objects to dictionaries.",
            "xp": 270,
            "testCases": [
                {"type": "code_contains", "expected": ["class", "def", "__dict__"]}
            ]
        },
        {
            "id": 36, "title": "Async Queue Worker",
            "task": "Implement an async task queue with worker pool using asyncio.",
            "xp": 280,
            "testCases": [
                {"type": "code_contains", "expected": ["async", "await", "asyncio"]},
                {"type": "code_contains_any", "expected": ["Queue", "queue", "worker"]}
            ]
        }
    ]
}

# --- Solution Validator ---
import io
import sys
import re

def validate_solution(code: str, quest_id: int) -> dict:
    """Validate a solution against test cases for a quest."""
    # Find the quest
    quest = None
    for level_quests in CHALLENGES.values():
        for q in level_quests:
            if q["id"] == quest_id:
                quest = q
                break
        if quest:
            break

    if not quest:
        return {"passed": False, "message": "Quest not found", "tests_passed": 0, "tests_total": 0}

    test_cases = quest.get("testCases", [])
    if not test_cases:
        return {"passed": True, "message": "No test cases defined", "tests_passed": 0, "tests_total": 0}

    tests_passed = 0
    tests_total = len(test_cases)
    failed_tests = []

    for i, test in enumerate(test_cases):
        test_type = test.get("type")

        try:
            if test_type == "code_contains":
                # Check if code contains all expected patterns
                expected = test.get("expected", [])
                if all(pattern in code for pattern in expected):
                    tests_passed += 1
                else:
                    missing = [p for p in expected if p not in code]
                    failed_tests.append(f"Missing required code: {missing}")

            elif test_type == "code_not_contains":
                # Check if code does NOT contain forbidden patterns
                forbidden = test.get("expected", [])
                if not any(pattern in code for pattern in forbidden):
                    tests_passed += 1
                else:
                    found = [p for p in forbidden if p in code]
                    failed_tests.append(f"Forbidden code found: {found}")

            elif test_type == "code_contains_any":
                # Check if code contains at least one of the expected patterns
                expected = test.get("expected", [])
                if any(pattern in code for pattern in expected):
                    tests_passed += 1
                else:
                    failed_tests.append(f"Missing at least one of: {expected}")

            elif test_type == "output_contains":
                # Run code and check if output contains expected strings
                try:
                    old_stdout = sys.stdout
                    sys.stdout = buffer = io.StringIO()
                    exec(code, {"__builtins__": __builtins__}, {})
                    output = buffer.getvalue()
                    sys.stdout = old_stdout

                    expected = test.get("expected", [])
                    if all(exp in output for exp in expected):
                        tests_passed += 1
                    else:
                        missing = [e for e in expected if e not in output]
                        failed_tests.append(f"Output missing: {missing}")
                except Exception as e:
                    failed_tests.append(f"Execution error: {str(e)[:50]}")

            elif test_type == "function_test":
                # Test a specific function with inputs
                func_name = test.get("function")
                inputs = test.get("inputs", [])
                expected = test.get("expected", [])

                try:
                    local_vars = {}
                    exec(code, {"__builtins__": __builtins__}, local_vars)

                    # Try to find function with various naming conventions
                    func = None
                    for name in [func_name, func_name.replace("_", ""), func_name.lower()]:
                        if name in local_vars and callable(local_vars[name]):
                            func = local_vars[name]
                            break

                    if not func:
                        # Try to find any function that could be it
                        for name, val in local_vars.items():
                            if callable(val) and not name.startswith("_"):
                                func = val
                                break

                    if func:
                        all_passed = True
                        for inp, exp in zip(inputs, expected):
                            result = func(*inp) if isinstance(inp, list) else func(inp)
                            if result != exp:
                                all_passed = False
                                failed_tests.append(f"Function test failed: {func_name}({inp}) returned {result}, expected {exp}")
                                break
                        if all_passed:
                            tests_passed += 1
                    else:
                        failed_tests.append(f"Function '{func_name}' not found")
                except Exception as e:
                    failed_tests.append(f"Function test error: {str(e)[:50]}")

            elif test_type == "code_line_count":
                # Check code is within line limit
                max_lines = test.get("max_lines", 100)
                lines = [l for l in code.split("\n") if l.strip() and not l.strip().startswith("#")]
                if len(lines) <= max_lines:
                    tests_passed += 1
                else:
                    failed_tests.append(f"Too many lines: {len(lines)} > {max_lines}")

            elif test_type == "code_count":
                # Count occurrences of a pattern
                pattern = test.get("pattern", "")
                min_count = test.get("min_count", 1)
                count = code.count(pattern)
                if count >= min_count:
                    tests_passed += 1
                else:
                    failed_tests.append(f"Pattern '{pattern}' found {count} times, need at least {min_count}")

        except Exception as e:
            failed_tests.append(f"Test error: {str(e)[:50]}")

    passed = tests_passed >= (tests_total * 0.5)  # Pass if at least 50% of tests pass

    return {
        "passed": passed,
        "tests_passed": tests_passed,
        "tests_total": tests_total,
        "message": "Solution accepted!" if passed else f"Solution failed: {failed_tests[0] if failed_tests else 'Unknown error'}",
        "details": failed_tests[:3] if not passed else []  # Return first 3 failure details
    }

class CodeSession(BaseModel):
    userId: str
    email: str
    code: str
    language: str
    fileName: str
    duration: float
    keystrokes: int
    questId: int = None  # Optional quest ID for validation

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

        # Validate solution if questId is provided
        validation = {"passed": True, "tests_passed": 0, "tests_total": 0, "message": "No validation", "details": []}
        if session.questId:
            validation = validate_solution(session.code, session.questId)

        doc_data = {
            "userId": session.userId,
            "email": session.email,
            "code": session.code,
            "language": session.language,
            "questId": session.questId,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "stats": {
                "duration": session.duration,
                "keystrokes": session.keystrokes,
                "complexity": len(session.code.split()),
                "skillLevel": skill_level,
                "confidence": confidence,
                "aiProbability": ai_probability,
                "passed": validation["passed"],
                "testsPassed": validation["tests_passed"],
                "testsTotal": validation["tests_total"]
            }
        }

        db.collection("sessions").add(doc_data)

        return {
            "status": "success",
            "stats": {
                "skillLevel": skill_level,
                "confidence": confidence,
                "aiProbability": ai_probability,
                "passed": validation["passed"],
                "testsPassed": validation["tests_passed"],
                "testsTotal": validation["tests_total"],
                "validationMessage": validation["message"],
                "validationDetails": validation["details"]
            }
        }

    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))