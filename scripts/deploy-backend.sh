
set -euo pipefail

HF_USERNAME="Hannan-12"
HF_SPACE="devskill-backend"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="$(mktemp -d)"

echo "==> Cloning HF Space into $WORKDIR"
git clone "https://huggingface.co/spaces/${HF_USERNAME}/${HF_SPACE}" "$WORKDIR/space"

echo "==> Syncing backend/ -> Space"
rsync -av --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='venv' \
  --exclude='ai_models/best_codebert_large' \
  --exclude='firebase_config' \
  --exclude='.env' \
  --exclude='.env.local' \
  "$REPO_ROOT/backend/" "$WORKDIR/space/"

cd "$WORKDIR/space"

echo "==> Writing HF Space frontmatter README"
cat > README.md <<'EOF'
---
title: DevSkill Backend
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

Backend for DevSkill Tracker. See https://github.com/Hannan-12/FYP for full docs.
EOF

if git diff --quiet && git diff --cached --quiet; then
  echo "==> No changes to deploy."
  exit 0
fi

git add -A
git commit -m "Deploy from local: $(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
git push

echo "==> Pushed. Watch the build at:"
echo "   https://huggingface.co/spaces/${HF_USERNAME}/${HF_SPACE}"
