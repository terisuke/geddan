# DanceFrame - 詳細役割分担表

**チーム**: Claude (Lead) + Cursor (Developer)
**期間**: 10-12営業日（2人体制）
**最終更新**: 2025-11-16

---

## 📊 概要

### 作業分担比率

```
Claude (Backend Lead)           Cursor (Frontend Lead)
├─ Backend: 70%                 ├─ Frontend: 70%
├─ Frontend: 10%                ├─ Backend: 5%
├─ Infrastructure: 15%          ├─ Testing: 20%
└─ Review/Architecture: 5%      └─ Documentation: 5%
```

### 並行作業可能な組み合わせ

| Claude | Cursor | 依存関係 |
|--------|--------|---------|
| API設計 | UI設計 | ❌ なし（並行可） |
| バックエンド実装 | フロントエンド実装 | ⚠️ API仕様確定後 |
| Celeryタスク | E2Eテスト | ⚠️ 機能完成後 |
| デプロイ設定 | スタイリング | ❌ なし（並行可） |

---

## 🗓️ フェーズ別詳細分担

### Phase 0: プロジェクトセットアップ（Day 1 - 0.5日）

#### Claude の担当

**環境構築 (2時間)**
- [ ] リポジトリ初期化・ブランチ戦略設定
  ```bash
  git init
  git checkout -b develop
  ```
- [ ] Docker Compose設定
  - `docker-compose.yml` 作成
  - Backend Dockerfile
  - Redis設定
- [ ] Backend プロジェクト構造作成
  ```
  packages/backend/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py
  │   ├── routers/
  │   ├── services/
  │   ├── tasks/
  │   └── models/
  ├── requirements.txt
  └── Dockerfile
  ```
- [ ] Celery + Redis セットアップ
- [ ] `/health` エンドポイント作成（動作確認用）

**成果物:**
- ✅ Backend が http://localhost:8000 で起動
- ✅ Swagger UI が http://localhost:8000/docs で表示
- ✅ Celery Worker が正常起動

---

#### Cursor の担当

**環境構築 (2時間)**
- [ ] Frontend プロジェクト初期化
  ```bash
  cd packages/frontend
  npx create-next-app@latest . --typescript --tailwind --app
  ```
- [ ] 依存関係インストール
  ```bash
  npm install @mediapipe/tasks-vision zustand@5.0.8 axios framer-motion
  ```
- [ ] プロジェクト構造作成
  ```
  packages/frontend/src/
  ├── app/
  │   ├── page.tsx
  │   ├── layout.tsx
  │   └── globals.css
  ├── components/
  ├── hooks/
  ├── lib/
  ├── store/
  └── types/
  ```
- [ ] Tailwind CSS設定
- [ ] 基本レイアウトコンポーネント作成
  - `Header.tsx`
  - `Footer.tsx`
  - `Layout.tsx`

**成果物:**
- ✅ Frontend が http://localhost:3000 で起動
- ✅ Next.js 16 + React 19.2 が正常動作
- ✅ Tailwind CSSが適用される

---

### Phase 1: 動画アップロード・解析機能（Day 1.5-3 - 1.5日）

#### Claude の担当（6-8時間）

**1. ファイルアップロードAPI (2時間)**
```python
# packages/backend/app/routers/upload.py

@router.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    # ファイル検証
    # ジョブID生成
    # ファイル保存
    # Celeryタスク起動
    return {"job_id": job_id, "status": "processing"}
```

**タスク:**
- [ ] `/api/upload` エンドポイント実装
- [ ] ファイルバリデーションミドルウェア
  - MIMEタイプチェック（video/mp4, image/gif）
  - ファイルサイズチェック（100MB以下）
  - FFprobe メタデータ検証
- [ ] 一時ファイル保存処理
- [ ] ユニットテスト作成

---

**2. 動画解析サービス (4-6時間)**
```python
# packages/backend/app/services/frame_extractor.py
# packages/backend/app/services/hash_analyzer.py
# packages/backend/app/services/pose_estimator.py
```

