'use client';

import { useRef, useEffect, useState } from 'react';
import { useMediaPipe } from '@/hooks/useMediaPipe';
import { useCamera } from '@/hooks/useCamera';
import { calculatePoseSimilarity } from '@/lib/poseComparison';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

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
}

export function CameraView({
  targetPose,
  onCapture,
  onSimilarityChange,
}: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [similarity, setSimilarity] = useState(0);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const CAPTURE_COOLDOWN = 500; // 500ms

  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } =
    useCamera({ facingMode: 'user' });

  const handleResults = (results: PoseLandmarkerResult) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      setSimilarity(0);
      onSimilarityChange?.(0);
      return;
    }

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

    // 自動シャッター（85%以上、クールダウン中でない）
    if (sim >= 85) {
      const now = Date.now();
      if (now - lastCaptureTime > CAPTURE_COOLDOWN) {
        captureFrame();
        setLastCaptureTime(now);
      }
    }
  };

  const { isReady: isMediaPipeReady, error: mediaPipeError } = useMediaPipe(
    videoRef,
    {
      onResults: handleResults,
      modelComplexity: 1, // Full model
    }
  );

  const captureFrame = async () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

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

  useEffect(() => {
    if (isActive && isMediaPipeReady) {
      // カメラとMediaPipeが準備できたら自動開始
    }
  }, [isActive, isMediaPipeReady]);

  useEffect(() => {
    // コンポーネントマウント時にカメラを開始
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  if (cameraError) {
    return (
      <div className="text-center p-8 bg-red-50 rounded-lg">
        <p className="text-red-700 font-semibold mb-2">カメラエラー</p>
        <p className="text-red-600 text-sm">{cameraError}</p>
        <button
          onClick={startCamera}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          再試行
        </button>
      </div>
    );
  }

  if (mediaPipeError) {
    return (
      <div className="text-center p-8 bg-yellow-50 rounded-lg">
        <p className="text-yellow-700 font-semibold mb-2">
          MediaPipe初期化エラー
        </p>
        <p className="text-yellow-600 text-sm">{mediaPipeError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* カメラビュー */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* 目標ポーズオーバーレイ（半透明） */}
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={targetPose.thumbnail}
            alt="Target pose"
            className="w-full h-full object-cover opacity-30"
          />
        </div>

        {/* キャンバス（非表示、キャプチャ用） */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* ステータス表示 */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
          <p className="text-white text-lg">カメラを起動中...</p>
        </div>
      )}

      {isActive && !isMediaPipeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
          <p className="text-white text-lg">MediaPipeを初期化中...</p>
        </div>
      )}
    </div>
  );
}

