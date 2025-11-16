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

export interface PoseComparisonResult {
  similarity: number; // 0-100
  details: {
    validPoints: number;
    averageDistance: number;
    maxDistance: number;
    minDistance: number;
  };
}

/**
 * 2つのポーズの類似度を計算
 *
 * @param reference 目標ポーズ（元動画から抽出）
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

  const distances: number[] = [];

  for (const idx of KEY_POINTS) {
    const ref = reference[idx];
    const cur = current[idx];

    // 信頼度が低い点はスキップ
    if (!ref || !cur || ref.visibility < 0.5 || cur.visibility < 0.5) {
      continue;
    }

    // 3Dユークリッド距離を計算
    const distance = Math.sqrt(
      Math.pow(ref.x - cur.x, 2) +
        Math.pow(ref.y - cur.y, 2) +
        Math.pow(ref.z - cur.z, 2)
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

  const avgDistance =
    distances.reduce((a, b) => a + b, 0) / distances.length;
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances);

  // スケーリング係数（経験的に調整）
  // 平均距離0.005で類似度100%, 0.01で50%, 0.015で0%程度
  const SCALE_FACTOR = 200;
  const similarity = Math.max(
    0,
    Math.min(100, 100 - avgDistance * SCALE_FACTOR)
  );

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

