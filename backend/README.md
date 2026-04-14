---
title: DevSkill Backend
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# DevSkill Backend

FastAPI backend for the DevSkill FYP project.

## Required secrets (set in Space settings)
- `FIREBASE_CREDENTIALS_JSON` — full Firebase service account JSON (paste contents)
- `ANTHROPIC_API_KEY` — optional, enables AI quest generation
- `CORS_ORIGINS` — comma-separated frontend URLs (e.g. `https://your-app.vercel.app`)
- `CODEBERT_MODEL_ID` — optional override (default: `Hannan-12/devskill-codebert`)
