# 📋 Cursor - DanceFrame Implementation Instructions

**Date**: 2025-11-16
**From**: Claude (Technical Lead)
**To**: Cursor (Frontend Developer)
**Project**: DanceFrame - AI-Powered Dance Video Generator

---

## 🎯 Your Role & Responsibilities

### Primary Focus (70% of your time)
You are the **Frontend Lead** responsible for:

✅ **All Frontend Implementation** (Next.js 16 + React 19.2)
✅ **MediaPipe Tasks Vision Integration** (Browser-side pose detection)
✅ **Camera & Real-time Capture UI**
✅ **State Management** (Zustand)
✅ **E2E Testing** (Playwright)
✅ **Vercel Deployment**

### Secondary Responsibilities (30% of your time)
- UI/UX Design & Polish
- Cross-browser Testing
- Performance Optimization
- Documentation Updates

---

## 🚨 CRITICAL: Technology Version Requirements

### ⚠️ MediaPipe BREAKING CHANGE

**DO NOT USE:**
```bash
❌ @mediapipe/pose  # DEPRECATED since March 2023
```

**MUST USE:**
```bash
✅ @mediapipe/tasks-vision@0.10.15  # Latest API (Jan 2025)
```

**Official Documentation:**
- 🔗 **Primary**: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- 🔗 **Setup Guide**: https://ai.google.dev/edge/mediapipe/solutions/setup_web
- 🔗 **NPM Package**: https://www.npmjs.com/package/@mediapipe/tasks-vision

**Why This Matters:**
1. Old API (`@mediapipe/pose`) has **completely different syntax**
2. New API supports GPU acceleration (WASM + WebGL)
3. Performance improved: 30+ FPS target achievable
4. Better TypeScript support

**Code Example (NEW API):**
```typescript
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Initialization
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);

const landmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    delegate: 'GPU'  // Critical for performance
  },
  runningMode: 'VIDEO',
  numPoses: 1
});

// Real-time detection
const results = landmarker.detectForVideo(videoElement, timestamp);
```

---

### Next.js 16 (Latest Stable)

**Official Documentation:**
- 🔗 **Main Docs**: https://nextjs.org/docs
- 🔗 **App Router**: https://nextjs.org/docs/app
- 🔗 **Turbopack**: https://nextjs.org/docs/architecture/turbopack

**Key Features to Use:**
1. **App Router** (not Pages Router)
2. **Turbopack** (5-10x faster builds)
3. **Server Components** where applicable
4. **Image Optimization** (`next/image`)

**Installation:**
```bash
npx create-next-app@latest packages/frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-npm
```

---

### React 19.2 (With React Compiler)

**Official Documentation:**
- 🔗 **React 19 Docs**: https://react.dev/blog/2024/12/05/react-19
- 🔗 **React Compiler**: https://react.dev/learn/react-compiler

**What's New:**
- Automatic optimization (no manual `useMemo`/`useCallback` needed)
- Better error handling
- Improved hydration

---

### Zustand 5.0.8 (State Management)

**Official Documentation:**
- 🔗 **Main Docs**: https://zustand.docs.pmnd.rs/
- 🔗 **TypeScript Guide**: https://zustand.docs.pmnd.rs/guides/typescript

**Why Zustand (not Redux):**
- Lightweight (1KB)
- Simple API
- No Context Provider needed
- Perfect for this use case

**Store Structure:**
```typescript
// store/useAppStore.ts
interface AppStore {
  // Upload & Analysis
  jobId: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'generating';
  uniqueFrames: UniqueFrame[];

  // Capture
  currentPoseIndex: number;
  capturedImages: Record<number, Blob>;

  // Actions
  setJobId: (id: string) => void;
  addCapturedImage: (index: number, blob: Blob) => void;
  nextPose: () => void;
}
```

---

## 📅 Your Day 1 Tasks (4 hours)

### Morning Session (2 hours)

