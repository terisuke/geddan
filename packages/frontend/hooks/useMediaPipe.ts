'use client';

import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';

interface UseMediaPipeOptions {
  onResults: (results: PoseLandmarkerResult) => void;
  modelComplexity?: 0 | 1 | 2; // 0: Lite, 1: Full, 2: Heavy
  runningMode?: 'IMAGE' | 'VIDEO';
}

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseMediaPipeOptions
) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

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
    let isDetecting = true; // 検出ループの実行フラグ

    async function detectPose() {
      if (!isDetecting || !video || !landmarkerRef.current) {
        // 検出が停止された、またはビデオ/landmarkerが利用できない場合は検出ループを停止
        return;
      }

      // ビデオ要素が有効なサイズを持つことを確認（MediaPipeエラーを防ぐ）
      const videoWidth = video.videoWidth || 0;
      const videoHeight = video.videoHeight || 0;
      const isVideoReady = videoWidth > 0 && videoHeight > 0 && video.readyState >= 2; // HAVE_CURRENT_DATA

      if (!isVideoReady) {
        // ビデオが準備できていない場合は次のフレームを待つ
        if (isDetecting) {
          animationFrameId.current = requestAnimationFrame(detectPose);
        }
        return;
      }

      const now = performance.now();

      // 新しいフレームの場合のみ処理
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          const results = landmarkerRef.current.detectForVideo(video, now);
          if (isDetecting) {
            options.onResults(results);
          }
        } catch (err) {
          // MediaPipeエラーをログに記録（ただし、ページ遷移による中断エラーは無視）
          const errorMessage = err instanceof Error ? err.message : String(err);
          // AbortErrorや中断エラーは正常な動作なので無視
          if (!errorMessage.includes('AbortError') && !errorMessage.includes('interrupted') && !errorMessage.includes('ROI width and height must be > 0')) {
            console.error('Pose detection error:', err);
          }
          // エラーが発生した場合も検出を停止（無限ループを防ぐ）
          isDetecting = false;
          return;
        }
      }

      // 次のフレームをリクエスト
      if (isDetecting) {
        animationFrameId.current = requestAnimationFrame(detectPose);
      }
    }

    // 検出ループ開始
    detectPose();

    return () => {
      isDetecting = false; // 検出を停止
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isReady, videoRef, options]);

  return { isReady, error };
}

