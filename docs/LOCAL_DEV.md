# Local Development with mise

軽量タスクランナー「mise」でフロント/バックエンドを一括操作する手順。

## 前提
- Node.js 20系 / npm
- Python 3.11
- mise がインストール済み（`mise --version`）

## 主要タスク

```bash
# フロントエンド
mise run frontend:install   # npm install
mise run frontend:dev       # Next.js dev サーバー (:3000)
mise run frontend:lint      # ESLint
mise run frontend:test      # Playwright（モックAPI使用）

# バックエンド
mise run backend:venv       # venv 作成
mise run backend:install    # 依存インストール（オフライン時はスキップ）
mise run backend:serve      # uvicorn --reload (:8000)
mise run backend:test       # pytest --cov=app

# 共通
mise run e2e                # Playwright E2E
mise run clean              # uploads/outputs を掃除

# 追加タスク（mise）
mise run dev:mock           # モックAPIでフロントのみ起動
mise run dev:full           # バックエンド（実API）＋フロント同時起動
mise run frontend:test:api  # 実API向けPlaywright（Redis/Celery/BE起動前提）

# スタック管理（推奨）
mise run stack:start        # Redis + Celery + Backend + Frontend を一括起動
mise run stack:stop         # 全サービスを一括停止
```

## スタック管理（mise run stack:start）

全サービス（Redis + Celery + Backend + Frontend）を一括で起動・停止できます。

```bash
# 一括起動（推奨）
mise run stack:start

# 起動後、自動的にサービス状態がチェックされます:
# ========================================
# 🔍 Service Status Check
# ========================================
# Redis:
#   ✅ Redis is running
#
# Celery Worker:
#   ✅ Celery worker is running (PID: 12345)
#
# Celery Worker Health:
#   ✅ Celery worker responding to ping
#
# Task Queues:
#   📊 video_analysis: 0
#   📊 video_generation: 0
#
# 📝 Celery logs: tail -f /tmp/celery.log
# ========================================

# 一括停止
mise run stack:stop
```

### デバッグ確認手順

**Celeryワーカーが動いているか確認**:
```bash
# 方法1: プロセス確認
ps aux | grep celery

# 方法2: pidfile確認
cat /tmp/celery.pid && echo "Celery is running (PID: $(cat /tmp/celery.pid))"

# 方法3: Celeryログ確認（リアルタイム）
tail -f /tmp/celery.log
```

**タスクキューの状態確認**:
```bash
# キューの長さ確認（0 であればタスクが消化されている）
redis-cli llen video_analysis      # 動画解析タスクキュー
redis-cli llen video_generation    # 動画生成タスクキュー

# Celeryワーカーのヘルスチェック
cd packages/backend
source venv/bin/activate
PYTHONPATH=. celery -A app.celery_worker inspect ping
# → pong が返ればワーカーが正常稼働中

# Redis接続確認
redis-cli ping
# → PONG が返ればOK
```

**Celeryワーカーが起動しない場合**:
1. `/tmp/celery.log` を確認してエラーを特定:
   ```bash
   cat /tmp/celery.log
   ```
2. よくあるエラー:
   - `ImportError`: 依存パッケージ不足 → `mise run backend:install` で再インストール
   - `Connection refused`: Redis未起動 → `redis-server --daemonize yes` で起動
   - `ModuleNotFoundError`: PYTHONPATH未設定 → `.mise.toml` で `PYTHONPATH=packages/backend` 設定済み

**タスクがキュー待ちのまま止まる場合**:
```bash
# 1. Celeryワーカーが動いているか確認
ps aux | grep celery

# 2. キューに溜まっているタスク数を確認
redis-cli llen video_analysis      # 動画解析タスク
redis-cli llen video_generation    # 動画生成タスク
# → 0以外ならワーカーが消化していない

# 3. ワーカーが正しいキューを監視しているか確認
cd packages/backend
source venv/bin/activate
PYTHONPATH=. celery -A app.celery_worker inspect active_queues
# → video_analysis, video_generation が表示されればOK
# → 表示されない場合は -Q オプション指定忘れ（.mise.toml を確認）

# 4. Celeryログを確認
tail -n 50 /tmp/celery.log

# 5. ワーカーを再起動
mise run stack:stop
mise run stack:start
```

## 2ターミナルで同時起動する例

### ターミナル1（バックエンド）
```
mise run backend:serve   # http://localhost:8000
```

### ターミナル2（フロントエンド）
```
mise run frontend:dev    # http://localhost:3000
```

※ 実APIと繋ぐ場合は `.env` に  
`NEXT_PUBLIC_API_URL=http://localhost:8000`  
`NEXT_PUBLIC_USE_MOCK_API=false` を設定。モックで良ければ true/未設定でOK。

