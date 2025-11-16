# DanceFrame - セットアップガイド

**最終更新**: 2025-11-16
**対象**: macOS, Linux, Windows (WSL2)

---

## 📋 目次

1. [前提条件](#前提条件)
2. [ローカル開発環境セットアップ](#ローカル開発環境セットアップ)
3. [Docker環境セットアップ](#docker環境セットアップ)
4. [トラブルシューティング](#トラブルシューティング)
5. [本番デプロイ](#本番デプロイ)

---

## ✅ 前提条件

### 必須ソフトウェア

| ソフトウェア | 最小バージョン | 推奨バージョン | インストール方法 |
|------------|--------------|--------------|----------------|
| **Node.js** | 20.0 | 20.x LTS | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.11 | 3.11+ | [python.org](https://www.python.org/) |
| **Git** | 2.30 | 最新 | 標準搭載 |

### 開発環境（推奨）

**macOS:**
```bash
# Homebrewがない場合
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 必須ソフトウェア
brew install node@20 python@3.11 redis ffmpeg

# 開発ツール
brew install --cask visual-studio-code docker
```

**Ubuntu/Debian:**
```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.11
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# その他
sudo apt-get install -y redis-server ffmpeg git
```

**Windows (WSL2):**
```powershell
# WSL2 Ubuntu をインストール後、Ubuntuの手順に従う
wsl --install -d Ubuntu
```

---

## 🖥️ ローカル開発環境セットアップ

### Step 1: リポジトリクローン

```bash
# HTTPSでクローン
git clone https://github.com/yourusername/dance-frame.git
cd dance-frame

# または SSH
git clone git@github.com:yourusername/dance-frame.git
cd dance-frame
```

### Step 2: 環境変数設定

```bash
# .envファイル作成
cp .env.example .env

# エディタで編集（必要に応じて）
code .env
```

**.env サンプル:**
```bash
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000
SECRET_KEY=dev-secret-key-change-in-production
DEBUG=true
LOG_LEVEL=INFO
MAX_UPLOAD_SIZE=104857600  # 100MB
FILE_RETENTION_HOURS=24
```

### Step 3: Frontend セットアップ

```bash
cd packages/frontend

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# 別ターミナルで確認
# ブラウザで http://localhost:3000 を開く
```

**期待される出力:**
```
   ▲ Next.js 16.0.0
   - Local:        http://localhost:3000
   - Ready in 1.2s
```

### Step 4: Backend セットアップ

```bash
cd packages/backend

# 仮想環境作成
python3.11 -m venv venv

# 仮想環境アクティベート
# macOS/Linux:
source venv/bin/activate
# Windows (WSL):
source venv/bin/activate

# 依存関係インストール
pip install -r requirements.txt

# 開発サーバー起動
uvicorn app.main:app --reload --port 8000

# 別ターミナルで確認
# ブラウザで http://localhost:8000/docs を開く
```

**期待される出力:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
```

### Step 5: Redis セットアップ

```bash
# Redis起動
redis-server

# 別ターミナルで接続確認
redis-cli ping
# 期待される出力: PONG
```

### Step 6: Celery Worker セットアップ

```bash
cd packages/backend
source venv/bin/activate

# Celeryワーカー起動
celery -A app.celery_worker worker --loglevel=info --concurrency=2

# 期待される出力:
# [tasks]
#   . tasks.analyze_video
#   . tasks.compose_video
# [2025-11-16 10:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
```

### Step 7: 動作確認

**ターミナル1: Frontend**
```bash
cd packages/frontend
npm run dev
```

**ターミナル2: Backend**
```bash
cd packages/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**ターミナル3: Celery**
```bash
cd packages/backend
source venv/bin/activate
celery -A app.celery_worker worker --loglevel=info
```

**ターミナル4: Redis**
```bash
redis-server
```

**確認項目:**
- ✅ http://localhost:3000 - Frontendが表示される
- ✅ http://localhost:8000/docs - Swagger UIが表示される
- ✅ `redis-cli ping` - PONGが返る
- ✅ Celeryログに "ready" が表示される

---

## 🐳 Docker環境セットアップ

### Step 1: Dockerインストール確認

```bash
docker --version
# Docker version 24.0.0 以上

docker-compose --version
# Docker Compose version v2.20.0 以上
```

### Step 2: Docker Composeで一括起動

```bash
# プロジェクトルートで実行
docker-compose up -d

# ログ確認
docker-compose logs -f

# サービス状態確認
docker-compose ps
```

**期待される出力:**
```
NAME                 SERVICE      STATUS      PORTS
dance-frame-frontend    frontend     running     0.0.0.0:3000->3000/tcp
dance-frame-backend     backend      running     0.0.0.0:8000->8000/tcp
dance-frame-celery      celery       running
dance-frame-redis       redis        running     0.0.0.0:6379->6379/tcp
```

### Step 3: 動作確認

```bash
# Frontend確認
curl http://localhost:3000

# Backend確認
curl http://localhost:8000/health

# Redis確認
docker-compose exec redis redis-cli ping
# 期待: PONG
```

### Step 4: 開発時のホットリロード

```bash
# コンテナは起動したまま、コード編集すると自動反映
# Frontend: Next.js Fast Refresh
# Backend: Uvicorn --reload

# コンテナ内でコマンド実行
docker-compose exec backend bash
# または
docker-compose exec frontend sh
```

### Step 5: Docker環境の停止・削除

```bash
# 停止
docker-compose stop

# 停止 + コンテナ削除
docker-compose down

# 停止 + コンテナ削除 + ボリューム削除（データ削除注意）
docker-compose down -v

# イメージもすべて削除
docker-compose down --rmi all
```

---

## 🔧 トラブルシューティング

### 問題1: `npm install` が失敗する

**症状:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**解決方法:**
```bash
# Node.jsバージョン確認
node --version
# 20.x であることを確認

# npmキャッシュクリア
npm cache clean --force

# node_modules削除後に再インストール
rm -rf node_modules package-lock.json
npm install

# それでもダメなら
npm install --legacy-peer-deps
```

---

### 問題2: MediaPipe初期化エラー

**症状:**
```
Failed to initialize MediaPipe: Could not load wasm files
```

**解決方法:**
```typescript
// WASMファイルのCDN URLを確認
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm'
  // バージョンを明示的に指定
);
```

**または、ローカルにWASMファイルを配置:**
```bash
cd packages/frontend/public
mkdir -p mediapipe/wasm

# WASMファイルをダウンロード
# https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/
```

---

### 問題3: FFmpegエラー

**症状:**
```
FFmpeg error: ffmpeg: command not found
```

**解決方法:**
```bash
# FFmpegインストール確認
ffmpeg -version

# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg

# Dockerの場合はDockerfileに含まれているため不要
```

---

### 問題4: Celeryワーカーがタスクを受け取らない

**症状:**
```
Celery worker起動しているがタスクが実行されない
```

**解決方法:**
```bash
# 1. Redis接続確認
redis-cli ping

# 2. Celeryブローカー接続確認
celery -A app.celery_worker inspect active

# 3. Redisのキューを確認
redis-cli
> KEYS celery*
> LLEN celery

# 4. Celeryワーカーを再起動
# Ctrl+C で停止後
celery -A app.celery_worker worker --loglevel=debug
```

---

### 問題5: CORS エラー

**症状:**
```
Access to fetch at 'http://localhost:8000/api/upload' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**解決方法:**
```python
# packages/backend/app/main.py

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 追加
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 問題6: ポート競合

**症状:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解決方法:**
```bash
# 使用中のプロセスを確認
lsof -i :3000

# プロセスを終了
kill -9 <PID>

# または別のポートを使用
npm run dev -- -p 3001
```

---

## 🚀 本番デプロイ

### Vercel (Frontend)

#### 1. Vercel CLI インストール

```bash
npm install -g vercel
```

#### 2. デプロイ

```bash
cd packages/frontend

# ログイン
vercel login

# デプロイ
vercel --prod

# 環境変数設定
vercel env add NEXT_PUBLIC_API_URL production
# Value: https://api.danceframe.app
```

#### 3. カスタムドメイン設定

Vercel ダッシュボード → Domains → Add Domain

---

### Railway (Backend)

#### 1. Railway CLI インストール

```bash
npm install -g @railway/cli
```

#### 2. プロジェクト作成

```bash
cd packages/backend

# ログイン
railway login

# プロジェクト初期化
railway init

# サービス追加
railway add  # Redis を選択
railway add  # Webサービス（FastAPI）を選択
railway add  # Worker（Celery）を選択
```

#### 3. 環境変数設定

```bash
railway variables set REDIS_URL=<Railway Redisの内部URL>
railway variables set CORS_ORIGINS=https://danceframe.app
railway variables set SECRET_KEY=<本番用ランダム文字列>
railway variables set DEBUG=false
```

#### 4. デプロイ

```bash
railway up
```

---

### 環境変数チェックリスト

**Frontend (Vercel):**
- [x] `NEXT_PUBLIC_API_URL`

**Backend (Railway):**
- [x] `REDIS_URL`
- [x] `CELERY_BROKER_URL`
- [x] `CELERY_RESULT_BACKEND`
- [x] `CORS_ORIGINS`
- [x] `SECRET_KEY`
- [x] `DEBUG=false`
- [x] `LOG_LEVEL=INFO`

---

## 📚 参考リンク

### 公式ドキュメント

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Celery Documentation](https://docs.celeryproject.org/)
- [Redis Documentation](https://redis.io/documentation)
- [MediaPipe Solutions](https://ai.google.dev/edge/mediapipe/solutions/guide)

### デプロイ

- [Vercel Deployment Guide](https://vercel.com/docs)
- [Railway Deployment Guide](https://docs.railway.app/)

### コミュニティ

- [GitHub Issues](https://github.com/yourusername/dance-frame/issues)
- [GitHub Discussions](https://github.com/yourusername/dance-frame/discussions)

---

## 🆘 サポート

問題が解決しない場合:

1. **GitHub Issues**: [Issue を作成](https://github.com/yourusername/dance-frame/issues/new)
2. **Discord**: [コミュニティに参加](https://discord.gg/your-server)
3. **Email**: support@danceframe.app

---

**Document Version**: 2.0
**Last Updated**: 2025-11-16
**Maintainer**: Kosuke Terada