**タスク:**
- [ ] `FrameExtractor` クラス実装
  - 音源抽出（FFmpeg）
  - フレーム抽出（24fps正規化）
  - メタデータ取得（ffprobe）
- [ ] `FrameHashAnalyzer` クラス実装
  - 知覚ハッシュ計算（imagehash.phash）
  - ハミング距離グルーピング
  - ユニークフレーム選定
- [ ] `PoseEstimator` クラス実装
  - MediaPipe Pose推定（Python版）
  - サムネイル生成（骨格線描画）
  - JSON出力
- [ ] Celery タスク `analyze_video_task` 実装
  - 進捗管理（Redis）
  - エラーハンドリング
  - タイムアウト設定（10分）
- [ ] `/api/analyze/{job_id}` エンドポイント実装
- [ ] 統合テスト作成

**成果物:**
- ✅ 動画アップロード→解析→結果取得が動作
- ✅ テストカバレッジ 80%以上
- ✅ Swagger ドキュメント完備

---

#### Cursor の担当（6-8時間）

**1. アップロードUIコンポーネント (2時間)**
```typescript
// packages/frontend/src/components/upload/FileUploader.tsx
```

**タスク:**
- [ ] `FileUploader` コンポーネント実装
  - ドラッグ&ドロップ対応
  - ファイル選択ボタン
  - プレビュー表示
  - バリデーションエラー表示
- [ ] Tailwind CSSでスタイリング
  - レスポンシブデザイン
  - ローディング状態
  - エラー状態
- [ ] コンポーネントテスト作成

---

**2. 解析進捗表示 (2時間)**
```typescript
// packages/frontend/src/components/analysis/ProgressBar.tsx
// packages/frontend/src/app/analysis/page.tsx
```

**タスク:**
- [ ] `ProgressBar` コンポーネント実装
  - プログレスバー（0-100%）
  - 現在のステップ表示
  - 推定残り時間表示
  - アニメーション
- [ ] `/analysis` ページ実装
  - ポーリング処理（GET /api/analyze/{job_id}）
  - 自動リダイレクト（完了時）
- [ ] ローディングアニメーション

---

**3. API統合 (2-4時間)**
```typescript
// packages/frontend/src/lib/api.ts
// packages/frontend/src/store/useAppStore.ts
```

**タスク:**
- [ ] Axios クライアント設定
  - Base URL設定
  - エラーハンドリング
  - インターセプター（共通ヘッダー）
- [ ] Zustand ストア実装
  ```typescript
  interface AppStore {
    jobId: string | null;
    status: 'idle' | 'uploading' | 'analyzing' | 'ready';
    progress: number;
    uniqueFrames: UniqueFrame[];
    // ...
  }
  ```
- [ ] API関数実装
  - `uploadVideo(file: File)`
  - `getAnalysisStatus(jobId: string)`
- [ ] E2Eテスト作成（Playwright）
  - アップロード→解析→完了フロー

**成果物:**
- ✅ アップロードUIが完全動作
- ✅ プログレスバーがリアルタイム更新
- ✅ E2Eテストパス

---

### Phase 2: カメラ撮影機能（Day 4-6 - 3日）

#### Claude の担当（4-6時間）

**1. ポーズ比較ロジック実装 (2-3時間)**
```typescript
// packages/frontend/src/lib/poseComparison.ts
```

**タスク:**
- [ ] `calculatePoseSimilarity` 関数実装
  - 3Dユークリッド距離計算
  - キー関節点の選定（13点）
  - 類似度スコア算出（0-100%）
- [ ] `calculateAngleSimilarity` 関数実装（補助的）
  - 関節角度計算
  - 角度差の評価
- [ ] パラメータチューニング
  - 閾値調整（85%）
  - スケーリング係数調整
- [ ] ユニットテスト作成
  - 各種ポーズパターンでテスト
  - エッジケース検証

---

**2. レビュー・技術サポート (2-3時間)**
- [ ] MediaPipe Tasks Vision統合のレビュー
- [ ] パフォーマンス最適化アドバイス
- [ ] バグ調査・修正サポート

**成果物:**
- ✅ 高精度なポーズ類似度計算
- ✅ リアルタイム処理（30+ FPS）

