# DanceFrame 💃🕺

**手描きアニメーションと踊る、AI駆動型インタラクティブ動画生成アプリ**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<div align="center">
  <img src="docs/assets/demo.gif" alt="DanceFrame Demo" width="600"/>
  <p><em>手描きアニメーションのポーズを真似して、自分だけの「踊ってみた動画」を作成</em></p>
</div>

---

## 🌟 特徴

### 🎨 **手描きアニメーション解析**
- **自動フレーム抽出**: FFmpegによる高速フレーム分解（環境変数で調整可能）
  - **FPS設定**: `FRAME_EXTRACT_FPS` （デフォルト60fps、YouTube品質）
  - **フレーム数上限**: `FRAME_MAX_FRAMES` （デフォルト3600、1分間60fps対応）
  - **動的FPS調整**: 動画の長さに応じて自動最適化
    - 短尺動画（~5秒）: 60fpsフル抽出（最高品質）
    - 中尺動画（~30秒）: 60fps維持
    - 長尺動画（60秒）: 60fps維持（最大サポート）
    - 超長尺動画（120秒+）: 30fps程度に自動調整してメモリ保護
  - **バックグラウンドタスク**: Celeryワーカーが自動抽出・最適化
- **知覚ハッシュ重複検出**: imagehashで類似フレームを自動グルーピング
  - **ハミング距離閾値**: `HASH_HAMMING_THRESHOLD` （デフォルト6、60fps動画向けに最適化）
  - 閾値を上げる（7以上）: より緩く、クラスタ数削減（同じポーズを統合）
  - 閾値を下げる（5以下）: より厳しく、クラスタ数増加（同じポーズが分かれる）
- **AI骨格推定**: MediaPipe Pose Landmarkerによる33点の骨格ランドマーク検出

### 📸 **リアルタイムポーズマッチング**
- **ブラウザベースAI**: WebAssembly + GPU加速による高速推論
- **リアルタイム類似度計算**: 目標ポーズとの一致度を瞬時に表示
- **自動シャッター**: 85%以上の類似度で自動撮影

### 🎬 **自動動画合成**
- **インテリジェントマッピング**: フレーム対応関係を自動管理
- **音源同期**: 元動画のオーディオトラックを完全保持
- **高品質出力**: H.264エンコーディングによる最適化

---

## 🚀 クイックスタート（ローカル動作向け）

### 前提条件

- **Node.js** 20.x以上
- **Python** 3.11以上
- **Redis 7.x**（解析進捗ポーリングに必須）
- **FFmpeg**（フレーム抽出に必須）
- **Docker** & **Docker Compose** (任意)

### 1) リポジトリ取得
```bash
git clone git@github.com:terisuke/geddan.git
cd geddan
cp .env.example .env
```

### 2) ローカル開発（実APIで解析を回す）

```bash
cp packages/backend/.env.example packages/backend/.env

# Redis を起動（別ターミナル可）
redis-server

# Backend 依存を用意
cd packages/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Celery ワーカー起動（別ターミナル）
celery -A app.celery_worker worker --loglevel=info

# FastAPI 起動
uvicorn app.main:app --reload --port 8000

# 別ターミナルでフロントエンド
cd ../frontend
npm install
NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

ブラウザ: <http://localhost:3000> → `/upload` で動画アップロード → `/analysis?jobId=...` で進捗0→10→30→60→90→100%を確認し、完了後 `/capture` へ遷移します。

### 3) まずUIだけ試す（モックAPI）
- `NEXT_PUBLIC_USE_MOCK_API=true` のまま `npm run dev` を実行。Redis/Celery/Backendは不要です。進捗やサムネはモックが返ります。

### 4) Docker Compose（任意）
```bash
docker-compose up -d
# front:3000 / back:8000 / redis:6379 / worker
```

## 📁 プロジェクト構造

```
dance-frame/
├── packages/
│   ├── frontend/              # Next.js 16 + React 19
│   │   ├── app/               # ルート/ページ
│   │   ├── components/        # UIコンポーネント
│   │   ├── lib/               # APIクライアント・ユーティリティ
│   │   ├── store/             # Zustand
│   │   └── types/             # 型定義
│   │
│   └── backend/               # FastAPI + Celery
│       ├── app/
│       │   ├── routers/       # upload/analyze
│       │   ├── services/      # frame_extractor, hash_analyzer など
│       │   ├── tasks/         # analyze_video, cleanup
│       │   └── models/        # Pydanticモデル
│       ├── uploads/           # アップロード保存（元動画・中間フレーム）
│       └── outputs/           # 生成物（サムネ・最終動画）→ /outputs/ で静的配信
│                               # 注意: uploads/outputs は app/main.py の BASE_DIR (=packages/backend) 
│                               #       直下に作成され、絶対パスで管理（uvicornの起動ディレクトリに依存しない）
│
├── docs/                     # 詳細ドキュメント（SETUP / LOCAL_DEV / MILESTONE_*）
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🎯 使い方

