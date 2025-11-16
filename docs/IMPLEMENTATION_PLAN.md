# DanceFrame - 実装計画書

**作成日**: 2025-11-16
**バージョン**: 2.0
**推定期間**: 15-20営業日
**開発者**: Kosuke Terada

---

## 📋 目次

1. [実装方針](#実装方針)
2. [開発環境](#開発環境)
3. [フェーズ別実装計画](#フェーズ別実装計画)
4. [技術的検証事項](#技術的検証事項)
5. [リスク管理](#リスク管理)
6. [デプロイ計画](#デプロイ計画)
7. [品質保証](#品質保証)

---

## 🎯 実装方針

### 開発アプローチ

**アジャイル・反復型開発**

- **スプリント期間**: 3-4日
- **反復サイクル**: 設計 → 実装 → テスト → レビュー
- **最小機能単位**: 各フェーズを独立して動作可能な状態で完成させる

### 優先順位

1. **P0 (必須)**: MVP機能、セキュリティ、基盤
2. **P1 (重要)**: UX改善、エラーハンドリング
3. **P2 (任意)**: パフォーマンス最適化、追加機能

### 技術選定の根拠

| 技術 | 選定理由 | 代替案 | 選定根拠 |
|------|---------|--------|---------|
| **MediaPipe Tasks Vision** | 最新API、GPU加速、WASM対応 | TensorFlow.js PoseNet | MediaPipeの方が高精度・高速（調査済） |
| **Next.js 16** | Turbopack安定版、React Compiler | Vite + React | SSR、Image最適化、デプロイ容易性 |
| **Celery** | 成熟したタスクキュー、豊富な機能 | BullMQ (Node.js) | Python生態系との親和性 |
| **Redis** | 高速、シンプル | RabbitMQ | 小規模なら十分、運用コスト低 |
| **Zustand** | 軽量（1KB）、シンプルAPI | Redux, Jotai | 学習コスト低、React 19対応済み |

---

## 🖥️ 開発環境

### 必須ソフトウェア

| ソフトウェア | バージョン | インストール方法 |
|------------|-----------|----------------|
| **Node.js** | 20.x LTS | `brew install node@20` |
| **Python** | 3.11+ | `brew install python@3.11` |
| **Docker** | 24.x+ | Docker Desktop |
| **Redis** | 7.2+ | `brew install redis` |
| **FFmpeg** | 6.1+ | `brew install ffmpeg` |
| **Git** | 2.40+ | 標準搭載 |

### 推奨ツール

- **IDE**: VSCode + 拡張機能
  - ESLint
  - Prettier
  - Pylance (Python)
  - Tailwind CSS IntelliSense
- **API テスト**: Thunder Client / Postman
- **データベース管理**: RedisInsight

### 環境変数テンプレート

```bash
# .env.example

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Backend
DATABASE_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
SECRET_KEY=your-secret-key-change-this-in-production
MAX_UPLOAD_SIZE=104857600  # 100MB
FILE_RETENTION_HOURS=24

# Development
DEBUG=true
LOG_LEVEL=INFO

# Production (追加)
# SENTRY_DSN=...
# AWS_ACCESS_KEY_ID=...
```

---

## 📅 フェーズ別実装計画

### Phase 0: プロジェクトセットアップ（1-2日）

#### 0.1 リポジトリ構造作成

**タスク:**
- [x] Gitリポジトリ初期化
- [ ] モノレポ構造作成
- [ ] `.gitignore`, `.dockerignore` 設定
- [ ] README.md, LICENSE作成

**成果物:**
```
dance-frame/
├── .git/
├── .gitignore
├── README.md
├── LICENSE
├── docker-compose.yml
├── .env.example
├── packages/
│   ├── frontend/
│   └── backend/
└── docs/
    ├── SPECIFICATION_V2.md
    ├── IMPLEMENTATION_PLAN.md
    ├── ARCHITECTURE.md
    └── SETUP.md
```

**検証:**
```bash
# ディレクトリ構造確認
tree -L 3 -I 'node_modules|__pycache__|.next'
```

---

#### 0.2 Frontend初期化

**タスク:**
- [ ] Next.js 16プロジェクト作成
- [ ] TypeScript設定
- [ ] Tailwind CSS設定
- [ ] ESLint, Prettier設定
- [ ] 基本レイアウト作成

**コマンド:**
```bash
cd packages/frontend

# Next.js 16 + TypeScript + Tailwind
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

# 依存関係追加
npm install @mediapipe/tasks-vision zustand@^5.0.8 axios framer-motion

# 開発用依存関係
npm install -D @types/node @types/react @types/react-dom
```

**検証:**
```bash
npm run dev
# http://localhost:3000 にアクセスして表示確認
```

---

#### 0.3 Backend初期化

**タスク:**
- [ ] FastAPIプロジェクト構造作成
- [ ] 依存関係定義（requirements.txt）
- [ ] Celeryセットアップ
- [ ] Redis接続確認
- [ ] Hello World API作成

**ファイル:**
```python
# packages/backend/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
celery==5.4.0
redis==5.1.1
opencv-python==4.10.0
imagehash==4.3.1
Pillow==10.3.0
mediapipe==0.10.14
ffmpeg-python==0.2.0
pydantic==2.8.0
pydantic-settings==2.4.0
python-jose==3.3.0
aiofiles==24.1.0
python-magic==0.4.27

# Development
pytest==8.3.2
pytest-asyncio==0.23.8
pytest-cov==5.0.0
black==24.8.0
flake8==7.1.1
```

**検証:**
```bash
cd packages/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# FastAPI起動確認
uvicorn app.main:app --reload
# http://localhost:8000/docs にアクセス
```

---

#### 0.4 Docker環境構築

**タスク:**
- [ ] docker-compose.yml作成
- [ ] Frontend Dockerfile作成
- [ ] Backend Dockerfile作成
- [ ] Redis設定
- [ ] ネットワーク設定

**ファイル:**
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    volumes:
      - ./packages/frontend:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev
    depends_on:
      - backend

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CORS_ORIGINS=http://localhost:3000
    volumes:
      - ./packages/backend:/app
      - backend_uploads:/app/uploads
      - backend_outputs:/app/outputs
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    depends_on:
      - redis

  celery-worker:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    environment:
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
    volumes:
      - ./packages/backend:/app
      - backend_uploads:/app/uploads
      - backend_outputs:/app/outputs
    command: celery -A app.celery_worker worker --loglevel=info --concurrency=2
    depends_on:
      - redis
      - backend

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru

volumes:
  redis_data:
  backend_uploads:
  backend_outputs:
```

**検証:**
```bash
docker-compose up -d
docker-compose ps  # すべてのサービスがUpであることを確認
docker-compose logs -f backend  # ログ確認
```

**完了基準:**
- ✅ すべてのサービスが正常起動
- ✅ Frontend: http://localhost:3000 アクセス可能
- ✅ Backend: http://localhost:8000/docs アクセス可能
- ✅ Redis: `redis-cli ping` で PONG 応答

---

### Phase 1: 動画解析機能（3-4日）

#### 1.1 ファイルアップロードAPI

**タスク:**
- [ ] `/api/upload` エンドポイント実装
- [ ] ファイル検証ミドルウェア
- [ ] ジョブID生成（UUID）
- [ ] 一時ファイル保存

**実装ファイル:**
```python
# packages/backend/app/routers/upload.py

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.file_validator import FileValidator
from app.tasks.video_analysis import analyze_video_task
import uuid
from pathlib import Path

router = APIRouter(prefix="/api", tags=["upload"])

@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    動画ファイルをアップロードして解析を開始

    Args:
        file: 動画ファイル (MP4, GIF)

    Returns:
        {"job_id": "...", "status": "processing"}
    """
    # ファイル検証
    validator = FileValidator()
    validation_result = await validator.validate(file)

    if not validation_result.is_valid:
        raise HTTPException(400, detail=validation_result.error_message)

    # ジョブID生成
    job_id = str(uuid.uuid4())

    # ファイル保存
    upload_dir = Path(f"/app/uploads/{job_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / f"original{Path(file.filename).suffix}"

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Celeryタスクをキューに追加
    task = analyze_video_task.delay(job_id, str(file_path))

    return {
        "job_id": job_id,
        "task_id": task.id,
        "status": "processing",
        "message": f"Analysis started. Check /api/analyze/{job_id} for progress."
    }
```

**テスト:**
```bash
# cURLでアップロードテスト
curl -X POST http://localhost:8000/api/upload \
  -F "file=@test_video.mp4" \
  -H "Content-Type: multipart/form-data"

# 期待レスポンス
# {
#   "job_id": "550e8400-e29b-41d4-a716-446655440000",
#   "status": "processing"
# }
```

---

#### 1.2 フレーム抽出サービス

**タスク:**
- [ ] FFmpegラッパー実装
- [ ] 音源抽出機能
- [ ] フレーム抽出機能（24fps正規化）
- [ ] メタデータ取得（ffprobe）

**実装ファイル:**
```python
# packages/backend/app/services/frame_extractor.py

import ffmpeg
from pathlib import Path
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class FrameExtractor:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def extract_audio(self, video_path: str, output_path: str) -> bool:
        """音源を抽出"""
        try:
            stream = (
                ffmpeg
                .input(video_path)
                .output(
                    output_path,
                    acodec='libmp3lame',
                    ar='44100',
                    ab='192k',
                    vn=None  # 映像なし
                )
                .overwrite_output()
            )
            ffmpeg.run(stream, capture_stdout=True, capture_stderr=True, quiet=True)
            logger.info(f"Audio extracted: {output_path}")
            return True

        except ffmpeg.Error as e:
            logger.error(f"Audio extraction failed: {e.stderr.decode()}")
            return False

    def extract_frames(self, video_path: str, fps: int = 24) -> Dict:
        """フレームを抽出"""
        frames_dir = self.output_dir / "frames"
        frames_dir.mkdir(exist_ok=True)

        output_pattern = str(frames_dir / "frame_%04d.png")

        try:
            # フレーム抽出
            stream = (
                ffmpeg
                .input(video_path)
                .filter('fps', fps=fps)
                .output(
                    output_pattern,
                    format='image2',
                    qscale=2  # 高品質
                )
                .overwrite_output()
            )
            ffmpeg.run(stream, capture_stdout=True, capture_stderr=True, quiet=True)

            # 抽出されたフレームを取得
            frame_files = sorted(frames_dir.glob("frame_*.png"))

            # メタデータ取得
            metadata = self.get_video_metadata(video_path)

            logger.info(f"Extracted {len(frame_files)} frames")

            return {
                'frames': [str(f) for f in frame_files],
                'count': len(frame_files),
                'fps': metadata.get('fps', fps),
                'duration': metadata.get('duration', 0),
                'resolution': metadata.get('resolution', 'unknown')
            }

        except ffmpeg.Error as e:
            logger.error(f"Frame extraction failed: {e.stderr.decode()}")
            raise

    def get_video_metadata(self, video_path: str) -> Dict:
        """動画のメタデータを取得"""
        try:
            probe = ffmpeg.probe(video_path)

            video_stream = next(
                (s for s in probe['streams'] if s['codec_type'] == 'video'),
                None
            )

            if not video_stream:
                return {}

            # FPS計算
            fps_str = video_stream.get('r_frame_rate', '24/1')
            num, den = map(int, fps_str.split('/'))
            fps = num / den if den != 0 else 24

            # 解像度
            width = video_stream.get('width', 0)
            height = video_stream.get('height', 0)
            resolution = f"{width}x{height}"

            # 長さ
            duration = float(probe['format'].get('duration', 0))

            return {
                'fps': fps,
                'duration': duration,
                'resolution': resolution,
                'width': width,
                'height': height
            }

        except Exception as e:
            logger.error(f"Metadata extraction failed: {e}")
            return {}
```

**テスト:**
```python
# tests/test_frame_extractor.py

import pytest
from app.services.frame_extractor import FrameExtractor
from pathlib import Path

def test_extract_audio(tmp_path):
    extractor = FrameExtractor(str(tmp_path))
    result = extractor.extract_audio("test_video.mp4", str(tmp_path / "audio.mp3"))
    assert result is True
    assert (tmp_path / "audio.mp3").exists()

def test_extract_frames(tmp_path):
    extractor = FrameExtractor(str(tmp_path))
    result = extractor.extract_frames("test_video.mp4", fps=24)
    assert result['count'] > 0
    assert len(result['frames']) == result['count']
```

---

#### 1.3 知覚ハッシュ解析

**タスク:**
- [ ] imagehash統合
- [ ] pHash計算実装
- [ ] ハミング距離グルーピング
- [ ] ユニークフレーム選定

**実装:**
```python
# packages/backend/app/services/hash_analyzer.py

import imagehash
from PIL import Image
from typing import List, Dict
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

class FrameHashAnalyzer:
    def __init__(self, hamming_threshold: int = 5):
        """
        Args:
            hamming_threshold: ハミング距離の閾値（この値以下なら同一とみなす）
        """
        self.hamming_threshold = hamming_threshold

    def analyze_frames(self, frame_paths: List[str]) -> Dict:
        """
        フレームを解析してユニークなフレームを特定

        Returns:
            {
                'unique_frames': [...],  # ユニークフレームのパスリスト
                'frame_mapping': {...},  # {元フレーム番号: ユニークフレーム番号}
                'groups': [...],         # グループ情報
                'total_frames': int,
                'unique_count': int
            }
        """
        logger.info(f"Analyzing {len(frame_paths)} frames...")

        # 全フレームのハッシュ値を計算
        hashes = []
        for idx, path in enumerate(frame_paths):
            try:
                img = Image.open(path)
                # 知覚ハッシュ（pHash）を計算
                phash = imagehash.phash(img, hash_size=8)
                hashes.append({
                    'index': idx,
                    'path': path,
                    'hash': phash
                })
            except Exception as e:
                logger.warning(f"Failed to hash {path}: {e}")
                continue

        # 類似フレームをグループ化
        groups = self._group_similar_frames(hashes)

        # ユニークフレームを抽出
        unique_frames = []
        frame_mapping = {}

        for group_idx, group in enumerate(groups):
            # グループの代表フレーム（最初のフレーム）
            representative = group['members'][0]
            unique_frames.append(representative['path'])

            # マッピングを作成
            for member in group['members']:
                frame_mapping[str(member['index'])] = group_idx

        logger.info(f"Found {len(unique_frames)} unique frames from {len(frame_paths)} total frames")

        return {
            'unique_frames': unique_frames,
            'frame_mapping': frame_mapping,
            'groups': groups,
            'total_frames': len(frame_paths),
            'unique_count': len(unique_frames)
        }

    def _group_similar_frames(self, hashes: List[Dict]) -> List[Dict]:
        """ハッシュ値が類似しているフレームをグループ化"""
        groups = []
        used = set()

        for i, hash_data in enumerate(hashes):
            if i in used:
                continue

            # 新しいグループを作成
            group = {
                'representative': hash_data,
                'members': [hash_data]
            }
            used.add(i)

            # 類似フレームを探してグループに追加
            for j in range(i + 1, len(hashes)):
                if j in used:
                    continue

                # ハミング距離を計算
                hamming_dist = hash_data['hash'] - hashes[j]['hash']

                if hamming_dist <= self.hamming_threshold:
                    group['members'].append(hashes[j])
                    used.add(j)

            groups.append(group)

        return groups
```

---

#### 1.4 骨格推定サービス

**タスク:**
- [ ] MediaPipe Python版統合
- [ ] 33点ランドマーク検出
- [ ] サムネイル生成（骨格線描画）
- [ ] JSON形式でエクスポート

**実装:**
```python
# packages/backend/app/services/pose_estimator.py

import mediapipe as mp
import cv2
import numpy as np
from PIL import Image
import base64
from io import BytesIO
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class PoseEstimator:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5
        )

    def estimate_pose(self, image_path: str) -> Optional[Dict]:
        """
        画像から骨格推定を実行

        Args:
            image_path: 画像ファイルパス

        Returns:
            {
                "landmarks": [
                    {"x": 0.5, "y": 0.3, "z": -0.1, "visibility": 0.99},
                    ...  # 33個
                ]
            }
        """
        try:
            # 画像読み込み
            image = cv2.imread(image_path)
            if image is None:
                logger.error(f"Failed to load image: {image_path}")
                return None

            # RGB変換
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # 骨格推定実行
            results = self.pose.process(image_rgb)

            if not results.pose_landmarks:
                logger.warning(f"No pose detected in {image_path}")
                return None

            # ランドマークをJSON形式に変換
            landmarks = []
            for landmark in results.pose_landmarks.landmark:
                landmarks.append({
                    'x': float(landmark.x),
                    'y': float(landmark.y),
                    'z': float(landmark.z),
                    'visibility': float(landmark.visibility)
                })

            return {'landmarks': landmarks}

        except Exception as e:
            logger.error(f"Pose estimation failed for {image_path}: {e}")
            return None

    def generate_thumbnail(
        self,
        image_path: str,
        landmarks: Optional[Dict] = None,
        size: tuple = (256, 256)
    ) -> str:
        """
        骨格線を描画したサムネイルを生成（Base64エンコード）

        Args:
            image_path: 画像ファイルパス
            landmarks: 骨格ランドマーク（Noneの場合は再推定）
            size: サムネイルサイズ

        Returns:
            "data:image/png;base64,..." 形式の文字列
        """
        try:
            # 画像読み込み
            image = cv2.imread(image_path)
            if image is None:
                return ""

            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # ランドマークがない場合は再推定
            if landmarks is None:
                results = self.pose.process(image_rgb)
                if not results.pose_landmarks:
                    # 骨格なしでもサムネイル生成
                    return self._image_to_base64(Image.fromarray(image_rgb), size)
            else:
                # ランドマークをMediaPipe形式に変換
                landmark_list = self._dict_to_landmark_list(landmarks)
                results = type('obj', (object,), {'pose_landmarks': landmark_list})()

            # 骨格線を描画
            annotated_image = image_rgb.copy()
            self.mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
            )

            # PIL Imageに変換してBase64エンコード
            pil_image = Image.fromarray(annotated_image)
            return self._image_to_base64(pil_image, size)

        except Exception as e:
            logger.error(f"Thumbnail generation failed: {e}")
            return ""

    def _image_to_base64(self, image: Image.Image, size: tuple) -> str:
        """PIL ImageをBase64文字列に変換"""
        # リサイズ
        image = image.resize(size, Image.Resampling.LANCZOS)

        # Base64エンコード
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return f"data:image/png;base64,{img_str}"

    def _dict_to_landmark_list(self, landmarks_dict: Dict):
        """辞書形式のランドマークをMediaPipe形式に変換"""
        # TODO: 必要に応じて実装
        pass

    def __del__(self):
        """リソース解放"""
        self.pose.close()
```

**完了基準:**
- ✅ 動画アップロード→解析→結果取得の一連の流れが動作
- ✅ ユニークフレーム数が元フレーム数の10-30%程度
- ✅ 骨格推定の成功率90%以上
- ✅ 処理時間: 10秒動画で30秒以内

---

### Phase 2: カメラ撮影機能（3-4日）

#### 2.1 MediaPipe統合（Frontend）

**タスク:**
- [ ] MediaPipe Tasks Vision初期化
- [ ] PoseLandmarkerセットアップ
- [ ] カスタムフック実装（useMediaPipe）
- [ ] リアルタイム骨格推定

**実装:**
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
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const modelName = options.modelComplexity === 0 ? 'lite' :
                          options.modelComplexity === 2 ? 'heavy' : 'full';

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelName}/float16/1/pose_landmarker_${modelName}.task`,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
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
  }, [options.modelComplexity]);

  // ビデオストリームからリアルタイム検出
  useEffect(() => {
    if (!isReady || !videoRef.current || !landmarkerRef.current) return;

    const video = videoRef.current;
    let lastVideoTime = -1;

    async function detectPose() {
      if (!video || !landmarkerRef.current) return;

      const now = performance.now();

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          const results = landmarkerRef.current.detectForVideo(video, now);
          options.onResults(results);
        } catch (err) {
          console.error('Pose detection error:', err);
        }
      }

      animationFrameId.current = requestAnimationFrame(detectPose);
    }

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

---

#### 2.2 カメラアクセス

**タスク:**
- [ ] getUserMedia実装
- [ ] カメラ選択機能（フロント/リア）
- [ ] ストリーム管理
- [ ] エラーハンドリング

**実装:**
```typescript
// packages/frontend/src/hooks/useCamera.ts

import { useEffect, useRef, useState } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';  // user: フロント, environment: リア
  width?: number;
  height?: number;
}

export function useCamera(options: UseCameraOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: options.facingMode || 'user',
          width: { ideal: options.width || 1280 },
          height: { ideal: options.height || 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      streamRef.current = stream;
      setIsActive(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMessage);
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera
  };
}
```

---

#### 2.3 ポーズマッチング

**タスク:**
- [ ] 類似度計算関数実装
- [ ] リアルタイム更新
- [ ] 閾値判定（85%）
- [ ] デバッグ表示

**実装:**
（SPECIFICATION_V2.mdの`calculatePoseSimilarity`を使用）

---

#### 2.4 撮影UI実装

**タスク:**
- [ ] カメラビューコンポーネント
- [ ] ポーズオーバーレイ表示
- [ ] 類似度メーター
- [ ] タイマー表示
- [ ] 自動シャッター

**実装:**
```typescript
// packages/frontend/src/app/capture/page.tsx

'use client';

import { useState, useRef, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useMediaPipe } from '@/hooks/useMediaPipe';
import { calculatePoseSimilarity } from '@/lib/poseComparison';
import { useAppStore } from '@/store/useAppStore';

export default function CapturePage() {
  const { videoRef, isActive, startCamera, stopCamera } = useCamera({ facingMode: 'user' });
  const [similarity, setSimilarity] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { uniqueFrames, currentPoseIndex, addCapturedImage, nextPose } = useAppStore();
  const targetPose = uniqueFrames[currentPoseIndex];

  // MediaPipe結果ハンドラー
  const handleResults = useCallback((results) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      setSimilarity(0);
      return;
    }

    const currentLandmarks = results.landmarks[0];
    const targetLandmarks = targetPose.pose_landmarks.landmarks;

    // 類似度計算
    const { similarity: sim } = calculatePoseSimilarity(targetLandmarks, currentLandmarks);
    setSimilarity(sim);

    // 自動シャッター（85%以上）
    if (sim >= 85) {
      captureFrame();
    }
  }, [targetPose]);

  const { isReady } = useMediaPipe(videoRef, {
    onResults: handleResults,
    modelComplexity: 1
  });

  // フレームキャプチャ
  const captureFrame = async () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
    });

    // Zustandに保存
    addCapturedImage(currentPoseIndex, blob);

    // 次のポーズへ
    setTimeout(() => {
      nextPose();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="flex justify-between items-center p-4">
        <div className="text-2xl font-bold">
          類似度: {similarity}% {similarity >= 85 && '🎯'}
        </div>
        <div className="text-xl">
          ⏱️ 残り {timeLeft}秒
        </div>
      </div>

      {/* カメラビュー */}
      <div className="relative flex justify-center items-center">
        <video
          ref={videoRef}
          className="max-w-full max-h-[70vh]"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 目標ポーズオーバーレイ */}
        {targetPose && (
          <img
            src={targetPose.thumbnail}
            alt="Target pose"
            className="absolute inset-0 opacity-30 pointer-events-none"
          />
        )}
      </div>

      {/* 進捗 */}
      <div className="text-center mt-4">
        ポーズ {currentPoseIndex + 1} / {uniqueFrames.length}
      </div>
    </div>
  );
}
```

**完了基準:**
- ✅ カメラが正常に起動
- ✅ リアルタイム骨格推定が30FPS以上
- ✅ 類似度が正確に計算される
- ✅ 85%以上で自動シャッター動作
- ✅ 撮影画像がZustandに保存される

---

### Phase 3: 確認・撮り直し機能（1日）

#### 3.1 サムネイル一覧表示

**タスク:**
- [ ] グリッドレイアウト実装
- [ ] 撮影済み/未撮影の判定
- [ ] 拡大表示モーダル
- [ ] 撮り直しボタン

**実装:**
```typescript
// packages/frontend/src/app/review/page.tsx

'use client';

import { useAppStore } from '@/store/useAppStore';
import Image from 'next/image';
import { useState } from 'react';

export default function ReviewPage() {
  const { uniqueFrames, capturedImages, goToCapture } = useAppStore();
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">撮影完了！確認してね 📸</h1>

      <div className="grid grid-cols-4 gap-4">
        {uniqueFrames.map((frame, index) => {
          const captured = capturedImages[index];
          const isCapture = !!captured;

          return (
            <div
              key={index}
              className="relative aspect-square bg-white rounded-lg shadow-md overflow-hidden cursor-pointer"
              onClick={() => setSelectedFrame(index)}
            >
              {isCapture ? (
                <>
                  <Image
                    src={URL.createObjectURL(captured)}
                    alt={`Captured ${index}`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                    ✓
                  </div>
                </>
              ) : (
                <>
                  <Image
                    src={frame.thumbnail}
                    alt={`Original ${index}`}
                    fill
                    className="object-cover opacity-30"
                  />
                  <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                    ❌
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToCapture(index);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                  >
                    撮影する
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* アクション */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          ← 戻る
        </button>
        <button
          onClick={() => {/* 動画生成へ */}}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          動画を生成! 🎬
        </button>
      </div>

      {/* 拡大表示モーダル */}
      {selectedFrame !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setSelectedFrame(null)}
        >
          <Image
            src={capturedImages[selectedFrame] ? URL.createObjectURL(capturedImages[selectedFrame]) : uniqueFrames[selectedFrame].thumbnail}
            alt="Preview"
            width={800}
            height={800}
            className="max-w-full max-h-full"
          />
        </div>
      )}
    </div>
  );
}
```

---

### Phase 4: 動画生成機能（2日）

#### 4.1 生成APIエンドポイント

**タスク:**
- [ ] `/api/generate` エンドポイント実装
- [ ] Base64画像のデコード・保存
- [ ] Celeryタスク起動
- [ ] 進捗通知（WebSocket）

**実装:**
```python
# packages/backend/app/routers/generate.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.tasks.video_composition import compose_video_task
import uuid

router = APIRouter(prefix="/api", tags=["generate"])

class CapturedFrame(BaseModel):
    unique_frame_id: int
    image: str  # "data:image/jpeg;base64,..."

class GenerateRequest(BaseModel):
    job_id: str
    captured_frames: List[CapturedFrame]

@router.post("/generate")
async def generate_video(request: GenerateRequest):
    """
    撮影画像から動画を生成

    Args:
        job_id: 解析ジョブID
        captured_frames: 撮影画像リスト

    Returns:
        {"generation_id": "...", "status": "processing"}
    """
    generation_id = f"gen_{uuid.uuid4().hex[:8]}"

    # Celeryタスクをキューに追加
    task = compose_video_task.delay(
        job_id=request.job_id,
        generation_id=generation_id,
        captured_frames=[f.dict() for f in request.captured_frames]
    )

    return {
        "generation_id": generation_id,
        "task_id": task.id,
        "status": "processing",
        "message": f"Check /api/status/{generation_id} for progress"
    }
```

---

#### 4.2 動画合成Celeryタスク

**実装:**
（SPECIFICATION_V2.mdの`compose_video_task`を使用）

---

### Phase 5: UI/UX改善（1-2日）

**タスク:**
- [ ] ローディングアニメーション
- [ ] トースト通知（成功/エラー）
- [ ] プログレスバー
- [ ] エラーページ
- [ ] レスポンシブデザイン

---

### Phase 6: テスト・デバッグ（2-3日）

**タスク:**
- [ ] ユニットテスト（Backend）
- [ ] 統合テスト
- [ ] E2Eテスト（Playwright）
- [ ] パフォーマンステスト
- [ ] バグ修正

---

### Phase 7: デプロイ（1日）

**タスク:**
- [ ] Vercel設定（Frontend）
- [ ] Railway設定（Backend）
- [ ] 環境変数設定
- [ ] DNS設定
- [ ] 本番確認

---

## 🧪 技術的検証事項

### 検証1: MediaPipe Tasks Vision性能

**目的:** ブラウザでのリアルタイム骨格推定が実用的な速度か検証

**方法:**
```typescript
// benchmark.ts

async function benchmarkPoseEstimation() {
  const video = document.querySelector('video')!;
  const landmarker = await initializePoseLandmarker();

  const samples = 100;
  const times: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await landmarker.detectForVideo(video, start);
    const end = performance.now();
    times.push(end - start);
  }

  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const fps = 1000 / avgTime;

  console.log(`Average time: ${avgTime.toFixed(2)}ms`);
  console.log(`Estimated FPS: ${fps.toFixed(1)}`);
}
```

**合格基準:** 30 FPS以上（33ms以下/フレーム）

---

### 検証2: FFmpeg処理速度

**目的:** 動画処理が許容範囲内の時間で完了するか

**方法:**
```python
import time
from app.services.frame_extractor import FrameExtractor

def benchmark_ffmpeg():
    extractor = FrameExtractor("/tmp/test")

    # 10秒動画でテスト
    start = time.time()
    result = extractor.extract_frames("test_10s.mp4", fps=24)
    elapsed = time.time() - start

    print(f"Extracted {result['count']} frames in {elapsed:.2f}s")
    print(f"Speed: {result['count'] / elapsed:.1f} fps")

    return elapsed < 10  # 10秒以内ならOK
```

**合格基準:** 10秒動画を10秒以内で処理

---

### 検証3: 知覚ハッシュ重複検出精度

**目的:** ループアニメーションで適切にユニークフレームを検出できるか

**方法:**
手動で作成したテスト動画（同じフレームが繰り返される）で検証

**合格基準:** 重複フレームを95%以上正しくグルーピング

---

## ⚠️ リスク管理

| リスク | 影響度 | 対策 |
|--------|--------|------|
| **MediaPipe性能不足** | 高 | 軽量モデル使用、フレームレート調整 |
| **FFmpeg処理遅延** | 中 | GPU加速、最適化パラメータ調整 |
| **Celeryワーカー不安定** | 中 | タイムアウト設定、リトライ機構 |
| **ストレージ容量不足** | 低 | 自動削除、圧縮 |
| **ブラウザ互換性問題** | 中 | ポリフィル、フォールバック |

---

## 🚀 デプロイ計画

### Vercel（Frontend）

```bash
# Vercelプロジェクト作成
cd packages/frontend
vercel

# 環境変数設定
vercel env add NEXT_PUBLIC_API_URL production
# Value: https://api.danceframe.app
```

### Railway（Backend）

```bash
# Railwayプロジェクト作成
railway init

# サービス追加
railway add  # Redis
railway add  # FastAPI
railway add  # Celery Worker

# 環境変数設定
railway variables set REDIS_URL=redis://...
railway variables set CORS_ORIGINS=https://danceframe.app
```

---

## ✅ 品質保証

### テストカバレッジ目標

- Backend: 80%以上
- Frontend: 70%以上

### テストピラミッド

```
       /\
      /E2E\      (5%)  - Playwright
     /------\
    /  統合  \    (15%) - API Tests
   /----------\
  / ユニット  \  (80%) - Jest, Pytest
 /--------------\
```

### CI/CD

```yaml
# .github/workflows/ci.yml

name: CI

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r packages/backend/requirements.txt
      - run: pytest packages/backend/tests

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
        working-directory: packages/frontend
      - run: npm test
        working-directory: packages/frontend
```

---

**Document Version**: 2.0
**Last Updated**: 2025-11-16
**Status**: Ready for Implementation