## 実API接続手順（Redis/Celeryが必要）

解析機能を使用するには、RedisとCeleryワーカーを起動する必要があります。

### 1. Redisを起動

```bash
# macOS (Homebrew)
brew services start redis

# または、直接起動
redis-server

# 起動確認
redis-cli ping
# → PONG が返ればOK
```

### 2. Celeryワーカーを起動

```bash
cd packages/backend
source venv/bin/activate
celery -A app.celery_worker worker --loglevel=info --concurrency=2 --queues=video_analysis,video_generation
```

**重要**: `--queues=video_analysis,video_generation` オプションを指定する必要があります。
`tasks.analyze_video` は `video_analysis` キューに、`tasks.generate_video` は `video_generation` キューにルーティングされるため、ワーカーがこれらのキューを監視している必要があります。

**起動確認方法**:
```bash
# ワーカープロセスが起動していることを確認
ps aux | grep celery | grep -v grep

# Celeryワーカーの応答を確認
celery -A app.celery_worker inspect ping
# → ワーカーが応答すればOK（複数ワーカーが起動している場合は全て応答）

# Redisキューの長さを確認（0を維持していればタスクが消化されている）
# 注意: tasks.analyze_video は video_analysis キューにルーティングされる
redis-cli llen video_analysis
# → 通常は 0（タスクが正常に消化されている）

# デフォルトの celery キューの長さも確認（任意）
redis-cli llen celery

# ワーカーログを確認（--logfile オプション使用時）
tail -f /tmp/celery.log
```

**期待される結果**:
- `ps aux | grep celery`: Celeryワーカープロセスが表示される
- `celery -A app.celery_worker inspect ping`: ワーカーから応答がある
- `redis-cli llen video_analysis`: 通常は `0`（タスクが正常に消化されている）
- `/tmp/celery.log`: ワーカー起動メッセージが表示される（`--logfile` オプション使用時）

### 3. バックエンドを起動

```bash
mise run backend:serve
# または
cd packages/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**重要**: `uploads` と `outputs` ディレクトリは `app/main.py` の `BASE_DIR` (= `packages/backend`) 直下に作成され、絶対パスで管理されます。これにより、uvicornの起動ディレクトリに依存せず、`/outputs/` で正しく静的配信されます。

### 4. フロントエンドの環境変数を設定

フロントエンドの `.env` ファイルに以下を追加：

```bash
# 実APIを使用
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5. フロントエンドを起動

```bash
mise run frontend:dev
```

### 動作確認

**サービス起動確認**:
```bash
# 1. Redisが起動していることを確認
redis-cli ping
# → PONG が返ればOK

# 2. Celeryワーカーが起動していることを確認
ps aux | grep celery | grep -v grep
# → Celeryワーカープロセスが表示されればOK

# 3. Redisキューの長さを確認（タスクが蓄積していないことを確認）
# 注意: tasks.analyze_video は video_analysis キューにルーティングされる
redis-cli llen video_analysis
# → 通常は 0（タスクが正常に消化されている）

# デフォルトの celery キューの長さも確認（任意）
redis-cli llen celery

# 4. バックエンドヘルスチェック
curl http://localhost:8000/health
# → {"status":"healthy","version":"1.0.0","redis":"connected"} が返ればOK

# 5. フロントエンドが起動していることを確認
curl http://localhost:3000
# → HTMLが返ればOK
```

**アップロード→解析→サムネ表示フロー**:
1. ブラウザで `http://localhost:3000/upload` にアクセス
2. 動画ファイルをアップロード
3. 解析進捗が表示される（0% → 10% → 30% → 60% → 90% → 100%）
4. 解析完了後、サムネイルグリッドが表示される
5. 「撮影を開始する」ボタンをクリックして `/capture` ページに遷移

**トラブルシューティング**:
- キュー待ちのまま止まる場合:
  - `ps aux | grep celery`: ワーカーが起動しているか確認
  - `celery -A app.celery_worker inspect ping`: ワーカーが応答するか確認
  - `redis-cli llen video_analysis`: **重要**: `video_analysis`キューにタスクが蓄積していないか確認（0以外の場合はタスクが消化されていない）
  - `/tmp/celery.log` を確認してエラーログがないか確認（`--logfile` オプション使用時）
  - ワーカーが正しいキューを監視しているか確認:
    ```bash
    # ワーカーの起動コマンドに --queues=video_analysis,video_generation が含まれているか確認
    ps aux | grep celery | grep -E "video_analysis|video_generation"
    ```

## 環境変数のポイント

### フロントエンド（`.env`）

```bash
# モックAPIを使用する場合
NEXT_PUBLIC_USE_MOCK_API=true
# NEXT_PUBLIC_API_URL は未設定でOK

# 実APIを使用する場合
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### バックエンド（`.env`）

```bash
# Redis接続設定（オプション1: REDIS_URL）
REDIS_URL=redis://localhost:6379/0