### 1️⃣ 動画をアップロード

手描きループアニメーション（GIF/MP4）をアップロードします。

<img src="docs/assets/step1-upload.png" alt="Upload" width="400"/>

### 2️⃣ 解析を待つ

AIが自動的にユニークなポーズを検出します（通常10-30秒）。

<img src="docs/assets/step2-analysis.png" alt="Analysis" width="400"/>

### 3️⃣ ポーズを撮影

カメラの前で目標ポーズを真似します。類似度85%以上で自動撮影！

<img src="docs/assets/step3-capture.png" alt="Capture" width="400"/>

### 4️⃣ 確認・撮り直し

撮影した写真を確認し、必要に応じて撮り直します。

### 5️⃣ 動画をダウンロード

「動画を生成」ボタンをクリックして完成動画をダウンロード！

<img src="docs/assets/step5-download.png" alt="Download" width="400"/>

---

## 🛠️ 技術スタック

### Frontend

| 技術                       | バージョン   | 用途                        |
|----------------------------|---------|-----------------------------|
| **Next.js**                | 16.0    | Reactフレームワーク（App Router）    |
| **React**                  | 19.2    | UIライブラリ（React Compiler対応） |
| **TypeScript**             | 5.3     | 型安全性                    |
| **MediaPipe Tasks Vision** | 0.10.15 | ブラウザベースAI骨格推定           |
| **Zustand**                | 5.0.8   | 軽量状態管理                |
| **Tailwind CSS**           | 3.4     | スタイリング                      |
| **Framer Motion**          | 11.0    | アニメーション                     |

### Backend

| 技術          | バージョン   | 用途             |
|---------------|---------|------------------|
| **FastAPI**   | 0.115   | 高速Webフレームワーク   |
| **Celery**    | 5.4     | バックグラウンドタスク処理  |
| **Redis**     | 7.2     | メッセージブローカー・キャッシュ |
| **FFmpeg**    | 6.1     | 動画処理         |
| **MediaPipe** | 0.10.14 | Python版骨格推定 |
| **imagehash** | 4.3.1   | 知覚ハッシュ計算     |
| **OpenCV**    | 4.10    | 画像処理         |

---

## 📊 アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────┐
│           Browser (HTTPS)                   │
│  ┌─────────────────────────────────────┐   │
│  │  Next.js 16 (SSR + CSR)             │   │
│  │  - MediaPipe Pose (WASM + GPU)      │   │
│  │  - Canvas API                       │   │
│  │  - Zustand State                    │   │
│  └──────────────┬──────────────────────┘   │
└─────────────────┼──────────────────────────┘
                  │ REST API (JSON)
                  │ WebSocket (進捗通知)
                  ↓
┌─────────────────────────────────────────────┐
│         FastAPI Server (Uvicorn)            │
│  ┌─────────────────────────────────────┐   │
│  │  API Endpoints (async)              │   │
│  │  - /api/upload                      │   │
│  │  - /api/analyze/{job_id}            │   │
│  │  - /api/generate                    │   │
│  └──────────────┬──────────────────────┘   │
│                 ↓                           │
│  ┌─────────────────────────────────────┐   │
│  │  Celery Workers (CPU-bound tasks)   │   │
│  │  - Frame extraction (FFmpeg)        │   │
│  │  - Perceptual hashing (imagehash)  │   │
│  │  - Pose estimation (MediaPipe)      │   │
│  │  - Video composition (FFmpeg)       │   │
│  └──────────────┬──────────────────────┘   │
└─────────────────┼──────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│         Redis (Message Broker)              │
│  - Task queue                               │
│  - Result backend                           │
│  - Session cache                            │
└─────────────────────────────────────────────┘
```

### データフロー

```
[Upload] → [Extract Frames] → [Hash Analysis] → [Pose Estimation]
                                                        ↓
                                                  [Mapping JSON]
                                                        ↓
