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

## Testing

- **Frontend:** `cd frontend && npx vitest run` (Vitest + Testing Library)
- **Test directory:** `frontend/src/test/`
- See `frontend/TESTING.md` for conventions

Expectations:
- 100% test coverage is the goal — tests make vibe coding safe
- When writing new functions, write a corresponding test
- When fixing a bug, write a regression test
- When adding error handling, write a test that triggers the error
- When adding a conditional (if/else, switch), write tests for BOTH paths
- Never commit code that makes existing tests fail

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
