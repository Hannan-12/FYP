"""
DevSkill CodeBERT Fine-Tuning Script
=====================================
Run this in Google Colab (GPU runtime).

Datasets used:
  - codeparrot/apps  (10K problems, Introductory/Interview/Competition)
  - BAAI/TACO        (26K problems, EASY/MEDIUM/MEDIUM_HARD/HARD/VERY_HARD)
  - newfacade/LeetCodeDataset (2.8K problems, Easy/Medium/Hard)

Target: 90%+ macro F1 on balanced 3-class skill classifier.

Instructions:
  1. Open Google Colab → Runtime → Change runtime type → GPU (T4 free)
  2. Upload this file or paste cell by cell
  3. Set HF_TOKEN and HF_REPO below before running
  4. Run all cells top to bottom (~45-60 min total)
"""

# ============================================================
# CELL 1 — Install dependencies
# ============================================================
# !pip install -q transformers datasets accelerate scikit-learn \
#              matplotlib seaborn huggingface_hub

# ============================================================
# CELL 2 — Imports & Config
# ============================================================
import os, json, re, random, ast
import numpy as np
from collections import Counter

import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, EarlyStoppingCallback
)
from datasets import load_dataset
from sklearn.metrics import (
    accuracy_score, f1_score, classification_report, confusion_matrix
)
import matplotlib.pyplot as plt
import seaborn as sns
from huggingface_hub import login

# --- Config (edit these) ---
HF_TOKEN  = "your_hf_token_here"       # huggingface.co → Settings → Access Tokens
HF_REPO   = "Hannan-12/devskill-codebert"
BASE_MODEL = "microsoft/codebert-base"

LABEL2ID = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
ID2LABEL  = {v: k for k, v in LABEL2ID.items()}

SAMPLES_PER_CLASS = 1500   # 1500 × 3 = 4500 total
MAX_LEN           = 256
BATCH_SIZE        = 16
GRAD_ACCUM        = 2       # effective batch = 32
EPOCHS            = 15
LR                = 2e-5
WARMUP_RATIO      = 0.10
WEIGHT_DECAY      = 0.01
LABEL_SMOOTHING   = 0.1
SEED              = 42

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

if torch.cuda.is_available():
    device = torch.device("cuda")
elif torch.backends.mps.is_available():
    device = torch.device("mps")   # Apple Silicon GPU
else:
    device = torch.device("cpu")
print(f"Device: {device}")
login(token=HF_TOKEN, add_to_git_credential=False)


# ============================================================
# CELL 3 — Data loading helpers
# ============================================================

def extract_first_python_solution(solutions_raw) -> str:
    """Pull the first Python solution out of a JSON-string list."""
    if not solutions_raw:
        return ""
    try:
        sols = json.loads(solutions_raw) if isinstance(solutions_raw, str) else solutions_raw
        if isinstance(sols, list):
            for s in sols:
                if isinstance(s, str) and len(s.strip()) > 20:
                    return s.strip()
    except Exception:
        pass
    return ""


def clean_code(code: str) -> str:
    """Normalize whitespace and strip leading/trailing blank lines."""
    if not code:
        return ""
    lines = code.split("\n")
    # Remove lines that are only whitespace
    lines = [l.rstrip() for l in lines]
    # Collapse 3+ consecutive blank lines to 1
    cleaned, blanks = [], 0
    for l in lines:
        if l.strip() == "":
            blanks += 1
            if blanks <= 1:
                cleaned.append(l)
        else:
            blanks = 0
            cleaned.append(l)
    return "\n".join(cleaned).strip()


def is_valid(code: str, min_len=50, max_len=2000) -> bool:
    """Filter out trivially short/long or non-Python snippets."""
    if not code or not isinstance(code, str):
        return False
    code = code.strip()
    if len(code) < min_len or len(code) > max_len:
        return False
    # Must contain at least one Python keyword
    py_keywords = {"def ", "class ", "return", "import", "for ", "while ", "if "}
    return any(kw in code for kw in py_keywords)


# ============================================================
# CELL 4 — Load APPS dataset
# ============================================================
print("\n=== Loading APPS dataset ===")

apps_map = {
    "introductory": "Beginner",
    "interview":    "Intermediate",
    "competition":  "Advanced",
}

