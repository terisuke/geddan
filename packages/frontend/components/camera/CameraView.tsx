'use client';

import { useCamera } from '@/hooks/useCamera';
import { useMediaPipe } from '@/hooks/useMediaPipe';
import { calculatePoseSimilarity } from '@/lib/poseComparison';
import type {
  NormalizedLandmark,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import Image from 'next/image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface TargetPoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface TargetPose {
  thumbnail: string;
  pose_landmarks: {
    landmarks: TargetPoseLandmark[];
  };
}

interface CameraViewProps {
  targetPose: TargetPose;
  onCapture: (blob: Blob) => void;
  onSimilarityChange?: (similarity: number) => void;
  onReadyChange?: (isReady: boolean) => void;
  captureTriggerRef?: React.MutableRefObject<() => void>;
  overlayOpacity?: number;
}

// Memoized overlay image component to prevent unnecessary re-renders
const PoseOverlay = memo(function PoseOverlay({
  thumbnail,
  opacity,
}: {
  thumbnail: string;
  opacity: number;
}) {
  if (opacity <= 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
      style={{ opacity }}
    >
      <Image
        src={thumbnail}
        alt="Target pose"
        fill
        className="object-cover"
        unoptimized
        priority={false}
      />
    </div>
  );
});

// Loading state component
const LoadingOverlay = memo(function LoadingOverlay({
  isActive,
  isMediaPipeReady,
}: {
  isActive: boolean;
  isMediaPipeReady: boolean;
}) {
  if (isActive && isMediaPipeReady) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
        <p>{!isActive ? "Starting Camera..." : "Loading AI Model..."}</p>
      </div>
    </div>
  );
});

function CameraViewComponent({
  targetPose,
  onCapture,
  onSimilarityChange,
  onReadyChange,
  captureTriggerRef,
  overlayOpacity = 0.3,
}: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } =
    useCamera({ facingMode: 'user' });

  // Stable refs for callbacks to prevent unnecessary re-renders
  const onSimilarityChangeRef = useRef(onSimilarityChange);
  const onCaptureRef = useRef(onCapture);
  onSimilarityChangeRef.current = onSimilarityChange;
  onCaptureRef.current = onCapture;

  // Memoize target landmarks conversion to avoid recalculating on each frame
  const targetLandmarks = useMemo(() => {
    const landmarks = targetPose?.pose_landmarks?.landmarks;
    if (!landmarks || landmarks.length === 0) return null;

    return landmarks.map(
      (lm): NormalizedLandmark => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      })
    );
  }, [targetPose?.pose_landmarks?.landmarks]);

  const hasTargetLandmarks = targetLandmarks !== null && targetLandmarks.length > 0;

  // Memoized capture function
  const captureFrame = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally for the capture to match preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCaptureRef.current(blob);
        }
      },
      'image/jpeg',
      0.92
    );
  }, [videoRef]);

  // Expose capture function to parent
  useEffect(() => {
    if (captureTriggerRef) {
      captureTriggerRef.current = captureFrame;
    }
  }, [captureTriggerRef, captureFrame]);

  // Throttled similarity update to reduce re-renders
  const lastSimilarityRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const SIMILARITY_UPDATE_INTERVAL = 100; // Update at most every 100ms

  const handleResults = useCallback(
    (results: PoseLandmarkerResult) => {
      // No pose detected from camera
      if (!results.landmarks || results.landmarks.length === 0) {
        if (lastSimilarityRef.current !== 0) {
          lastSimilarityRef.current = 0;
          onSimilarityChangeRef.current?.(0);
        }
        return;
      }

      // No target landmarks to compare against
      if (!targetLandmarks) {
        if (lastSimilarityRef.current !== 0) {
          lastSimilarityRef.current = 0;
          onSimilarityChangeRef.current?.(0);
        }
        return;
      }

      // Throttle similarity updates
      const now = performance.now();
      if (now - lastUpdateTimeRef.current < SIMILARITY_UPDATE_INTERVAL) {
        return;
      }
      lastUpdateTimeRef.current = now;

      const currentLandmarks = results.landmarks[0] as NormalizedLandmark[];
      const { similarity: sim } = calculatePoseSimilarity(
        targetLandmarks,
        currentLandmarks
      );

      // Only update if similarity changed significantly (>1%)
      if (Math.abs(sim - lastSimilarityRef.current) >= 1) {
        lastSimilarityRef.current = sim;
        onSimilarityChangeRef.current?.(sim);
      }
    },
    [targetLandmarks]
  );

  const { isReady: isMediaPipeReady, error: mediaPipeError } = useMediaPipe(
    videoRef,
    {
      onResults: handleResults,
      modelComplexity: 1,
    }
  );

  // カメラとMediaPipeの準備状態を親に通知
  useEffect(() => {
    const isReady = isActive && isMediaPipeReady;
    onReadyChange?.(isReady);
  }, [isActive, isMediaPipeReady, onReadyChange]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  if (cameraError) {
    return (
      <div className="text-center p-8 bg-red-900/50 rounded-lg border border-red-500">
        <p className="text-red-200 font-semibold mb-2">Camera Error</p>
        <p className="text-red-300 text-sm">{cameraError}</p>
        <button
          onClick={startCamera}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (mediaPipeError) {
    return (
      <div className="text-center p-8 bg-yellow-900/50 rounded-lg border border-yellow-500">
        <p className="text-yellow-200 font-semibold mb-2">
          MediaPipe Error
        </p>
        <p className="text-yellow-300 text-sm">{mediaPipeError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Video Preview */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100" // Mirror preview
        playsInline
        muted
        autoPlay
      />

      {/* Target Pose Overlay (Optional, controlled by prop) */}
      <PoseOverlay thumbnail={targetPose.thumbnail} opacity={overlayOpacity} />

      {/* No landmarks warning */}
      {!hasTargetLandmarks && isActive && isMediaPipeReady && (
        <div className="absolute top-4 right-4 bg-yellow-600/90 px-3 py-1 rounded text-sm">
          比較準備中...
        </div>
      )}

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading States */}
      <LoadingOverlay isActive={isActive} isMediaPipeReady={isMediaPipeReady} />
    </div>
  );
}

// Export memoized component to prevent unnecessary re-renders from parent
export const CameraView = memo(CameraViewComponent);