# または（オプション2: REDIS_HOST + REDIS_PORT）
REDIS_HOST=localhost
REDIS_PORT=6379

# Redis Optional モード（開発環境）
DEBUG=true
REDIS_OPTIONAL=true

# Redis Required モード（本番環境）
DEBUG=false
REDIS_OPTIONAL=false
```

## マイルストーン（進行中）

### 目的
「アップロード→フレーム抽出→pHashクラスタ→サムネ表示」をローカルで完走

### 実装状況

**Backend (Claude担当)**:
- ✅ APIスキーマ確定: `result.clusters[]` 構造を定義
- ✅ 静的配信設定: `/outputs/` を StaticFiles でマウント
- ✅ Celery/Redis連携で解析ジョブ実行（パイプライン実装済み）
- ✅ `/api/analyze/{job_id}` でクラスタ+サムネURL返却
- ✅ **フレーム抽出FPS改善**: 環境変数対応（デフォルト15fps、最大60fps、自動調整）

**Frontend (Cursor担当)**:
- ✅ 型定義更新: `AnalysisResponse` に `result.clusters` 追加
- ✅ モックAPI更新: クラスタ構造を反映
- 🚧 完了時にクラスタ代表サムネをグリッド表示（実API連携検証中）
- 🚧 UI分岐: status=failed と pending の明示表示（実データでの確認中）
- 🚧 E2Eテスト追加: 実APIでの解析完了→サムネ表示シナリオ（追加予定）

### APIスキーマ

**解析完了時のレスポンス**:
```json
{
  "job_id": "uuid",
  "status": "completed",
  "progress": 100,
  "result": {
    "clusters": [
      {
        "id": 0,
        "size": 12,
        "thumbnail_url": "/outputs/{job_id}/thumbnails/cluster-0.jpg"
      }
    ]
  }
}
```

**静的ファイル配信**:
- サムネイルURL: `http://localhost:8000/outputs/{job_id}/thumbnails/cluster-{id}.jpg`
- FastAPIの `StaticFiles` で `/outputs/` ディレクトリをマウント済み
- **重要**: 生成物（サムネ・最終動画）は `packages/backend/outputs/{job_id}/` に配置され、`/outputs/` 静的ルートで配信されます
- **パス管理**: `app/main.py` の `BASE_DIR` (= `packages/backend`) を基準とした絶対パスで管理されるため、uvicornの起動ディレクトリに依存しません

## E2Eテストの実行

### モックAPIでの実行（デフォルト）

```bash
mise run frontend:test       # モックAPIを使用（@mockタグ付きテスト）
# または
npm run test:e2e
```

**実行されるテスト**:
- 基本ナビゲーション
- ファイルアップロードUI
- モックAPIでのアップロードフロー

### 実APIでの実行（バックエンド起動が必要）

**前提条件**:
1. Redisを起動: `redis-server` または `brew services start redis`
2. Celeryワーカーを起動:
   ```bash
   cd packages/backend
   source venv/bin/activate
   celery -A app.celery_worker worker --loglevel=info --concurrency=2 --queues=video_analysis,video_generation
   ```
