# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**DanceFrame** is an AI-powered interactive video generation app that extracts keyframes from hand-drawn loop animations and allows users to photograph themselves mimicking the poses to create "dance cover" videos.

**Core Flow**: Video Upload → AI Analysis (pose detection) → Real-time Camera Matching → Automatic Video Composition

**Team Structure**: 2-person development (Claude: Backend Lead, Cursor: Frontend Lead)

---

## Architecture

### Monorepo Structure

```
packages/
├── frontend/     # Next.js 16 + React 19.2 (SPA)
└── backend/      # FastAPI + Celery (Async API)
```

### Key Architectural Decisions

**Frontend**:
- **Next.js 16** with Turbopack (5-10x faster builds)
- **React 19.2** with React Compiler (automatic optimization)
- **MediaPipe Tasks Vision 0.10.15** (⚠️ NOT `@mediapipe/pose` - deprecated since 2023)
- **Zustand 5.0.8** for state management (lightweight, no Context API)
- **Stateful SPA**: All pose matching happens client-side for real-time performance

**Backend**:
- **Layered Architecture**: Presentation (FastAPI) → Application (Routers) → Domain (Services) → Infrastructure
- **Async-First**: Heavy video processing offloaded to Celery workers
- **Stateless API**: All state stored in Redis (24h TTL)
- **Celery + Redis**: Critical for CPU-intensive tasks (video analysis, composition)

### Data Flow Pattern

1. **Upload** → FastAPI receives file → enqueues Celery task → returns job_id
2. **Analysis** (Celery Worker) → FFmpeg extracts frames → imagehash dedupes → MediaPipe poses → Redis stores mapping
3. **Capture** (Browser) → MediaPipe detects poses → calculates similarity → auto-captures at 85%+ → Zustand stores
4. **Generate** (Celery Worker) → Maps user photos to frames → FFmpeg composites → merges audio → Redis stores result

---

## Development Commands

### Local Development (Recommended for Development)

**Frontend**:
```bash
cd packages/frontend
npm install
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build with Turbopack
npm run lint         # ESLint
npm test             # Jest unit tests
npm run test:e2e     # Playwright E2E tests
```

**Backend**:
```bash
cd packages/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start Redis (separate terminal)
redis-server

# Start Celery Worker (separate terminal)
celery -A app.celery_worker worker --loglevel=info --concurrency=2

# Start FastAPI
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs

# Run tests
pytest                           # All tests
pytest tests/test_frame_extractor.py  # Single file
pytest --cov=app tests/          # With coverage
```

### Docker Development (Recommended for Full System)

```bash
# Start all services (Frontend, Backend, Celery, Redis)
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f celery-worker

# Stop all
docker-compose down

# Rebuild after dependency changes
docker-compose up -d --build
```

---

## Critical Implementation Details

### MediaPipe Integration (⚠️ Major Breaking Change from v1)

**DO NOT USE**: `@mediapipe/pose` (deprecated March 2023)

**MUST USE**: `@mediapipe/tasks-vision`

```typescript
// Correct implementation (2025)
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);

const landmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/.../pose_landmarker_lite.task`,
    delegate: 'GPU'  // Critical for performance
  },
  runningMode: 'VIDEO',
  numPoses: 1
});