apps_rows = []
try:
    apps_ds = load_dataset("codeparrot/apps", split="train", trust_remote_code=True)
    for row in apps_ds:
        label = apps_map.get(row.get("difficulty", "").lower())
        if not label:
            continue
        code = extract_first_python_solution(row.get("solutions", ""))
        code = clean_code(code)
        if is_valid(code):
            apps_rows.append({"code": code, "label": label, "source": "apps"})
    print(f"APPS: {len(apps_rows)} valid samples")
    dist = Counter(r["label"] for r in apps_rows)
    print(f"  Distribution: {dict(dist)}")
except Exception as e:
    print(f"APPS load failed: {e}")


# ============================================================
# CELL 5 — Load TACO dataset
# ============================================================
print("\n=== Loading TACO dataset ===")

taco_map = {
    "EASY":        "Beginner",
    "MEDIUM":      "Intermediate",
    "MEDIUM_HARD": "Intermediate",
    "HARD":        "Advanced",
    "VERY_HARD":   "Advanced",
}

taco_rows = []
try:
    taco_ds = load_dataset("BAAI/TACO", split="train", trust_remote_code=True)
    for row in taco_ds:
        label = taco_map.get((row.get("difficulty") or "").upper())
        if not label:
            continue
        code = extract_first_python_solution(row.get("solutions", ""))
        code = clean_code(code)
        if is_valid(code):
            taco_rows.append({"code": code, "label": label, "source": "taco"})
    print(f"TACO: {len(taco_rows)} valid samples")
    dist = Counter(r["label"] for r in taco_rows)
    print(f"  Distribution: {dict(dist)}")
except Exception as e:
    print(f"TACO load failed: {e}")


# ============================================================
# CELL 6 — Load LeetCode dataset
# ============================================================
print("\n=== Loading LeetCode dataset ===")

lc_map = {
    "easy":   "Beginner",
    "medium": "Intermediate",
    "hard":   "Advanced",
}

lc_rows = []
try:
    lc_ds = load_dataset("newfacade/LeetCodeDataset", split="train", trust_remote_code=True)
    for row in lc_ds:
        label = lc_map.get((row.get("difficulty") or "").lower())
        if not label:
            continue
        code = clean_code(row.get("completion", "") or "")
        if is_valid(code):
            lc_rows.append({"code": code, "label": label, "source": "leetcode"})
    print(f"LeetCode: {len(lc_rows)} valid samples")
    dist = Counter(r["label"] for r in lc_rows)
    print(f"  Distribution: {dict(dist)}")
except Exception as e:
    print(f"LeetCode load failed: {e}")


# ============================================================
# CELL 7 — Combine, deduplicate, balance
# ============================================================
print("\n=== Combining datasets ===")
all_rows = apps_rows + taco_rows + lc_rows
print(f"Total before dedup: {len(all_rows)}")

# Deduplicate by first 200 chars of code
seen = set()
deduped = []
for r in all_rows:
    key = r["code"][:200].strip()
    if key not in seen:
        seen.add(key)
        deduped.append(r)
print(f"Total after dedup:  {len(deduped)}")

# Separate by class
by_class = {"Beginner": [], "Intermediate": [], "Advanced": []}
for r in deduped:
    by_class[r["label"]].append(r)

print("\nPre-balance counts:")
for cls, rows in by_class.items():
    print(f"  {cls}: {len(rows)}")


# ============================================================
# CELL 8 — Data augmentation (for minority classes)
# ============================================================

