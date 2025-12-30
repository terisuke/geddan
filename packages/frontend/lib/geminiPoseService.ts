/**
 * Gemini API for anime/illustration pose extraction
 *
 * MediaPipe is optimized for real photos, so it often fails to detect poses
 * in anime/illustration images. Gemini Vision API can extract skeletal info
 * from these images.
 *
 * Performance optimizations:
 * - Lazy loading of Gemini SDK (~500KB)
 * - Singleton model instance
 * - Result caching for repeated images
 */

// Lazy load Gemini SDK to reduce initial bundle size
let geminiModule: typeof import('@google/generative-ai') | null = null;
let geminiLoadPromise: Promise<typeof import('@google/generative-ai')> | null = null;

async function loadGeminiModule(): Promise<typeof import('@google/generative-ai')> {
  if (geminiModule) {
    return geminiModule;
  }

  if (geminiLoadPromise) {
    return geminiLoadPromise;
  }

  geminiLoadPromise = import('@google/generative-ai').then((mod) => {
    geminiModule = mod;
    return mod;
  });

  return geminiLoadPromise;
}

// Singleton instances
let genAIInstance: InstanceType<typeof import('@google/generative-ai').GoogleGenerativeAI> | null = null;
let modelInstance: ReturnType<InstanceType<typeof import('@google/generative-ai').GoogleGenerativeAI>['getGenerativeModel']> | null = null;

// Gemini APIキー（環境変数から取得）
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// MediaPipeランドマークインデックスへのマッピング
// 14関節のジョイント名（MediaPipeの33ランドマークのうち主要なもの）に対応
const JOINT_TO_LANDMARK_INDEX: Record<string, number> = {
  head: 0, // nose
  neck: 0, // MediaPipeには直接ないため、shoulderの中点で計算が必要
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};

export interface GeminiPoseJoints {
  [key: string]: [number, number]; // [x, y] 0-100スケール
}

export interface GeminiPoseData {
  joints: GeminiPoseJoints;
  poseDescription: string;
}

// NormalizedLandmark形式に変換したデータ
export interface NormalizedPoseLandmark {
  x: number; // 0-1
  y: number; // 0-1
  z: number; // 深度（Geminiでは0固定）
  visibility: number; // 信頼度
}

/**
 * リトライ付きでAPIを呼び出す
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let delay = 2000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimit =
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED');
      if (i === maxRetries - 1 || !isRateLimit) {
        throw error;
      }
      console.warn(
        `Gemini API rate limit hit, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error('Max retries reached');
}

// Cache for pose analysis results
const poseCache = new Map<string, GeminiPoseData>();
const MAX_CACHE_SIZE = 50;

/**
 * Get or create singleton model instance
 */
async function getModelInstance() {
  if (modelInstance) {
    return modelInstance;
  }

  const { GoogleGenerativeAI } = await loadGeminiModule();

  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  // Gemini 3 Flash (2025-12) - Pro-level performance at Flash speed
  modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  return modelInstance;
}

/**
 * Analyze anime/illustration pose with Gemini API
 */
