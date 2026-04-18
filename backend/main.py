import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud.firestore_v1.base_query import FieldFilter
from typing import Optional, List, Union
import os
import joblib
import random
import uuid
import json
import math
import statistics
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

if not firebase_admin._apps:
    cred_json_env = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if cred_json_env:
        cred = credentials.Certificate(json.loads(cred_json_env))
        firebase_admin.initialize_app(cred)
        print("Firebase Admin Connected (env)")
    else:
        cred_path = os.getenv("FIREBASE_CREDS_PATH", "firebase_config/serviceAccountKey.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print(f"Firebase Admin Connected (file: {cred_path})")
        else:
            raise RuntimeError(
                f"Firebase credentials not found. Set FIREBASE_CREDENTIALS_JSON env var "
                f"or place serviceAccountKey.json at {cred_path}"
            )

db = firestore.client()
app = FastAPI(title="DevSkill Tracker API", version="1.0.0")

# Enable CORS for frontend and extension
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
_default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_origin_regex=r"vscode-webview://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI Model Loading (CodeBERT) ---
CODEBERT_LABEL2ID = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
CODEBERT_ID2LABEL = {v: k for k, v in CODEBERT_LABEL2ID.items()}
CODEBERT_MAX_LEN  = 256

class CodeBERTClassifier:
    """Thin wrapper around a fine-tuned CodeBERT model with sklearn-compatible API."""

    def __init__(self, model_dir: str):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir).to(self.device)
        self.model.eval()
        print(f"CodeBERT model loaded from '{model_dir}' on {self.device}")

    def _encode(self, code: str):
        enc = self.tokenizer(
            code,
            max_length=CODEBERT_MAX_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )
        return enc["input_ids"].to(self.device), enc["attention_mask"].to(self.device)

    def predict(self, codes: list) -> list:
        results = []
        with torch.no_grad():
            for code in codes:
                ids, mask = self._encode(code)
                logits = self.model(input_ids=ids, attention_mask=mask).logits
                label_id = int(torch.argmax(logits, dim=-1).item())
                results.append(CODEBERT_ID2LABEL[label_id])
        return results

    def predict_proba(self, codes: list) -> list:
        results = []
        with torch.no_grad():
            for code in codes:
                ids, mask = self._encode(code)
                logits = self.model(input_ids=ids, attention_mask=mask).logits
                probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().tolist()
                results.append(probs)
        return results


ai_model = None
_local_model = "ai_models/best_codebert_large"
_hub_model   = "Hannan-12/devskill-codebert"
_model_src   = _local_model if os.path.isdir(_local_model) else _hub_model
try:
    ai_model = CodeBERTClassifier(_model_src)
except Exception as _ex:
    print(f"Warning: CodeBERT load failed from '{_model_src}': {_ex}")

if ai_model is None:
    print("Warning: No AI model found — keyword fallback will be used.")

# --- Gamified Quests Data with Test Cases (Python - original) ---
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

# --- Multi-Language Quest Templates ---
# Quests are generated dynamically based on language + skill level.
# Each language has templates per difficulty that use language-appropriate syntax/concepts.

