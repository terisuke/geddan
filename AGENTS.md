# AGENTS.md - DanceFrame 開発ワークフロー

> **プロジェクト**: DanceFrame (geddan)
> **モード**: Solo (Claude Code)
> **更新日時**: 2025-12-30

---

## 📋 概要

DanceFrame は AI パワードのインタラクティブ動画生成アプリです。
手描きループアニメーションからキーフレームを抽出し、ユーザーがポーズを真似て撮影することで「踊ってみた」動画を作成します。

**コアフロー**: 動画アップロード → AI解析（ポーズ検出） → リアルタイムカメラマッチング → 自動動画合成

---

## 🏗️ プロジェクト構造

```
packages/
├── frontend/             # Next.js 16 + React 19.2 (SPA)
│   ├── app/             # App Router pages
│   ├── components/      # React components
│   ├── hooks/           # Custom hooks (useMediaPipe, useCamera)
│   ├── lib/             # Utilities (API client, pose comparison)
│   ├── store/           # Zustand state (useAppStore)
│   └── types/           # TypeScript definitions
└── backend/             # FastAPI + Celery (Async API)
    ├── app/
    │   ├── routers/     # API endpoints
    │   ├── services/    # Business logic
    │   ├── tasks/       # Celery tasks
    │   └── models/      # Pydantic schemas
    ├── tests/           # pytest tests
    ├── uploads/         # Temporary file storage
    └── outputs/         # Generated outputs
```

---

## 🚀 開発コマンド

### mise (推奨)

```bash
mise run frontend:dev     # Next.js dev server (port 3000)
mise run backend:serve    # FastAPI dev server (port 8000)
mise run frontend:test    # Playwright E2E tests
mise run backend:test     # pytest with coverage
mise run clean            # Clean uploads/outputs
```

### マニュアル

```bash
# Frontend
cd packages/frontend && npm run dev

# Backend
cd packages/backend
source venv/bin/activate
DEBUG=true REDIS_OPTIONAL=true uvicorn app.main:app --reload --port 8000
```

---

## 📐 コーディング規約

### Frontend (TypeScript)

- 2スペースインデント
- 関数コンポーネント優先
- PascalCase: コンポーネント
- camelCase: ユーティリティ
- `use*`: カスタムフック
- ESLint でチェック: `npm run lint`

### Backend (Python)

- Black でフォーマット
- Flake8 でリント
- snake_case: 関数・変数
- PascalCase: Pydantic モデル

---

## 🧪 テストガイドライン

- **Frontend E2E**: `packages/frontend/__tests__/e2e/*.spec.ts`
- **Backend**: `packages/backend/tests/test_*.py`
- data-testid セレクタを優先
- API モックを活用してフレーク回避

---

## 📦 コミット規約

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(frontend): add capture HUD
```

---

## 🔧 現在のマイルストーン

**目標**: アップロード → フレーム抽出 → pHashクラスタ → サムネ表示

詳細は `Plans.md` を参照。

---

## 📚 ドキュメント参照

- `README.md` - クイックスタート
- `CLAUDE.md` - Claude Code 設定
- `Plans.md` - タスク管理
- `docs/SPECIFICATION_V2.md` - 技術仕様
- `docs/ARCHITECTURE.md` - アーキテクチャ