---

#### Cursor の担当（12-16時間）★メイン担当

**1. MediaPipe Tasks Vision統合 (4-6時間)**
```typescript
// packages/frontend/src/hooks/useMediaPipe.ts
```

**タスク:**
- [ ] `useMediaPipe` フック実装
  - PoseLandmarker初期化
  - WASM読み込み
  - GPU加速設定
  - リアルタイム検出ループ
- [ ] エラーハンドリング
  - 初期化失敗時
  - WASM読み込み失敗時
  - 検出エラー時
- [ ] パフォーマンス最適化
  - requestAnimationFrame使用
  - 不要な再レンダリング防止
- [ ] ユニットテスト作成

---

**2. カメラアクセス (2-3時間)**
```typescript
// packages/frontend/src/hooks/useCamera.ts
```

**タスク:**
- [ ] `useCamera` フック実装
  - getUserMedia統合
  - カメラ選択（フロント/リア）
  - ストリーム管理
  - 解像度設定（1280x720）
- [ ] エラーハンドリング
  - 権限拒否
  - カメラなし
  - ブラウザ非対応
- [ ] クリーンアップ処理

---

**3. 撮影UIコンポーネント (6-7時間)**
```typescript
// packages/frontend/src/app/capture/page.tsx
// packages/frontend/src/components/camera/CameraView.tsx
// packages/frontend/src/components/camera/PoseOverlay.tsx
// packages/frontend/src/components/camera/SimilarityMeter.tsx
// packages/frontend/src/components/camera/Timer.tsx
```

**タスク:**
- [ ] `CameraView` コンポーネント実装
  - ビデオ要素
  - Canvasオーバーレイ
  - 目標ポーズ表示（半透明）
  - 自分の骨格線表示（緑色）
- [ ] `SimilarityMeter` コンポーネント実装
  - リアルタイム更新（毎フレーム）
  - プログレスバー形式
  - 色変化（赤→黄→緑）
  - 達成時アニメーション
- [ ] `Timer` コンポーネント実装
  - カウントダウン（5秒）
  - 音声再生（3, 2, 1）
  - タイムアウト処理
- [ ] 自動シャッター機能
  - 類似度85%検知
  - Canvas画像キャプチャ
  - Blob生成
  - Zustandに保存
  - フラッシュエフェクト
  - シャッター音再生
- [ ] `/capture` ページ実装
  - 全体レイアウト
  - 進捗表示（X/総数）
  - スキップボタン
  - 自動遷移（全ポーズ完了時）
- [ ] レスポンシブデザイン
- [ ] アニメーション（Framer Motion）

**成果物:**
- ✅ カメラが正常起動
- ✅ リアルタイム骨格推定が30+ FPS
- ✅ 類似度計算が正確
- ✅ 自動シャッターが動作
- ✅ 撮影画像がストアに保存

---

### Phase 3: 確認・撮り直し機能（Day 7 - 0.5日）

#### Claude の担当（1時間）
- [ ] レビュー・バグ修正サポート
- [ ] パフォーマンス確認

#### Cursor の担当（3-4時間）★メイン担当

**1. レビューUIコンポーネント (3-4時間)**
```typescript
// packages/frontend/src/app/review/page.tsx
// packages/frontend/src/components/review/ThumbnailGrid.tsx
```

**タスク:**
- [ ] `ThumbnailGrid` コンポーネント実装
  - グリッドレイアウト（4列）
  - 撮影済み/未撮影の判定
  - サムネイル表示
  - ステータスバッジ（✓/❌）
- [ ] `/review` ページ実装
  - 一覧表示
  - クリック→拡大表示（モーダル）
  - 撮り直しボタン
  - 「動画を生成」ボタン
  - 警告表示（未撮影ポーズがある場合）
- [ ] スタイリング
  - ホバーエフェクト
  - アニメーション
  - レスポンシブ

**成果物:**
- ✅ 撮影結果の確認が可能
- ✅ 撮り直しが動作
- ✅ 次ステップへ遷移

---

### Phase 4: 動画生成機能（Day 7.5-8.5 - 1日）