LANGUAGE_QUESTS = {
    "javascript": {
        "Beginner": [
            {
                "title": "Loop Logic",
                "task": "Print numbers 1 to 10 using a for loop. Use console.log() for output.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["for"]},
                    {"type": "code_contains_any", "expected": ["console.log", "console.info"]}
                ]
            },
            {
                "title": "Arrow Function Sum",
                "task": "Create an arrow function called 'add' that takes two numbers and returns their sum.",
                "xp": 45,
                "testCases": [
                    {"type": "code_contains", "expected": ["=>"]},
                    {"type": "code_contains_any", "expected": ["const add", "let add", "var add"]}
                ]
            },
            {
                "title": "Even or Odd",
                "task": "Write a function 'isEven' that returns true if a number is even, false otherwise.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["%", "2"]},
                    {"type": "code_contains_any", "expected": ["function", "=>"]}
                ]
            },
            {
                "title": "String Reversal",
                "task": "Write a function 'reverseString' that reverses a string without using .reverse().",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["function", "=>"]},
                    {"type": "code_not_contains", "expected": [".reverse()"]}
                ]
            },
            {
                "title": "Array Max",
                "task": "Find the maximum number in an array without using Math.max().",
                "xp": 55,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["for", "forEach", "reduce"]},
                    {"type": "code_not_contains", "expected": ["Math.max"]}
                ]
            },
            {
                "title": "FizzBuzz",
                "task": "Print numbers 1-100. Print 'Fizz' for multiples of 3, 'Buzz' for 5, 'FizzBuzz' for both.",
                "xp": 70,
                "testCases": [
                    {"type": "code_contains", "expected": ["%"]},
                    {"type": "code_contains_any", "expected": ["Fizz", "Buzz"]}
                ]
            },
            {
                "title": "Template Literals",
                "task": "Create a function 'greet' that takes a name and returns 'Hello, {name}!' using template literals.",
                "xp": 40,
                "testCases": [
                    {"type": "code_contains", "expected": ["`", "${"]},
                    {"type": "code_contains_any", "expected": ["function", "=>"]}
                ]
            },
            {
                "title": "Array Filter",
                "task": "Filter an array to keep only numbers greater than 10 using the filter method.",
                "xp": 55,
                "testCases": [
                    {"type": "code_contains", "expected": [".filter("]},
                    {"type": "code_contains_any", "expected": ["=>", "function"]}
                ]
            },
            {
                "title": "Object Destructuring",
                "task": "Given an object with 'name' and 'age' properties, use destructuring to extract them into variables.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["{", "}", "="]},
                    {"type": "code_contains_any", "expected": ["name", "age"]}
                ]
            },
            {
                "title": "Vowel Counter",
                "task": "Write a function 'countVowels' that counts the number of vowels in a string.",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["aeiou", "AEIOU", "match", "includes"]},
                    {"type": "code_contains_any", "expected": ["function", "=>"]}
                ]
            }
        ],
        "Intermediate": [
            {
                "title": "Promise Chain",
                "task": "Create a function that returns a Promise which resolves with 'Hello' after a delay.",
                "xp": 110,
                "testCases": [
                    {"type": "code_contains", "expected": ["Promise", "resolve"]},
                    {"type": "code_contains_any", "expected": ["setTimeout", "then", "async"]}
                ]
            },
            {
                "title": "Array Reduce",
                "task": "Use reduce to calculate the sum of all numbers in an array.",
                "xp": 100,
                "testCases": [
                    {"type": "code_contains", "expected": [".reduce("]},
                    {"type": "code_contains_any", "expected": ["=>", "function"]}
                ]
            },
            {
                "title": "Closure Counter",
                "task": "Create a counter function using closures that returns an object with increment, decrement, and getCount methods.",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["function", "return"]},
                    {"type": "code_contains_any", "expected": ["increment", "decrement", "getCount"]}
                ]
            },
            {
                "title": "Array Flat",
                "task": "Flatten a nested array (e.g., [[1,2],[3,[4,5]]]) into a single-level array without using .flat().",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["function", "=>"]},
                    {"type": "code_not_contains", "expected": [".flat("]}
                ]
            },
            {
                "title": "Debounce Function",
                "task": "Implement a debounce function that delays invoking a function until after a wait period.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["setTimeout", "clearTimeout"]},
                    {"type": "code_contains_any", "expected": ["function", "=>"]}
                ]
            },
            {
                "title": "Deep Clone",
                "task": "Write a function that creates a deep clone of an object (handle nested objects and arrays).",
                "xp": 135,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["typeof", "Array.isArray", "Object"]},
                    {"type": "code_not_contains", "expected": ["JSON.parse(JSON.stringify"]}
                ]
            },
            {
                "title": "Event Emitter",
                "task": "Create a simple EventEmitter class with on, off, and emit methods.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["class"]},
                    {"type": "code_contains_any", "expected": ["on(", "emit(", "off("]}
                ]
            },
            {
                "title": "Async/Await Fetch",
                "task": "Write an async function that fetches data from a URL and handles errors with try/catch.",
                "xp": 115,
                "testCases": [
                    {"type": "code_contains", "expected": ["async", "await"]},
                    {"type": "code_contains_any", "expected": ["try", "catch", "fetch"]}
                ]
            },
            {
                "title": "Memoize Function",
                "task": "Create a memoize function that caches the results of expensive function calls.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["Map", "cache", "{}"]},
                    {"type": "code_contains", "expected": ["return"]}
                ]
            },
            {
                "title": "Binary Search",
                "task": "Implement the binary search algorithm on a sorted array.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["while"]},
                    {"type": "code_contains_any", "expected": ["mid", "middle", "Math.floor"]}
                ]
            }
        ],
        "Advanced": [
            {
                "title": "Custom Promise.all",
                "task": "Implement your own version of Promise.all that takes an array of promises and resolves when all complete.",
                "xp": 220,
                "testCases": [
                    {"type": "code_contains", "expected": ["Promise", "resolve", "reject"]},
                    {"type": "code_contains_any", "expected": ["forEach", "map", "length"]}
                ]
            },
            {
                "title": "Proxy Validator",
                "task": "Create a Proxy-based object validator that validates property types on set.",
                "xp": 240,
                "testCases": [
                    {"type": "code_contains", "expected": ["Proxy", "set"]},
                    {"type": "code_contains_any", "expected": ["typeof", "throw", "Error"]}
                ]
            },
            {
                "title": "Generator Iterator",
                "task": "Create a generator function that yields Fibonacci numbers infinitely.",
                "xp": 210,
                "testCases": [
                    {"type": "code_contains", "expected": ["function*", "yield"]},
                ]
            },
            {
                "title": "Curry Function",
                "task": "Implement a curry function that converts a multi-argument function into a chain of single-argument functions.",
                "xp": 230,
                "testCases": [
                    {"type": "code_contains", "expected": ["return"]},
                    {"type": "code_contains_any", "expected": ["length", "args", "arguments", "..."]}
                ]
            },
            {
                "title": "Observable Pattern",
                "task": "Implement a simple Observable class with subscribe, unsubscribe, and next methods.",
                "xp": 250,
                "testCases": [
                    {"type": "code_contains", "expected": ["class"]},
                    {"type": "code_contains_any", "expected": ["subscribe", "next", "unsubscribe"]}
                ]
            },
            {
                "title": "Async Queue",
                "task": "Build an async task queue that processes tasks with a configurable concurrency limit.",
                "xp": 260,
                "testCases": [
                    {"type": "code_contains", "expected": ["async", "await"]},
                    {"type": "code_contains_any", "expected": ["queue", "Queue", "concurrency", "limit"]}
                ]
            },
            {
                "title": "Virtual DOM Diff",
                "task": "Implement a simple diff algorithm that compares two virtual DOM tree objects and returns patches.",
                "xp": 280,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["function", "=>"]},
                    {"type": "code_contains_any", "expected": ["diff", "patch", "children", "type"]}
                ]
            },
            {
                "title": "Middleware Pipeline",
                "task": "Create a middleware pipeline (like Express.js) that chains functions with next().",
                "xp": 245,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["next", "middleware", "use"]},
                    {"type": "code_contains_any", "expected": ["function", "class", "=>"]}
                ]
            }
        ]
    },
    "java": {
        "Beginner": [
            {
                "title": "Loop Logic",
                "task": "Print numbers 1 to 10 using a for loop with System.out.println().",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "System.out.println"]}
                ]
            },
            {
                "title": "Sum Method",
                "task": "Create a method that takes two integers and returns their sum.",
                "xp": 45,
                "testCases": [
                    {"type": "code_contains", "expected": ["int", "return"]},
                    {"type": "code_contains_any", "expected": ["public", "static", "private"]}
                ]
            },
            {
                "title": "Even or Odd",
                "task": "Write a method that checks if a number is even or odd and returns a String.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["%", "2"]},
                    {"type": "code_contains_any", "expected": ["even", "odd", "Even", "Odd"]}
                ]
            },
            {
                "title": "String Reversal",
                "task": "Reverse a string without using StringBuilder.reverse().",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["charAt", "toCharArray", "for"]},
                    {"type": "code_not_contains", "expected": [".reverse()"]}
                ]
            },
            {
                "title": "Array Max",
                "task": "Find the maximum value in an integer array without using Arrays.sort() or Collections.",
                "xp": 55,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "int"]},
                    {"type": "code_not_contains", "expected": ["Arrays.sort", "Collections"]}
                ]
            },
            {
                "title": "FizzBuzz",
                "task": "Print numbers 1-100. Print 'Fizz' for multiples of 3, 'Buzz' for 5, 'FizzBuzz' for both.",
                "xp": 70,
                "testCases": [
                    {"type": "code_contains", "expected": ["%", "for"]},
                    {"type": "code_contains_any", "expected": ["Fizz", "Buzz"]}
                ]
            },
            {
                "title": "Palindrome Check",
                "task": "Write a method to check if a given string is a palindrome.",
                "xp": 65,
                "testCases": [
                    {"type": "code_contains", "expected": ["boolean"]},
                    {"type": "code_contains_any", "expected": ["charAt", "equals", "for"]}
                ]
            },
            {
                "title": "Factorial Calculator",
                "task": "Create a method that calculates the factorial of a number using a loop.",
                "xp": 55,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "return"]},
                    {"type": "code_contains_any", "expected": ["*=", "* "]}
                ]
            },
            {
                "title": "Vowel Counter",
                "task": "Write a method that counts the number of vowels in a string.",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains", "expected": ["for"]},
                    {"type": "code_contains_any", "expected": ["aeiou", "AEIOU", "charAt", "contains"]}
                ]
            },
            {
                "title": "Grade Calculator",
                "task": "Create a method that converts a score (0-100) to a letter grade (A, B, C, D, F).",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["if", "switch"]},
                    {"type": "code_contains", "expected": ["return"]}
                ]
            }
        ],
        "Intermediate": [
            {
                "title": "ArrayList Operations",
                "task": "Create a method that removes duplicates from an ArrayList while preserving order.",
                "xp": 110,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["ArrayList", "List", "LinkedHashSet"]},
                    {"type": "code_contains", "expected": ["return"]}
                ]
            },
            {
                "title": "HashMap Word Count",
                "task": "Count the frequency of each word in a string and return a HashMap.",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["HashMap", "split"]},
                    {"type": "code_contains_any", "expected": ["put", "getOrDefault", "merge"]}
                ]
            },
            {
                "title": "Binary Search",
                "task": "Implement binary search on a sorted integer array.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["while", "int"]},
                    {"type": "code_contains_any", "expected": ["mid", "middle", "low", "high"]}
                ]
            },
            {
                "title": "Stack Implementation",
                "task": "Implement a Stack data structure using an array with push, pop, and peek methods.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains", "expected": ["class"]},
                    {"type": "code_contains_any", "expected": ["push", "pop", "peek"]}
                ]
            },
            {
                "title": "Interface Design",
                "task": "Create an interface 'Shape' with an area() method. Implement it for Circle and Rectangle.",
                "xp": 115,
                "testCases": [
                    {"type": "code_contains", "expected": ["interface", "implements"]},
                    {"type": "code_contains_any", "expected": ["area", "Circle", "Rectangle"]}
                ]
            },
            {
                "title": "Exception Handler",
                "task": "Create a custom exception class and use it in a method that validates user age (must be 0-150).",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["extends", "throw"]},
                    {"type": "code_contains_any", "expected": ["Exception", "try", "catch"]}
                ]
            },
            {
                "title": "Comparable Sort",
                "task": "Create a Student class that implements Comparable to sort by GPA descending.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains", "expected": ["Comparable", "compareTo"]},
                    {"type": "code_contains_any", "expected": ["class", "Student"]}
                ]
            },
            {
                "title": "Stream Filter",
                "task": "Use Java Streams to filter a list of integers and keep only even numbers greater than 10.",
                "xp": 115,
                "testCases": [
                    {"type": "code_contains", "expected": [".stream()", ".filter("]},
                    {"type": "code_contains_any", "expected": ["->", "collect", "Collectors"]}
                ]
            },
            {
                "title": "Generic Pair",
                "task": "Create a generic Pair<K, V> class with getKey() and getValue() methods.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["class", "<", ">"]},
                    {"type": "code_contains_any", "expected": ["getKey", "getValue", "K", "V"]}
                ]
            },
            {
                "title": "Bubble Sort",
                "task": "Implement the bubble sort algorithm for an integer array.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "for", "int"]},
                    {"type": "code_contains_any", "expected": ["swap", "temp", ">", "<"]}
                ]
            }
        ],
        "Advanced": [
            {
                "title": "Thread-Safe Singleton",
                "task": "Implement a thread-safe Singleton pattern using double-checked locking.",
                "xp": 220,
                "testCases": [
                    {"type": "code_contains", "expected": ["synchronized", "volatile", "private"]},
                    {"type": "code_contains_any", "expected": ["getInstance", "instance", "Singleton"]}
                ]
            },
            {
                "title": "Producer Consumer",
                "task": "Implement a producer-consumer pattern using wait() and notify().",
                "xp": 250,
                "testCases": [
                    {"type": "code_contains", "expected": ["synchronized"]},
                    {"type": "code_contains_any", "expected": ["wait", "notify", "notifyAll"]}
                ]
            },
            {
                "title": "Custom Annotation",
                "task": "Create a custom annotation @Validate and a processor that checks if a String field is not empty.",
                "xp": 240,
                "testCases": [
                    {"type": "code_contains", "expected": ["@interface", "@Retention"]},
                    {"type": "code_contains_any", "expected": ["Validate", "annotation"]}
                ]
            },
            {
                "title": "LRU Cache",
                "task": "Implement an LRU Cache using LinkedHashMap with a fixed capacity.",
                "xp": 230,
                "testCases": [
                    {"type": "code_contains", "expected": ["class", "LinkedHashMap"]},
                    {"type": "code_contains_any", "expected": ["get", "put", "removeEldest"]}
                ]
            },
            {
                "title": "Builder Pattern",
                "task": "Implement the Builder design pattern for a complex User object with optional fields.",
                "xp": 210,
                "testCases": [
                    {"type": "code_contains", "expected": ["class", "Builder", "build"]},
                    {"type": "code_contains", "expected": ["return this"]}
                ]
            },
            {
                "title": "CompletableFuture Chain",
                "task": "Chain multiple CompletableFuture operations with thenApply, thenCompose, and error handling.",
                "xp": 260,
                "testCases": [
                    {"type": "code_contains", "expected": ["CompletableFuture"]},
                    {"type": "code_contains_any", "expected": ["thenApply", "thenCompose", "exceptionally"]}
                ]
            },
            {
                "title": "Binary Tree",
                "task": "Implement a Binary Search Tree with insert, search, and in-order traversal methods.",
                "xp": 245,
                "testCases": [
                    {"type": "code_contains", "expected": ["class"]},
                    {"type": "code_contains_any", "expected": ["insert", "search", "left", "right"]}
                ]
            },
            {
                "title": "Observer Pattern",
                "task": "Implement the Observer design pattern with Subject and Observer interfaces.",
                "xp": 235,
                "testCases": [
                    {"type": "code_contains", "expected": ["interface"]},
                    {"type": "code_contains_any", "expected": ["Observer", "Subject", "notify", "update"]}
                ]
            }
        ]
    },
    "csharp": {
        "Beginner": [
            {
                "title": "Loop Logic",
                "task": "Print numbers 1 to 10 using a for loop with Console.WriteLine().",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "Console.WriteLine"]}
                ]
            },
            {
                "title": "Method Sum",
                "task": "Create a method that takes two integers and returns their sum.",
                "xp": 45,
                "testCases": [
                    {"type": "code_contains", "expected": ["int", "return"]},
                    {"type": "code_contains_any", "expected": ["public", "static", "private"]}
                ]
            },
            {
                "title": "Even or Odd",
                "task": "Write a method that checks if a number is even or odd.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["%", "2"]},
                    {"type": "code_contains_any", "expected": ["even", "odd", "Even", "Odd"]}
                ]
            },
            {
                "title": "String Reversal",
                "task": "Reverse a string without using Array.Reverse() or LINQ Reverse().",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains", "expected": ["for"]},
                    {"type": "code_not_contains", "expected": ["Array.Reverse", ".Reverse()"]}
                ]
            },
            {
                "title": "FizzBuzz",
                "task": "Print numbers 1-100. Print 'Fizz' for multiples of 3, 'Buzz' for 5, 'FizzBuzz' for both.",
                "xp": 70,
                "testCases": [
                    {"type": "code_contains", "expected": ["%", "for"]},
                    {"type": "code_contains_any", "expected": ["Fizz", "Buzz"]}
                ]
            },
            {
                "title": "Array Max",
                "task": "Find the maximum value in an integer array without using LINQ Max().",
                "xp": 55,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "int"]},
                    {"type": "code_not_contains", "expected": [".Max()"]}
                ]
            },
            {
                "title": "Palindrome Check",
                "task": "Write a method to check if a given string is a palindrome.",
                "xp": 65,
                "testCases": [
                    {"type": "code_contains", "expected": ["bool"]},
                    {"type": "code_contains_any", "expected": ["for", "while", "ToCharArray"]}
                ]
            },
            {
                "title": "Vowel Counter",
                "task": "Write a method that counts the number of vowels in a string.",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains", "expected": ["for"]},
                    {"type": "code_contains_any", "expected": ["aeiou", "Contains", "switch"]}
                ]
            },
            {
                "title": "String Interpolation",
                "task": "Create a method that returns a formatted greeting using string interpolation ($\"\").",
                "xp": 40,
                "testCases": [
                    {"type": "code_contains", "expected": ["$\"", "{"]},
                    {"type": "code_contains", "expected": ["return"]}
                ]
            },
            {
                "title": "Grade Calculator",
                "task": "Create a method that converts a score (0-100) to a letter grade.",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["if", "switch"]},
                    {"type": "code_contains", "expected": ["return"]}
                ]
            }
        ],
        "Intermediate": [
            {
                "title": "LINQ Filter",
                "task": "Use LINQ to filter a list of integers and keep only even numbers greater than 10.",
                "xp": 110,
                "testCases": [
                    {"type": "code_contains", "expected": [".Where("]},
                    {"type": "code_contains_any", "expected": ["=>", "LINQ", "using System.Linq"]}
                ]
            },
            {
                "title": "Dictionary Word Count",
                "task": "Count the frequency of each word in a string using Dictionary<string, int>.",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["Dictionary"]},
                    {"type": "code_contains_any", "expected": ["Split", "ContainsKey", "TryGetValue"]}
                ]
            },
            {
                "title": "Interface Design",
                "task": "Create an IShape interface with Area() and Perimeter() methods. Implement for Circle and Rectangle.",
                "xp": 115,
                "testCases": [
                    {"type": "code_contains", "expected": ["interface", ":"]},
                    {"type": "code_contains_any", "expected": ["Area", "IShape"]}
                ]
            },
            {
                "title": "Extension Method",
                "task": "Create an extension method for string that returns the word count.",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["static", "this string"]},
                    {"type": "code_contains", "expected": ["return"]}
                ]
            },
            {
                "title": "Async/Await",
                "task": "Write an async method that simulates fetching data with Task.Delay and returns a result.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains", "expected": ["async", "await", "Task"]},
                    {"type": "code_contains_any", "expected": ["Delay", "return"]}
                ]
            },
            {
                "title": "Generic Stack",
                "task": "Implement a generic Stack<T> class with Push, Pop, and Peek methods.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains", "expected": ["class", "<T>"]},
                    {"type": "code_contains_any", "expected": ["Push", "Pop", "Peek"]}
                ]
            },
            {
                "title": "Events and Delegates",
                "task": "Create a class with a custom event and delegate. Raise the event when a value changes.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["event", "delegate"]},
                    {"type": "code_contains_any", "expected": ["Invoke", "+="]}
                ]
            },
            {
                "title": "Binary Search",
                "task": "Implement binary search on a sorted integer array.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["while", "int"]},
                    {"type": "code_contains_any", "expected": ["mid", "low", "high"]}
                ]
            },
            {
                "title": "Bubble Sort",
                "task": "Implement the bubble sort algorithm.",
                "xp": 125,
                "testCases": [
                    {"type": "code_contains", "expected": ["for", "for"]},
                    {"type": "code_contains_any", "expected": ["swap", "temp", ">", "<"]}
                ]
            },
            {
                "title": "Record Type",
                "task": "Create a record type for a Person with name and age, and demonstrate immutability with 'with' expressions.",
                "xp": 110,
                "testCases": [
                    {"type": "code_contains", "expected": ["record"]},
                    {"type": "code_contains_any", "expected": ["with", "Person"]}
                ]
            }
        ],
        "Advanced": [
            {
                "title": "Dependency Injection",
                "task": "Implement a simple DI container with Register and Resolve methods using generics.",
                "xp": 240,
                "testCases": [
                    {"type": "code_contains", "expected": ["class", "Dictionary"]},
                    {"type": "code_contains_any", "expected": ["Register", "Resolve", "Type"]}
                ]
            },
            {
                "title": "Observer Pattern",
                "task": "Implement the Observer pattern with IObservable<T> and IObserver<T>.",
                "xp": 230,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["IObservable", "IObserver", "Subscribe"]},
                    {"type": "code_contains", "expected": ["class"]}
                ]
            },
            {
                "title": "Async Pipeline",
                "task": "Create an async data processing pipeline using Task chaining with ContinueWith or async/await.",
                "xp": 250,
                "testCases": [
                    {"type": "code_contains", "expected": ["async", "await", "Task"]},
                    {"type": "code_contains_any", "expected": ["ContinueWith", "WhenAll", "pipeline"]}
                ]
            },
            {
                "title": "Expression Tree",
                "task": "Build a simple expression tree that evaluates mathematical expressions.",
                "xp": 260,
                "testCases": [
                    {"type": "code_contains", "expected": ["class"]},
                    {"type": "code_contains_any", "expected": ["Evaluate", "Expression", "Node", "left", "right"]}
                ]
            },
            {
                "title": "Middleware Pattern",
                "task": "Implement an ASP.NET-style middleware pipeline with Use and Run methods.",
                "xp": 245,
                "testCases": [
                    {"type": "code_contains", "expected": ["class"]},
                    {"type": "code_contains_any", "expected": ["Use", "Run", "next", "Invoke"]}
                ]
            },
            {
                "title": "Custom LINQ Operator",
                "task": "Create a custom LINQ extension method 'WhereNot' that filters out items matching a predicate.",
                "xp": 225,
                "testCases": [
                    {"type": "code_contains", "expected": ["static", "this", "IEnumerable"]},
                    {"type": "code_contains_any", "expected": ["WhereNot", "Func<", "yield"]}
                ]
            },
            {
                "title": "Thread-Safe Cache",
                "task": "Implement a thread-safe cache using ConcurrentDictionary with expiration.",
                "xp": 255,
                "testCases": [
                    {"type": "code_contains", "expected": ["ConcurrentDictionary"]},
                    {"type": "code_contains_any", "expected": ["DateTime", "expir", "TimeSpan"]}
                ]
            },
            {
                "title": "Builder Pattern",
                "task": "Implement the Builder pattern for a complex object with method chaining.",
                "xp": 220,
                "testCases": [
                    {"type": "code_contains", "expected": ["class", "Builder", "Build"]},
                    {"type": "code_contains", "expected": ["return this"]}
                ]
            }
        ]
    },
    "python": {
        "Beginner": [],
        "Intermediate": [],
        "Advanced": []
    },
    "html": {
        "Beginner": [
            {
                "title": "Basic Page Structure",
                "task": "Create a complete HTML page with <!DOCTYPE html>, <html>, <head> with a <title>, and a <body> containing an <h1> heading and a <p> paragraph.",
                "xp": 40,
                "testCases": [
                    {"type": "code_contains", "expected": ["<!DOCTYPE html>", "<html", "<head>", "<title>", "</title>", "<body>", "<h1>", "</h1>", "<p>", "</p>", "</body>", "</html>"]}
                ]
            },
            {
                "title": "Navigation Bar",
                "task": "Create a navigation bar using <nav> with an unordered list (<ul>) containing at least 3 list items (<li>), each with an anchor link (<a>).",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["<nav>", "<ul>", "<li>", "<a ", "href"]},
                    {"type": "code_count", "pattern": "<li>", "min": 3}
                ]
            },
            {
                "title": "Image Gallery",
                "task": "Create a section with at least 3 images using <img> tags. Each image must have src and alt attributes.",
                "xp": 45,
                "testCases": [
                    {"type": "code_contains", "expected": ["<img", "src=", "alt="]},
                    {"type": "code_count", "pattern": "<img", "min": 3}
                ]
            },
            {
                "title": "Contact Form",
                "task": "Build a contact form with <form> containing: a text input for name, an email input, a textarea for message, and a submit button.",
                "xp": 60,
                "testCases": [
                    {"type": "code_contains", "expected": ["<form", "<input", "<textarea", "<button"]},
                    {"type": "code_contains_any", "expected": ["type=\"text\"", "type='text'", "type=\"email\"", "type='email'"]}
                ]
            },
            {
                "title": "Ordered & Unordered Lists",
                "task": "Create both an ordered list (<ol>) and an unordered list (<ul>), each with at least 3 items.",
                "xp": 40,
                "testCases": [
                    {"type": "code_contains", "expected": ["<ol>", "<ul>", "<li>"]},
                    {"type": "code_count", "pattern": "<li>", "min": 6}
                ]
            },
            {
                "title": "Simple Table",
                "task": "Create an HTML table with <table>, a header row (<thead> with <th>) and at least 3 data rows (<tbody> with <tr> and <td>). The table should have 3 columns.",
                "xp": 55,
                "testCases": [
                    {"type": "code_contains", "expected": ["<table", "<tr", "<th", "<td"]},
                    {"type": "code_count", "pattern": "<tr", "min": 4}
                ]
            },
            {
                "title": "Semantic HTML",
                "task": "Build a page layout using semantic HTML5 elements: <header>, <main>, <section>, <article>, and <footer>. Each should contain some text content.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["<header>", "<main>", "<section>", "<article>", "<footer>"]}
                ]
            },
            {
                "title": "Hyperlinks",
                "task": "Create a page with at least 3 links: one that opens in the same tab, one that opens in a new tab (target=\"_blank\"), and one that links to a section on the same page using an id.",
                "xp": 50,
                "testCases": [
                    {"type": "code_contains", "expected": ["<a ", "href=", "id="]},
                    {"type": "code_count", "pattern": "<a ", "min": 3}
                ]
            },
            {
                "title": "Video Embed",
                "task": "Embed a video using the <video> tag with controls attribute, a source, and a fallback text. Also add a heading and description paragraph.",
                "xp": 45,
                "testCases": [
                    {"type": "code_contains", "expected": ["<video", "controls", "<source", "</video>"]},
                    {"type": "code_contains_any", "expected": ["<h1>", "<h2>", "<h3>"]}
                ]
            },
            {
                "title": "Meta Tags & SEO",
                "task": "Create an HTML page with proper <head> section including: charset meta tag, viewport meta tag, a description meta tag, and a title tag.",
                "xp": 45,
                "testCases": [
                    {"type": "code_contains", "expected": ["<meta", "charset", "viewport", "description", "<title>"]}
                ]
            }
        ],
        "Intermediate": [
            {
                "title": "Responsive Grid Layout",
                "task": "Create a responsive card grid using CSS Grid or Flexbox. Include at least 4 cards, each with an image placeholder, title, and description. Use media queries or auto-fit/auto-fill for responsiveness.",
                "xp": 80,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["display: grid", "display: flex", "display:grid", "display:flex"]},
                    {"type": "code_count", "pattern": "<div", "min": 5}
                ]
            },
            {
                "title": "CSS Flexbox Navigation",
                "task": "Build a horizontal navigation bar using Flexbox with a logo on the left and nav links on the right. Include hover effects on the links.",
                "xp": 70,
                "testCases": [
                    {"type": "code_contains", "expected": ["display: flex", "<nav", "hover"]},
                    {"type": "code_contains_any", "expected": ["justify-content", "align-items"]}
                ]
            },
            {
                "title": "Form Validation Attributes",
                "task": "Create a registration form with HTML5 validation: required fields, email type, password with minlength, number input with min/max, and a pattern attribute for phone number.",
                "xp": 75,
                "testCases": [
                    {"type": "code_contains", "expected": ["required", "minlength", "pattern"]},
                    {"type": "code_contains_any", "expected": ["type=\"email\"", "type='email'", "type=\"password\"", "type='password'"]}
                ]
            },
            {
                "title": "CSS Animation",
                "task": "Create a CSS animation using @keyframes. Animate an element to change at least 2 properties (e.g., color, transform, opacity). Use animation-duration and animation-iteration-count.",
                "xp": 80,
                "testCases": [
                    {"type": "code_contains", "expected": ["@keyframes", "animation"]},
                    {"type": "code_contains_any", "expected": ["transform", "opacity", "color", "background"]}
                ]
            },
            {
                "title": "Accessible Form",
                "task": "Build an accessible form with proper <label> elements linked to inputs via for/id attributes, fieldset/legend grouping, and aria attributes.",
                "xp": 75,
                "testCases": [
                    {"type": "code_contains", "expected": ["<label", "for=", "<fieldset>", "<legend>"]},
                    {"type": "code_contains_any", "expected": ["aria-", "role="]}
                ]
            },
            {
                "title": "CSS Variables Theme",
                "task": "Create a page that uses CSS custom properties (variables) for colors. Define at least 4 variables in :root and use them throughout the page for background, text, borders, and accent colors.",
                "xp": 70,
                "testCases": [
                    {"type": "code_contains", "expected": [":root", "--", "var("]},
                    {"type": "code_count", "pattern": "--", "min": 4}
                ]
            },
            {
                "title": "Responsive Images",
                "task": "Create a page with responsive images using <picture> element with multiple <source> tags for different screen sizes, and an <img> fallback. Include srcset and sizes attributes.",
                "xp": 75,
                "testCases": [
                    {"type": "code_contains", "expected": ["<picture>", "<source", "<img"]},
                    {"type": "code_contains_any", "expected": ["srcset", "media="]}
                ]
            },
            {
                "title": "Modal Dialog",
                "task": "Create a modal/dialog using the HTML <dialog> element. Include an open button, close button, a heading, content text, and basic styling with backdrop.",
                "xp": 80,
                "testCases": [
                    {"type": "code_contains", "expected": ["<dialog", "</dialog>"]},
                    {"type": "code_contains_any", "expected": ["showModal", "::backdrop", "open"]}
                ]
            }
        ],
        "Advanced": [
            {
                "title": "CSS Grid Dashboard",
                "task": "Build a dashboard layout with CSS Grid: sidebar, header, main content with 3 stat cards, and a footer. Use grid-template-areas for named layout regions.",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["display: grid", "grid-template-areas"]},
                    {"type": "code_count", "pattern": "grid-area", "min": 3}
                ]
            },
            {
                "title": "Dark Mode Toggle",
                "task": "Create a page with light and dark mode themes using CSS custom properties and a data attribute toggle (data-theme). Include styles for both themes and a toggle button with CSS transitions.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["data-theme", ":root", "--", "var("]},
                    {"type": "code_contains_any", "expected": ["transition", "prefers-color-scheme"]}
                ]
            },
            {
                "title": "CSS-Only Accordion",
                "task": "Build an accordion/collapsible section using only HTML and CSS (no JavaScript). Use the <details>/<summary> elements or checkbox hack. Include at least 3 sections with smooth transitions.",
                "xp": 110,
                "testCases": [
                    {"type": "code_contains_any", "expected": ["<details>", "<summary>", "checkbox", ":checked"]},
                    {"type": "code_contains", "expected": ["transition"]}
                ]
            },
            {
                "title": "Print Stylesheet",
                "task": "Create a page with a separate print stylesheet using @media print. Hide navigation and sidebar for print, adjust fonts to serif, remove backgrounds, and show full URLs for links.",
                "xp": 100,
                "testCases": [
                    {"type": "code_contains", "expected": ["@media print", "display: none"]},
                    {"type": "code_contains_any", "expected": ["content:", "serif"]}
                ]
            },
            {
                "title": "Responsive Email Template",
                "task": "Create an HTML email template using table-based layout (for email client compatibility). Include inline styles, a header with logo area, content section, call-to-action button, and footer.",
                "xp": 140,
                "testCases": [
                    {"type": "code_contains", "expected": ["<table", "style=", "width"]},
                    {"type": "code_count", "pattern": "<table", "min": 2}
                ]
            },
            {
                "title": "SVG Inline Graphics",
                "task": "Create a page with inline SVG graphics. Draw at least 3 shapes (circle, rect, path) with different fill colors, and add a text element and hover effects using CSS.",
                "xp": 120,
                "testCases": [
                    {"type": "code_contains", "expected": ["<svg", "<circle", "<rect"]},
                    {"type": "code_contains_any", "expected": ["<path", "<text", "<polygon"]},
                    {"type": "code_contains", "expected": ["fill="]}
                ]
            },
            {
                "title": "CSS Scroll Snap Gallery",
                "task": "Build a horizontal scroll-snap image gallery. Use scroll-snap-type and scroll-snap-align for smooth snapping between items. Include navigation dots or arrows.",
                "xp": 130,
                "testCases": [
                    {"type": "code_contains", "expected": ["scroll-snap-type", "scroll-snap-align"]},
                    {"type": "code_contains_any", "expected": ["overflow", "scroll"]}
                ]
            },
            {
                "title": "Web Components Template",
                "task": "Create an HTML page that uses the <template> and <slot> elements. Define a reusable card template and clone it to create at least 3 instances with different content.",
                "xp": 150,
                "testCases": [
                    {"type": "code_contains", "expected": ["<template", "<slot"]},
                    {"type": "code_contains_any", "expected": ["cloneNode", "customElements", "shadow"]}
                ]
            }
        ]
    }
}