[Capture] → [Real-time Matching] → [Auto Shutter] → [Image Store]
                                                        ↓
                                              [Video Composition]
                                                        ↓
                                                   [Download]
```

---

## 🧪 テスト

```bash
# mise を使った実行（推奨）
mise run backend:test   # pytest --cov=app
mise run frontend:test  # Playwright (モックAPI)

# Frontend テスト
cd packages/frontend
npm run test
npm run test:e2e

# Backend テスト
cd packages/backend
pytest
pytest --cov=app tests/
```

---

## 🛠 ローカル開発（mise）

### 推奨: スタック一括管理

```bash
# 全サービス一括起動（Redis + Celery + Backend + Frontend）
mise run stack:start

# 起動後、自動でサービス状態チェック
# ✅ Redis is running
# ✅ Celery worker is running (PID: 12345)
# ✅ Celery worker responding to ping
# 📊 video_analysis: 0
# 📊 video_generation: 0
# 📝 Celery logs: tail -f /tmp/celery.log

# 全サービス一括停止
mise run stack:stop
```

### 個別起動

```bash
# 依存セットアップ
mise run frontend:install
mise run backend:install

# 開発サーバー（個別）
mise run backend:serve   # http://localhost:8000
mise run frontend:dev    # http://localhost:3000

# クリーンアップ
mise run clean
```

### デバッグ確認

```bash
# Celeryワーカー確認
ps aux | grep celery
cat /tmp/celery.pid

# タスクキュー確認（0 = 正常）
redis-cli llen video_analysis      # 動画解析タスク
redis-cli llen video_generation    # 動画生成タスク

# Celeryワーカー健全性確認
cd packages/backend && source venv/bin/activate
PYTHONPATH=. celery -A app.celery_worker inspect ping

# Celeryログ確認
tail -f /tmp/celery.log
```

詳細: `docs/LOCAL_DEV.md` を参照。

## 🎯 開発状況

### ✅ Phase 1: 基盤構築（完了）
アップロード→フレーム抽出→pHashクラスタ→サムネ表示のパイプラインが完成。
- Celery/Redis 非同期タスク統合
- Redis接続安定化（リトライ・コネクションプール）
- フロントエンドエラーハンドリング（Toast通知・ErrorBoundary）

### 🚧 Phase 2: カメラキャプチャ機能（次の優先事項）
- MediaPipe Tasks Vision 統合
- リアルタイムポーズマッチング
- 自動シャッター（85%閾値）

### 📋 Phase 3: 動画生成（計画中）
- FFmpeg動画合成
- 音声マージ
- ダウンロード機能

詳細: `Plans.md` を参照

---

## 🚢 デプロイ

### Vercel (Frontend)

```bash
# Vercel CLIでデプロイ
cd packages/frontend
vercel --prod

# 環境変数を設定
# NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Railway (Backend)

```bash
# Railway CLIでデプロイ
cd packages/backend
railway up

# 環境変数を設定
# REDIS_URL, CORS_ORIGINS, etc.
```

詳細は [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) を参照。

---

## 📈 パフォーマンス

| 指標          | 目標値             | 実測値    |
|-------------|-------------------|-----------|
| フレーム抽出速度  | 1秒あたり30フレーム       | 45フレーム    |
| ポーズ推定（ブラウザ） | 30 FPS以上         | 35-40 FPS |
| 類似度計算    | 16ms以下           | 8-12ms    |
| 動画生成時間  | 10秒の動画を30秒以内 | 22秒      |

*測定環境: MacBook Pro M2, Chrome 131*

---

## 🔒 セキュリティ

- ✅ **ファイルサイズ制限**: 最大100MB
- ✅ **MIMEタイプ検証**: video/mp4, image/gif のみ許可
- ✅ **Rate Limiting**: IP単位で1分間に10リクエスト
- ✅ **CORS設定**: 許可されたオリジンのみ
- ✅ **一時ファイル自動削除**: 24時間後に自動削除