def rename_variables(code: str) -> str:
    """Randomly rename local variables using AST — safe augmentation."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return code

    # Collect all Name nodes that are local variables (not builtins/imports)
    import builtins as _builtins_mod
    builtins = set(dir(_builtins_mod))
    builtins |= {"self", "cls", "True", "False", "None"}

    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id not in builtins and len(node.id) <= 15:
            names.add(node.id)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for arg in node.args.args:
                if arg.arg not in builtins:
                    names.add(arg.arg)

    if not names:
        return code

    # Pick 30–60% of names to rename
    to_rename = random.sample(list(names), k=max(1, int(len(names) * random.uniform(0.3, 0.6))))
    suffixes = ["_val", "_tmp", "_res", "_num", "_item", "_data", "_x", "_n", "_v"]
    mapping = {n: n + random.choice(suffixes) for n in to_rename}

    # Simple token-level replacement (safe for non-string contexts)
    result = code
    for old, new in mapping.items():
        result = re.sub(r'\b' + re.escape(old) + r'\b', new, result)
    return result


def strip_comments(code: str) -> str:
    """Remove inline and block comments."""
    lines = []
    for line in code.split("\n"):
        stripped = re.sub(r'#.*$', '', line).rstrip()
        lines.append(stripped)
    return "\n".join(lines)


def augment(rows: list, target: int) -> list:
    """Augment rows to reach target count using variable renaming + comment stripping."""
    result = list(rows)
    ops = [rename_variables, strip_comments, lambda c: rename_variables(strip_comments(c))]
    attempts = 0
    while len(result) < target and attempts < target * 3:
        src = random.choice(rows)
        op  = random.choice(ops)
        new_code = clean_code(op(src["code"]))
        if is_valid(new_code) and new_code != src["code"]:
            result.append({"code": new_code, "label": src["label"],
                           "source": src["source"] + "_aug"})
        attempts += 1
    return result


print("\n=== Augmenting minority classes ===")
balanced = {}
for cls in ["Beginner", "Intermediate", "Advanced"]:
    rows = by_class[cls]
    if len(rows) >= SAMPLES_PER_CLASS:
        balanced[cls] = random.sample(rows, SAMPLES_PER_CLASS)
        print(f"  {cls}: sampled {SAMPLES_PER_CLASS} from {len(rows)}")
    else:
        augmented = augment(rows, SAMPLES_PER_CLASS)
        balanced[cls] = augmented[:SAMPLES_PER_CLASS]
        print(f"  {cls}: augmented {len(rows)} → {len(balanced[cls])}")


# ============================================================
# CELL 9 — Train / Val / Test split (70 / 15 / 15)
# ============================================================
all_data = []
for cls, rows in balanced.items():
    random.shuffle(rows)
    all_data.extend(rows)
random.shuffle(all_data)

n = len(all_data)
n_train = int(n * 0.70)
n_val   = int(n * 0.15)

train_data = all_data[:n_train]
val_data   = all_data[n_train:n_train + n_val]
test_data  = all_data[n_train + n_val:]

print(f"\nSplit — Train: {len(train_data)}, Val: {len(val_data)}, Test: {len(test_data)}")


# ============================================================
# CELL 10 — Tokenizer & Dataset class
# ============================================================
print(f"\n=== Loading tokenizer: {BASE_MODEL} ===")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)


class CodeDataset(Dataset):
    def __init__(self, rows, tokenizer, max_len):
        self.rows      = rows
        self.tokenizer = tokenizer
        self.max_len   = max_len

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows[idx]
        enc = self.tokenizer(
            row["code"],
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids":      enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "labels":         torch.tensor(LABEL2ID[row["label"]], dtype=torch.long),
        }


train_ds = CodeDataset(train_data, tokenizer, MAX_LEN)
val_ds   = CodeDataset(val_data,   tokenizer, MAX_LEN)
test_ds  = CodeDataset(test_data,  tokenizer, MAX_LEN)


# ============================================================
# CELL 11 — Class weights (handle any residual imbalance)
# ============================================================
train_labels = [LABEL2ID[r["label"]] for r in train_data]
class_counts = Counter(train_labels)
total = sum(class_counts.values())
class_weights = torch.tensor(
    [total / (3 * class_counts[i]) for i in range(3)],
    dtype=torch.float
).to(device)
print(f"Class weights: {class_weights.tolist()}")


# ============================================================
# CELL 12 — Custom Trainer with weighted loss + label smoothing
# ============================================================
class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels  = inputs.pop("labels")
        outputs = model(**inputs)
        logits  = outputs.logits
        loss_fn = nn.CrossEntropyLoss(
            weight=class_weights,
            label_smoothing=LABEL_SMOOTHING
        )
        loss = loss_fn(logits, labels)
        return (loss, outputs) if return_outputs else loss


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    acc   = accuracy_score(labels, preds)
    macro_f1 = f1_score(labels, preds, average="macro")
    per_class_f1 = f1_score(labels, preds, average=None)
    return {
        "accuracy":        acc,
        "macro_f1":        macro_f1,
        "f1_beginner":     per_class_f1[0],
        "f1_intermediate": per_class_f1[1],
        "f1_advanced":     per_class_f1[2],
    }


# ============================================================
# CELL 13 — Load model & training args
# ============================================================
print(f"\n=== Loading model: {BASE_MODEL} ===")
model = AutoModelForSequenceClassification.from_pretrained(
    BASE_MODEL,
    num_labels=3,
    id2label=ID2LABEL,
    label2id=LABEL2ID,
    ignore_mismatched_sizes=True,
)
model.to(device)

steps_per_epoch  = len(train_data) // (BATCH_SIZE * GRAD_ACCUM)
total_steps      = steps_per_epoch * EPOCHS
warmup_steps     = int(total_steps * WARMUP_RATIO)
eval_steps       = steps_per_epoch  # evaluate once per epoch

training_args = TrainingArguments(
    output_dir="./codebert_checkpoints",
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=32,
    gradient_accumulation_steps=GRAD_ACCUM,
    learning_rate=LR,
    warmup_steps=warmup_steps,
    weight_decay=WEIGHT_DECAY,
    eval_strategy="steps",
    eval_steps=eval_steps,
    save_strategy="steps",
    save_steps=eval_steps,
    load_best_model_at_end=True,
    metric_for_best_model="macro_f1",
    greater_is_better=True,
    logging_steps=50,
    fp16=torch.cuda.is_available(),     # CUDA only
    bf16=not torch.cuda.is_available() and torch.backends.mps.is_available(),  # MPS (Apple)
    seed=SEED,
    report_to="none",
    save_total_limit=2,
)

trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
)


# ============================================================
# CELL 14 — Train
# ============================================================
print("\n=== Training ===")
trainer.train()


# ============================================================
# CELL 15 — Evaluate on test set
# ============================================================
print("\n=== Test Set Evaluation ===")
test_loader = DataLoader(test_ds, batch_size=32)
model.eval()
all_preds, all_labels = [], []

with torch.no_grad():
    for batch in test_loader:
        input_ids  = batch["input_ids"].to(device)
        attn_mask  = batch["attention_mask"].to(device)
        labels     = batch["labels"].numpy()
        logits     = model(input_ids=input_ids, attention_mask=attn_mask).logits
        preds      = logits.argmax(-1).cpu().numpy()
        all_preds.extend(preds)
        all_labels.extend(labels)

acc      = accuracy_score(all_labels, all_preds)
macro_f1 = f1_score(all_labels, all_preds, average="macro")
print(f"\nTest Accuracy : {acc*100:.2f}%")
print(f"Test Macro F1 : {macro_f1*100:.2f}%")
print("\nPer-class report:")
print(classification_report(
    all_labels, all_preds,
    target_names=["Beginner", "Intermediate", "Advanced"]
))

# Confusion matrix
cm = confusion_matrix(all_labels, all_preds)
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=["Beginner","Intermediate","Advanced"],
            yticklabels=["Beginner","Intermediate","Advanced"])
plt.ylabel("True"); plt.xlabel("Predicted")
plt.title(f"Confusion Matrix — Accuracy: {acc*100:.1f}%  Macro F1: {macro_f1*100:.1f}%")
plt.tight_layout()
plt.savefig("confusion_matrix.png", dpi=150)
plt.show()
print("Confusion matrix saved to confusion_matrix.png")


# ============================================================
# CELL 16 — Save model locally and push to HF Hub
# ============================================================
SAVE_DIR = "./best_codebert_large"

print(f"\n=== Saving model to {SAVE_DIR} ===")
model.save_pretrained(SAVE_DIR)
tokenizer.save_pretrained(SAVE_DIR)
print("Saved locally.")

print(f"\n=== Pushing to HuggingFace Hub: {HF_REPO} ===")
model.push_to_hub(HF_REPO, token=HF_TOKEN)
tokenizer.push_to_hub(HF_REPO, token=HF_TOKEN)
print(f"Done. Model live at: https://huggingface.co/{HF_REPO}")

print("\n=== All done! ===")
print(f"Final Test Accuracy: {acc*100:.2f}%")
print(f"Final Test Macro F1: {macro_f1*100:.2f}%")