**Task 1.1: Project Initialization (30 min)**
```bash
cd /Users/teradakousuke/Developer/geddan/packages/frontend

# Create Next.js 16 project
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-npm
```

**Task 1.2: Install Dependencies (15 min)**
```bash
# Core dependencies
npm install @mediapipe/tasks-vision@0.10.15
npm install zustand@5.0.8
npm install axios
npm install framer-motion

# Dev dependencies (if needed)
npm install -D @types/node
npm install -D @playwright/test  # For E2E tests later
```

**Task 1.3: Project Structure (30 min)**
```bash
# Create directory structure
mkdir -p {components,hooks,lib,store,types}/{upload,analysis,capture,review,generate}
mkdir -p public/sounds  # For shutter sound, etc.
mkdir -p __tests__      # For tests
```

**Task 1.4: Verify Setup (15 min)**
```bash
npm run dev
# Should open http://localhost:3000
# Verify Tailwind CSS works
```

---

### Afternoon Session (2 hours)

**Task 2.1: Layout Components (60 min)**

Create these files:

**`app/layout.tsx`** (Root layout):
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DanceFrame - Dance with AI',
  description: 'AI-powered interactive video generation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

**`components/Header.tsx`**:
```typescript
export function Header() {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold">DanceFrame 💃</h1>
      </div>
    </header>
  );
}
```

**`components/Footer.tsx`**:
```typescript
export function Footer() {
  return (
    <footer className="bg-gray-100 p-4 text-center text-gray-600">
      <p>© 2025 DanceFrame. Powered by MediaPipe + Next.js</p>
    </footer>
  );
}
```

**Task 2.2: Landing Page (60 min)**

**`app/page.tsx`**:
```typescript
'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-blue-50">
        <h1 className="text-6xl font-bold mb-6 text-center bg-gradient-to-r from-purple-600 to-blue-600 text-transparent bg-clip-text">
          DanceFrame 💃
        </h1>

        <p className="text-2xl text-gray-700 mb-12 text-center max-w-2xl">
          手描きアニメーションと踊る<br />
          AI駆動型動画生成アプリ
        </p>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-4xl">
          <FeatureCard
            icon="🎨"
            title="動画解析"
            description="AIが自動でユニークなポーズを検出"
          />
          <FeatureCard
            icon="📸"
            title="リアルタイム撮影"
            description="カメラでポーズを真似して自動シャッター"
          />
          <FeatureCard
            icon="🎬"
            title="自動合成"
            description="あなただけの踊ってみた動画を生成"
          />
        </div>

        {/* CTA Button */}
        <Link href="/upload">
          <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105">
            さっそく始める →
          </button>
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
      <div className="text-5xl mb-4 text-center">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-center">{title}</h3>
      <p className="text-gray-600 text-center">{description}</p>
    </div>
  );
}
```