export async function analyzeAnimePoseWithGemini(
  imageUrl: string
): Promise<GeminiPoseData | null> {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set, skipping Gemini pose analysis');
    return null;
  }

  // Check cache first
  const cached = poseCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  try {
    const model = await getModelInstance();

    // 画像をBase64に変換
    const base64Data = await imageUrlToBase64(imageUrl);
    if (!base64Data) {
      console.error('Failed to convert image to base64');
      return null;
    }

    const result = await withRetry(async () => {
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        },
        {
          text: `Analyze the skeleton/pose of the character in this anime/illustration image.
Return the coordinates (0-100 scale, where 0,0 is top-left and 100,100 is bottom-right) for these major joints:
- head (center of head/face)
- neck (base of neck)
- left_shoulder, right_shoulder
- left_elbow, right_elbow
- left_wrist, right_wrist
- left_hip, right_hip
- left_knee, right_knee
- left_ankle, right_ankle

Also provide a brief description of the pose in Japanese.

IMPORTANT: Return ONLY valid JSON in this exact format, no markdown or explanations:
{
  "joints": {
    "head": [50, 15],
    "neck": [50, 22],
    "left_shoulder": [40, 28],
    "right_shoulder": [60, 28],
    "left_elbow": [32, 42],
    "right_elbow": [68, 42],
    "left_wrist": [28, 55],
    "right_wrist": [72, 55],
    "left_hip": [42, 55],
    "right_hip": [58, 55],
    "left_knee": [40, 72],
    "right_knee": [60, 72],
    "left_ankle": [38, 90],
    "right_ankle": [62, 90]
  },
  "poseDescription": "両手を広げて立っているポーズ"
}`,
        },
      ]);

      return response.response.text();
    });

    // JSONをパース
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from Gemini response:', result);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiPoseData;

    // Validate required fields
    if (!parsed.joints || !parsed.poseDescription) {
      console.error('Invalid response structure from Gemini:', parsed);
      return null;
    }

    // Cache the result (with LRU-like eviction)
    if (poseCache.size >= MAX_CACHE_SIZE) {
      const firstKey = poseCache.keys().next().value;
      if (firstKey) poseCache.delete(firstKey);
    }
    poseCache.set(imageUrl, parsed);

    return parsed;
  } catch (error) {
    console.error('Gemini pose analysis failed:', error);
    return null;
  }
}

/**
 * Clear the pose analysis cache
 */
export function clearPoseCache(): void {
  poseCache.clear();
}

/**
 * GeminiのジョイントデータをMediaPipe互換のNormalizedLandmark配列に変換
 * MediaPipeは33ランドマークを使用するが、Geminiからは14関節のみ取得
 * 不足分は補間または隣接ポイントで代用
 */
export function convertGeminiToNormalizedLandmarks(
  geminiData: GeminiPoseData
): NormalizedPoseLandmark[] {
  // 33ランドマークの配列を初期化（すべて0）
  const landmarks: NormalizedPoseLandmark[] = Array(33)
    .fill(null)
    .map(() => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
    }));

  const joints = geminiData.joints;

  // Geminiの0-100スケールを0-1に変換して対応するランドマークに設定
  for (const [jointName, coords] of Object.entries(joints)) {
    if (!coords || coords.length !== 2) continue;

    const landmarkIndex = JOINT_TO_LANDMARK_INDEX[jointName];
    if (landmarkIndex !== undefined) {
      landmarks[landmarkIndex] = {
        x: coords[0] / 100,
        y: coords[1] / 100,
        z: 0,
        visibility: 1,
      };
    }
  }

  // noseの位置をheadとして使用（インデックス0）
  if (joints.head) {
    landmarks[0] = {
      x: joints.head[0] / 100,
      y: joints.head[1] / 100,
      z: 0,
      visibility: 1,
    };
  }

  // 顔のランドマーク（1-10）はheadの位置を基準に設定
  const headX = joints.head ? joints.head[0] / 100 : 0.5;
  const headY = joints.head ? joints.head[1] / 100 : 0.15;
  for (let i = 1; i <= 10; i++) {
    landmarks[i] = {
      x: headX + (Math.random() - 0.5) * 0.05,
      y: headY + (Math.random() - 0.5) * 0.05,
      z: 0,
      visibility: 0.5, // 低い信頼度
    };
  }

  return landmarks;
}

/**
 * 画像URLをBase64に変換
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    // data URLの場合
    if (url.startsWith('data:')) {
      return url.split(',')[1] || null;
    }

    // 通常のURLの場合はfetchして変換
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1] || null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return null;
  }
}

/**
 * Gemini APIが利用可能かチェック
 */
export function isGeminiAvailable(): boolean {
  return !!GEMINI_API_KEY;
}
