# DanceFrame - 技術仕様書 v2.0

**最終更新**: 2025-11-16
**バージョン**: 2.0 (2025年ベストプラクティス対応版)
**著者**: Kosuke Terada & Claude

---

## 📋 目次

1. [変更履歴](#変更履歴)
2. [プロジェクト概要](#プロジェクト概要)
3. [技術スタック（更新版）](#技術スタック更新版)
4. [アーキテクチャ設計](#アーキテクチャ設計)
5. [機能要件](#機能要件)
6. [API仕様](#api仕様)
7. [主要コンポーネント実装](#主要コンポーネント実装)
8. [データベース設計](#データベース設計)
9. [セキュリティ](#セキュリティ)
10. [パフォーマンス最適化](#パフォーマンス最適化)

---

## 🔄 変更履歴

### v2.0 (2025-11-16) - メジャーアップデート

#### **重大な変更**

1. **MediaPipe移行** 🔴 BREAKING CHANGE
   - `@mediapipe/pose` (非推奨) → `@mediapipe/tasks-vision` (最新)
   - 理由: 旧パッケージは2023年3月にサポート終了
   - 影響: ポーズ推定APIが完全に変更

2. **Next.js & React アップグレード** 🔴 BREAKING CHANGE
   - Next.js: 14.2.x → 16.0
   - React: 18.3.1 → 19.2.0
   - 理由: Turbopack安定版、React Compiler対応
   - 影響: ビルド速度5-10倍向上、自動最適化

3. **バックグラウンド処理追加** ⚠️ ARCHITECTURE CHANGE
   - Celery + Redis の導入
   - 理由: CPU集約的な動画処理の非同期化
   - 影響: スケーラビリティとUX向上

#### **マイナーアップデート**

- Zustand: 4.5.2 → 5.0.8
- ffmpeg-python の適切な使用パターン追加
- WebSocket による進捗通知機能

#### **参考資料**

- [MediaPipe Tasks Vision Migration Guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [React 19.2 Documentation](https://react.dev/blog/2025/01/15/react-19-2)
- [FastAPI Background Tasks Best Practices](https://fastapi.tiangolo.com/tutorial/background-tasks/)

---

## 📋 プロジェクト概要

### コンセプト

手描きループアニメーション動画から原画を抽出し、ユーザーが同じポーズを撮影することで「自分が踊ってみた」風の動画を自動生成するWebアプリケーション。

### ターゲットユーザー

- **初期（MVP）**: 開発者本人
- **短期（v1.x）**: クリエイター、アーティスト
- **中期（v2.x）**: 一般SNSユーザー

### 主要な価値提供

1. **自動化**: 手動でのフレーム選定不要
2. **楽しさ**: ゲーム感覚の撮影体験
3. **クオリティ**: AI駆動の高精度マッチング
4. **即時性**: 数分で完成動画を取得

---

## 🛠️ 技術スタック（更新版）

### Frontend

| 技術 | バージョン | 選定理由 | 公式ドキュメント |
|------|-----------|----------|-----------------|
| **Next.js** | **16.0** | ✅ Turbopack安定版（5-10倍高速化）<br>✅ PPR（Partial Pre-Rendering）<br>✅ React Compiler統合 | [nextjs.org](https://nextjs.org/blog/next-16) |
| **React** | **19.2** | ✅ View Transitions API<br>✅ useEffectEvent フック<br>✅ 自動最適化 | [react.dev](https://react.dev/) |
| **TypeScript** | 5.3+ | 型安全性、IDE補完 | [typescriptlang.org](https://www.typescriptlang.org/) |
| **MediaPipe Tasks Vision** | **0.10.15** | ✅ 最新のPose Landmarker API<br>✅ WASM + GPU加速<br>⚠️ `@mediapipe/pose`は非推奨 | [ai.google.dev](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) |
| **Zustand** | **5.0.8** | 軽量（1KB）、シンプルAPI、React 19対応 | [zustand.docs.pmnd.rs](https://zustand.docs.pmnd.rs/) |
| **Tailwind CSS** | 3.4+ | ユーティリティファースト、JIT | [tailwindcss.com](https://tailwindcss.com/) |
| **Framer Motion** | 11.0+ | View Transitions対応、宣言的アニメーション | [framer.com/motion](https://www.framer.com/motion/) |

### Backend

| 技術 | バージョン | 選定理由 | 公式ドキュメント |
|------|-----------|----------|-----------------|
| **FastAPI** | 0.115+ | 高速、自動ドキュメント生成、async対応 | [fastapi.tiangolo.com](https://fastapi.tiangolo.com/) |
| **Celery** | **5.4** | ✅ CPU集約的タスクの非同期処理<br>✅ スケーラビリティ | [docs.celeryproject.org](https://docs.celeryproject.org/) |
| **Redis** | 7.2+ | 高速、メッセージブローカー、キャッシュ | [redis.io](https://redis.io/) |
| **Python** | 3.11+ | 高速、型ヒント、豊富なライブラリ | [python.org](https://www.python.org/) |
| **FFmpeg** | 6.1+ | 業界標準、高性能動画処理 | [ffmpeg.org](https://ffmpeg.org/) |
| **ffmpeg-python** | 0.2.0 | Pythonic API、可読性 | [kkroening.github.io](https://kkroening.github.io/ffmpeg-python/) |
| **MediaPipe** | 0.10.14 | バックエンド版骨格推定 | [google.github.io/mediapipe](https://google.github.io/mediapipe/) |
| **imagehash** | 4.3.1 | 知覚ハッシュ、重複検出 | [github.com/JohannesBuchner](https://github.com/JohannesBuchner/imagehash) |
| **OpenCV** | 4.10+ | 画像処理、コンピュータビジョン | [opencv.org](https://opencv.org/) |

---

## 🏗️ アーキテクチャ設計

### システム全体図

```
┌──────────────────────────────────────────────────────────────┐
│                    Client (Browser)                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js 16 (App Router + React 19.2)                  │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  MediaPipe Tasks Vision (WASM + GPU)             │  │  │
│  │  │  - PoseLandmarker.detectForVideo()               │  │  │
│  │  │  - Real-time pose estimation (30+ FPS)           │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Zustand Store (Global State)                    │  │  │
│  │  │  - Job metadata                                  │  │  │
│  │  │  - Captured images                               │  │  │
│  │  │  - UI state                                      │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTPS
                        │ REST API (JSON)
                        │ WebSocket (進捗通知)
                        ↓
┌──────────────────────────────────────────────────────────────┐
│              Vercel / Cloud Platform (Frontend)              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js Server (SSR + API Routes)                    │  │
│  │  - Edge Runtime                                       │  │
│  │  - Middleware (auth, rate limiting)                   │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ↓
┌──────────────────────────────────────────────────────────────┐
│          Railway / Render (Backend Infrastructure)           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  FastAPI Server (Uvicorn + Gunicorn)                  │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  API Endpoints (async)                           │ │  │
│  │  │  - POST /api/upload                              │ │  │
│  │  │  - GET  /api/analyze/{job_id}                    │ │  │
│  │  │  - POST /api/generate                            │ │  │
│  │  │  - GET  /api/status/{job_id}                     │ │  │
│  │  │  - WS   /ws/progress/{job_id}                    │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────┴───────────────────────────────────┐  │
│  │  Celery Workers (CPU-bound Background Tasks)          │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Worker 1: Video Analysis                        │ │  │
│  │  │  - extract_frames_task()                         │ │  │
│  │  │  - analyze_hashes_task()                         │ │  │
│  │  │  - estimate_poses_task()                         │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Worker 2: Video Composition                     │ │  │
│  │  │  - compose_video_task()                          │ │  │
│  │  │  - merge_audio_task()                            │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       ↓                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Redis (Message Broker + Result Backend)              │  │
│  │  - Task queue: celery:tasks                           │  │
│  │  - Results: celery:results                            │  │
│  │  - Session cache: sessions:*                          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  File Storage (Ephemeral)                             │  │
│  │  - /uploads/{job_id}/original.mp4                     │  │
│  │  - /outputs/{job_id}/frames/                          │  │
│  │  - /outputs/{job_id}/mapping.json                     │  │
│  │  - /outputs/{job_id}/final.mp4                        │  │
│  │  (自動削除: 24時間後)                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### データフロー詳細

#### 1. アップロード → 解析フェーズ

```
[Client]
  │
  ├─ 1. POST /api/upload
  │   Body: multipart/form-data (video file)
  │   ↓
[FastAPI]
  │
  ├─ 2. Save to /uploads/{job_id}/original.mp4
  │
  ├─ 3. Enqueue Celery task: analyze_video_task.delay(job_id)
  │   ↓
[Celery Worker]
  │
  ├─ 4. Extract audio → /outputs/{job_id}/audio.mp3
  │      ffmpeg.input(video).output(audio, acodec='mp3').run()
  │
  ├─ 5. Extract frames → /outputs/{job_id}/frames/frame_*.png
  │      ffmpeg.input(video).output(pattern, vf='fps=24').run()
  │
  ├─ 6. Calculate perceptual hashes (imagehash.phash)
  │
  ├─ 7. Group similar frames (Hamming distance < 5)
  │
  ├─ 8. Select unique representatives
  │
  ├─ 9. Pose estimation (MediaPipe) on unique frames
  │
  ├─ 10. Generate mapping.json
  │       {
  │         "frame_mapping": {0: 0, 1: 1, 2: 0, ...},
  │         "unique_frames": [{id, path, landmarks}, ...],
  │         "metadata": {fps, duration, ...}
  │       }
  │
  └─ 11. Update Redis: job_status = "completed"
         Publish WebSocket: progress 100%
         ↓
[Client]
  │
  └─ 12. Poll GET /api/analyze/{job_id} or receive WebSocket notification
         → Navigate to capture screen
```

#### 2. 撮影フェーズ（クライアント側）

```
[Client Browser]
  │
  ├─ 1. Initialize MediaPipe PoseLandmarker
  │      const vision = await FilesetResolver.forVisionTasks(CDN_URL)
  │      const landmarker = await PoseLandmarker.createFromOptions(...)
  │
  ├─ 2. Start camera (getUserMedia)
  │
  ├─ 3. Real-time loop (requestAnimationFrame):
  │      │
  │      ├─ a. landmarker.detectForVideo(videoElement, timestamp)
  │      │     → Get current pose landmarks
  │      │
  │      ├─ b. calculatePoseSimilarity(targetPose, currentPose)
  │      │     → Compute 3D Euclidean distance for key joints
  │      │     → Convert to percentage (0-100%)
  │      │
  │      ├─ c. Update UI (similarity meter, overlay)
  │      │
  │      └─ d. If similarity >= 85%:
  │            - Capture canvas.toBlob()
  │            - Play shutter sound
  │            - Store in Zustand: capturedImages.push(blob)
  │            - Auto-advance to next pose
  │
  └─ 4. All poses captured → Navigate to review screen
```

#### 3. 動画生成フェーズ

```
[Client]
  │
  ├─ 1. POST /api/generate
  │      Body: {
  │        job_id,
  │        captured_frames: [
  │          {unique_frame_id: 0, image: "base64..."},
  │          ...
  │        ]
  │      }
  │      ↓
[FastAPI]
  │
  ├─ 2. Save images → /outputs/{job_id}/captured/frame_{id}.jpg
  │
  ├─ 3. Enqueue: compose_video_task.delay(job_id)
  │      ↓
[Celery Worker]
  │
  ├─ 4. Load mapping.json
  │
  ├─ 5. For each original frame index:
  │      unique_id = mapping[frame_index]
  │      if captured[unique_id] exists:
  │        copy captured[unique_id] → /composed_frames/frame_{index}.png
  │      else:
  │        copy original_unique[unique_id] → /composed_frames/frame_{index}.png
  │
  ├─ 6. Generate video from frames:
  │      ffmpeg
  │        .input('/composed_frames/frame_%04d.png', framerate=24)
  │        .output('/temp_video.mp4', vcodec='libx264', pix_fmt='yuv420p')
  │        .run()
  │
  ├─ 7. Merge audio:
  │      video = ffmpeg.input('/temp_video.mp4')
  │      audio = ffmpeg.input('/audio.mp3')
  │      ffmpeg
  │        .output(video, audio, '/final.mp4', vcodec='copy', acodec='aac')
  │        .run()
  │
  └─ 8. Update Redis: generation_status = "completed"
         ↓
[Client]
  │
  └─ 9. GET /api/download/{job_id}/final.mp4
         → Download and play
```

---

## 🎯 機能要件

### MVP (v1.0) - 必須機能

#### 1. 動画アップロード

**要件:**
- 対応形式: MP4, GIF
- 最大サイズ: 100MB
- 最大長さ: 30秒
- 最小解像度: 480p
- 最大解像度: 1080p

**検証ルール:**
```python
ALLOWED_EXTENSIONS = {"mp4", "gif"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_DURATION = 30  # seconds

def validate_upload(file: UploadFile):
    # MIMEタイプチェック
    if file.content_type not in ["video/mp4", "image/gif"]:
        raise HTTPException(400, "Invalid file type")

    # ファイルサイズチェック
    file.file.seek(0, 2)  # EOF
    size = file.file.tell()
    file.file.seek(0)  # Reset
    if size > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    # 動画メタデータチェック（FFprobe）
    metadata = get_video_metadata(file)
    if metadata["duration"] > MAX_DURATION:
        raise HTTPException(400, "Video too long")
```

#### 2. 動画解析

**処理ステップ:**

| ステップ | 処理内容 | 使用技術 | 推定時間 |
|---------|---------|---------|---------|
| 1. 音源抽出 | 動画からオーディオトラックを分離 | FFmpeg | 1-2秒 |
| 2. フレーム抽出 | 24fpsで正規化してPNG出力 | FFmpeg | 3-5秒 |
| 3. ハッシュ計算 | 知覚ハッシュ（pHash）計算 | imagehash | 2-3秒 |
| 4. 重複検出 | ハミング距離でグルーピング | Python | 1秒 |
| 5. 骨格推定 | ユニークフレームで33点検出 | MediaPipe | 5-10秒 |
| 6. マッピング生成 | JSON出力 | Python | <1秒 |

**出力データ構造:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "metadata": {
    "original_fps": 24,
    "duration": 5.0,
    "total_frames": 120,
    "unique_count": 12,
    "resolution": "1920x1080"
  },
  "frame_mapping": {
    "0": 0,
    "1": 1,
    "2": 0,
    "3": 2,
    ...
  },
  "unique_frames": [
    {
      "id": 0,
      "thumbnail": "data:image/png;base64,iVBORw0KG...",
      "pose_landmarks": {
        "landmarks": [
          {"x": 0.5123, "y": 0.2456, "z": -0.0123, "visibility": 0.995},
          {"x": 0.4987, "y": 0.1234, "z": -0.0234, "visibility": 0.987},
          ...  // 33 landmarks total
        ]
      }
    },
    ...
  ]
}
```

#### 3. リアルタイムポーズマッチング

**仕様:**

| 項目 | 値 | 根拠 |
|------|-----|------|
| フレームレート | 30+ FPS | MediaPipe WASM性能 |
| 類似度閾値 | 85% | 経験的調整値 |
| タイムアウト | 5秒/ポーズ | UXバランス |
| キー関節点数 | 13点 | 主要関節のみ使用 |

**類似度計算アルゴリズム:**

```typescript
const KEY_POINTS = [
  0,  // nose
  11, 12, // shoulders
  13, 14, // elbows
  15, 16, // wrists
  23, 24, // hips
  25, 26, // knees
  27, 28, // ankles
];

function calculatePoseSimilarity(
  reference: PoseLandmarks,
  current: PoseLandmarks
): number {
  let totalDistance = 0;
  let validPoints = 0;

  for (const idx of KEY_POINTS) {
    const ref = reference.landmarks[idx];
    const cur = current.landmarks[idx];

    // 信頼度フィルタリング
    if (ref.visibility < 0.5 || cur.visibility < 0.5) continue;

    // 3Dユークリッド距離
    const distance = Math.sqrt(
      (ref.x - cur.x) ** 2 +
      (ref.y - cur.y) ** 2 +
      (ref.z - cur.z) ** 2
    );

    totalDistance += distance;
    validPoints++;
  }

  if (validPoints === 0) return 0;

  const avgDistance = totalDistance / validPoints;

  // スケーリング係数（経験的調整）
  const SCALE_FACTOR = 200;
  const similarity = Math.max(0, Math.min(100, 100 - avgDistance * SCALE_FACTOR));

  return Math.round(similarity);
}
```

#### 4. 自動シャッター

**ロジック:**
```typescript
class AutoShutter {
  private threshold = 85;
  private cooldown = 500; // ms
  private lastCapture = 0;

  async checkAndCapture(
    similarity: number,
    videoElement: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ): Promise<Blob | null> {
    const now = Date.now();

    // クールダウン中は撮影しない
    if (now - this.lastCapture < this.cooldown) {
      return null;
    }

    // 閾値チェック
    if (similarity >= this.threshold) {
      // フラッシュエフェクト
      this.showFlash();

      // シャッター音
      this.playSound('/sounds/shutter.mp3');

      // キャプチャ
      const blob = await this.captureFrame(videoElement, canvas);

      this.lastCapture = now;
      return blob;
    }

    return null;
  }

  private async captureFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ): Promise<Blob> {
    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob!),
        'image/jpeg',
        0.92  // 高品質
      );
    });
  }
}
```

#### 5. 動画生成

**仕様:**

- 出力形式: MP4 (H.264 + AAC)
- ビットレート: 2Mbps (動画), 192kbps (音声)
- 解像度: 元動画と同じ
- フレームレート: 24fps

**実装:**
```python
def compose_video(
    job_id: str,
    frame_mapping: Dict[int, int],
    unique_frames: List[str],
    captured_images: Dict[int, str],
    audio_path: str,
    output_path: str,
    fps: int = 24
) -> str:
    composed_dir = Path(f"/tmp/{job_id}/composed")
    composed_dir.mkdir(parents=True, exist_ok=True)

    # フレーム配置
    for frame_idx, unique_id in frame_mapping.items():
        source = captured_images.get(unique_id) or unique_frames[unique_id]
        dest = composed_dir / f"frame_{frame_idx:04d}.png"
        shutil.copy(source, dest)

    # 動画生成（音声なし）
    temp_video = f"/tmp/{job_id}/temp.mp4"
    (
        ffmpeg
        .input(str(composed_dir / "frame_%04d.png"), framerate=fps)
        .output(
            temp_video,
            vcodec='libx264',
            pix_fmt='yuv420p',
            video_bitrate='2M',
            preset='medium'
        )
        .overwrite_output()
        .run(capture_stdout=True, capture_stderr=True)
    )

    # 音声マージ
    video_stream = ffmpeg.input(temp_video)
    audio_stream = ffmpeg.input(audio_path)
    (
        ffmpeg
        .output(
            video_stream,
            audio_stream,
            output_path,
            vcodec='copy',
            acodec='aac',
            audio_bitrate='192k',
            shortest=None  # 短い方に合わせる
        )
        .overwrite_output()
        .run(capture_stdout=True, capture_stderr=True)
    )

    return output_path
```

---

## 🔌 API仕様

### Base URL

- **開発**: `http://localhost:8000`
- **本番**: `https://api.danceframe.app`

### 認証

**v1.0**: 認証なし（単一ユーザー想定）
**v2.0以降**: JWT Bearer Token

### エンドポイント一覧

#### 1. POST /api/upload

**動画ファイルをアップロードして解析を開始**

**Request:**
```http
POST /api/upload HTTP/1.1
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="dance.mp4"
Content-Type: video/mp4

[binary data]
------WebKitFormBoundary--
```

**Response (202 Accepted):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Analysis started. Check /api/analyze/{job_id} for progress."
}
```

**Error Responses:**
```json
// 400 Bad Request
{
  "detail": "Invalid file type. Allowed: mp4, gif"
}

// 413 Payload Too Large
{
  "detail": "File size exceeds 100MB limit"
}

// 422 Unprocessable Entity
{
  "detail": "Video duration exceeds 30s limit"
}
```

---

#### 2. GET /api/analyze/{job_id}

**解析ジョブのステータスと結果を取得**

**Request:**
```http
GET /api/analyze/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**Response (200 OK) - Processing:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 65,
  "current_step": "Estimating poses...",
  "eta_seconds": 15
}
```

**Response (200 OK) - Completed:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "original_fps": 24,
    "duration": 5.0,
    "total_frames": 120,
    "unique_count": 12,
    "resolution": "1920x1080"
  },
  "frame_mapping": {
    "0": 0,
    "1": 1,
    "2": 0
    // ... 120 entries
  },
  "unique_frames": [
    {
      "id": 0,
      "thumbnail": "data:image/png;base64,iVBORw0KG...",
      "pose_landmarks": {
        "landmarks": [
          {"x": 0.5, "y": 0.3, "z": -0.1, "visibility": 0.99},
          // ... 33 landmarks
        ]
      }
    }
    // ... 12 unique frames
  ]
}
```

**Error Responses:**
```json
// 404 Not Found
{
  "detail": "Job not found"
}

// 500 Internal Server Error
{
  "detail": "Analysis failed: FFmpeg error",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "error_log": "..."
}
```

---

#### 3. POST /api/generate

**撮影画像から動画を生成**

**Request:**
```http
POST /api/generate HTTP/1.1
Content-Type: application/json

{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "captured_frames": [
    {
      "unique_frame_id": 0,
      "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    },
    {
      "unique_frame_id": 1,
      "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    }
    // ... captured images
  ]
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "generation_id": "gen_abc123",
  "status": "processing",
  "message": "Video generation started. Check /api/status/{generation_id}"
}
```

---

#### 4. GET /api/status/{generation_id}

**動画生成の進捗を取得**

**Request:**
```http
GET /api/status/gen_abc123 HTTP/1.1
```

**Response (200 OK) - Processing:**
```json
{
  "generation_id": "gen_abc123",
  "status": "processing",
  "progress": 75,
  "current_step": "Merging audio...",
  "eta_seconds": 8
}
```

**Response (200 OK) - Completed:**
```json
{
  "generation_id": "gen_abc123",
  "status": "completed",
  "progress": 100,
  "video_url": "/api/download/550e8400-e29b-41d4-a716-446655440000/final.mp4",
  "video_size_bytes": 15728640,
  "duration_seconds": 5.0
}
```

---

#### 5. GET /api/download/{job_id}/final.mp4

**完成動画をダウンロード**

**Request:**
```http
GET /api/download/550e8400-e29b-41d4-a716-446655440000/final.mp4 HTTP/1.1
```

**Response (200 OK):**
```http
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 15728640
Content-Disposition: attachment; filename="dance_550e8400.mp4"
Cache-Control: public, max-age=3600

[binary video data]
```

---

#### 6. WebSocket: /ws/progress/{job_id}

**リアルタイム進捗通知（オプション）**

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/progress/550e8400-e29b-41d4-a716-446655440000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
  // {
  //   "type": "progress",
  //   "progress": 65,
  //   "step": "Estimating poses...",
  //   "eta": 15
  // }
};
```

---

## 💻 主要コンポーネント実装

### Frontend: MediaPipe PoseLandmarker統合（v2.0対応）

```typescript
// packages/frontend/src/hooks/useMediaPipe.ts

import { useEffect, useRef, useState } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  PoseLandmarkerResult
} from '@mediapipe/tasks-vision';

interface UseMediaPipeOptions {
  onResults: (results: PoseLandmarkerResult) => void;
  modelComplexity?: 0 | 1 | 2;  // 0: Lite, 1: Full, 2: Heavy
  runningMode?: 'IMAGE' | 'VIDEO';
}

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseMediaPipeOptions
) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    let isMounted = true;

    async function initializeLandmarker() {
      try {
        // Vision tasks用のwasmファイルを読み込み
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // PoseLandmarkerを作成
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${
              options.modelComplexity === 0 ? 'lite' :
              options.modelComplexity === 2 ? 'heavy' : 'full'
            }/float16/1/pose_landmarker_${
              options.modelComplexity === 0 ? 'lite' :
              options.modelComplexity === 2 ? 'heavy' : 'full'
            }.task`,
            delegate: 'GPU'  // GPU加速を有効化
          },
          runningMode: options.runningMode || 'VIDEO',
          numPoses: 1,  // 1人のポーズのみ検出
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize MediaPipe');
        }
      }
    }

    initializeLandmarker();

    return () => {
      isMounted = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      landmarkerRef.current?.close();
    };
  }, [options.modelComplexity, options.runningMode]);

  // ビデオストリームからリアルタイム検出
  useEffect(() => {
    if (!isReady || !videoRef.current || !landmarkerRef.current) return;

    const video = videoRef.current;
    let lastVideoTime = -1;

    async function detectPose() {
      if (!video || !landmarkerRef.current) return;

      const now = performance.now();

      // 新しいフレームの場合のみ処理
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          const results = landmarkerRef.current.detectForVideo(video, now);
          options.onResults(results);
        } catch (err) {
          console.error('Pose detection error:', err);
        }
      }

      // 次のフレームをリクエスト
      animationFrameId.current = requestAnimationFrame(detectPose);
    }

    // 検出ループ開始
    detectPose();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isReady, videoRef, options]);

  return { isReady, error };
}
```

### Frontend: ポーズ類似度計算（改良版）

```typescript
// packages/frontend/src/lib/poseComparison.ts

import { PoseLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

// MediaPipe Pose ランドマークインデックス
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
const LANDMARK_INDICES = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const KEY_POINTS = Object.values(LANDMARK_INDICES);

export interface PoseComparisonResult {
  similarity: number;  // 0-100
  details: {
    validPoints: number;
    averageDistance: number;
    maxDistance: number;
    minDistance: number;
  };
}

/**
 * 2つのポーズの類似度を計算
 *
 * @param reference 目標ポーズ（元動画から抽出）
 * @param current 現在のポーズ（カメラから取得）
 * @returns 類似度（0-100%）と詳細情報
 */
export function calculatePoseSimilarity(
  reference: NormalizedLandmark[],
  current: NormalizedLandmark[]
): PoseComparisonResult {
  if (!reference?.length || !current?.length) {
    return {
      similarity: 0,
      details: { validPoints: 0, averageDistance: 1, maxDistance: 1, minDistance: 1 }
    };
  }

  const distances: number[] = [];

  for (const idx of KEY_POINTS) {
    const ref = reference[idx];
    const cur = current[idx];

    // 信頼度が低い点はスキップ
    if (!ref || !cur || ref.visibility < 0.5 || cur.visibility < 0.5) {
      continue;
    }

    // 3Dユークリッド距離を計算
    const distance = Math.sqrt(
      Math.pow(ref.x - cur.x, 2) +
      Math.pow(ref.y - cur.y, 2) +
      Math.pow(ref.z - cur.z, 2)
    );

    distances.push(distance);
  }

  if (distances.length === 0) {
    return {
      similarity: 0,
      details: { validPoints: 0, averageDistance: 1, maxDistance: 1, minDistance: 1 }
    };
  }

  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances);

  // スケーリング係数（経験的に調整）
  // 平均距離0.005で類似度100%, 0.01で50%, 0.015で0%程度
  const SCALE_FACTOR = 200;
  const similarity = Math.max(0, Math.min(100, 100 - avgDistance * SCALE_FACTOR));

  return {
    similarity: Math.round(similarity),
    details: {
      validPoints: distances.length,
      averageDistance: avgDistance,
      maxDistance,
      minDistance
    }
  };
}

/**
 * 角度ベースの類似度計算（補助的）
 * より厳密な判定が必要な場合に使用
 */
export function calculateAngleSimilarity(
  reference: NormalizedLandmark[],
  current: NormalizedLandmark[]
): number {
  // 主要な関節角度を計算
  const angles = [
    // 左肘の角度
    { joint: LANDMARK_INDICES.LEFT_ELBOW, prev: LANDMARK_INDICES.LEFT_SHOULDER, next: LANDMARK_INDICES.LEFT_WRIST },
    // 右肘の角度
    { joint: LANDMARK_INDICES.RIGHT_ELBOW, prev: LANDMARK_INDICES.RIGHT_SHOULDER, next: LANDMARK_INDICES.RIGHT_WRIST },
    // 左膝の角度
    { joint: LANDMARK_INDICES.LEFT_KNEE, prev: LANDMARK_INDICES.LEFT_HIP, next: LANDMARK_INDICES.LEFT_ANKLE },
    // 右膝の角度
    { joint: LANDMARK_INDICES.RIGHT_KNEE, prev: LANDMARK_INDICES.RIGHT_HIP, next: LANDMARK_INDICES.RIGHT_ANKLE },
  ];

  let totalAngleDiff = 0;
  let validAngles = 0;

  for (const { joint, prev, next } of angles) {
    const refAngle = calculateAngle(reference[prev], reference[joint], reference[next]);
    const curAngle = calculateAngle(current[prev], current[joint], current[next]);

    if (refAngle !== null && curAngle !== null) {
      const diff = Math.abs(refAngle - curAngle);
      totalAngleDiff += Math.min(diff, 360 - diff);  // 角度差の最小値
      validAngles++;
    }
  }

  if (validAngles === 0) return 0;

  const avgAngleDiff = totalAngleDiff / validAngles;

  // 角度差0度で100%, 45度で50%, 90度で0%
  const similarity = Math.max(0, 100 - (avgAngleDiff / 90) * 100);

  return Math.round(similarity);
}

function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number | null {
  if (!a || !b || !c) return null;

  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}
```

### Backend: Celeryタスク定義

```python
# packages/backend/app/celery_worker.py

from celery import Celery
from celery.signals import task_prerun, task_postrun
from app.config import settings
import logging

# Celeryアプリケーション初期化
celery_app = Celery(
    'danceframe',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Tokyo',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10分タイムアウト
    task_soft_time_limit=540,  # 9分ソフトリミット
    worker_prefetch_multiplier=1,  # 1タスクずつ処理
    worker_max_tasks_per_child=50,  # 50タスクごとにワーカー再起動
)

logger = logging.getLogger(__name__)

@task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    logger.info(f"Task {task.name} [{task_id}] started")

@task_postrun.connect
def task_postrun_handler(task_id, task, *args, **kwargs):
    logger.info(f"Task {task.name} [{task_id}] completed")
```

```python
# packages/backend/app/tasks/video_analysis.py

from app.celery_worker import celery_app
from app.services.frame_extractor import FrameExtractor
from app.services.hash_analyzer import FrameHashAnalyzer
from app.services.pose_estimator import PoseEstimator
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name='tasks.analyze_video')
def analyze_video_task(self, job_id: str, video_path: str):
    """
    動画解析タスク

    Args:
        job_id: ジョブID
        video_path: 動画ファイルパス

    Returns:
        dict: 解析結果
    """
    try:
        output_dir = Path(f"/app/outputs/{job_id}")
        output_dir.mkdir(parents=True, exist_ok=True)

        # ステップ1: 音源抽出
        self.update_state(state='PROGRESS', meta={'step': 'Extracting audio', 'progress': 10})
        extractor = FrameExtractor(str(output_dir))
        audio_path = output_dir / "audio.mp3"
        extractor.extract_audio(video_path, str(audio_path))

        # ステップ2: フレーム抽出
        self.update_state(state='PROGRESS', meta={'step': 'Extracting frames', 'progress': 25})
        frame_data = extractor.extract_frames(video_path)

        # ステップ3: ハッシュ解析
        self.update_state(state='PROGRESS', meta={'step': 'Analyzing duplicates', 'progress': 45})
        analyzer = FrameHashAnalyzer(hamming_threshold=5)
        hash_result = analyzer.analyze_frames(frame_data['frames'])

        # ステップ4: 骨格推定
        self.update_state(state='PROGRESS', meta={'step': 'Estimating poses', 'progress': 60})
        estimator = PoseEstimator()
        unique_frames_with_poses = []

        for i, frame_path in enumerate(hash_result['unique_frames']):
            progress = 60 + int((i / len(hash_result['unique_frames'])) * 30)
            self.update_state(
                state='PROGRESS',
                meta={'step': f'Pose estimation {i+1}/{len(hash_result["unique_frames"])}', 'progress': progress}
            )

            landmarks = estimator.estimate_pose(frame_path)
            thumbnail = estimator.generate_thumbnail(frame_path, landmarks)

            unique_frames_with_poses.append({
                'id': i,
                'path': frame_path,
                'thumbnail': thumbnail,
                'pose_landmarks': landmarks
            })

        # ステップ5: マッピングJSON生成
        self.update_state(state='PROGRESS', meta={'step': 'Generating mapping', 'progress': 95})
        result = {
            'job_id': job_id,
            'status': 'completed',
            'metadata': {
                'original_fps': frame_data['fps'],
                'duration': frame_data['duration'],
                'total_frames': hash_result['total_frames'],
                'unique_count': hash_result['unique_count']
            },
            'frame_mapping': hash_result['frame_mapping'],
            'unique_frames': unique_frames_with_poses
        }

        # JSONファイルに保存
        mapping_path = output_dir / "mapping.json"
        with open(mapping_path, 'w') as f:
            json.dump(result, f, indent=2)

        return result

    except Exception as e:
        logger.error(f"Analysis task failed for job {job_id}: {e}", exc_info=True)
        raise
```

```python
# packages/backend/app/tasks/video_composition.py

from app.celery_worker import celery_app
from app.services.video_composer import VideoComposer
from pathlib import Path
import json
import base64
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name='tasks.compose_video')
def compose_video_task(self, job_id: str, captured_frames: list):
    """
    動画合成タスク

    Args:
        job_id: ジョブID
        captured_frames: 撮影画像リスト
            [{"unique_frame_id": 0, "image": "base64..."}, ...]

    Returns:
        dict: 生成結果
    """
    try:
        output_dir = Path(f"/app/outputs/{job_id}")

        # マッピング読み込み
        mapping_path = output_dir / "mapping.json"
        with open(mapping_path, 'r') as f:
            mapping_data = json.load(f)

        # 撮影画像を保存
        self.update_state(state='PROGRESS', meta={'step': 'Saving captured images', 'progress': 10})
        captured_dir = output_dir / "captured"
        captured_dir.mkdir(exist_ok=True)

        captured_paths = {}
        for item in captured_frames:
            unique_id = item['unique_frame_id']
            image_data = item['image'].split(',')[1]  # "data:image/jpeg;base64," を除去
            image_bytes = base64.b64decode(image_data)

            image_path = captured_dir / f"frame_{unique_id}.jpg"
            with open(image_path, 'wb') as f:
                f.write(image_bytes)

            captured_paths[unique_id] = str(image_path)

        # 動画合成
        self.update_state(state='PROGRESS', meta={'step': 'Composing video', 'progress': 40})
        composer = VideoComposer(str(output_dir))

        unique_frame_paths = [frame['path'] for frame in mapping_data['unique_frames']]
        audio_path = str(output_dir / "audio.mp3")
        final_video_path = str(output_dir / "final.mp4")

        composer.compose_video(
            job_id=job_id,
            frame_mapping=mapping_data['frame_mapping'],
            unique_frames=unique_frame_paths,
            captured_images=captured_paths,
            audio_path=audio_path,
            output_path=final_video_path,
            fps=int(mapping_data['metadata']['original_fps']),
            progress_callback=lambda p: self.update_state(
                state='PROGRESS',
                meta={'step': 'Encoding video', 'progress': 40 + int(p * 0.55)}
            )
        )

        # ファイルサイズ取得
        file_size = Path(final_video_path).stat().st_size

        return {
            'status': 'completed',
            'video_path': final_video_path,
            'video_size_bytes': file_size,
            'duration_seconds': mapping_data['metadata']['duration']
        }

    except Exception as e:
        logger.error(f"Composition task failed for job {job_id}: {e}", exc_info=True)
        raise
```

### Backend: ffmpeg-python活用

```python
# packages/backend/app/services/video_composer.py (改良版)

import ffmpeg
from pathlib import Path
from typing import Dict, List, Callable, Optional
import logging

logger = logging.getLogger(__name__)

class VideoComposer:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def compose_video(
        self,
        job_id: str,
        frame_mapping: Dict[int, int],
        unique_frames: List[str],
        captured_images: Dict[int, str],
        audio_path: str,
        output_path: str,
        fps: int = 24,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> str:
        """
        フレームマッピングに基づいて動画を合成
        """
        logger.info(f"Starting video composition for job {job_id}")

        # フレーム配置ディレクトリ
        composed_dir = self.output_dir / "composed_frames"
        composed_dir.mkdir(exist_ok=True)

        # フレーム配置（進捗20%）
        total_frames = len(frame_mapping)
        for i, (frame_idx, unique_id) in enumerate(frame_mapping.items()):
            # 撮影画像があればそれを使用、なければ元画像
            source_path = captured_images.get(unique_id) or unique_frames[unique_id]
            dest_path = composed_dir / f"frame_{int(frame_idx):04d}.png"

            self._copy_and_resize(source_path, dest_path)

            if progress_callback and i % 10 == 0:
                progress = 0.2 * (i / total_frames)
                progress_callback(progress)

        if progress_callback:
            progress_callback(0.2)

        # 動画生成（進捗20-70%）
        temp_video = self.output_dir / f"{job_id}_temp.mp4"
        self._create_video_from_frames(
            frames_dir=composed_dir,
            output_path=temp_video,
            fps=fps,
            progress_callback=lambda p: progress_callback(0.2 + 0.5 * p) if progress_callback else None
        )

        # 音声マージ（進捗70-100%）
        self._merge_audio(
            video_path=temp_video,
            audio_path=audio_path,
            output_path=output_path,
            progress_callback=lambda p: progress_callback(0.7 + 0.3 * p) if progress_callback else None
        )

        logger.info(f"Video composition completed: {output_path}")
        return output_path

    def _copy_and_resize(
        self,
        source: str,
        destination: Path,
        target_size: Optional[tuple] = None
    ):
        """
        画像をコピー＆リサイズ（ffmpeg使用）
        """
        try:
            stream = ffmpeg.input(source)

            if target_size:
                stream = ffmpeg.filter(stream, 'scale', target_size[0], target_size[1])

            stream = ffmpeg.output(stream, str(destination), format='png')
            ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True, quiet=True)

        except ffmpeg.Error as e:
            logger.error(f"FFmpeg error in copy_and_resize: {e.stderr.decode()}")
            raise

    def _create_video_from_frames(
        self,
        frames_dir: Path,
        output_path: Path,
        fps: int,
        progress_callback: Optional[Callable[[float], None]] = None
    ):
        """
        フレームから動画を生成
        """
        input_pattern = str(frames_dir / "frame_%04d.png")

        try:
            stream = (
                ffmpeg
                .input(input_pattern, framerate=fps)
                .output(
                    str(output_path),
                    vcodec='libx264',
                    pix_fmt='yuv420p',
                    preset='medium',  # medium/fast/faster/veryfast
                    crf=23,  # 品質 (18-28, 低いほど高品質)
                    video_bitrate='2M'
                )
                .overwrite_output()
            )

            # 進捗モニタリング付き実行
            process = (
                stream
                .global_args('-progress', 'pipe:1')
                .run_async(pipe_stdout=True, pipe_stderr=True)
            )

            # 進捗をパース（簡易版）
            if progress_callback:
                for line in process.stdout:
                    # TODO: FFmpegの進捗出力をパースして正確な進捗を計算
                    pass

            process.wait()

            if progress_callback:
                progress_callback(1.0)

        except ffmpeg.Error as e:
            logger.error(f"FFmpeg error in create_video: {e.stderr.decode()}")
            raise

    def _merge_audio(
        self,
        video_path: Path,
        audio_path: str,
        output_path: str,
        progress_callback: Optional[Callable[[float], None]] = None
    ):
        """
        動画に音声を追加
        """
        try:
            video_stream = ffmpeg.input(str(video_path))
            audio_stream = ffmpeg.input(audio_path)

            stream = (
                ffmpeg
                .output(
                    video_stream,
                    audio_stream,
                    output_path,
                    vcodec='copy',  # ビデオは再エンコードしない
                    acodec='aac',
                    audio_bitrate='192k',
                    shortest=None  # 短い方に合わせる
                )
                .overwrite_output()
            )

            ffmpeg.run(stream, capture_stdout=True, capture_stderr=True)

            if progress_callback:
                progress_callback(1.0)

        except ffmpeg.Error as e:
            logger.error(f"FFmpeg error in merge_audio: {e.stderr.decode()}")
            raise
```

---

## 🗄️ データベース設計

### v1.0: Redis（揮発性ストレージ）

**Job State**
```
Key: job:{job_id}:state
Type: Hash
Fields:
  - status: "pending" | "processing" | "completed" | "failed"
  - progress: 0-100
  - current_step: "Extracting frames..."
  - created_at: timestamp
  - updated_at: timestamp
  - error: null | error_message
TTL: 24 hours
```

**Job Result**
```
Key: job:{job_id}:result
Type: String (JSON)
Value: {mapping.json content}
TTL: 24 hours
```

**Generation State**
```
Key: gen:{generation_id}:state
Type: Hash
Fields:
  - status: "pending" | "processing" | "completed" | "failed"
  - job_id: parent job ID
  - progress: 0-100
  - video_path: "/outputs/{job_id}/final.mp4"
  - created_at: timestamp
TTL: 24 hours
```

### v2.0以降: PostgreSQL（永続化）

```sql
-- ユーザー
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ジョブ
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    duration_seconds FLOAT,
    fps INTEGER,
    resolution VARCHAR(20),  -- "1920x1080"
    status VARCHAR(20) NOT NULL,  -- pending/processing/completed/failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- ユニークフレーム
CREATE TABLE unique_frames (
    id SERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    frame_index INTEGER NOT NULL,
    thumbnail_url TEXT,
    pose_landmarks JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, frame_index)
);

CREATE INDEX idx_unique_frames_job_id ON unique_frames(job_id);

-- 生成動画
CREATE TABLE generated_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    duration_seconds FLOAT,
    views_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_generated_videos_user_id ON generated_videos(user_id);
CREATE INDEX idx_generated_videos_public ON generated_videos(is_public) WHERE is_public = TRUE;
```

---

## 🔒 セキュリティ

### 脅威モデル

| 脅威 | 対策 | 実装箇所 |
|------|------|---------|
| **悪意のあるファイルアップロード** | MIMEタイプ検証、サイズ制限、FFprobe検証 | FastAPI middleware |
| **DoS攻撃** | Rate limiting (10 req/min/IP) | Middleware |
| **XSS** | CSP ヘッダー、入力サニタイズ | Next.js headers |
| **CSRF** | SameSite cookies、CORS設定 | FastAPI CORS middleware |
| **データ漏洩** | ファイル自動削除、ランダムジョブID | Cron job |

### 実装例

```python
# packages/backend/app/middleware/security.py

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import magic
import hashlib
from pathlib import Path

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware
    """
    # /api/* に対して10 req/min/IP
    if request.url.path.startswith("/api/"):
        # slowapi limiterで処理
        pass

    response = await call_next(request)
    return response

async def file_validation_middleware(request: Request, call_next):
    """
    ファイルアップロード検証
    """
    if request.url.path == "/api/upload" and request.method == "POST":
        # Content-Type チェック
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("multipart/form-data"):
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid content type"}
            )

    response = await call_next(request)
    return response

def validate_video_file(file_path: str) -> bool:
    """
    動画ファイルの詳細検証

    - MIMEタイプ（libmagic使用）
    - ファイルサイズ
    - FFprobe による構造検証
    """
    path = Path(file_path)

    # MIMEタイプ検証（実ファイルの内容から判定）
    mime = magic.Magic(mime=True)
    file_mime = mime.from_file(file_path)

    if file_mime not in ["video/mp4", "video/quicktime", "image/gif"]:
        return False

    # ファイルサイズ
    if path.stat().st_size > 100 * 1024 * 1024:  # 100MB
        return False

    # FFprobe検証（malformed fileを検出）
    try:
        probe = ffmpeg.probe(file_path)
        if 'streams' not in probe or len(probe['streams']) == 0:
            return False
    except ffmpeg.Error:
        return False

    return True

# セキュリティヘッダー
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:;"
}

async def security_headers_middleware(request: Request, call_next):
    """
    セキュリティヘッダー追加
    """
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response
```

### CORS設定

```python
# packages/backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="DanceFrame API", version="2.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # ["http://localhost:3000", "https://danceframe.app"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=3600,
)
```

---

## ⚡ パフォーマンス最適化

### Frontend最適化

#### 1. React Compiler（自動最適化）

```javascript
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true  // React Compiler有効化
  },
  // Turbopack (デフォルトで有効)
}

module.exports = nextConfig
```

#### 2. 画像最適化

```typescript
// packages/frontend/src/components/review/ThumbnailGrid.tsx

import Image from 'next/image';

export function ThumbnailGrid({ frames }: { frames: CapturedFrame[] }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {frames.map((frame) => (
        <div key={frame.id} className="relative aspect-square">
          <Image
            src={frame.thumbnail}
            alt={`Frame ${frame.id}`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover rounded-lg"
            priority={frame.id < 4}  // 最初の4枚は優先読み込み
          />
        </div>
      ))}
    </div>
  );
}
```

#### 3. Code Splitting

```typescript
// packages/frontend/src/app/capture/page.tsx

import dynamic from 'next/dynamic';

// MediaPipeは重いので遅延ロード
const CameraView = dynamic(
  () => import('@/components/camera/CameraView').then(mod => mod.CameraView),
  {
    loading: () => <div>Loading camera...</div>,
    ssr: false  // サーバーサイドでは実行しない
  }
);

export default function CapturePage() {
  return <CameraView />;
}
```

### Backend最適化

#### 1. Celeryワーカー設定

```python
# docker-compose.yml

services:
  celery-worker:
    image: danceframe-backend
    command: celery -A app.celery_worker worker --loglevel=info --concurrency=2 --max-tasks-per-child=50
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    deploy:
      replicas: 2  # 2つのワーカーを並列実行
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

#### 2. Redis設定最適化

```conf
# redis.conf

maxmemory 2gb
maxmemory-policy allkeys-lru  # LRUでキャッシュ削除

# AOF persistence（オプション）
appendonly no  # 揮発性でOKなのでオフ

# RDB snapshot（オプション）
save ""  # スナップショット無効

# TCP backlog
tcp-backlog 511

# Timeout
timeout 300
```

#### 3. FFmpeg最適化

```python
# GPU加速対応（NVIDIAの場合）
def create_video_with_gpu(frames_dir, output_path, fps=24):
    """
    NVIDIA GPU加速を使用した動画生成
    """
    stream = (
        ffmpeg
        .input(str(frames_dir / "frame_%04d.png"), framerate=fps)
        .output(
            output_path,
            vcodec='h264_nvenc',  # NVIDIA GPU encoder
            pix_fmt='yuv420p',
            preset='p4',  # p1-p7 (高速 → 高品質)
            rc='vbr',  # Variable bitrate
            cq=23,  # Constant quality
            gpu=0  # GPU ID
        )
        .overwrite_output()
    )

    ffmpeg.run(stream)
```

---

## 📚 参考文献

### 公式ドキュメント

1. **MediaPipe Tasks Vision**
   - URL: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
   - 最終確認: 2025-01-13

2. **Next.js 16 Documentation**
   - URL: https://nextjs.org/docs
   - Release Notes: https://nextjs.org/blog/next-16

3. **React 19.2 Documentation**
   - URL: https://react.dev/
   - Compiler: https://react.dev/learn/react-compiler

4. **FastAPI Best Practices**
   - URL: https://fastapi.tiangolo.com/
   - GitHub: https://github.com/zhanymkanov/fastapi-best-practices

5. **Celery Documentation**
   - URL: https://docs.celeryproject.org/
   - Best Practices: https://docs.celeryproject.org/en/stable/userguide/tasks.html

6. **FFmpeg Documentation**
   - URL: https://ffmpeg.org/documentation.html
   - Python Bindings: https://kkroening.github.io/ffmpeg-python/

### 技術記事

- [Building a Video Processing Pipeline using FastAPI, Celery, and Redis](https://medium.com/@hemantgarg26/building-a-video-processing-pipeline-using-fastapi-celery-and-redis-e045dcf66c7f)
- [State Management in 2025: When to Use Zustand](https://dev.to/hijazi313/state-management-in-2025)
- [MediaPipe Migration Guide](https://developers.google.com/mediapipe/solutions/guide)

---

**Document Version**: 2.0
**Last Updated**: 2025-11-16
**Next Review**: 2025-12-16