# Python uses the original CHALLENGES dict
LANGUAGE_QUESTS["python"]["Beginner"] = CHALLENGES["Beginner"]
LANGUAGE_QUESTS["python"]["Intermediate"] = CHALLENGES["Intermediate"]
LANGUAGE_QUESTS["python"]["Advanced"] = CHALLENGES["Advanced"]

# Build a flat lookup for quest IDs (across all languages)
# Assign unique IDs to language quests starting from 100
_next_id = 100
for lang, levels in LANGUAGE_QUESTS.items():
    if lang == "python":
        continue  # Python quests already have IDs 1-36
    for level, quests in levels.items():
        for q in quests:
            q["id"] = _next_id
            q["language"] = lang
            _next_id += 1

# Add language tag to python quests too
for level, quests in LANGUAGE_QUESTS["python"].items():
    for q in quests:
        q["language"] = "python"

# Build flat quest lookup for validation
ALL_QUESTS = {}
for lang, levels in LANGUAGE_QUESTS.items():
    for level, quests in levels.items():
        for q in quests:
            ALL_QUESTS[q["id"]] = q

# --- Solution Validator ---
import io
import sys
import re

def validate_solution(code: str, quest_id) -> dict:
    """Validate a solution against test cases for a quest.
    quest_id can be an int (hardcoded) or a string (Firestore doc ID).
    """
    quest = ALL_QUESTS.get(quest_id)

    # Also try integer lookup if quest_id is numeric
    if not quest and isinstance(quest_id, (int, float)):
        quest = ALL_QUESTS.get(int(quest_id))

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
                # Only works for Python quests
                quest_lang = quest.get("language", "python")
                if quest_lang != "python":
                    # For non-Python, just check code contains the expected strings
                    expected = test.get("expected", [])
                    if any(exp in code for exp in expected):
                        tests_passed += 1
                    else:
                        failed_tests.append(f"Output check skipped for {quest_lang}")
                    continue

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
                # Test a specific function with inputs (Python only)
                quest_lang = quest.get("language", "python")
                if quest_lang != "python":
                    tests_passed += 1  # Skip function tests for non-Python
                    continue

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

