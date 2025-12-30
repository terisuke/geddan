/**
 * Extract Pose Landmarks from Image
 *
 * ハイブリッドアプローチ：
 * 1. Gemini API（アニメ/イラスト画像に対応）を優先
 * 2. MediaPipe（実写画像に最適）をフォールバック
 *
 * 参照実装: references/anime-pose-mimic/services/geminiService.ts
 */

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import {
  analyzeAnimePoseWithGemini,
  convertGeminiToNormalizedLandmarks,
  isGeminiAvailable,
} from './geminiPoseService';

// Singleton PoseLandmarker instance for image processing
let imageLandmarker: PoseLandmarker | null = null;
let isInitializing = false;
let initPromise: Promise<PoseLandmarker> | null = null;

/**
 * PoseLandmarker インスタンスを初期化（シングルトン）
 */
async function getImageLandmarker(): Promise<PoseLandmarker> {
  if (imageLandmarker) {
    return imageLandmarker;
  }

  if (initPromise) {
    return initPromise;
  }

  if (isInitializing) {
    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getImageLandmarker();
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE', // 静止画モード
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      imageLandmarker = landmarker;
      return landmarker;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

export interface ExtractedPose {
  landmarks: NormalizedLandmark[];
  worldLandmarks?: NormalizedLandmark[];
  source: 'gemini' | 'mediapipe';
  poseDescription?: string;
}

/**
 * 画像URLからポーズランドマークを抽出
 *
 * ハイブリッドアプローチ:
 * 1. Gemini APIが利用可能な場合、Geminiで解析を試みる
 * 2. Geminiで失敗した場合、MediaPipeにフォールバック
 *
 * @param imageUrl - 画像のURL（data URL、blob URL、または通常のURL）
 * @returns ランドマーク情報、または検出失敗時はnull
 */
export async function extractPoseLandmarksFromImage(
  imageUrl: string
): Promise<ExtractedPose | null> {
  // 1. Gemini APIを試す（アニメ/イラスト画像に対応）
  if (isGeminiAvailable()) {
    console.log('Attempting pose extraction with Gemini API...');
    const geminiResult = await analyzeAnimePoseWithGemini(imageUrl);

    if (geminiResult) {
      console.log('Gemini pose extraction successful:', geminiResult.poseDescription);
      const landmarks = convertGeminiToNormalizedLandmarks(geminiResult);
      return {
        landmarks: landmarks as NormalizedLandmark[],
        source: 'gemini',
        poseDescription: geminiResult.poseDescription,
      };
    }
    console.warn('Gemini pose extraction failed, falling back to MediaPipe');
  } else {
    console.log('Gemini API not available, using MediaPipe directly');
  }

  // 2. MediaPipeにフォールバック（実写画像向け）
  return extractWithMediaPipe(imageUrl);
}

/**
 * MediaPipeでポーズ抽出
 */
async function extractWithMediaPipe(
  imageUrl: string
): Promise<ExtractedPose | null> {
  try {
    const landmarker = await getImageLandmarker();

    // 画像を読み込み
    const img = await loadImage(imageUrl);

    // ランドマーク検出
    const result = landmarker.detect(img);

    if (!result.landmarks || result.landmarks.length === 0) {
      console.warn('MediaPipe: No pose detected in image:', imageUrl.substring(0, 50));
      return null;
    }

    return {
      landmarks: result.landmarks[0] as NormalizedLandmark[],
      worldLandmarks: result.worldLandmarks?.[0] as
        | NormalizedLandmark[]
        | undefined,
      source: 'mediapipe',
    };
  } catch (error) {
    console.error('MediaPipe: Failed to extract pose landmarks:', error);
    return null;
  }
}

/**
 * 複数の画像からポーズランドマークを一括抽出
 *
 * @param imageUrls - 画像URLの配列
 * @param onProgress - 進捗コールバック (current, total)
 * @returns ランドマーク情報の配列（検出失敗はnull）
 */
export async function extractPoseLandmarksFromImages(
  imageUrls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<(ExtractedPose | null)[]> {
  const results: (ExtractedPose | null)[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    onProgress?.(i + 1, imageUrls.length);
    const result = await extractPoseLandmarksFromImage(imageUrls[i]);
    results.push(result);
  }

  return results;
}

/**
 * 画像URLからHTMLImageElementを読み込み
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // CORS対応
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * PoseLandmarkerインスタンスを破棄（クリーンアップ用）
 */
export function disposeImageLandmarker(): void {
  if (imageLandmarker) {
    imageLandmarker.close();
    imageLandmarker = null;
    initPromise = null;
  }
}
