"""
Evaluate the CodeBERT skill classifier.
Uses identical encoding params as main.py (max_length=256, padding=max_length).
Samples are realistic coding-session snapshots, not clean polished code.
"""
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "ai_models/best_codebert_large"
MAX_LEN = 256  # must match main.py

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

id2label = {0: "Advanced", 1: "Beginner", 2: "Intermediate"}

# Samples resemble actual coding sessions: incomplete, messy, work-in-progress
TEST_SAMPLES = [
    # --- BEGINNER ---
    ("print('hello')\nprint('world')", "Beginner"),
    ("x = int(input('num: '))\ny = int(input('num2: '))\nprint(x + y)", "Beginner"),
    ("name = input()\nif name == 'hannan':\n    print('hi')\nelse:\n    print('who')", "Beginner"),
    ("for i in range(5):\n    print(i)\n# prints 0 to 4", "Beginner"),
    ("nums = []\nnums.append(1)\nnums.append(2)\nprint(nums)", "Beginner"),
    ("def add(a, b):\n    return a + b\nprint(add(3, 4))", "Beginner"),
    ("# calculate area\nl = 5\nw = 3\narea = l * w\nprint(area)", "Beginner"),
    ("grade = int(input())\nif grade >= 90:\n    print('A')\nelif grade >= 80:\n    print('B')\nelse:\n    print('F')", "Beginner"),

    # --- INTERMEDIATE ---
    ("""
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n-1)

for i in range(10):
    print(i, factorial(i))
""", "Intermediate"),
    ("""
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError('Insufficient funds')
        self.balance -= amount
""", "Intermediate"),
    ("""
import csv

def read_students(path):
    students = []
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            students.append(row)
    return students

def average_grade(students):
    grades = [float(s['grade']) for s in students]
    return sum(grades) / len(grades)
""", "Intermediate"),
    ("""
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] < right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]
""", "Intermediate"),
    ("""
import requests

def get_user(user_id):
    resp = requests.get(f'https://api.example.com/users/{user_id}')
    resp.raise_for_status()
    return resp.json()

users = [get_user(i) for i in range(1, 6)]
names = [u['name'] for u in users]
""", "Intermediate"),
    ("""
from collections import defaultdict

def word_frequency(text):
    freq = defaultdict(int)
    for word in text.lower().split():
        word = word.strip('.,!?')
        freq[word] += 1
    return sorted(freq.items(), key=lambda x: x[1], reverse=True)
""", "Intermediate"),

    # --- ADVANCED ---
    ("""
from functools import wraps
import time

def retry(max_attempts=3, backoff=1.5):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            delay = 1.0
            for attempt in range(max_attempts):
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    time.sleep(delay)
                    delay *= backoff
        return wrapper
    return decorator

@retry(max_attempts=5)
def fetch_data(url):
    pass
""", "Advanced"),
    ("""
import asyncio
import aiohttp
from typing import List

async def fetch(session: aiohttp.ClientSession, url: str) -> dict:
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
        r.raise_for_status()
        return await r.json()

async def fetch_all(urls: List[str]) -> List[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [asyncio.create_task(fetch(session, u)) for u in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
""", "Advanced"),
    ("""
from typing import TypeVar, Generic, Callable, Iterator, Optional

T = TypeVar('T')
U = TypeVar('U')

class Stream(Generic[T]):
    def __init__(self, iterable):
        self._it = iter(iterable)

    def map(self, fn: Callable[[T], U]) -> 'Stream[U]':
        return Stream(fn(x) for x in self._it)

    def filter(self, pred: Callable[[T], bool]) -> 'Stream[T]':
        return Stream(x for x in self._it if pred(x))

    def reduce(self, fn: Callable[[U, T], U], init: U) -> U:
        acc = init
        for x in self._it:
            acc = fn(acc, x)
        return acc
""", "Advanced"),
    ("""
import contextlib
import threading

class RWLock:
    def __init__(self):
        self._read_ready = threading.Condition(threading.Lock())
        self._readers = 0

    @contextlib.contextmanager
    def read(self):
        with self._read_ready:
            self._readers += 1
        try:
            yield
        finally:
            with self._read_ready:
                self._readers -= 1
                if self._readers == 0:
                    self._read_ready.notify_all()

    @contextlib.contextmanager
    def write(self):
        with self._read_ready:
            while self._readers > 0:
                self._read_ready.wait()
            yield
""", "Advanced"),
    ("""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import heapq

@dataclass(order=True)
class Node:
    cost: float
    vertex: str = field(compare=False)
    path: List[str] = field(default_factory=list, compare=False)

def dijkstra(graph: Dict[str, Dict[str, float]], start: str, end: str) -> Optional[List[str]]:
    heap = [Node(0, start, [start])]
    visited = set()
    while heap:
        node = heapq.heappop(heap)
        if node.vertex in visited:
            continue
        visited.add(node.vertex)
        if node.vertex == end:
            return node.path
        for neighbor, weight in graph.get(node.vertex, {}).items():
            if neighbor not in visited:
                heapq.heappush(heap, Node(node.cost + weight, neighbor, node.path + [neighbor]))
    return None
""", "Advanced"),
]


def predict(code):
    enc = tokenizer(code, max_length=MAX_LEN, padding="max_length",
                    truncation=True, return_tensors="pt")
    with torch.no_grad():
        logits = model(input_ids=enc["input_ids"],
                       attention_mask=enc["attention_mask"]).logits
    probs = torch.softmax(logits, dim=-1)[0]
    pred_id = int(logits.argmax(-1).item())
    return id2label[pred_id], float(probs[pred_id]) * 100, probs.tolist()


correct = 0
total = len(TEST_SAMPLES)
by_class = {"Beginner": [0, 0], "Intermediate": [0, 0], "Advanced": [0, 0]}

print(f"\n{'#':<4} {'Expected':<14} {'Predicted':<14} {'Conf':>6}  {'':>2}")
print("-" * 52)

for i, (code, label) in enumerate(TEST_SAMPLES, 1):
    pred, conf, probs = predict(code)
    ok = pred == label
    correct += ok
    by_class[label][1] += 1
    if ok:
        by_class[label][0] += 1
    adv, beg, mid = probs[0]*100, probs[1]*100, probs[2]*100
    print(f"{i:<4} {label:<14} {pred:<14} {conf:>5.1f}%  {'✓' if ok else '✗'}  "
          f"[Adv:{adv:.0f}% Beg:{beg:.0f}% Mid:{mid:.0f}%]")

print("-" * 52)
print(f"\nOverall accuracy: {correct}/{total} = {correct/total*100:.1f}%\n")
print("Per-class accuracy:")
for cls, (c, t) in by_class.items():
    bar = "█" * c + "░" * (t - c)
    print(f"  {cls:<14} {c}/{t} = {c/t*100:.0f}%  {bar}")