**Completion Criteria:**
✅ Landing page displays beautifully
✅ Tailwind CSS styling works
✅ Responsive design (mobile, tablet, desktop)
✅ "さっそく始める" button exists (even if link doesn't work yet)

---

## 🔄 API Contract (Mock for Now, Real Later)

Claude (me) will provide the real API on **Day 2-3**, but you can start building with mocks:

### Upload API
```typescript
// POST /api/upload
interface UploadResponse {
  job_id: string;        // UUID
  task_id: string;       // Celery task ID
  status: 'processing';
  message: string;
}

// Mock implementation (lib/api/mock.ts)
export async function mockUploadVideo(file: File): Promise<UploadResponse> {
  await sleep(1000);
  return {
    job_id: `mock-${Date.now()}`,
    task_id: `task-${Date.now()}`,
    status: 'processing',
    message: 'Analysis started'
  };
}
```

### Analysis Status API
```typescript
// GET /api/analyze/:jobId
interface AnalysisResponse {
  status: 'processing' | 'completed' | 'failed';
  progress: number;      // 0-100
  current_step: string;  // 'Extracting frames...', etc.
  result?: {
    unique_frames: Array<{
      index: number;
      thumbnail: string;  // Base64 encoded image
      pose_landmarks: {
        landmarks: Array<{
          x: number;
          y: number;
          z: number;
          visibility: number;
        }>
      }
    }>;
    total_frames: number;
    unique_count: number;
  };
}

// Mock implementation
export async function mockGetAnalysisStatus(jobId: string): Promise<AnalysisResponse> {
  const progress = Math.min(100, (Date.now() % 30000) / 300);

  if (progress >= 100) {
    return {
      status: 'completed',
      progress: 100,
      current_step: 'Done!',
      result: mockAnalysisResult  // See separate file
    };
  }

  return {
    status: 'processing',
    progress,
    current_step: ['Extracting frames...', 'Detecting poses...', 'Generating thumbnails...'][Math.floor(progress / 33)]
  };
}
```

**When to Switch from Mock to Real:**
- Claude will notify you when API is ready (Day 2 PM or Day 3 AM)
- Just swap the import: `import { uploadVideo } from '@/lib/api/mock'` → `import { uploadVideo } from '@/lib/api/client'`

---

## 📞 Communication Protocol

### Daily Standup (Async)
**Every morning at 9:00 AM** - Post in GitHub Issue:

```markdown
## Daily Standup - 2025-11-XX

### Cursor
**Yesterday:**
- ✅ Completed landing page
- ✅ Setup project structure

**Today:**
- 🎯 Implement upload component
- 🎯 Create progress bar component

**Blockers:**
- ❓ Need API endpoint for testing (waiting for Claude)
```

### Questions & Blockers
- **GitHub Issue**: Technical questions, design decisions
- **PR Comments**: Code-specific questions
- **Urgent**: Tag @Claude in issue

### Code Review
- **Create PR**: When feature is working (even if not perfect)
- **Review Time**: Claude will review within 6 hours
- **Merge**: After approval + CI passes

---

## 🎨 Design Guidelines

### Color Palette
```css
/* Primary */
purple-600: #9333ea
blue-600: #2563eb

/* Gradients */
from-purple-600 to-blue-600

/* Neutral */
gray-50, gray-100, gray-600, gray-900
```

### Typography
```typescript
// Use Inter font (already in layout.tsx)
Font sizes:
- Hero: text-6xl (60px)
- Heading: text-2xl, text-3xl
- Body: text-base, text-lg
- Small: text-sm
```

### Responsive Breakpoints
```css
sm: 640px   (mobile)
md: 768px   (tablet)
lg: 1024px  (desktop)
xl: 1280px  (large desktop)
```

---

## 🧪 Testing Strategy

### Unit Tests (Jest + React Testing Library)
```bash
# Later in the project
npm test

# Example
// components/__tests__/Header.test.tsx
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';

test('renders header with title', () => {
  render(<Header />);
  expect(screen.getByText('DanceFrame 💃')).toBeInTheDocument();
});
```

### E2E Tests (Playwright)
```bash
# Install (Day 5-6)
npm install -D @playwright/test
npx playwright install

# Run
npx playwright test
```

**Coverage Targets:**
- Unit tests: 70%+
- E2E tests: 100% of critical paths (upload → capture → download)

---

## 📚 Required Reading (Priority Order)

### Must Read Today:
1. ✅ **This Document** (you're reading it now!)
2. 📖 **DIVISION_OF_LABOR.md** - Your detailed task breakdown
3. 📖 **TEAM_WORKFLOW.md** - How we work together

### Read by Day 3:
4. 📖 **SPECIFICATION_V2.md** (Frontend sections) - Implementation examples
5. 📖 **ARCHITECTURE.md** - System design overview

### External Documentation:
- 🔗 [MediaPipe Pose Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) ⭐ **CRITICAL**
- 🔗 [Next.js 16 App Router](https://nextjs.org/docs/app)
- 🔗 [Zustand Getting Started](https://zustand.docs.pmnd.rs/)
- 🔗 [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🚨 Common Pitfalls to Avoid

### 1. Using Old MediaPipe API
```typescript
❌ import Pose from '@mediapipe/pose';  // WRONG - Deprecated!
✅ import { PoseLandmarker } from '@mediapipe/tasks-vision';  // CORRECT
```

### 2. Not Handling Async Properly
```typescript
❌ const landmarker = PoseLandmarker.create(...);  // Missing await!
✅ const landmarker = await PoseLandmarker.createFromOptions(...);
```

### 3. Forgetting Camera Permissions
```typescript
// Always handle rejection
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
} catch (err) {
  // Show friendly error: "Please allow camera access"
}
```

### 4. Not Cleaning Up Resources
```typescript
useEffect(() => {
  // Initialization...

  return () => {
    // CRITICAL: Stop camera, close MediaPipe
    stream?.getTracks().forEach(track => track.stop());
    landmarker?.close();
  };
}, []);
```

---

## 🎯 Success Metrics

### Day 1 (Today)
✅ Project initialized
✅ Dependencies installed
✅ Landing page renders
✅ Tailwind CSS working
✅ Dev server running at http://localhost:3000

### Day 3
✅ Upload UI complete
✅ Progress bar working
✅ Connected to real API

### Day 6
✅ Camera access working
✅ MediaPipe detecting poses at 30+ FPS
✅ Auto-capture triggering at 85% similarity

### Day 12
✅ Full app deployed to Vercel
✅ E2E tests passing
✅ Lighthouse score 90+

---

## 🤝 Working with Claude

### What Claude is Responsible For:
- All Backend API endpoints
- Video processing (FFmpeg, MediaPipe Python)
- Celery background tasks
- Docker & deployment (Railway)
- Pose similarity algorithm (`lib/poseComparison.ts` - Claude will write this for you!)

### What You'll Collaborate On:
- **MediaPipe Integration**: Claude will help with the algorithm, you implement the UI
- **API Contract**: Discuss together before implementation
- **Performance Optimization**: Both contribute ideas

### When You're Blocked:
1. Try to solve for 30 min
2. Search official docs
3. If still stuck: Create GitHub Issue with details
4. Claude will respond within 2-6 hours
5. Urgent: Tag with `priority: high`

---

## 🚀 Ready to Start?

### Your Next Actions (Right Now):

1. **Create Project** (30 min)
```bash
cd /Users/teradakousuke/Developer/geddan/packages/frontend
npx create-next-app@latest . --typescript --tailwind --app
```

2. **Install Dependencies** (10 min)
```bash
npm install @mediapipe/tasks-vision@0.10.15 zustand@5.0.8 axios framer-motion
```

3. **Create Landing Page** (60 min)
   - Follow the code examples above
   - Make it beautiful!

4. **Verify** (10 min)
```bash
npm run dev
# Visit http://localhost:3000
```

5. **First Commit** (10 min)
```bash
git add packages/frontend
git commit -m "feat(frontend): Initialize Next.js 16 project with landing page"
```

6. **Create PR & Notify Claude**
   - Create PR with screenshots
   - Tag Claude for review

---

## 📞 Questions?

If anything is unclear:
- 🐛 **Technical issue**: Create GitHub Issue with `question` label
- 💬 **Quick question**: Comment on this file (GitHub)
- 🚨 **Blocker**: Tag @Claude with `priority: high`

---

## 🎉 Welcome to the Team!

I'm excited to work with you on DanceFrame! Your expertise in modern frontend development will be crucial to making this app amazing.

Don't hesitate to ask questions, suggest improvements, or challenge any decisions. We're in this together!

Let's build something incredible! 💪

**— Claude (Technical Lead)**

---

**Document Version**: 1.0
**Date**: 2025-11-16
**Next Review**: After Day 1 completion
**Official Docs Referenced**: MediaPipe (latest), Next.js 16, Zustand 5.0, React 19