#### Claude の担当（6-8時間）★メイン担当

**1. 動画生成APIエンドポイント (2時間)**
```python
# packages/backend/app/routers/generate.py

@router.post("/api/generate")
async def generate_video(request: GenerateRequest):
    # Base64画像をデコード・保存
    # Celeryタスク起動
    return {"generation_id": gen_id, "status": "processing"}

@router.get("/api/status/{generation_id}")
async def get_generation_status(generation_id: str):
    # Redis から進捗取得
    return {"status": "completed", "video_url": "..."}
```

**タスク:**
- [ ] `/api/generate` エンドポイント実装
- [ ] Base64画像デコード・保存処理
- [ ] `/api/status/{generation_id}` エンドポイント実装
- [ ] ユニットテスト作成

---

**2. 動画合成Celeryタスク (4-6時間)**
```python
# packages/backend/app/tasks/video_composition.py
# packages/backend/app/services/video_composer.py
```

**タスク:**
- [ ] `VideoComposer` クラス実装
  - フレーム配置ロジック
  - FFmpegで動画生成
  - 音声マージ
  - 進捗通知（Redis）
- [ ] `compose_video_task` 実装
  - マッピングJSON読み込み
  - 撮影画像と元画像の組み合わせ
  - 動画エンコード（H.264）
  - 音声合成（AAC）
  - エラーハンドリング
- [ ] ダウンロードエンドポイント
  ```python
  @router.get("/api/download/{job_id}/final.mp4")
  async def download_video(job_id: str):
      return FileResponse(video_path)
  ```
- [ ] 統合テスト作成

**成果物:**
- ✅ 動画生成が完全動作
- ✅ 音声が正しく合成される
- ✅ ダウンロード可能

---

#### Cursor の担当（3-4時間）

**1. 生成UIコンポーネント (2時間)**
```typescript
// packages/frontend/src/app/generate/page.tsx
// packages/frontend/src/components/generate/GenerationProgress.tsx
```

**タスク:**
- [ ] `GenerationProgress` コンポーネント実装
  - プログレスバー
  - 現在のステップ表示
  - 推定残り時間
- [ ] `/generate` ページ実装
  - 生成開始処理
  - ポーリング（GET /api/status/{gen_id}）
  - 完了時リダイレクト

---

**2. ダウンロードUIコンポーネント (1-2時間)**
```typescript
// packages/frontend/src/app/download/page.tsx
```

**タスク:**
- [ ] `/download` ページ実装
  - 動画プレビュー再生
  - ダウンロードボタン
  - 「もう一度作る」ボタン
  - SNSシェアボタン（将来的）
- [ ] スタイリング

**成果物:**
- ✅ 生成フローが完全動作
- ✅ 動画ダウンロード可能

---

### Phase 5: テスト・品質向上（Day 9-10 - 2日）

#### Claude の担当（8時間）

**1. Backend テスト強化 (4時間)**
- [ ] ユニットテストカバレッジ向上（目標85%）
- [ ] 統合テスト追加
  - エンドツーエンドフロー
  - エラーケース
  - エッジケース
- [ ] パフォーマンステスト
  - 動画処理速度計測
  - Celeryワーカー負荷テスト
- [ ] セキュリティテスト
  - ファイルアップロード攻撃
  - SQL インジェクション（該当なし）
  - XSS（該当なし）

---

**2. パフォーマンス最適化 (4時間)**
- [ ] FFmpeg パラメータチューニング
  - エンコード速度向上
  - GPU加速（可能なら）
- [ ] Redis キャッシュ最適化
- [ ] Celery ワーカー設定最適化
  - 並列度調整
  - メモリ使用量削減
- [ ] API レスポンス最適化
  - 不要なデータ削減
  - gzip圧縮

**成果物:**
- ✅ テストカバレッジ 85%以上
- ✅ 10秒動画の処理時間 30秒以内

---

#### Cursor の担当（8時間）

**1. E2Eテスト作成 (4時間)**
```typescript
// packages/frontend/tests/e2e/
```