# --- Pydantic Models ---

class CodeSession(BaseModel):
    userId: str
    email: str
    code: str
    language: str
    fileName: str
    duration: float
    keystrokes: int
    questId: Union[int, str, None] = None  # Quest ID (int for hardcoded, str for Firestore)
    behavioralSignals: Optional[dict] = None

class QuestCreateRequest(BaseModel):
    title: str
    task: str
    xp: int
    language: str
    level: str  # "Beginner", "Intermediate", "Advanced"
    testCases: List[dict] = []

class QuestUpdateRequest(BaseModel):
    title: Optional[str] = None
    task: Optional[str] = None
    xp: Optional[int] = None
    language: Optional[str] = None
    level: Optional[str] = None
    testCases: Optional[List[dict]] = None

class QuestCompleteRequest(BaseModel):
    userId: str
    questId: str
    completionTimeMs: int
    estimatedTimeMs: int = 600000  # default 10 min
    hintsUsed: int = 0
    passed: bool
    questType: str = "reinforcement"  # reinforcement | stretch | weak_area

class SessionStartRequest(BaseModel):
    userId: str
    email: str
    language: Optional[str] = None

class BehavioralSignalsModel(BaseModel):
    totalClipboardPastes: int = 0
    totalPasteCharacters: int = 0
    totalAutocompleteAccepts: int = 0
    totalCopilotAccepts: int = 0
    totalUndos: int = 0
    totalRedos: int = 0
    totalFormatActions: int = 0
    totalSnippetInserts: int = 0
    typingIntervals: List[float] = []
    burstCount: int = 0
    totalDeletions: int = 0
    deletionCharacters: int = 0

class SessionUpdateRequest(BaseModel):
    totalKeystrokes: int = 0
    totalPastes: int = 0
    totalEdits: int = 0
    activeDuration: float = 0
    idleDuration: float = 0
    filesEdited: List[str] = []
    languagesUsed: List[str] = []
    behavioralSignals: Optional[BehavioralSignalsModel] = None

class SessionEndRequest(BaseModel):
    totalKeystrokes: int = 0
    totalPastes: int = 0
    totalEdits: int = 0
    totalDuration: float = 0
    activeDuration: float = 0
    idleDuration: float = 0
    filesEdited: List[str] = []
    languagesUsed: List[str] = []
    behavioralSignals: Optional[BehavioralSignalsModel] = None
    snapshotCode: Optional[str] = None      # Current file code at session end
    snapshotLanguage: Optional[str] = None  # Language of the snapshot file

class AIDetectRequest(BaseModel):
    sessionId: str

# --- AI Detection Engine (Physics-Based Behavioral Analysis) ---