3. バックエンドを起動: `mise run backend:serve`
4. フロントエンドの`.env`に以下を設定:
   ```bash
   NEXT_PUBLIC_USE_MOCK_API=false
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

**実行方法**:
```bash
mise run frontend:test:api   # 実APIを使用（@apiタグ付きテスト）
# または
playwright test --grep "@api"
```

**実行されるテスト**:
- 実APIでのファイルアップロード
- 解析完了までの待機（最大5分）
- `result.clusters[]`の表示確認
- `status=failed` と `status=pending` のUI表示確認

**注意**:
- 実APIテストは、バックエンドが起動していない場合、自動的にスキップされます
- 解析完了には時間がかかるため、タイムアウトは最大5分に設定されています

## よくある確認
- バックエンドテスト: `mise run backend:test`（30/30パス、約82%カバレッジ）
- フロントE2Eを実APIで流す場合、バックエンドを先に `mise run backend:serve` で起動。

## バックエンドの起動モード

### オートリロードモード（推奨）
```bash
mise run backend:serve  # uvicorn --reload で起動（ファイル変更時に自動再起動）
```

### 通常モード（オートリロードなし）
環境によっては `--reload` オプションが「Operation not permitted」エラーを起こす場合があります。
その場合は、`.mise.toml` の `backend:serve` タスクを編集して `--reload` を外すか、直接実行：

```bash
cd packages/backend
source venv/bin/activate
uvicorn app.main:app --port 8000  # --reload なし
```

## 解析APIの実装状況（✅ 完了）

**2025-11-16更新**: 解析API（`/api/analyze/{job_id}`）の実装が完了しました！

- **実装済みの機能**:
  - ✅ **フレーム抽出**（FFmpeg、環境変数対応）
    - **バックグラウンドタスク**: `FRAME_EXTRACT_FPS`（デフォルト15fps、上限60fps）を採用
    - **自動調整**: `MAX_FRAMES=300` を超える場合、FPSを動的に縮小
    - **短尺動画対応**: 3秒程度の短尺アニメでも十分なフレーム数を抽出（最大60fps）
  - ✅ 知覚ハッシュ計算（imagehash.phash）
  - ✅ クラスタリング（ハミング距離 ≤5）
  - ✅ サムネイル生成（代表フレーム）
  - ✅ **進捗ポーリング**: Redis に中間ステータス書き込み (0→10→30→60→90→100%)
  - ✅ Celeryタスクによる非同期処理
  - ✅ `/outputs/{job_id}/thumbnails/` への静的配信

- **進捗ポーリングの動作**:
  - ポーリング間隔: 5秒
  - 進捗ステップ: 0% → 10% → 30% → 60% → 90% → 100%
  - `current_step` にリアルタイムメッセージ（"Extracting frames...", "Computing hashes..." など）
  - Redis/Celery が起動している必要があります

- **フロントエンドの表示**:
  - 進捗バーに `progress` と `current_step` が表示されます
  - 完了時に `result.clusters[]` が表示されます
  - Redis/Celery 未設定時は「⚠️ 処理待ち（バックエンド未設定）」と表示

## Redisについて

バックエンドはRedisなしでも動作します。Redis接続に失敗してもエラーで停止せず、警告ログを出して続行します。

### Redis Optional モード（推奨: 開発環境）

`.env` ファイルで以下のように設定すると、Redisなしで起動できます：

```bash
DEBUG=true
REDIS_OPTIONAL=true
```

**起動時のログ**:
```
🚀 Starting DanceFrame API...
🐛 DEBUG mode enabled - Redis is optional
⚠️  Redis not available (optional in dev mode): [Errno 61] Connection refused
📁 Created upload/output directories
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**制限事項**:
- ✅ アップロードAPI (`/api/upload`) は動作します
- ✅ Swagger UI (`/docs`) は利用できます
- ❌ 解析API (`/api/analyze`) はジョブを実行しません（Celeryが動かないため）
- ❌ 生成API (`/api/generate`) は動作しません

### Redis Required モード（推奨: 本番環境）

`.env` ファイルで以下のように設定すると、Redis接続が必須になります：

```bash
DEBUG=false
REDIS_OPTIONAL=false
REDIS_URL=redis://localhost:6379/0
```

Redisに接続できない場合、起動時にエラーで停止します：
```
❌ Failed to connect to Redis (required): [Errno 61] Connection refused
RuntimeError: Redis connection required but failed
```

### Redis接続設定

**オプション1: REDIS_URL（Docker環境・Railway等）**
```bash
REDIS_URL=redis://localhost:6379/0
```

**オプション2: REDIS_HOST + REDIS_PORT（ローカル開発）**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Redisの起動確認**:
```bash
# Redis起動
redis-server

# 別ターミナルで確認
redis-cli ping
# → PONG が返ればOK
```

## トラブルシューティング

### 問題1: 無限リロードループ

**症状**:
```
INFO:     Detected file change in 'uploads/xxx/original.mp4'. Reloading...
INFO:     Detected file change in 'outputs/xxx/frame_0001.jpg'. Reloading...
（繰り返し）
```

**原因**: `uvicorn --reload` がアップロード/出力ディレクトリの変更を検知している

**解決策1: 除外パターンを指定**

```bash
uvicorn app.main:app --reload \
  --reload-exclude 'uploads/*' \
  --reload-exclude 'outputs/*' \
  --port 8000
```

**解決策2: `.env` で除外パターンを設定**

```bash
WATCHFILES_EXCLUDE=*.log,*.tmp,uploads/**,outputs/**,__pycache__/**
```

**解決策3: オートリロードを無効化**

```bash
uvicorn app.main:app --port 8000  # --reload なし
```

### 問題2: `libmagic` が見つからない

**症状**:
```
ImportError: failed to find libmagic. Check your installation
```

**解決策**:
```bash
# macOS
brew install libmagic

# Ubuntu/Debian
sudo apt-get install libmagic1
```

### 問題3: テストが `uploads/` を汚染する

**症状**: `uploads/` ディレクトリに大量のテストジョブディレクトリが残る

**解決策**: 最新の `conftest.py` を使用（自動でtmpdirにリダイレクト）

手動削除:
```bash
rm -rf packages/backend/uploads/*/
```
