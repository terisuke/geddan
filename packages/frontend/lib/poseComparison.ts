import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// MediaPipe Pose ランドマークインデックス
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
const LANDMARK_INDICES = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const KEY_POINTS = Object.values(LANDMARK_INDICES);

// 体幹の基準点（正規化用）
const TORSO_POINTS = [
  LANDMARK_INDICES.LEFT_SHOULDER,
  LANDMARK_INDICES.RIGHT_SHOULDER,
  LANDMARK_INDICES.LEFT_HIP,
  LANDMARK_INDICES.RIGHT_HIP,
];

export interface PoseComparisonResult {
  similarity: number; // 0-100
  details: {
    validPoints: number;
    averageDistance: number;
    maxDistance: number;
    minDistance: number;
  };
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * ポーズを正規化（中心化＋スケーリング）
 * 体幹の中心を原点に、体幹サイズを1に正規化
 */
function normalizePose(
  landmarks: NormalizedLandmark[],
  indices: number[]
): Map<number, Point2D> {
  const normalized = new Map<number, Point2D>();

  // 体幹点を収集して中心とスケールを計算
  const torsoPoints: Point2D[] = [];
  for (const idx of TORSO_POINTS) {
    const lm = landmarks[idx];
    if (lm && lm.visibility >= 0.3) {
      torsoPoints.push({ x: lm.x, y: lm.y });
    }
  }

  if (torsoPoints.length < 2) {
    // 体幹が検出できない場合、単純な正規化
    for (const idx of indices) {
      const lm = landmarks[idx];
      if (lm && lm.visibility >= 0.3) {
        normalized.set(idx, { x: lm.x, y: lm.y });
      }
    }
    return normalized;
  }

  // 体幹の中心を計算
  const centerX = torsoPoints.reduce((sum, p) => sum + p.x, 0) / torsoPoints.length;
  const centerY = torsoPoints.reduce((sum, p) => sum + p.y, 0) / torsoPoints.length;

  // 体幹の「サイズ」を計算（各点から中心への平均距離）
  const torsoSize = torsoPoints.reduce((sum, p) => {
    return sum + Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
  }, 0) / torsoPoints.length;

  // スケールファクター（0除算防止）
  const scale = torsoSize > 0.01 ? torsoSize : 0.1;

  // 各キーポイントを正規化
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (lm && lm.visibility >= 0.3) {
      normalized.set(idx, {
        x: (lm.x - centerX) / scale,
        y: (lm.y - centerY) / scale,
      });
    }
  }

  return normalized;
}

/**
 * 2つのポーズの類似度を計算
 *
 * 改良点:
 * - 2D比較のみ（z座標を無視、Geminiは2D座標のみ返すため）
 * - ポーズ正規化（位置・スケール不変）
 * - より寛容なスケーリング係数
 *
 * @param reference 目標ポーズ（元動画/イラストから抽出）
 * @param current 現在のポーズ（カメラから取得）
 * @returns 類似度（0-100%）と詳細情報
 */
export function calculatePoseSimilarity(
  reference: NormalizedLandmark[],
  current: NormalizedLandmark[]
): PoseComparisonResult {
  if (!reference?.length || !current?.length) {
    return {
      similarity: 0,
      details: {
        validPoints: 0,
        averageDistance: 1,
        maxDistance: 1,
        minDistance: 1,
      },
    };
  }

  // ポーズを正規化（中心化＋スケーリング）
  const refNormalized = normalizePose(reference, KEY_POINTS);
  const curNormalized = normalizePose(current, KEY_POINTS);

  const distances: number[] = [];

  for (const idx of KEY_POINTS) {
    const ref = refNormalized.get(idx);
    const cur = curNormalized.get(idx);

    // 両方のポーズで検出されている点のみ比較
    if (!ref || !cur) {
      continue;
    }

    // 2Dユークリッド距離を計算（z座標は無視）
    const distance = Math.sqrt(
      Math.pow(ref.x - cur.x, 2) + Math.pow(ref.y - cur.y, 2)
    );

    distances.push(distance);
  }

  if (distances.length === 0) {
    return {
      similarity: 0,
      details: {
        validPoints: 0,
        averageDistance: 1,
        maxDistance: 1,
        minDistance: 1,
      },
    };
  }

  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances);

  // スケーリング係数（経験的に調整）
  // 正規化後の座標系では、avgDistance 0.5 は中程度のずれ
  // avgDistance 0 → 100%, avgDistance 1.0 → 0%
  const SCALE_FACTOR = 100;
  const similarity = Math.max(0, Math.min(100, 100 - avgDistance * SCALE_FACTOR));

  return {
    similarity: Math.round(similarity),
    details: {
      validPoints: distances.length,
      averageDistance: avgDistance,
      maxDistance,
      minDistance,
    },
  };
}