**タスク:**
- [ ] Playwright セットアップ
- [ ] E2Eテストシナリオ作成
  - アップロード→解析→撮影→生成→ダウンロード
  - エラーケース（ファイルサイズ超過など）
  - 撮り直しフロー
- [ ] CI/CD統合

---

**2. UI/UXブラッシュアップ (4時間)**
- [ ] アクセシビリティ改善
  - ARIAラベル追加
  - キーボード操作対応
  - スクリーンリーダー対応
- [ ] レスポンシブデザイン最終調整
  - スマホ対応確認
  - タブレット対応確認
- [ ] マイクロアニメーション追加
  - ページ遷移
  - ボタンホバー
  - ローディング
- [ ] エラーメッセージ改善
  - ユーザーフレンドリーな文言
  - 解決方法の提示
- [ ] パフォーマンス最適化
  - 画像最適化（Next.js Image）
  - コード分割
  - 遅延読み込み

**成果物:**
- ✅ E2Eテスト全シナリオパス
- ✅ Lighthouse スコア 90点以上
- ✅ アクセシビリティ WCAG AA準拠

---

### Phase 6: デプロイ・リリース（Day 11-12 - 2日）

#### Claude の担当（8時間）★メイン担当

**1. Railwayデプロイ設定 (4時間)**
- [ ] Railway プロジェクト作成
- [ ] サービス設定
  - FastAPI (Web)
  - Celery Worker
  - Redis
- [ ] 環境変数設定
  ```
  REDIS_URL=...
  CORS_ORIGINS=https://danceframe.app
  SECRET_KEY=...
  DEBUG=false
  ```
- [ ] Dockerfile最適化
  - マルチステージビルド
  - イメージサイズ削減
- [ ] デプロイ実行
- [ ] ヘルスチェック確認
- [ ] ログモニタリング設定

---

**2. インフラ最終調整 (4時間)**
- [ ] Redis永続化設定
- [ ] Celeryワーカースケーリング
- [ ] バックアップ設定（手動）
- [ ] エラーログ収集（Sentry統合 - 任意）
- [ ] パフォーマンスモニタリング
- [ ] 本番環境テスト
  - スモークテスト
  - 負荷テスト（軽め）
  - エラーハンドリング確認

**成果物:**
- ✅ Backend が本番環境で稼働
- ✅ API が https://api.danceframe.app でアクセス可能
- ✅ Celery Worker が正常動作

---

#### Cursor の担当（6時間）

**1. Vercelデプロイ設定 (3時間)**
- [ ] Vercel プロジェクト作成
- [ ] 環境変数設定
  ```
  NEXT_PUBLIC_API_URL=https://api.danceframe.app
  ```
- [ ] ビルド設定最適化
  - Turbopack有効化
  - 出力最適化
- [ ] デプロイ実行
- [ ] カスタムドメイン設定
  - DNS設定
  - SSL証明書
- [ ] CDN設定確認
- [ ] プレビューデプロイ確認

---

**2. 最終検証・ドキュメント更新 (3時間)**
- [ ] 本番環境E2Eテスト
- [ ] クロスブラウザテスト
  - Chrome
  - Safari
  - Edge
- [ ] モバイルデバイステスト
  - iOS Safari
  - Android Chrome
- [ ] README.md更新
  - 本番URL追加
  - スクリーンショット追加
  - デモ動画追加（任意）
- [ ] リリースノート作成

**成果物:**
- ✅ Frontend が https://danceframe.app でアクセス可能
- ✅ 全ブラウザで動作確認
- ✅ ドキュメント完備

---

## 📊 工数見積もりサマリー

### Claude（合計: 40-50時間）

| フェーズ | 作業内容 | 時間 |
|---------|---------|------|
| Phase 0 | Backend環境構築 | 2h |
| Phase 1 | 動画解析API・サービス | 6-8h |
| Phase 2 | ポーズ比較ロジック・レビュー | 4-6h |
| Phase 3 | レビュー・サポート | 1h |
| Phase 4 | 動画生成API・Celeryタスク | 6-8h |
| Phase 5 | テスト・パフォーマンス最適化 | 8h |
| Phase 6 | Railwayデプロイ・インフラ | 8h |
| **合計** | | **35-41h** |