// Real-time detection loop
const results = landmarker.detectForVideo(videoElement, timestamp);
```

**Location**: `packages/frontend/src/hooks/useMediaPipe.ts`

### Pose Similarity Calculation

**Algorithm**: 3D Euclidean distance on 13 key joints (nose, shoulders, elbows, wrists, hips, knees, ankles)

**Threshold**: 85% similarity triggers auto-capture

**Location**: `packages/frontend/src/lib/poseComparison.ts`

**Critical Parameters**:
- `SCALE_FACTOR = 200` (empirically tuned)
- `KEY_POINTS`: 13 joints (not all 33 landmarks)
- `visibility >= 0.5` filter (ignore low-confidence points)

### Video Processing Pipeline (Backend)

**Service Chain**:
1. `FrameExtractor` → FFmpeg operations (audio extraction, frame extraction at 24fps)
2. `FrameHashAnalyzer` → Perceptual hashing (imagehash.phash), Hamming distance grouping (<5 = duplicate)
3. `PoseEstimator` → MediaPipe Python (33 landmarks per unique frame)
4. `VideoComposer` → FFmpeg composition (user photos + original frames → H.264 + AAC)

**Location**: `packages/backend/app/services/`

**Performance Target**: Process 10-second video in <30 seconds

### Celery Task Pattern

```python
@celery_app.task(bind=True, name='tasks.analyze_video')
def analyze_video_task(self, job_id: str, video_path: str):
    # Update progress in Redis
    self.update_state(state='PROGRESS', meta={'step': '...', 'progress': 50})

    # Perform work
    result = process_video(video_path)

    # Store in Redis (24h TTL)
    redis_client.setex(f"job:{job_id}:result", 86400, json.dumps(result))
```

**Location**: `packages/backend/app/tasks/`

---

## State Management

### Frontend (Zustand)

```typescript
interface AppStore {
  jobId: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'generating';
  uniqueFrames: UniqueFrame[];
  capturedImages: Record<number, Blob>;
  currentPoseIndex: number;
  // Actions
  setJobId: (id: string) => void;
  addCapturedImage: (index: number, blob: Blob) => void;
  nextPose: () => void;
}
```

**Location**: `packages/frontend/src/store/useAppStore.ts`

### Backend (Redis)

```
job:{job_id}:state      → Hash (status, progress, current_step)
job:{job_id}:result     → JSON string (mapping.json content)
gen:{gen_id}:state      → Hash (status, video_path)

TTL: 24 hours (auto-cleanup)
```

---

## API Endpoints

**Base URL**: `http://localhost:8000` (dev) | `https://api.danceframe.app` (prod)

### Core Endpoints

| Method | Path | Purpose | Async? |
|--------|------|---------|--------|
| POST | `/api/upload` | Upload video, start analysis | Yes (Celery) |
| GET | `/api/analyze/{job_id}` | Poll analysis status/results | No (Redis read) |
| POST | `/api/generate` | Start video composition | Yes (Celery) |
| GET | `/api/status/{gen_id}` | Poll generation status | No (Redis read) |
| GET | `/api/download/{job_id}/final.mp4` | Download result | No (FileResponse) |

**Swagger UI**: http://localhost:8000/docs (auto-generated from FastAPI)

---

## Testing Strategy

### Frontend
- **Unit**: Jest + React Testing Library (`npm test`)
- **E2E**: Playwright (`npm run test:e2e`)
- **Coverage Target**: 70%+

### Backend
- **Unit**: pytest (`pytest`)
- **Integration**: pytest with real services (`pytest tests/integration/`)
- **Coverage Target**: 80%+

### Critical Paths (100% E2E coverage required)
1. Upload → Analysis → Prepare
2. Capture → Review → Generate → Download

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Frame extraction | 30 FPS processing | 45 FPS |
| Pose detection (browser) | 30+ FPS | 35-40 FPS |
| Similarity calculation | <16ms | 8-12ms |
| 10s video processing | <30s total | ~22s |
| Lighthouse score | 90+ | TBD |

---

## Security Considerations

**File Upload Validation**:
- MIMEtype check (video/mp4, image/gif only)
- Size limit: 100MB
- FFprobe structure validation (detect malformed files)
- python-magic for content-based detection

**Location**: `packages/backend/app/middleware/security.py`

**Rate Limiting**: 10 requests/min/IP (slowapi)

**CORS**: Whitelist only (configured in `app/main.py`)

**File Retention**: Auto-delete after 24h (cron job)

---

## Common Pitfalls

