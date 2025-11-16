'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

interface UseMediaPipeOptions {
  onResults: (results: PoseLandmarkerResult) => void;
  modelComplexity?: 0 | 1 | 2; // 0: Lite, 1: Full, 2: Heavy
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

        const modelName =
          options.modelComplexity === 0
            ? 'lite'
            : options.modelComplexity === 2
              ? 'heavy'
              : 'full';

        // PoseLandmarkerを作成
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelName}/float16/1/pose_landmarker_${modelName}.task`,
            delegate: 'GPU', // GPU加速を有効化
          },
          runningMode: options.runningMode || 'VIDEO',
          numPoses: 1, // 1人のポーズのみ検出
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to initialize MediaPipe'
          );
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