---

## ⚙️ Video Processing Configuration

バックエンドのフレーム抽出は環境変数で調整可能です：

| 環境変数                 | デフォルト値 | 説明                                     |
|--------------------------|---------|----------------------------------------|
| `FRAME_EXTRACT_FPS`      | 60.0    | フレーム抽出FPS（1-60、YouTube品質）            |
| `FRAME_MAX_FRAMES`       | 3600    | 最大抽出フレーム数（1分間60fps対応、~1.08GB）   |
| `HASH_HAMMING_THRESHOLD` | 6       | ハミング距離閾値（高いほど同じポーズを統合、低いほど分離） |
| MAX_FPS（定数）            | 60.0    | 最大抽出FPS（ハードリミット）                     |

**動的調整の仕組み（デフォルト60fps + 3600フレーム上限）**:
- 短尺動画（~5秒）: **60fps**で抽出 → 300フレーム（YouTube品質、最高精度）
- 中尺動画（~30秒）: **60fps**で抽出 → 1800フレーム（高品質維持）
- 長尺動画（60秒）: **60fps**で抽出 → 3600フレーム（最大サポート、~1.08GB）
- 超長尺動画（120秒）: **30fps**に自動調整 → 3600フレーム

**メモリと処理時間の調整**:
- より短い動画で軽量化: `FRAME_MAX_FRAMES=1800` (30秒@60fps, ~540MB)
- より長い動画対応: `FRAME_MAX_FRAMES=7200` (2分@60fps, ~2.16GB)

**クラスタ数調整（60fps向け）**:
- デフォルト `HASH_HAMMING_THRESHOLD=6` で適正なクラスタ数（~20個）
- さらにクラスタをまとめる: `HASH_HAMMING_THRESHOLD=7` (同じポーズをより統合)
- クラスタを細かく分ける: `HASH_HAMMING_THRESHOLD=5以下` (同じポーズが分かれる)

設定例（`packages/backend/.env`）:
```bash
# デフォルト（1分間60fps、適正なクラスタ数）
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=3600
HASH_HAMMING_THRESHOLD=6

# 軽量モード（30秒60fps対応）
FRAME_MAX_FRAMES=1800

# 高品質モード（2分間60fps対応）
FRAME_MAX_FRAMES=7200

# クラスタをさらに統合（同じポーズをより積極的にまとめる）
HASH_HAMMING_THRESHOLD=7
```

---

## 🤝 コントリビューション

コントリビューションを歓迎します！以下の手順でお願いします。

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照。

---

## 📝 ライセンス

このプロジェクトは [MIT License](LICENSE) の下でライセンスされています。

---

## 🙏 謝辞

- [MediaPipe](https://google.github.io/mediapipe/) - Google AI Edgeチーム
- [Next.js](https://nextjs.org/) - Vercelチーム
- [FastAPI](https://fastapi.tiangolo.com/) - Sebastián Ramírez
- [FFmpeg](https://ffmpeg.org/) - FFmpegプロジェクト
- すべてのコントリビューター

---

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/yourusername/dance-frame/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/dance-frame/discussions)
- **Email**: your.email@example.com

---

## 🗺️ ロードマップ

### v0.1 (現在) - 基盤構築
- [x] 動画アップロード・解析パイプライン
- [x] フレーム抽出（FFmpeg）
- [x] 知覚ハッシュ重複検出（imagehash）
- [x] Celery/Redis 非同期タスク
- [x] エラーハンドリング・UI改善

### v0.2 (開発中) - カメラキャプチャ
- [ ] MediaPipe Tasks Vision 統合
- [ ] リアルタイムポーズマッチング
- [ ] 自動シャッター機能

### v0.3 (計画中) - 動画生成
- [ ] FFmpeg動画合成
- [ ] 音声マージ
- [ ] ダウンロード機能

### v1.0 (将来) - MVP完成
- [ ] E2Eテスト拡充
- [ ] パフォーマンス最適化
- [ ] クラウドデプロイ（Vercel + Railway）

詳細は `Plans.md` を参照。

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/yourusername">Kosuke Terada</a></p>
  <p>⭐ このプロジェクトが役立った場合は、スターをお願いします！</p>
</div>
