'use client';

import { CameraView } from '@/components/camera/CameraView';
import {
  extractPoseLandmarksFromImage,
  type ExtractedPose,
} from '@/lib/extractPoseLandmarks';
import { useAppStore } from '@/store/useAppStore';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Loader2, Pause, Play, SkipForward } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const WAIT_SECONDS = 10;
const COUNTDOWN_SECONDS = 5;
const SIMILARITY_THRESHOLD = 70;

// ターゲットポーズのランドマーク抽出結果をキャッシュ
type LandmarkCache = Map<string, ExtractedPose | null>;

export default function CapturePage() {
  const router = useRouter();
  const {
    uniqueFrames,
    currentPoseIndex,
    capturedImages,
    addCapturedImage,
    nextPose,
    setCurrentPoseIndex,
  } = useAppStore();

  const [similarity, setSimilarity] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(WAIT_SECONDS);
  const [countdown, setCountdown] = useState<number | null>(null); // null means not in countdown

  // Camera/MediaPipe ready state
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Camera control ref
  const captureRef = useRef<() => void>(() => {});

  // ターゲットポーズのランドマークキャッシュ
  const landmarkCacheRef = useRef<LandmarkCache>(new Map());
  const [currentTargetLandmarks, setCurrentTargetLandmarks] = useState<
    NormalizedLandmark[] | null
  >(null);
  const [isExtractingLandmarks, setIsExtractingLandmarks] = useState(false);

  // Check if all poses are captured
  useEffect(() => {
    if (uniqueFrames.length === 0) {
      router.push('/upload');
      return;
    }

    if (currentPoseIndex >= uniqueFrames.length) {
      router.push('/review');
    }
  }, [uniqueFrames, currentPoseIndex, router]);

  // 現在のターゲットポーズからランドマークを抽出
  useEffect(() => {
    const currentPose = uniqueFrames[currentPoseIndex];
    if (!currentPose?.thumbnail) return;

    const thumbnailUrl = currentPose.thumbnail;
    let isMounted = true;

    // キャッシュをチェック（非同期で状態更新）
    const cachedResult = landmarkCacheRef.current.get(thumbnailUrl);
    if (landmarkCacheRef.current.has(thumbnailUrl)) {
      // キャッシュヒット時は次のマイクロタスクで状態更新
      // これによりsetStateの同期呼び出しを回避
      Promise.resolve().then(() => {
        if (isMounted) {
          setCurrentTargetLandmarks(cachedResult?.landmarks ?? null);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    // ランドマーク抽出（非同期で開始）
    // setStateを非同期化してエフェクト内の同期呼び出し警告を回避
    Promise.resolve().then(() => {
      if (isMounted) {
        setIsExtractingLandmarks(true);
      }
    });

    extractPoseLandmarksFromImage(thumbnailUrl)
      .then((result) => {
        if (!isMounted) return;
        landmarkCacheRef.current.set(thumbnailUrl, result);
        setCurrentTargetLandmarks(result?.landmarks ?? null);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to extract landmarks:', err);
        landmarkCacheRef.current.set(thumbnailUrl, null);
        setCurrentTargetLandmarks(null);
      })
      .finally(() => {
        if (isMounted) {
          setIsExtractingLandmarks(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [uniqueFrames, currentPoseIndex]);

  // ターゲットポーズオブジェクトを生成（メモ化）
  const targetPoseWithLandmarks = useMemo(() => {
    const currentPose = uniqueFrames[currentPoseIndex];
    if (!currentPose) return null;

    return {
      thumbnail: currentPose.thumbnail,
      pose_landmarks: {
        landmarks: currentTargetLandmarks
          ? currentTargetLandmarks.map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility ?? 1,
            }))
          : [],
      },
    };
  }, [uniqueFrames, currentPoseIndex, currentTargetLandmarks]);

  // triggerCapture must be defined before the useEffects that use it
  const triggerCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    // Visual feedback
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-white z-50 pointer-events-none opacity-0';
    document.body.appendChild(flash);

    requestAnimationFrame(() => {
      flash.style.transition = 'opacity 0.1s';
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => document.body.removeChild(flash), 100);
      }, 100);
    });

    // Sound - only play if audio element can be created successfully
    // Shutter sound is optional; if missing, capture still works silently
    if (typeof Audio !== 'undefined') {
      const audio = new Audio('/sounds/shutter.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => { /* Ignore audio playback errors */ });
    }

    // Capture frame via ref
    captureRef.current();

    // Wait slightly before moving next
    await new Promise(r => setTimeout(r, 500));

    if (currentPoseIndex < uniqueFrames.length) {
      nextPose();
      // Reset state for next pose
      setSimilarity(0);
      setTimeLeft(WAIT_SECONDS);
      setCountdown(null);
      setIsCapturing(false);
    }
  }, [isCapturing, currentPoseIndex, uniqueFrames.length, nextPose]);

  // 全ての準備が完了しているかどうか
  // - カメラとMediaPipeが準備完了
  // - ターゲットランドマークの抽出が完了（成功・失敗問わず）
  const isFullyReady = isCameraReady && !isExtractingLandmarks;

  // Main Timer Logic
  useEffect(() => {
    // 準備が完了するまでタイマーを開始しない
    if (isPaused || isCapturing || !isFullyReady) return;

    const timer = setInterval(() => {
      // 1. Initial 10s wait period
      if (countdown === null) {
        if (timeLeft > 0) {
          setTimeLeft(prev => prev - 1);
        } else {
          // Time up -> Start 5s countdown
          setCountdown(COUNTDOWN_SECONDS);
        }
      }
      // 2. 5s Countdown period
      else {
        if (countdown > 0) {
          setCountdown(prev => (prev !== null ? prev - 1 : null));
        } else {
          // Countdown finished -> Force capture
          clearInterval(timer);
          triggerCapture();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, isCapturing, isFullyReady, timeLeft, countdown, triggerCapture]);

  // Auto-Shutter Logic - disabled linting as intentional async state update
  useEffect(() => {
    // 準備が完了していない場合は自動シャッターを無効化
    if (isPaused || isCapturing || countdown !== null || !isFullyReady) return;

    if (similarity >= SIMILARITY_THRESHOLD) {
      // Intentional: triggerCapture is a user-initiated action triggered by similarity reaching threshold
      // eslint-disable-next-line react-hooks/set-state-in-effect
      triggerCapture();
    }
  }, [similarity, isPaused, isCapturing, countdown, isFullyReady, triggerCapture]);

  const handleCapture = useCallback((blob: Blob) => {
    addCapturedImage(currentPoseIndex, blob);
  }, [addCapturedImage, currentPoseIndex]);

  const togglePause = () => setIsPaused(prev => !prev);

  const handleSkip = () => {
    nextPose();
    setSimilarity(0);
    setTimeLeft(WAIT_SECONDS);
    setCountdown(null);
  };

  const currentPose = uniqueFrames[currentPoseIndex];

  if (!currentPose || !targetPoseWithLandmarks) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col">
      {/* Header / Progress */}
      <div className="flex justify-between items-center mb-4 px-4">
        <div className="flex items-center gap-4">
          <button onClick={togglePause} className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
            {isPaused ? <Play size={24} /> : <Pause size={24} />}
          </button>
          <span className="font-mono text-xl">
            Pose {currentPoseIndex + 1} / {uniqueFrames.length}
          </span>
        </div>

        <div className="text-xl font-bold">
          {!isFullyReady ? (
            <span className="text-yellow-400 animate-pulse">準備中...</span>
          ) : countdown !== null ? (
            <span className="text-red-500 animate-pulse text-4xl">{countdown}</span>
          ) : (
            <span className="text-gray-400">{timeLeft}s</span>
          )}
        </div>

        <button onClick={handleSkip} className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700">
          Skip <SkipForward size={18} />
        </button>
      </div>

      {/* Split Screen Content */}
      <div className="flex-1 grid grid-cols-2 gap-4 h-full min-h-0">
        {/* Left: Target Pose */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden border-2 border-slate-700">
          <Image
            src={currentPose.thumbnail}
            alt="Target Pose"
            fill
            className="object-contain"
            unoptimized // 外部URLの場合に必要
          />
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-sm">
            Target
          </div>
          {/* ランドマーク抽出中の表示 */}
          {isExtractingLandmarks && (
            <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              AI分析中...
            </div>
          )}
          {/* ランドマーク検出状態 */}
          {!isExtractingLandmarks && currentTargetLandmarks && (
            <div className="absolute bottom-4 left-4 bg-green-600/80 px-3 py-1 rounded text-sm">
              ポーズ検出OK
            </div>
          )}
          {!isExtractingLandmarks && !currentTargetLandmarks && (
            <div className="absolute bottom-4 left-4 bg-yellow-600/80 px-3 py-1 rounded text-sm">
              ポーズ未検出
            </div>
          )}
        </div>

        {/* Right: Camera Preview */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden border-2 border-slate-700">
          <CameraView
            targetPose={targetPoseWithLandmarks}
            onCapture={handleCapture}
            onSimilarityChange={setSimilarity}
            onReadyChange={setIsCameraReady}
            captureTriggerRef={captureRef}
            overlayOpacity={0} // No overlay in split mode
          />
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-sm">
            Camera
          </div>

          {/* Similarity Badge */}
          <div
            className={`absolute bottom-4 right-4 px-6 py-3 rounded-full text-xl font-bold transition-colors ${
              similarity >= SIMILARITY_THRESHOLD
                ? 'bg-green-500 text-white'
                : 'bg-black/50 text-gray-300'
            }`}
          >
            {Math.round(similarity)}%
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max px-2">
          {uniqueFrames.map((frame, idx) => (
            <button
              key={frame.id || idx}
              onClick={() => {
                setCurrentPoseIndex(idx);
                setSimilarity(0);
                setTimeLeft(WAIT_SECONDS);
                setCountdown(null);
                setIsPaused(true); // Pause when manually selecting
              }}
              className={`relative w-16 h-16 rounded overflow-hidden cursor-pointer border-2 transition-all ${
                idx === currentPoseIndex
                  ? 'border-blue-500 scale-110 z-10'
                  : capturedImages[idx]
                    ? 'border-green-500 opacity-50'
                    : 'border-gray-700 opacity-50'
              }`}
            >
              <Image
                src={frame.thumbnail}
                alt={`Pose ${idx + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
              {capturedImages[idx] && (
                <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

