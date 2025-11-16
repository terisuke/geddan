# Repository Guidelines

Concise reference for contributing to DanceFrame. Keep PRs small, include tests, and echo the patterns already in the codebase. 現在の最優先マイルストーンは「アップロード→フレーム抽出→pHashクラスタ→サムネ表示」をローカルで完走させること。

## Project Structure & Module Organization
- `packages/frontend`: Next.js 16 + React 19 UI. Core code under `app/` (routes), `components/`, `hooks/`, `lib/`, `store/`, `types/`; static assets in `public/`.
- `packages/backend`: FastAPI entrypoint `app/main.py`, with Redis/Celery hooks planned and upload/output dirs created at startup.
- `docs/`: Architecture, workflow, and setup references; read `SETUP.md` before environment changes.
- `docker-compose.yml`: Spins up app services (frontend/backends/Redis) for parity with local dev.

## Build, Test, and Development Commands
```bash
# Frontend
cd packages/frontend
npm run dev          # Next.js dev server on :3000
npm run build        # Production build
npm run lint         # ESLint (core-web-vitals rules)
npm run test:e2e     # Playwright E2E specs in __tests__/e2e

# Backend
cd packages/backend
uvicorn app.main:app --reload --port 8000
pytest               # Python tests (asyncio ready)
pytest --cov=app tests/  # Coverage when needed

# Using mise (recommended)
mise run frontend:install
mise run frontend:dev
mise run frontend:test
mise run backend:install
mise run backend:serve
mise run backend:test
```

## Current Milestone
- 目標: アップロード→フレーム抽出→pHashクラスタ→サムネ表示（ローカル完走）
- Backend: Celery/Redisで解析ジョブ実行、`/api/analyze/{job_id}`でクラスタ+サムネURL返却
- Frontend: 解析進捗ポーリングし完了時にクラスタ代表サムネをグリッド表示。404/501/503時はモックにフォールバックしつつ「未実装」表示。

## Coding Style & Naming Conventions
- Frontend: TypeScript, 2-space indent, prefer functional components. PascalCase for components, camelCase for utils, `use*` for hooks. Keep server components lean; isolate browser-only logic with `"use client"`. Lint with `npm run lint` before pushing.
- Backend: Python 3.11, format with `black`, lint with `flake8`. snake_case for functions/vars, PascalCase for Pydantic models. Keep request/response models in `app/models`, side effects behind service functions.

## Testing Guidelines
- Frontend E2E: Playwright specs live in `packages/frontend/__tests__/e2e/*.spec.ts`; prefer data-testid selectors and deterministic fixtures. Run against the dev server; avoid network flakiness by mocking APIs when possible.
- Backend: Tests belong under `packages/backend/tests/` using `pytest` naming (`test_*.py`). Use `pytest-asyncio` for async routes; add regression tests when touching logic.

## Commit & Pull Request Guidelines
- Branches: `feature/<owner>/<topic>` from `develop` when available.
- Commits: Conventional format `type(scope): subject` (e.g., `feat(frontend): add capture HUD`, `fix(backend): handle redis downtime`, `docs: update quickstart`).
- PRs: Link issues, describe behavior changes, list test commands run, and attach screenshots for UI tweaks. Keep scope narrow and ensure lint/tests pass before requesting review.

## Security & Configuration Tips
- Copy `.env.example` files; never commit secrets. Ensure local Redis is reachable when exercising upload/processing flows. Clean temporary `uploads/` and `outputs/` directories after debugging to avoid large diffs.
