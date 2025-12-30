'use client';

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMediaPipeOptions {
  onResults: (results: PoseLandmarkerResult) => void;
  modelComplexity?: 0 | 1 | 2; // 0: Lite, 1: Full, 2: Heavy
  runningMode?: 'IMAGE' | 'VIDEO';
}

// MediaPipe module cache for lazy loading
let mediaPipeModule: typeof import('@mediapipe/tasks-vision') | null = null;
let mediaPipeLoadPromise: Promise<typeof import('@mediapipe/tasks-vision')> | null = null;

/**
 * Lazy load MediaPipe tasks-vision module
 * This reduces initial bundle size by ~2MB
 */
async function loadMediaPipeModule(): Promise<typeof import('@mediapipe/tasks-vision')> {
  if (mediaPipeModule) {
    return mediaPipeModule;
  }

  if (mediaPipeLoadPromise) {
    return mediaPipeLoadPromise;
  }

  mediaPipeLoadPromise = import('@mediapipe/tasks-vision').then((mod) => {
    mediaPipeModule = mod;
    return mod;
  });

  return mediaPipeLoadPromise;
}

// Singleton cache for PoseLandmarker instances by model complexity
const landmarkerCache = new Map<string, Promise<InstanceType<typeof import('@mediapipe/tasks-vision').PoseLandmarker>>>();

/**
 * Get or create a cached PoseLandmarker instance
 * Reuses instances across hook calls to avoid redundant initialization
 */
async function getCachedLandmarker(
  modelComplexity: 0 | 1 | 2,
  runningMode: 'IMAGE' | 'VIDEO'
): Promise<InstanceType<typeof import('@mediapipe/tasks-vision').PoseLandmarker>> {
  const cacheKey = `${modelComplexity}-${runningMode}`;

  if (landmarkerCache.has(cacheKey)) {
    return landmarkerCache.get(cacheKey)!;
  }

  const promise = (async () => {
    const { FilesetResolver, PoseLandmarker } = await loadMediaPipeModule();

    // Vision tasks WASM files
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm'
    );

    const modelName =
      modelComplexity === 0 ? 'lite' : modelComplexity === 2 ? 'heavy' : 'full';

    // Create PoseLandmarker
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelName}/float16/1/pose_landmarker_${modelName}.task`,
        delegate: 'GPU', // GPU acceleration
      },
      runningMode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    return landmarker;
  })();

  landmarkerCache.set(cacheKey, promise);
  return promise;
}

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseMediaPipeOptions
) {
  const landmarkerRef = useRef<InstanceType<typeof import('@mediapipe/tasks-vision').PoseLandmarker> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

  // Stable reference for callback to prevent unnecessary re-renders
  const onResultsRef = useRef(options.onResults);
  onResultsRef.current = options.onResults;

  // Memoize the results handler
  const handleResults = useCallback((results: PoseLandmarkerResult) => {
    onResultsRef.current(results);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const modelComplexity = options.modelComplexity ?? 1;
    const runningMode = options.runningMode ?? 'VIDEO';

    async function initializeLandmarker() {
      try {
        const landmarker = await getCachedLandmarker(modelComplexity, runningMode);

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
      // Note: Don't close the landmarker here since it's cached and shared
    };
  }, [options.modelComplexity, options.runningMode]);

  // Video stream real-time detection with frame throttling
  useEffect(() => {
    if (!isReady || !videoRef.current || !landmarkerRef.current) return;

    const video = videoRef.current;
    let lastVideoTime = -1;
    let lastProcessedTime = 0;
    let isDetecting = true;

    // Target 30fps for detection to reduce CPU/GPU load
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    function detectPose(timestamp: number) {
      if (!isDetecting || !video || !landmarkerRef.current) {
        return;
      }

      // Check video readiness
      const videoWidth = video.videoWidth || 0;
      const videoHeight = video.videoHeight || 0;
      const isVideoReady = videoWidth > 0 && videoHeight > 0 && video.readyState >= 2;

      if (!isVideoReady) {
        if (isDetecting) {
          animationFrameId.current = requestAnimationFrame(detectPose);
        }
        return;
      }

      // Frame throttling: skip if not enough time has passed
      const elapsed = timestamp - lastProcessedTime;
      if (elapsed < FRAME_INTERVAL) {
        if (isDetecting) {
          animationFrameId.current = requestAnimationFrame(detectPose);
        }
        return;
      }

      // Only process new frames
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastProcessedTime = timestamp;

        try {
          const results = landmarkerRef.current.detectForVideo(video, timestamp);
          if (isDetecting) {
            handleResults(results);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // Ignore abort/interrupt errors (normal during navigation)
          if (!errorMessage.includes('AbortError') &&
              !errorMessage.includes('interrupted') &&
              !errorMessage.includes('ROI width and height must be > 0')) {
            console.error('Pose detection error:', err);
          }
          isDetecting = false;
          return;
        }
      }

      if (isDetecting) {
        animationFrameId.current = requestAnimationFrame(detectPose);
      }
    }

    // Start detection loop
    animationFrameId.current = requestAnimationFrame(detectPose);

    return () => {
      isDetecting = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isReady, videoRef, handleResults]);

  return { isReady, error };
}

/**
 * Cleanup function to dispose all cached landmarkers
 * Call this when the app is unmounting or when you need to free resources
 */
export async function disposeMediaPipeLandmarkers(): Promise<void> {
  for (const [, promise] of landmarkerCache) {
    try {
      const landmarker = await promise;
      landmarker.close();
    } catch {
      // Ignore errors during cleanup
    }
  }
  landmarkerCache.clear();
  mediaPipeModule = null;
  mediaPipeLoadPromise = null;
}

