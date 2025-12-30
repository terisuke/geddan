'use client';

import { useCamera } from '@/hooks/useCamera';
import { useMediaPipe } from '@/hooks/useMediaPipe';
import { calculatePoseSimilarity } from '@/lib/poseComparison';
import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  targetPose: {
    thumbnail: string;
    pose_landmarks: {
      landmarks: Array<{
        x: number;
        y: number;
        z: number;
        visibility: number;
      }>;
    };
  };
  onCapture: (blob: Blob) => void;
  onSimilarityChange?: (similarity: number) => void;
  captureTriggerRef?: React.MutableRefObject<() => void>;
  overlayOpacity?: number;
}

export function CameraView({
  targetPose,
  onCapture,
  onSimilarityChange,
  captureTriggerRef,
  overlayOpacity = 0.3
}: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [similarity, setSimilarity] = useState(0);

  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } =
    useCamera({ facingMode: 'user' });

  const captureFrame = async () => {
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

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // Expose capture function to parent
  useEffect(() => {
    if (captureTriggerRef) {
      captureTriggerRef.current = captureFrame;
    }
  }, [captureTriggerRef]);

  const handleResults = (results: PoseLandmarkerResult) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      setSimilarity(0);
      onSimilarityChange?.(0);
      return;
    }

    // Mirror landmarks if using user-facing camera (optional, depends on MediaPipe config)
    // For now assuming MediaPipe returns normalized coords consistent with image

    const currentLandmarks = results.landmarks[0] as NormalizedLandmark[];
    const targetLandmarks = targetPose.pose_landmarks.landmarks.map(
      (lm) =>
        ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility,
        }) as NormalizedLandmark
    );

    const { similarity: sim } = calculatePoseSimilarity(
      targetLandmarks,
      currentLandmarks
    );

    setSimilarity(sim);
    onSimilarityChange?.(sim);
  };

  const { isReady: isMediaPipeReady, error: mediaPipeError } = useMediaPipe(
    videoRef,
    {
      onResults: handleResults,
      modelComplexity: 1,
    }
  );

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
      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ opacity: overlayOpacity }}
        >
          <img
            src={targetPose.thumbnail}
            alt="Target pose"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading States */}
      {(!isActive || !isMediaPipeReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
            <p>{!isActive ? "Starting Camera..." : "Loading AI Model..."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

