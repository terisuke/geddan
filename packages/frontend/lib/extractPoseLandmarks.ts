/**
 * Extract Pose Landmarks from Image
 *
 * MediaPipe Tasks Vision を使用して、静止画像からポーズランドマークを抽出します。
 * 参照実装: references/posevision-ai/services/poseService.ts
 */

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

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
}

/**
 * 画像URLからポーズランドマークを抽出
 *
 * @param imageUrl - 画像のURL（data URL、blob URL、または通常のURL）
 * @returns ランドマーク情報、または検出失敗時はnull
 */
export async function extractPoseLandmarksFromImage(
  imageUrl: string
): Promise<ExtractedPose | null> {
  try {
    const landmarker = await getImageLandmarker();

    // 画像を読み込み
    const img = await loadImage(imageUrl);

    // ランドマーク検出
    const result = landmarker.detect(img);

    if (!result.landmarks || result.landmarks.length === 0) {
      console.warn('No pose detected in image:', imageUrl.substring(0, 50));
      return null;
    }

    return {
      landmarks: result.landmarks[0] as NormalizedLandmark[],
      worldLandmarks: result.worldLandmarks?.[0] as
        | NormalizedLandmark[]
        | undefined,
    };
  } catch (error) {
    console.error('Failed to extract pose landmarks:', error);
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
