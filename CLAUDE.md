# Project Icarus

Generative AI platform that overlays photorealistic, structurally sound architectural designs onto drone footage. Bridges conceptual "vibe" to technical "spec."

## Architecture

Monorepo with two main packages:

- `frontend/` — React + Three.js (React Three Fiber) web application
- `backend/` — Python FastAPI server for ML pipeline and API

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + React Three Fiber |
| 3D Engine | Three.js + Gaussian Splat renderer |
| Backend | Python + FastAPI |
| AI Conversation | Claude API (architect questionnaire) |
| Scene Reconstruction | COLMAP + Gaussian Splatting |
| Building Generation | Procedural geometry + diffusion texturing |
| Database | PostgreSQL + local filesystem (v0.1) |

## v0.1 Scope — Interactive 3D

1. Upload drone footage
2. Reconstruct scene via COLMAP → Gaussian Splatting
3. AI-guided questionnaire to define building specs
4. Procedural building generation from specs
5. Place and manipulate building in 3D scene viewer
6. Export scene as 3D model

## Key Decisions

- Hybrid building generation: LLM drives spec conversation → procedural geometry engine → diffusion texturing
- Structural validation v0.1: rule-based plausibility checks, not full FEA
- Local-first deployment, cloud later
- Target users: architects, real estate developers, urban planners, homeowners

## Commands

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```
