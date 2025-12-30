'use client';

import { CameraView } from '@/components/camera/CameraView';
import { useAppStore } from '@/store/useAppStore';
import { Pause, Play, SkipForward } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const WAIT_SECONDS = 10;
const COUNTDOWN_SECONDS = 5;
const SIMILARITY_THRESHOLD = 70;

export default function CapturePage() {
  const router = useRouter();
  const {
    uniqueFrames,
    currentPoseIndex,
    capturedImages,
    addCapturedImage,
    nextPose,
    setCurrentPoseIndex
  } = useAppStore();

  const [similarity, setSimilarity] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(WAIT_SECONDS);
  const [countdown, setCountdown] = useState<number | null>(null); // null means not in countdown

  // Camera control ref
  const captureRef = useRef<() => void>(() => { });

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

    // Sound
    try {
      new Audio('/sounds/shutter.mp3').play().catch(() => { });
    } catch { }

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

  // Main Timer Logic
  useEffect(() => {
    if (isPaused || isCapturing) return;

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
  }, [isPaused, isCapturing, timeLeft, countdown, triggerCapture]);

  // Auto-Shutter Logic - disabled linting as intentional async state update
  useEffect(() => {
    if (isPaused || isCapturing || countdown !== null) return;

    if (similarity >= SIMILARITY_THRESHOLD) {
      // Intentional: triggerCapture is a user-initiated action triggered by similarity reaching threshold
      // eslint-disable-next-line react-hooks/set-state-in-effect
      triggerCapture();
    }
  }, [similarity, isPaused, isCapturing, countdown, triggerCapture]);

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

  if (!currentPose) return null;

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
          {countdown !== null ? (
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
          <img
            src={currentPose.thumbnail}
            alt="Target Pose"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-sm">
            Target
          </div>
        </div>

        {/* Right: Camera Preview */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden border-2 border-slate-700">
          <CameraView
            targetPose={currentPose}
            onCapture={handleCapture}
            onSimilarityChange={setSimilarity}
            captureTriggerRef={captureRef}
            overlayOpacity={0} // No overlay in split mode
          />
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded text-sm">
            Camera
          </div>

          {/* Similarity Badge */}
          <div className={`absolute bottom-4 right-4 px-6 py-3 rounded-full text-xl font-bold transition-colors ${similarity >= SIMILARITY_THRESHOLD ? 'bg-green-500 text-white' : 'bg-black/50 text-gray-300'
            }`}>
            {Math.round(similarity)}%
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max px-2">
          {uniqueFrames.map((frame, idx) => (
            <div
              key={idx}
              onClick={() => {
                setCurrentPoseIndex(idx);
                setSimilarity(0);
                setTimeLeft(WAIT_SECONDS);
                setCountdown(null);
                setIsPaused(true); // Pause when manually selecting
              }}
              className={`relative w-16 h-16 rounded overflow-hidden cursor-pointer border-2 transition-all ${idx === currentPoseIndex ? 'border-blue-500 scale-110 z-10' :
                  capturedImages[idx] ? 'border-green-500 opacity-50' : 'border-gray-700 opacity-50'
                }`}
            >
              <img src={frame.thumbnail} className="w-full h-full object-cover" />
              {capturedImages[idx] && (
                <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