### Cursor（合計: 45-55時間）

| フェーズ | 作業内容 | 時間 |
|---------|---------|------|
| Phase 0 | Frontend環境構築 | 2h |
| Phase 1 | アップロードUI・API統合 | 6-8h |
| Phase 2 | MediaPipe統合・撮影UI | 12-16h |
| Phase 3 | レビューUI | 3-4h |
| Phase 4 | 生成UI・ダウンロードUI | 3-4h |
| Phase 5 | E2Eテスト・UI/UXブラッシュアップ | 8h |
| Phase 6 | Vercelデプロイ・最終検証 | 6h |
| **合計** | | **40-48h** |

---

## 🔄 デイリースタンドアップ例

### Day 3 の例

**Claude:**
```markdown
**Yesterday:**
- ✅ FrameExtractor実装完了
- ✅ FrameHashAnalyzer実装完了
- ⏳ PoseEstimator 50%完了

**Today:**
- 🎯 PoseEstimator完成
- 🎯 analyze_video_task実装
- 🎯 /api/analyze エンドポイント実装

**Blockers:**
- なし
```

**Cursor:**
```markdown
**Yesterday:**
- ✅ FileUploader コンポーネント完成
- ✅ ProgressBar コンポーネント完成
- ✅ Zustand ストア基本実装

**Today:**
- 🎯 API統合（uploadVideo, getAnalysisStatus）
- 🎯 /analysis ページ実装
- 🎯 E2Eテスト作成開始

**Blockers:**
- なし（ClaudeのAPI完成待ち → 午後には完成予定）
```

---

## 🎯 完了チェックリスト

### Claude の完了条件

**Phase 1-4 (Backend開発):**
- [ ] 全APIエンドポイント実装完了
- [ ] Swagger ドキュメント完備
- [ ] ユニットテストカバレッジ 80%以上
- [ ] 統合テストパス
- [ ] エラーハンドリング完備
- [ ] ログ出力適切
- [ ] パフォーマンス目標達成
  - 10秒動画を30秒以内で処理
  - API レスポンス 500ms以内

**Phase 5-6 (テスト・デプロイ):**
- [ ] セキュリティテストパス
- [ ] 負荷テスト実施
- [ ] Railway デプロイ成功
- [ ] 本番環境ヘルスチェックOK
- [ ] モニタリング設定完了

---

### Cursor の完了条件

**Phase 1-4 (Frontend開発):**
- [ ] 全ページコンポーネント実装完了
- [ ] レスポンシブデザイン対応
- [ ] クロスブラウザ対応（Chrome, Safari, Edge）
- [ ] コンポーネントテストカバレッジ 70%以上
- [ ] アクセシビリティ WCAG AA準拠
- [ ] パフォーマンス目標達成
  - Lighthouse Performance 90点以上
  - First Contentful Paint < 1.5s

**Phase 5-6 (テスト・デプロイ):**
- [ ] E2Eテスト全シナリオパス
- [ ] Vercel デプロイ成功
- [ ] カスタムドメイン設定完了
- [ ] 本番環境動作確認OK
- [ ] ドキュメント更新完了

---

## 💡 効率化のヒント

### 並行作業のコツ

1. **API仕様を先に確定**
   - Claude が API設計書作成
   - Cursor がレビュー・承認
   - 両者が並行して実装開始

2. **モックデータの活用**
   - Cursor はモックデータでUI開発
   - Claude のAPI完成を待たずに進行可能

3. **定期的な統合テスト**
   - 1日1回は統合確認
   - 早期に問題発見

### コミュニケーションのコツ

1. **非同期優先**
   - GitHub Issue/PRでの議論
   - 即座の返答を期待しない

2. **同期は短く**
   - 1日1回15分以内
   - 必要事項のみ

3. **ドキュメントファースト**
   - 口頭説明よりドキュメント
   - 後から見返せる

---

**Document Version**: 1.0
**Last Updated**: 2025-11-16
**Team**: Claude (Lead) + Cursor (Developer)