class AIDetectionEngine:
    """
    Multi-signal behavioral AI detection engine.
    Uses physics-based signals (typing patterns, paste behavior, editing rhythm)
    to determine likelihood that code was AI-generated.

    Each signal produces a score 0-100 and a verdict: 'human', 'suspicious', 'ai_likely'.
    Signals are weighted and combined for a final AI likelihood score.
    """

    # Signal weights (must sum to 1.0)
    WEIGHTS = {
        "typing_speed":   0.15,
        "paste_ratio":    0.25,   # Increased — primary signal for vibe coding
        "typing_rhythm":  0.15,
        "deletion_ratio": 0.10,
        "burst_pattern":  0.10,
        "copilot_usage":  0.15,
        "undo_redo_ratio": 0.05,
        "idle_ratio":     0.05,
    }

    @staticmethod
    def analyze(session_data: dict) -> dict:
        """
        Analyze a session and return AI detection results.

        Args:
            session_data: dict with keys:
                - totalKeystrokes, totalPastes, totalEdits
                - activeDuration, idleDuration, totalDuration
                - behavioralSignals (optional): dict with typing intervals, paste counts, etc.

        Returns:
            dict with aiLikelihoodScore, confidence, signals breakdown, recommendation
        """
        signals = {}
        bs = session_data.get("behavioralSignals", {}) or {}

        total_keystrokes = session_data.get("totalKeystrokes", 0)
        total_pastes = session_data.get("totalPastes", 0)
        total_edits = session_data.get("totalEdits", 0)
        active_duration = session_data.get("activeDuration", 0)
        idle_duration = session_data.get("idleDuration", 0)
        total_duration = session_data.get("totalDuration", 0) or (active_duration + idle_duration)

        # --- Signal 1: Typing Speed (characters per second) ---
        cps = total_keystrokes / (active_duration + 0.1) if active_duration > 0 else 0

        # Pre-compute paste metrics here for use in multiple signals
        paste_chars_early = bs.get("totalPasteCharacters", 0)
        total_input_early = total_keystrokes + paste_chars_early + 0.1
        paste_ratio_early = paste_chars_early / total_input_early if total_input_early > 0 else 0

        if cps > 8.0:
            ts_score, ts_verdict = 95, "ai_likely"
            ts_desc = f"{cps:.1f} chars/sec — superhuman typing speed"
        elif cps > 5.0:
            ts_score, ts_verdict = 75, "ai_likely"
            ts_desc = f"{cps:.1f} chars/sec — very fast, likely AI-assisted"
        elif cps > 3.5:
            ts_score, ts_verdict = 40, "suspicious"
            ts_desc = f"{cps:.1f} chars/sec — above average"
        elif cps > 1.5:
            ts_score, ts_verdict = 10, "human"
            ts_desc = f"{cps:.1f} chars/sec — normal human typing"
        elif paste_ratio_early > 0.5:
            # Low keystrokes but lots of paste — user typed prompts, AI wrote the code
            ts_score, ts_verdict = 75, "ai_likely"
            ts_desc = f"{cps:.1f} chars/sec — few keystrokes typed but {paste_ratio_early*100:.0f}% of code was pasted (vibe coding pattern)"
        else:
            ts_score, ts_verdict = 15, "human"
            ts_desc = f"{cps:.1f} chars/sec — slow session"

        signals["typing_speed"] = {
            "name": "Typing Speed",
            "value": round(cps, 2),
            "score": ts_score,
            "weight": AIDetectionEngine.WEIGHTS["typing_speed"],
            "description": ts_desc,
            "verdict": ts_verdict
        }

        # --- Signal 2: Paste Ratio (pasted chars vs total input) ---
        clipboard_pastes = bs.get("totalClipboardPastes", 0)
        paste_chars = bs.get("totalPasteCharacters", 0)
        total_input = total_keystrokes + paste_chars + 0.1
        paste_ratio = paste_chars / total_input if total_input > 0 else 0

        if paste_ratio > 0.8:
            pr_score, pr_verdict = 95, "ai_likely"
        elif paste_ratio > 0.5:
            pr_score, pr_verdict = 70, "ai_likely"
        elif paste_ratio > 0.3:
            pr_score, pr_verdict = 40, "suspicious"
        elif paste_ratio > 0.1:
            pr_score, pr_verdict = 15, "human"
        else:
            pr_score, pr_verdict = 5, "human"

        signals["paste_ratio"] = {
            "name": "Paste Ratio",
            "value": round(paste_ratio * 100, 1),
            "score": pr_score,
            "weight": AIDetectionEngine.WEIGHTS["paste_ratio"],
            "description": f"{paste_ratio*100:.0f}% of code was pasted ({clipboard_pastes} paste actions, {paste_chars} chars)",
            "verdict": pr_verdict
        }

        # --- Signal 3: Typing Rhythm Consistency ---
        # Humans have variable inter-key intervals. AI paste = no intervals or very uniform bursts.
        typing_intervals = bs.get("typingIntervals", [])
        cv = 0.0
        if len(typing_intervals) >= 10:
            mean_interval = statistics.mean(typing_intervals)
            stdev_interval = statistics.stdev(typing_intervals)
            cv = stdev_interval / (mean_interval + 0.1)  # coefficient of variation

            # Humans typically have CV > 0.6 (high variability)
            # AI-assisted: fewer intervals, or very uniform
            if cv < 0.3:
                tr_score, tr_verdict = 80, "ai_likely"
            elif cv < 0.5:
                tr_score, tr_verdict = 50, "suspicious"
            elif cv < 0.8:
                tr_score, tr_verdict = 20, "human"
            else:
                tr_score, tr_verdict = 5, "human"

            tr_desc = f"Rhythm variability: {cv:.2f} (CV) — humans typically >0.6"
        else:
            # Too few typing intervals — check paste context
            if paste_chars_early > 200:
                tr_score, tr_verdict = 85, "ai_likely"
                tr_desc = f"Only {len(typing_intervals)} typed intervals but {paste_chars_early} chars pasted — code was generated, not typed"
            elif total_keystrokes > 200:
                tr_score, tr_verdict = 60, "suspicious"
                tr_desc = f"Only {len(typing_intervals)} typing intervals for {total_keystrokes} keystrokes — most code may have been pasted"
            else:
                tr_score, tr_verdict = 20, "human"
                tr_desc = f"Short session ({len(typing_intervals)} intervals) — insufficient data"

        signals["typing_rhythm"] = {
            "name": "Typing Rhythm",
            "value": round(cv, 2) if len(typing_intervals) >= 10 else 0,
            "score": tr_score,
            "weight": AIDetectionEngine.WEIGHTS["typing_rhythm"],
            "description": tr_desc,
            "verdict": tr_verdict
        }

        # --- Signal 4: Deletion Ratio ---
        # Humans delete/correct frequently. AI-generated code is pasted clean.
        total_deletions = bs.get("totalDeletions", 0)
        deletion_chars = bs.get("deletionCharacters", 0)
        deletion_ratio = total_deletions / (total_edits + 0.1) if total_edits > 0 else 0

        if total_edits < 5:
            dr_score, dr_verdict = 30, "suspicious"
            dr_desc = "Too few edits to analyze deletion patterns"
        elif deletion_ratio < 0.05:
            dr_score, dr_verdict = 70, "ai_likely"
            dr_desc = f"Almost no deletions ({deletion_ratio*100:.0f}%) — AI code is usually pasted clean"
        elif deletion_ratio < 0.15:
            dr_score, dr_verdict = 40, "suspicious"
            dr_desc = f"Low deletion rate ({deletion_ratio*100:.0f}%) — below typical human range"
        elif deletion_ratio < 0.4:
            dr_score, dr_verdict = 10, "human"
            dr_desc = f"Normal deletion rate ({deletion_ratio*100:.0f}%) — consistent with human editing"
        else:
            dr_score, dr_verdict = 5, "human"
            dr_desc = f"High deletion rate ({deletion_ratio*100:.0f}%) — lots of trial-and-error (human)"

        signals["deletion_ratio"] = {
            "name": "Deletion Pattern",
            "value": round(deletion_ratio * 100, 1),
            "score": dr_score,
            "weight": AIDetectionEngine.WEIGHTS["deletion_ratio"],
            "description": dr_desc,
            "verdict": dr_verdict
        }

        # --- Signal 5: Burst Pattern ---
        # Rapid typing bursts OR large paste insertions = AI-assisted pattern
        burst_count = bs.get("burstCount", 0)
        clipboard_pastes_for_burst = bs.get("totalClipboardPastes", 0)
        # Each large paste event is effectively an AI "burst" of inserted code
        effective_bursts = burst_count + clipboard_pastes_for_burst
        if effective_bursts >= 5:
            bp_score, bp_verdict = 85, "ai_likely"
            bp_desc = f"{clipboard_pastes_for_burst} large paste insertions + {burst_count} typing bursts — AI-generated code pattern"
        elif effective_bursts >= 2:
            bp_score, bp_verdict = 55, "suspicious"
            bp_desc = f"{effective_bursts} large insertion events detected"
        else:
            bp_score, bp_verdict = 10, "human"
            bp_desc = f"No significant paste bursts — steady coding rhythm"

        signals["burst_pattern"] = {
            "name": "Burst Pattern",
            "value": burst_count,
            "score": bp_score,
            "weight": AIDetectionEngine.WEIGHTS["burst_pattern"],
            "description": bp_desc,
            "verdict": bp_verdict
        }

        # --- Signal 6: Copilot / AI Tool Usage ---
        copilot_accepts = bs.get("totalCopilotAccepts", 0)
        autocomplete_accepts = bs.get("totalAutocompleteAccepts", 0)
        # Copilot is a direct AI signal. Autocomplete is normal IDE behavior.
        if copilot_accepts > 10:
            cu_score, cu_verdict = 90, "ai_likely"
            cu_desc = f"{copilot_accepts} Copilot suggestions accepted — heavy AI assistance"
        elif copilot_accepts > 3:
            cu_score, cu_verdict = 60, "suspicious"
            cu_desc = f"{copilot_accepts} Copilot suggestions accepted"
        elif copilot_accepts > 0:
            cu_score, cu_verdict = 30, "suspicious"
            cu_desc = f"{copilot_accepts} Copilot suggestion(s) — some AI assistance"
        else:
            cu_score, cu_verdict = 5, "human"
            cu_desc = "No AI tool usage detected"

        signals["copilot_usage"] = {
            "name": "AI Tool Usage",
            "value": copilot_accepts,
            "score": cu_score,
            "weight": AIDetectionEngine.WEIGHTS["copilot_usage"],
            "description": cu_desc,
            "verdict": cu_verdict
        }

        # --- Signal 7: Undo/Redo Ratio ---
        # Humans undo frequently while experimenting. Pure AI paste = no undos.
        total_undos = bs.get("totalUndos", 0)
        total_redos = bs.get("totalRedos", 0)
        undo_ratio = total_undos / (total_edits + 0.1) if total_edits > 0 else 0

        if total_edits < 5:
            ur_score, ur_verdict = 25, "suspicious"
            ur_desc = "Too few edits to evaluate undo patterns"
        elif undo_ratio < 0.02:
            ur_score, ur_verdict = 55, "suspicious"
            ur_desc = f"Almost no undos ({total_undos}) — may indicate pre-written code"
        elif undo_ratio < 0.1:
            ur_score, ur_verdict = 15, "human"
            ur_desc = f"Normal undo rate ({total_undos} undos) — consistent with human coding"
        else:
            ur_score, ur_verdict = 5, "human"
            ur_desc = f"High undo rate ({total_undos} undos) — lots of experimentation (human)"

        signals["undo_redo_ratio"] = {
            "name": "Undo/Redo Pattern",
            "value": total_undos,
            "score": ur_score,
            "weight": AIDetectionEngine.WEIGHTS["undo_redo_ratio"],
            "description": ur_desc,
            "verdict": ur_verdict
        }

        # --- Signal 8: Idle Ratio ---
        # Humans think, read docs, switch context. Pure AI use = minimal idle time.
        idle_ratio = idle_duration / (total_duration + 0.1) if total_duration > 0 else 0

        if total_duration < 30:
            ir_score, ir_verdict = 50, "suspicious"
            ir_desc = "Very short session — insufficient data for idle analysis"
        elif idle_ratio < 0.05:
            ir_score, ir_verdict = 50, "suspicious"
            ir_desc = f"Almost no thinking time ({idle_ratio*100:.0f}% idle) — code produced with minimal pauses"
        elif idle_ratio < 0.15:
            ir_score, ir_verdict = 25, "human"
            ir_desc = f"Low idle time ({idle_ratio*100:.0f}%) — focused but could be normal"
        elif idle_ratio < 0.5:
            ir_score, ir_verdict = 10, "human"
            ir_desc = f"Normal idle pattern ({idle_ratio*100:.0f}%) — reading, thinking, planning"
        else:
            ir_score, ir_verdict = 10, "human"
            ir_desc = f"High idle time ({idle_ratio*100:.0f}%) — lots of reading/thinking"

        signals["idle_ratio"] = {
            "name": "Thinking Time",
            "value": round(idle_ratio * 100, 1),
            "score": ir_score,
            "weight": AIDetectionEngine.WEIGHTS["idle_ratio"],
            "description": ir_desc,
            "verdict": ir_verdict
        }

        # --- Combine Signals into Final Score ---
        weighted_sum = 0
        total_weight = 0
        for key, signal in signals.items():
            w = signal["weight"]
            weighted_sum += signal["score"] * w
            total_weight += w

        ai_likelihood = weighted_sum / total_weight if total_weight > 0 else 0

        # Paste dominance override: if the majority of code was pasted, enforce a minimum score.
        # This covers vibe coding / copy-paste sessions that other signals undercount.
        final_paste_ratio = paste_ratio_early  # already computed above
        if final_paste_ratio > 0.85:
            ai_likelihood = max(ai_likelihood, 88)
        elif final_paste_ratio > 0.70:
            ai_likelihood = max(ai_likelihood, 75)
        elif final_paste_ratio > 0.50:
            ai_likelihood = max(ai_likelihood, 60)

        ai_likelihood = min(100, max(0, round(ai_likelihood, 1)))

        # Confidence: higher if we have more behavioral data
        has_intervals = len(typing_intervals) >= 10
        has_behavioral = bool(bs)
        data_points = sum([
            has_intervals,
            has_behavioral,
            total_edits > 10,
            active_duration > 60,
            total_keystrokes > 50
        ])
        confidence = min(95, data_points * 19)

        # Recommendation
        if ai_likelihood >= 70:
            recommendation = "High likelihood of AI-generated code. Review behavioral signals for details."
        elif ai_likelihood >= 40:
            recommendation = "Moderate AI indicators detected. Some code may be AI-assisted."
        else:
            recommendation = "Code appears to be human-written based on behavioral analysis."

        return {
            "status": "success",
            "aiLikelihoodScore": ai_likelihood,
            "confidence": confidence,
            "signals": signals,
            "recommendation": recommendation
        }


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

def generate_tips(skill_level: str, ai_probability: float, signals: dict) -> list:
    """Generate personalized, actionable recommendation tips based on skill level and AI signals."""
    tips = []

    # Skill-level tips
    if skill_level == "Beginner":
        tips.append("Practice writing small functions from scratch daily — even 15 minutes builds strong foundations.")
        tips.append("Read code written by others and try to explain it line by line; this builds pattern recognition.")
    elif skill_level == "Intermediate":
        tips.append("Challenge yourself with problems that require data structures (trees, graphs) to deepen your understanding.")
        tips.append("Review time and space complexity of your solutions — aim to optimize after you get them working.")
    elif skill_level == "Advanced":
        tips.append("Contribute to open-source projects; reviewing real codebases at scale accelerates mastery.")
        tips.append("Mentor or explain concepts to others — teaching is one of the fastest ways to deepen expertise.")

    # AI detection tips based on signals
    if ai_probability > 70:
        tips.append("High AI likelihood detected: try writing code without AI assistance for at least one session per day to build genuine problem-solving skills.")
        tips.append("If you used AI to generate code, go back and manually rewrite it line by line to internalize the logic.")
    elif ai_probability > 40:
        tips.append("Some AI-assisted patterns detected: use AI as a reference, not a generator — write the solution yourself first, then compare.")

    # Signal-specific tips
    paste_signal = signals.get("paste_ratio", {})
    if paste_signal.get("verdict") in ("suspicious", "ai_likely"):
        tips.append("High paste ratio: type code manually instead of copying — muscle memory accelerates learning.")

    rhythm_signal = signals.get("typing_rhythm", {})
    if rhythm_signal.get("verdict") in ("suspicious", "ai_likely"):
        tips.append("Irregular typing rhythm detected: slow down and think through each line before typing it.")

    deletion_signal = signals.get("deletion_ratio", {})
    if deletion_signal.get("verdict") in ("suspicious", "ai_likely"):
        tips.append("Very few deletions observed: real coding involves constant correction — don't be afraid to edit and refine.")

    idle_signal = signals.get("idle_ratio", {})
    if idle_signal.get("verdict") in ("suspicious", "ai_likely"):
        tips.append("Little thinking/pause time: take moments to plan your approach before writing code — design beats speed.")

    # Positive reinforcement if all human
    ai_likely_count = sum(1 for s in signals.values() if s.get("verdict") == "ai_likely")
    if ai_likely_count == 0 and ai_probability < 30:
        tips.append("Excellent authentic coding behavior! Keep up the consistent practice.")

    return tips[:5]  # Return at most 5 tips to keep it focused

# --- Persistent Session Endpoints ---

@app.post("/session/start")
async def session_start(req: SessionStartRequest):
    """Create a new persistent session. Returns sessionId. Call once when tracking starts."""
    try:
        session_id = str(uuid.uuid4())
        doc_data = {
            "sessionId": session_id,
            "userId": req.userId,
            "email": req.email,
            "status": "active",
            "language": req.language,
            "sessionType": "extension",
            "timestamp": firestore.SERVER_TIMESTAMP,
            "startTime": firestore.SERVER_TIMESTAMP,
            "endTime": None,
            "totalKeystrokes": 0,
            "totalPastes": 0,
            "totalEdits": 0,
            "totalDuration": 0,
            "activeDuration": 0,
            "idleDuration": 0,
            "filesEdited": [],
            "languagesUsed": [],
        }
        db.collection("sessions").document(session_id).set(doc_data)
        return {"status": "success", "sessionId": session_id}
    except Exception as e:
        print(f"Session start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/session/{session_id}/update")