### 1. MediaPipe Initialization Order
❌ **Wrong**: Call `detectForVideo()` before model loads
✅ **Right**: Wait for `isReady` state from `useMediaPipe` hook

### 2. Celery Task Timeouts
- Default: 10 minutes (`task_time_limit=600`)
- Soft: 9 minutes (`task_soft_time_limit=540`)
- Adjust in `packages/backend/app/celery_worker.py` if needed

### 3. FFmpeg Path Issues
- Docker: FFmpeg pre-installed in container
- Local: Must install separately (`brew install ffmpeg`)
- Check with: `ffmpeg -version`

### 4. Redis Connection
- Docker: `redis://redis:6379/0` (service name)
- Local: `redis://localhost:6379/0`
- Set via `REDIS_URL` env var

### 5. Next.js Image Optimization
- Use `<Image>` component (not `<img>`)
- Set `sizes` prop for responsive images
- Priority loading for above-fold images

---

## Documentation Reference

**Quick Start**: `README.md`
**Technical Spec**: `docs/SPECIFICATION_V2.md` (60KB - comprehensive)
**Architecture**: `docs/ARCHITECTURE.md`
**Setup Guide**: `docs/SETUP.md`
**Team Workflow**: `docs/TEAM_WORKFLOW.md`
**Role Division**: `docs/DIVISION_OF_LABOR.md`

**Implementation Plan**: `docs/IMPLEMENTATION_PLAN.md` (15-20 day roadmap)

---

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```bash
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000
SECRET_KEY=dev-secret-key
DEBUG=true
LOG_LEVEL=INFO
MAX_UPLOAD_SIZE=104857600  # 100MB
FILE_RETENTION_HOURS=24
```

**Template**: `.env.example` (copy and customize)

---

## Deployment

**Frontend**: Vercel (automatic from `main` branch)
**Backend**: Railway (FastAPI + Celery + Redis)

**Production URLs**:
- Frontend: `https://danceframe.app`
- API: `https://api.danceframe.app`

See `docs/SETUP.md` for deployment instructions.

---

## Critical Dependencies Version Requirements

**⚠️ Version Constraints** (breaking changes if violated):

- `@mediapipe/tasks-vision` MUST be 0.10.15+ (NOT `@mediapipe/pose`)
- `next` MUST be 16.0+ (Turbopack)
- `react` MUST be 19.2+ (React Compiler)
- `zustand` MUST be 5.0+ (API changes from 4.x)
- `celery` MUST be 5.4+ (Python 3.11 compatibility)
- `python` MUST be 3.11+ (performance optimizations)

---

## Monorepo Development Tips

**Run both Frontend + Backend simultaneously**:
```bash
# Terminal 1: Backend
cd packages/backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2: Celery
cd packages/backend && celery -A app.celery_worker worker --loglevel=info

# Terminal 3: Frontend
cd packages/frontend && npm run dev

# Terminal 4: Redis
redis-server
```

**Or use Docker Compose** (recommended):
```bash
docker-compose up
```

---

## Code Style

**Frontend**: ESLint + Prettier (auto-format on save)
**Backend**: Black + Flake8

**Commit Message Format**:
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(frontend): implement camera view component
```

---

## When Things Break

**Frontend not building?**
- Check Node version: `node --version` (should be 20.x)
- Clear cache: `rm -rf .next node_modules && npm install`

**Backend tasks not running?**
- Check Celery worker: `celery -A app.celery_worker inspect active`
- Check Redis: `redis-cli ping` (should return PONG)
- Check logs: `docker-compose logs celery-worker`

**MediaPipe not loading?**
- Check WASM CDN availability
- Open browser console for errors
- Verify GPU support: WebGL enabled

**FFmpeg errors?**
- Verify installation: `ffmpeg -version`
- Check file permissions on uploads/ directory
- Review Celery worker logs for stderr output

---

**Last Updated**: 2025-11-16
**Version**: 2.0
**Maintained by**: Claude (Technical Lead)