async def session_update(session_id: str, req: SessionUpdateRequest):
    """Update an active session with latest metrics. Call periodically (e.g., every 30s)."""
    try:
        doc_ref = db.collection("sessions").document(session_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        update_data = {
            "totalKeystrokes": req.totalKeystrokes,
            "totalPastes": req.totalPastes,
            "totalEdits": req.totalEdits,
            "activeDuration": req.activeDuration,
            "idleDuration": req.idleDuration,
            "filesEdited": req.filesEdited,
            "languagesUsed": req.languagesUsed,
            "lastUpdated": firestore.SERVER_TIMESTAMP,
        }
        if req.behavioralSignals:
            update_data["behavioralSignals"] = req.behavioralSignals.dict()
        doc_ref.update(update_data)
        return {"status": "success", "sessionId": session_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Session update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def fuse_skill_with_behavior(
    codebert_probs: list,          # [adv_prob, beg_prob, mid_prob] from model
    req: "SessionEndRequest",
) -> tuple[str, float]:
    """
    Combine CodeBERT class probabilities with behavioral signals to produce
    a final skill label and confidence.

    CodeBERT weight: 60%  (what was written)
    Behavioral weight: 40% (how it was written)

    Behavioral score (0–1) maps to a soft label distribution:
      score < 0.35  → lean Beginner
      score 0.35-0.65 → lean Intermediate
      score > 0.65  → lean Advanced
    """
    beg_p, mid_p, adv_p = codebert_probs  # model outputs [Beginner, Intermediate, Advanced]

    # --- Build behavioral score ---
    total_ks = max(req.totalKeystrokes, 1)
    total_dur = max(req.totalDuration, 1)
    active_dur = max(req.activeDuration, 1)
    bs = req.behavioralSignals

    paste_ratio   = min(req.totalPastes / total_ks, 1.0)          # lower = better
    idle_ratio    = min(req.idleDuration / total_dur, 1.0)         # lower = better
    ks_rate       = min(req.totalKeystrokes / (active_dur / 60), 400) / 400  # higher = better (cap 400 kpm)
    file_breadth  = min(len(req.filesEdited or []) / 5, 1.0)       # higher = better
    lang_breadth  = min(len(req.languagesUsed or []) / 3, 1.0)     # higher = better

    copilot_ratio = 0.0
    undo_ratio    = 0.0
    burst_score   = 0.5
    deletion_ratio = 0.0

    if bs:
        copilot_accepts = bs.totalCopilotAccepts + bs.totalAutocompleteAccepts
        copilot_ratio   = min(copilot_accepts / total_ks, 1.0)     # lower = better
        undo_ratio      = min(bs.totalUndos / total_ks, 1.0)       # lower = better (fewer mistakes)
        burst_score     = min(bs.burstCount / 20, 1.0)             # higher = more confident typing
        deletion_ratio  = min(bs.deletionCharacters / max(total_ks * 5, 1), 1.0)  # lower = better

    behavioral_score = (
        (1 - paste_ratio)   * 0.20 +
        (1 - idle_ratio)    * 0.15 +
        ks_rate             * 0.15 +
        file_breadth        * 0.10 +
        lang_breadth        * 0.05 +
        (1 - copilot_ratio) * 0.15 +
        (1 - undo_ratio)    * 0.10 +
        burst_score         * 0.05 +
        (1 - deletion_ratio)* 0.05
    )
    behavioral_score = max(0.0, min(1.0, behavioral_score))

    # Convert behavioral score to a soft label distribution
    if behavioral_score < 0.35:
        b_beg, b_mid, b_adv = 0.70, 0.25, 0.05
    elif behavioral_score < 0.65:
        b_beg, b_mid, b_adv = 0.15, 0.65, 0.20
    else:
        b_beg, b_mid, b_adv = 0.05, 0.30, 0.65

    # Weighted fusion (CodeBERT 60%, behavioral 40%)
    W_CB, W_BH = 0.60, 0.40
    f_adv = W_CB * adv_p + W_BH * b_adv
    f_beg = W_CB * beg_p + W_BH * b_beg
    f_mid = W_CB * mid_p + W_BH * b_mid

    fused = {"Beginner": f_beg, "Intermediate": f_mid, "Advanced": f_adv}
    best_label = max(fused, key=fused.get)
    confidence = fused[best_label] / sum(fused.values()) * 100

    print(f"[SkillFusion] behavioral_score={behavioral_score:.2f} "
          f"cb=[Beg:{beg_p:.2f} Mid:{mid_p:.2f} Adv:{adv_p:.2f}] "
          f"bh=[Beg:{b_beg:.2f} Mid:{b_mid:.2f} Adv:{b_adv:.2f}] "
          f"→ {best_label} ({confidence:.1f}%)")

    return best_label, confidence


@app.post("/session/{session_id}/end")
async def session_end(session_id: str, req: SessionEndRequest):
    """End a session. Call when user stops tracking or exits VS Code."""
    try:
        doc_ref = db.collection("sessions").document(session_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        num_languages = len(req.languagesUsed) if req.languagesUsed else 0
        num_files = len(req.filesEdited) if req.filesEdited else 0

        # Classify skill: CodeBERT fused with behavioral signals
        skill_level = "Beginner"
        confidence = 0.0
        if req.snapshotCode and ai_model:
            try:
                probs = ai_model.predict_proba([req.snapshotCode])[0]  # [adv, beg, mid]
                skill_level, confidence = fuse_skill_with_behavior(probs, req)
            except Exception as model_err:
                print(f"CodeBERT error on snapshot: {model_err}")
                advanced_langs = {"typescript", "rust", "go", "kotlin", "scala", "swift"}
                intermediate_langs = {"javascript", "java", "csharp", "c#", "python", "ruby", "php"}
                used_lower = [l.lower() for l in (req.languagesUsed or [])]
                if any(l in advanced_langs for l in used_lower) or (num_languages >= 3 and num_files >= 5):
                    skill_level = "Advanced"
                elif any(l in intermediate_langs for l in used_lower) or num_files >= 3 or req.totalKeystrokes > 500:
                    skill_level = "Intermediate"
        else:
            advanced_langs = {"typescript", "rust", "go", "kotlin", "scala", "swift"}
            intermediate_langs = {"javascript", "java", "csharp", "c#", "python", "ruby", "php"}
            used_lower = [l.lower() for l in (req.languagesUsed or [])]
            if any(l in advanced_langs for l in used_lower) or (num_languages >= 3 and num_files >= 5):
                skill_level = "Advanced"
            elif any(l in intermediate_langs for l in used_lower) or num_files >= 3 or req.totalKeystrokes > 500:
                skill_level = "Intermediate"

        # Run AI Detection Engine with behavioral signals
        detection_input = {
            "totalKeystrokes": req.totalKeystrokes,
            "totalPastes": req.totalPastes,
            "totalEdits": req.totalEdits,
            "activeDuration": req.activeDuration,
            "idleDuration": req.idleDuration,
            "totalDuration": req.totalDuration,
            "behavioralSignals": req.behavioralSignals.dict() if req.behavioralSignals else {}
        }
        detection_result = AIDetectionEngine.analyze(detection_input)
        ai_probability = detection_result["aiLikelihoodScore"]

        # Generate personalized tips
        tips = generate_tips(skill_level, ai_probability, detection_result["signals"])

        # Determine primary language: prefer snapshotLanguage (file open at end),
        # fall back to last language used, then existing language field.
        primary_language = (
            req.snapshotLanguage
            or (req.languagesUsed[-1] if req.languagesUsed else None)
        )

        update_data = {
            "status": "completed",
            "endTime": firestore.SERVER_TIMESTAMP,
            "totalKeystrokes": req.totalKeystrokes,
            "totalPastes": req.totalPastes,
            "totalEdits": req.totalEdits,
            "totalDuration": req.totalDuration,
            "activeDuration": req.activeDuration,
            "idleDuration": req.idleDuration,
            "filesEdited": req.filesEdited,
            "languagesUsed": req.languagesUsed,
            **({"language": primary_language} if primary_language else {}),
            "stats": {
                "skillLevel": skill_level,
                "confidence": confidence,
                "duration": req.totalDuration,
                "keystrokes": req.totalKeystrokes,
                "aiProbability": ai_probability,
                "filesCount": num_files,
                "languageCount": num_languages,
                "tips": tips,
            },
            "aiDetection": {
                "aiLikelihoodScore": detection_result["aiLikelihoodScore"],
                "confidence": detection_result["confidence"],
                "signals": detection_result["signals"],
                "recommendation": detection_result["recommendation"]
            }
        }
        if req.behavioralSignals:
            update_data["behavioralSignals"] = req.behavioralSignals.dict()
        doc_ref.update(update_data)
        return {"status": "success", "sessionId": session_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Session end error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Quest Endpoints (AI-generated + Firestore cached) ---

# Load Anthropic client for AI quest generation
_anthropic_client = None
try:
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
        print("Anthropic client initialized for AI quest generation")
    else:
        print("Warning: ANTHROPIC_API_KEY not set. AI quest generation disabled, using hardcoded fallback.")
except ImportError:
    print("Warning: anthropic package not installed. AI quest generation disabled.")

def _normalize_language(language: str) -> str:
    """Normalize language name to a standard key."""
    lang = (language or "python").lower().strip()
    lang_map = {
        "python": "python", "py": "python",
        "javascript": "javascript", "js": "javascript",
        "typescript": "typescript", "ts": "typescript",
        "java": "java",
        "csharp": "csharp", "c#": "csharp", "cs": "csharp",
        "html": "html", "htm": "html",
        "css": "css", "scss": "css", "sass": "css",
        "c": "c", "cpp": "cpp", "c++": "cpp",
        "go": "go", "golang": "go",
        "rust": "rust", "rs": "rust",
        "ruby": "ruby", "rb": "ruby",
        "php": "php",
        "swift": "swift",
        "kotlin": "kotlin", "kt": "kotlin",
        "r": "r",
        "sql": "sql",
        "shell": "shell", "bash": "shell", "sh": "shell",
    }
    return lang_map.get(lang, lang)

async def _get_quests_from_firestore(language: str, level: str) -> list:
    """Fetch quests from Firestore for a given language and level."""
    try:
        quests_ref = db.collection("quests")
        query = quests_ref.where(
            filter=FieldFilter("language", "==", language)
        ).where(
            filter=FieldFilter("level", "==", level)
        )
        docs = query.stream()
        quests = []
        for doc in docs:
            quest_data = doc.to_dict()
            quest_data["id"] = doc.id
            quests.append(quest_data)
        return quests
    except Exception as e:
        print(f"Firestore quest fetch error: {e}")
        return []

def _generate_quests_ai(language: str, level: str, count: int = 8) -> list:
    """Use Claude AI to generate quests for any language and skill level.
    Returns a list of quest dicts with title, task, xp, testCases.
    """
    if not _anthropic_client:
        return []

    xp_ranges = {
        "Beginner": (30, 60),
        "Intermediate": (65, 100),
        "Advanced": (100, 180)
    }
    xp_min, xp_max = xp_ranges.get(level, (40, 80))

    prompt = f"""Generate exactly {count} coding quests/challenges for the programming language: **{language}**
Skill level: **{level}**

Return ONLY valid JSON — an array of quest objects. No markdown, no explanation.

Each quest object must have:
- "title": short catchy name (2-4 words)
- "task": clear task description telling the user exactly what to code (1-3 sentences)
- "xp": integer between {xp_min} and {xp_max}
- "testCases": array of test case objects for automated validation

Test case types you can use:
1. {{"type": "code_contains", "expected": ["pattern1", "pattern2"]}} — ALL patterns must be in the code
2. {{"type": "code_not_contains", "expected": ["forbidden1"]}} — NONE of these should be in the code
3. {{"type": "code_contains_any", "expected": ["option1", "option2"]}} — at least ONE must be in the code
4. {{"type": "code_count", "pattern": "somepattern", "min": 3}} — pattern must appear at least N times

Rules:
- Each quest must have 1-3 test cases
- Test cases should check for {language}-specific syntax and patterns
- Tasks should be practical and relevant to {language}
- {level} difficulty: {"basic syntax, simple tasks, single concepts" if level == "Beginner" else "multiple concepts, real-world patterns, moderate complexity" if level == "Intermediate" else "advanced patterns, architectural concepts, complex problem-solving"}
- Make quests unique and interesting, not generic

Example output format:
[
  {{
    "title": "Loop Logic",
    "task": "Print numbers 1 to 10 using a loop.",
    "xp": 50,
    "testCases": [
      {{"type": "code_contains", "expected": ["for"]}},
      {{"type": "code_contains_any", "expected": ["print", "console.log"]}}
    ]
  }}
]

Return ONLY the JSON array, nothing else."""

    try:
        response = _anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()

        quests = json.loads(text)

        if not isinstance(quests, list):
            print(f"AI returned non-list: {type(quests)}")
            return []

        # Validate and clean each quest
        valid_quests = []
        for q in quests:
            if isinstance(q, dict) and "title" in q and "task" in q:
                valid_quests.append({
                    "title": str(q.get("title", "")),
                    "task": str(q.get("task", "")),
                    "xp": int(q.get("xp", 50)),
                    "testCases": q.get("testCases", []),
                    "language": language,
                    "level": level,
                })

        print(f"AI generated {len(valid_quests)} {language}/{level} quests")
        return valid_quests

    except Exception as e:
        print(f"AI quest generation error: {e}")
        return []

def _save_generated_quests_to_firestore(quests: list, language: str, level: str):
    """Save AI-generated quests to Firestore for caching."""
    saved = 0
    for quest in quests:
        try:
            doc_id = f"{language}_{quest['title'].lower().replace(' ', '_').replace('/', '_')}"
            doc_ref = db.collection("quests").document(doc_id)
            if not doc_ref.get().exists:
                doc_data = {
                    "title": quest["title"],
                    "task": quest["task"],
                    "xp": quest["xp"],
                    "language": language,
                    "level": level,
                    "testCases": quest.get("testCases", []),
                    "generatedBy": "ai",
                    "createdAt": firestore.SERVER_TIMESTAMP,
                }
                doc_ref.set(doc_data)
                saved += 1
        except Exception as e:
            print(f"Error saving quest to Firestore: {e}")
    if saved:
        print(f"Cached {saved} AI-generated {language}/{level} quests to Firestore")
        _rebuild_quest_lookup()

async def _get_or_generate_quests(language: str, level: str, count: int = 8) -> list:
    """Get quests from Firestore, or generate with AI if none exist.
    Falls back to hardcoded data if AI is unavailable.
    """
    # 1. Try Firestore cache
    quests = await _get_quests_from_firestore(language, level)
    if quests:
        return quests

    # 2. Try AI generation
    generated = _generate_quests_ai(language, level, count)
    if generated:
        _save_generated_quests_to_firestore(generated, language, level)
        return generated

    # 3. Fallback to hardcoded data (only for languages that have it)
    lang_quests = LANGUAGE_QUESTS.get(language, {})
    quests = lang_quests.get(level, [])
    if quests:
        return quests

    # 4. Last resort: return empty
    return []

@app.get("/get-quest/{skill_level}")
async def get_quest(skill_level: str, language: Optional[str] = None):
    """Returns a random challenge. Auto-generates quests via AI for any language."""
    lang = _normalize_language(language)
    quests = await _get_or_generate_quests(lang, skill_level)

    if not quests:
        raise HTTPException(status_code=404, detail=f"No quests available for {lang}/{skill_level}. Set ANTHROPIC_API_KEY to enable AI quest generation.")

    quest = random.choice(quests)
    return {**quest, "language": lang}

@app.get("/get-quests/{skill_level}")
async def get_quests(skill_level: str, language: Optional[str] = None, count: int = 8):
    """Returns multiple quests. Auto-generates via AI for any detected language."""
    lang = _normalize_language(language)
    quests = await _get_or_generate_quests(lang, skill_level, count)

    # Shuffle and limit
    random.shuffle(quests)
    selected = quests[:min(count, len(quests))]

    return {
        "quests": [{**q, "language": lang} for q in selected],
        "total": len(quests),
        "generated": any(q.get("generatedBy") == "ai" for q in selected)
    }

@app.get("/detect-language/{user_id}")
async def detect_language(user_id: str):
    """Detect the most-used language from a user's recent sessions."""
    try:
        lang_counts = {}

        sessions_ref = db.collection("sessions").where(
            filter=FieldFilter("userId", "==", user_id)
        )
        docs = sessions_ref.stream()

        for doc in docs:
            data = doc.to_dict()
            for lang in data.get("languagesUsed", []):
                normalized = _normalize_language(lang)
                lang_counts[normalized] = lang_counts.get(normalized, 0) + 2
            if data.get("language"):
                normalized = _normalize_language(data["language"])
                lang_counts[normalized] = lang_counts.get(normalized, 0) + 1

        if not lang_counts:
            return {"language": "python", "confidence": 0, "all": {}}

        detected = max(lang_counts, key=lang_counts.get)
        return {"language": detected, "confidence": lang_counts[detected], "all": lang_counts}
    except Exception as e:
        print(f"Language detection error: {e}")
        return {"language": "python", "confidence": 0, "all": {}}

@app.get("/get-quest-languages")
async def get_quest_languages():
    """Returns languages that have quests in Firestore."""
    language_counts = {}
    try:
        for doc in db.collection("quests").stream():
            lang = doc.to_dict().get("language", "python")
            language_counts[lang] = language_counts.get(lang, 0) + 1
    except Exception as e:
        print(f"Error fetching quest languages: {e}")

    # Fallback to hardcoded if Firestore empty
    if not language_counts:
        for lang, levels in LANGUAGE_QUESTS.items():
            total = sum(len(q) for q in levels.values())
            if total > 0:
                language_counts[lang] = total

    return {"languages": [
        {"id": lang, "name": lang.capitalize(), "questCount": count}
        for lang, count in language_counts.items()
    ]}

# --- Personalized Daily Quest System ---

async def _get_user_context(user_id: str) -> dict:
    """Build user context from recent sessions and quest meta for personalized generation."""
    from datetime import date as date_type
    context = {
        "skill_level": "Beginner",
        "language": "python",
        "difficulty_score": 3,
        "last_generated_date": None,
        "last_skill_level": None,
        "undo_rate": 0.0,
        "paste_rate": 0.0,
        "idle_ratio": 0.0,
        "avg_session_duration": 0,
        "recent_quest_performance": [],
        "weak_areas": [],
    }
    try:
        # Fetch quest meta
        meta_ref = db.collection("student_quest_meta").document(user_id)
        meta_snap = meta_ref.get()
        if meta_snap.exists:
            meta = meta_snap.to_dict()
            context["difficulty_score"] = meta.get("difficultyScore", 3)
            context["last_generated_date"] = meta.get("lastGeneratedDate")
            context["last_skill_level"] = meta.get("lastSkillLevel")
            context["weak_areas"] = meta.get("weakAreas", [])
            context["recent_quest_performance"] = meta.get("recentQuestPerformance", [])

        # Fetch last 5 sessions
        try:
            sessions_query = db.collection("sessions").where(
                filter=FieldFilter("userId", "==", user_id)
            ).order_by("timestamp", direction=firestore.Query.DESCENDING).limit(5)
            sessions_docs = list(sessions_query.stream())
        except Exception:
            sessions_query = db.collection("sessions").where(
                filter=FieldFilter("userId", "==", user_id)
            )
            sessions_docs = list(sessions_query.stream())[:5]

        if sessions_docs:
            skill_counts = {"Beginner": 0, "Intermediate": 0, "Advanced": 0}
            lang_counts = {}
            total_undos, total_keystrokes, total_pastes = 0, 0, 0
            total_active, total_idle = 0.0, 0.0

            for doc in sessions_docs:
                data = doc.to_dict()
                skill = data.get("stats", {}).get("skillLevel")
                if skill and skill in skill_counts:
                    skill_counts[skill] += 1
                for lang in data.get("languagesUsed", []):
                    nl = _normalize_language(lang)
                    lang_counts[nl] = lang_counts.get(nl, 0) + 1
                bs = data.get("behavioralSignals", {})
                total_undos += bs.get("totalUndos", 0)
                total_keystrokes += data.get("totalKeystrokes", 0)
                total_pastes += data.get("totalPastes", 0)
                total_active += data.get("activeDuration", 0)
                total_idle += data.get("idleDuration", 0)

            context["skill_level"] = max(skill_counts, key=skill_counts.get)
            if lang_counts:
                context["language"] = max(lang_counts, key=lang_counts.get)
            if total_keystrokes > 0:
                context["undo_rate"] = round(total_undos / total_keystrokes, 3)
                context["paste_rate"] = round(total_pastes / total_keystrokes, 3)
            total_time = total_active + total_idle
            if total_time > 0:
                context["idle_ratio"] = round(total_idle / total_time, 2)
            context["avg_session_duration"] = int(total_active / max(len(sessions_docs), 1))

    except Exception as e:
        print(f"Error building user context: {e}")
    return context


def _generate_personalized_quests_ai(context: dict) -> list:
    """Generate 3 personalized quests using Claude based on user context."""
    if not _anthropic_client:
        return []

    skill = context["skill_level"]
    lang = context["language"]
    diff = context["difficulty_score"]
    undo_rate = context["undo_rate"]
    paste_rate = context["paste_rate"]
    idle_ratio = context["idle_ratio"]
    weak_areas = context.get("weak_areas", [])
    recent_perf = context.get("recent_quest_performance", [])

    xp_map = {
        "Beginner": (30, 70),
        "Intermediate": (65, 120),
        "Advanced": (110, 180),
    }
    xp_min, xp_max = xp_map.get(skill, (40, 90))

    # Infer weak areas from behavior if not stored
    if not weak_areas:
        if undo_rate > 0.08:
            weak_areas.append("logic and problem structuring")
        if paste_rate > 0.05:
            weak_areas.append("writing code from scratch")
        if idle_ratio > 0.4:
            weak_areas.append("recalling syntax quickly")

    weak_area_str = ", ".join(weak_areas) if weak_areas else "general practice"
    perf_str = ""
    if recent_perf:
        last = recent_perf[-3:]
        perf_str = f"Recent quest results: {last}. "

    prompt = f"""You are an adaptive coding quest generator for a developer skill tracking platform.

Student profile:
- Skill level: {skill}
- Primary language: {lang}
- Current difficulty score: {diff}/10
- Weak areas detected: {weak_area_str}
- Undo rate: {undo_rate} (high = struggles with logic)
- Paste rate: {paste_rate} (high = relies on copy-paste)
- Idle ratio: {idle_ratio} (high = thinks slowly / recalls syntax poorly)
- {perf_str}

Generate exactly 3 coding quests for {lang} language.
Quest 1 — type "reinforcement": matches current difficulty ({diff}/10), reinforces {skill} concepts
Quest 2 — type "stretch": difficulty {min(diff + 2, 10)}/10, pushes toward next level
Quest 3 — type "weak_area": directly targets weak area "{weak_area_str}", easier ({max(diff - 1, 1)}/10)

Return ONLY valid JSON array. No markdown, no explanation.

Each quest object must have:
- "title": short catchy name (2-4 words)
- "task": clear description of what to code (1-3 sentences)
- "xp": integer between {xp_min} and {xp_max}
- "questType": one of "reinforcement", "stretch", "weak_area"
- "testCases": 1-3 test case objects

Test case types:
1. {{"type": "code_contains", "expected": ["pattern1", "pattern2"]}} — ALL must appear
2. {{"type": "code_not_contains", "expected": ["forbidden"]}} — NONE should appear
3. {{"type": "code_contains_any", "expected": ["opt1", "opt2"]}} — at least ONE must appear

Rules:
- Use {lang}-specific syntax in test cases
- Tasks must be practical and solvable in under 15 minutes
- Do NOT repeat common generic tasks (avoid "hello world", "fibonacci" unless advanced)
- Difficulty {diff}/10 means: {"basic syntax" if diff <= 3 else "moderate logic" if diff <= 6 else "complex algorithms and patterns"}

Return ONLY the JSON array of 3 quest objects."""

    try:
        response = _anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()

        quests = json.loads(text)
        if not isinstance(quests, list):
            return []

        def _sanitize_test_cases(raw):
            """Ensure testCases have flat string arrays (Firestore forbids nested arrays)."""
            result = []
            for tc in (raw or []):
                if not isinstance(tc, dict):
                    continue
                expected = tc.get("expected", [])
                flat = []
                for item in expected:
                    if isinstance(item, list):
                        flat.extend(str(x) for x in item)
                    else:
                        flat.append(str(item))
                result.append({"type": str(tc.get("type", "code_contains")), "expected": flat})
            return result

        valid = []
        for q in quests:
            if isinstance(q, dict) and "title" in q and "task" in q:
                valid.append({
                    "title": str(q.get("title", "")),
                    "task": str(q.get("task", "")),
                    "xp": int(q.get("xp", 60)),
                    "questType": str(q.get("questType", "reinforcement")),
                    "testCases": _sanitize_test_cases(q.get("testCases", [])),
                    "language": lang,
                    "level": skill,
                    "isPersonal": True,
                })
        print(f"Generated {len(valid)} personalized quests for user ({skill}/{lang}/diff:{diff})")
        return valid
    except Exception as e:
        print(f"Personalized quest generation error: {e}")
        return []


@app.get("/quests/daily/{user_id}")
async def get_daily_quests(user_id: str, language: Optional[str] = None):
    """Return today's personalized quests for a user. Regenerates if date changed or skill level changed.
    Optional ?language= param forces quests for a specific language (used by language tabs in the UI)."""
    from datetime import date as date_type
    today = date_type.today().isoformat()
    lang_override = _normalize_language(language) if language else None
    cache_key = f"{user_id}_{today}" if not lang_override else f"{user_id}_{today}_{lang_override}"

    try:
        # Check for cached quests today
        daily_ref = db.collection("personal_quests").document(cache_key)
        daily_snap = daily_ref.get()

        if daily_snap.exists:
            data = daily_snap.to_dict()
            meta_ref = db.collection("student_quest_meta").document(user_id)
            meta_snap = meta_ref.get()
            current_skill = "Beginner"
            if meta_snap.exists:
                current_skill = meta_snap.to_dict().get("lastSkillLevel", "Beginner")

            # Return cached if skill level hasn't changed
            if data.get("skillLevel") == current_skill:
                return {
                    "quests": data.get("quests", []),
                    "date": today,
                    "cached": True,
                    "skillLevel": current_skill,
                    "language": data.get("language", "python"),
                }

        # Generate new personalized quests
        context = await _get_user_context(user_id)
        if lang_override:
            context["language"] = lang_override
        quests = _generate_personalized_quests_ai(context)

        # Fallback to generic quests if AI fails
        if not quests:
            quests = await _get_or_generate_quests(context["language"], context["skill_level"], 3)
            for q in quests:
                q["questType"] = "reinforcement"

        if not quests:
            raise HTTPException(status_code=404, detail="No quests could be generated. Ensure ANTHROPIC_API_KEY is set.")

        # Save each quest to the global quests collection so validate_solution can find them
        saved_quests = []
        for i, q in enumerate(quests):
            doc_id = f"personal_{user_id}_{today}_{q.get('questType', 'q')}_{i}"
            doc_ref = db.collection("quests").document(doc_id)
            # Serialize testCases to JSON string to avoid Firestore nested-array restriction
            test_cases = q.get("testCases", [])
            quest_data = {
                **{k: v for k, v in q.items() if k != "testCases"},
                "testCases": json.dumps(test_cases),
                "userId": user_id,
                "generatedAt": firestore.SERVER_TIMESTAMP,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
            try:
                doc_ref.set(quest_data)
            except Exception as e:
                print(f"Error saving quest '{doc_id}' to Firestore: {e}")
                raise
            saved_quests.append({**q, "id": doc_id})

        _rebuild_quest_lookup()

        # Cache daily quests for this user (strip testCases — Firestore forbids nested arrays)
        quests_for_cache = [
            {k: v for k, v in q.items() if k != "testCases"}
            | {"testCasesCount": len(q.get("testCases", []))}
            for q in saved_quests
        ]
        try:
            daily_ref.set({
                "userId": user_id,
                "date": today,
                "quests": quests_for_cache,
                "skillLevel": context["skill_level"],
                "language": context["language"],
                "generatedAt": firestore.SERVER_TIMESTAMP,
            })
        except Exception as e:
            print(f"Error saving personal_quests cache: {e}")
            raise

        # Update meta
        meta_ref = db.collection("student_quest_meta").document(user_id)
        try:
            meta_ref.set({
                "lastGeneratedDate": today,
                "lastSkillLevel": context["skill_level"],
                "difficultyScore": context["difficulty_score"],
                "weakAreas": context.get("weak_areas", []),
            }, merge=True)
        except Exception as e:
            print(f"Error saving student_quest_meta: {e}")
            raise

        return {
            "quests": saved_quests,
            "date": today,
            "cached": False,
            "skillLevel": context["skill_level"],
            "language": context["language"],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Daily quest error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get daily quests: {str(e)}")


@app.post("/quests/complete")
async def quest_completed(req: QuestCompleteRequest):
    """Update difficulty score after quest completion."""
    if not req.passed:
        return {"updated": False}

    try:
        meta_ref = db.collection("student_quest_meta").document(req.userId)
        meta_snap = meta_ref.get()
        current_score = 3
        total_completed = 0
        recent_perf = []

        if meta_snap.exists:
            data = meta_snap.to_dict()
            current_score = data.get("difficultyScore", 3)
            total_completed = data.get("totalQuestsCompleted", 0)
            recent_perf = data.get("recentQuestPerformance", [])

        # Difficulty scaling logic
        fast = req.completionTimeMs < req.estimatedTimeMs
        no_hints = req.hintsUsed == 0
        slow = req.completionTimeMs > (req.estimatedTimeMs * 2)

        if fast and no_hints:
            new_score = min(current_score + 2, 10)
        elif slow or req.hintsUsed > 1:
            new_score = max(current_score - 1, 1)
        else:
            new_score = current_score

        # Track performance
        recent_perf.append({
            "questId": req.questId,
            "questType": req.questType,
            "completionTimeMs": req.completionTimeMs,
            "hintsUsed": req.hintsUsed,
            "difficultyScoreBefore": current_score,
        })
        recent_perf = recent_perf[-10:]  # keep last 10

        meta_ref.set({
            "difficultyScore": new_score,
            "totalQuestsCompleted": total_completed + 1,
            "recentQuestPerformance": recent_perf,
        }, merge=True)

        return {
            "updated": True,
            "difficultyScore": new_score,
            "change": new_score - current_score,
        }

    except Exception as e:
        print(f"Quest complete update error: {e}")
        return {"updated": False, "error": str(e)}


# --- Quest Admin CRUD ---

@app.post("/admin/quests/seed")
async def seed_quests():
    """Seed Firestore with the hardcoded quests. Skips quests that already exist."""
    try:
        seeded = 0
        skipped = 0

        for lang, levels in LANGUAGE_QUESTS.items():
            for level, quests in levels.items():
                for quest in quests:
                    # Use a deterministic doc ID based on language + quest title
                    doc_id = f"{lang}_{quest['title'].lower().replace(' ', '_')}"
                    doc_ref = db.collection("quests").document(doc_id)

                    if doc_ref.get().exists:
                        skipped += 1
                        continue

                    doc_data = {
                        "title": quest["title"],
                        "task": quest["task"],
                        "xp": quest["xp"],
                        "language": lang,
                        "level": level,
                        "testCases": quest.get("testCases", []),
                        "createdAt": firestore.SERVER_TIMESTAMP,
                    }
                    doc_ref.set(doc_data)
                    seeded += 1

        # Also rebuild ALL_QUESTS lookup from Firestore
        _rebuild_quest_lookup()

        return {"status": "success", "seeded": seeded, "skipped": skipped}
    except Exception as e:
        print(f"Quest seed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/quests")
async def list_quests(language: Optional[str] = None, level: Optional[str] = None):
    """List all quests, optionally filtered by language and/or level."""
    try:
        quests_ref = db.collection("quests")

        # Apply filters
        if language:
            quests_ref = quests_ref.where(filter=FieldFilter("language", "==", _normalize_language(language)))
        if level:
            quests_ref = quests_ref.where(filter=FieldFilter("level", "==", level))

        docs = quests_ref.stream()
        quests = []
        for doc in docs:
            quest_data = doc.to_dict()
            quest_data["id"] = doc.id
            quests.append(quest_data)

        # Sort by language then level
        level_order = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
        quests.sort(key=lambda q: (q.get("language", ""), level_order.get(q.get("level", ""), 9)))

        return {"quests": quests, "total": len(quests)}
    except Exception as e:
        print(f"List quests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/quests")
async def create_quest(req: QuestCreateRequest):
    """Create a new quest in Firestore."""
    try:
        lang = _normalize_language(req.language)
        doc_id = f"{lang}_{req.title.lower().replace(' ', '_')}"
        doc_ref = db.collection("quests").document(doc_id)

        if doc_ref.get().exists:
            raise HTTPException(status_code=409, detail="A quest with this title already exists for this language")

        doc_data = {
            "title": req.title,
            "task": req.task,
            "xp": req.xp,
            "language": lang,
            "level": req.level,
            "testCases": req.testCases,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        doc_ref.set(doc_data)

        _rebuild_quest_lookup()

        return {"status": "success", "id": doc_id, "quest": {**doc_data, "id": doc_id}}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create quest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/admin/quests/{quest_id}")
async def update_quest(quest_id: str, req: QuestUpdateRequest):
    """Update an existing quest in Firestore."""
    try:
        doc_ref = db.collection("quests").document(quest_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Quest not found")

        update_data = {}
        if req.title is not None:
            update_data["title"] = req.title
        if req.task is not None:
            update_data["task"] = req.task
        if req.xp is not None:
            update_data["xp"] = req.xp
        if req.language is not None:
            update_data["language"] = _normalize_language(req.language)
        if req.level is not None:
            update_data["level"] = req.level
        if req.testCases is not None:
            update_data["testCases"] = req.testCases

        if update_data:
            update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
            doc_ref.update(update_data)

        _rebuild_quest_lookup()

        updated = doc_ref.get().to_dict()
        updated["id"] = quest_id
        return {"status": "success", "quest": updated}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update quest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/admin/quests/{quest_id}")
async def delete_quest(quest_id: str):
    """Delete a quest from Firestore."""
    try:
        doc_ref = db.collection("quests").document(quest_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Quest not found")

        doc_ref.delete()
        _rebuild_quest_lookup()

        return {"status": "success", "deleted": quest_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete quest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _rebuild_quest_lookup():
    """Rebuild the ALL_QUESTS lookup dict by merging hardcoded + Firestore data."""
    global ALL_QUESTS
    try:
        # Start with hardcoded quests (integer keys)
        merged = dict(ALL_QUESTS)

        # Add Firestore quests (string keys)
        docs = db.collection("quests").stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            # Deserialize testCases if stored as JSON string
            if isinstance(data.get("testCases"), str):
                try:
                    data["testCases"] = json.loads(data["testCases"])
                except Exception:
                    data["testCases"] = []
            merged[doc.id] = data

        ALL_QUESTS = merged
    except Exception as e:
        print(f"Rebuild quest lookup error: {e}")

# --- AI Detection Endpoint ---

@app.post("/detect-ai/{session_id}")
async def detect_ai(session_id: str):
    """
    Run AI detection analysis on an existing session.
    Reads session data + behavioral signals from Firestore and returns full signal breakdown.
    """
    try:
        doc_ref = db.collection("sessions").document(session_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = doc.to_dict()
        detection_input = {
            "totalKeystrokes": session_data.get("totalKeystrokes", 0),
            "totalPastes": session_data.get("totalPastes", 0),
            "totalEdits": session_data.get("totalEdits", 0),
            "activeDuration": session_data.get("activeDuration", 0),
            "idleDuration": session_data.get("idleDuration", 0),
            "totalDuration": session_data.get("totalDuration", 0),
            "behavioralSignals": session_data.get("behavioralSignals", {})
        }

        result = AIDetectionEngine.analyze(detection_input)

        # Store result back in session
        doc_ref.update({"aiDetection": result})

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"AI Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Code Analysis ---

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

        bs = session.behavioralSignals or {}
        detection_input = {
            "totalKeystrokes": session.keystrokes,
            "totalPastes": bs.get("totalClipboardPastes", 0),
            "totalEdits": session.keystrokes,
            "activeDuration": session.duration,
            "idleDuration": bs.get("idleDuration", 0),
            "totalDuration": session.duration + bs.get("idleDuration", 0),
            "behavioralSignals": bs,
        }
        detection_result = AIDetectionEngine.analyze(detection_input)
        ai_probability = detection_result["aiLikelihoodScore"]

        # Validate solution if questId is provided
        validation = {"passed": True, "tests_passed": 0, "tests_total": 0, "message": "No validation", "details": []}
        if session.questId:
            validation = validate_solution(session.code, session.questId)

        doc_data = {
            "userId": session.userId,
            "email": session.email,
            "code": session.code,
            "language": session.language,
            "fileName": session.fileName,
            "questId": session.questId,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "sessionType": "quest",
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
            },
            "aiDetection": {
                "aiLikelihoodScore": detection_result["aiLikelihoodScore"],
                "confidence": detection_result["confidence"],
                "signals": detection_result["signals"],
                "recommendation": detection_result["recommendation"]
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
                "validationDetails": validation["details"],
                "aiDetection": {
                    "aiLikelihoodScore": detection_result["aiLikelihoodScore"],
                    "confidence": detection_result["confidence"],
                    "signals": detection_result["signals"],
                    "recommendation": detection_result["recommendation"]
                }
            }
        }

    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "7860")),
    )
