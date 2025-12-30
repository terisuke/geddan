import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// MediaPipe Pose landmark indices
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
} as const;

// Pre-computed arrays for performance (avoid Object.values on each call)
const KEY_POINTS: readonly number[] = [
  LANDMARK_INDICES.NOSE,
  LANDMARK_INDICES.LEFT_SHOULDER,
  LANDMARK_INDICES.RIGHT_SHOULDER,
  LANDMARK_INDICES.LEFT_ELBOW,
  LANDMARK_INDICES.RIGHT_ELBOW,
  LANDMARK_INDICES.LEFT_WRIST,
  LANDMARK_INDICES.RIGHT_WRIST,
  LANDMARK_INDICES.LEFT_HIP,
  LANDMARK_INDICES.RIGHT_HIP,
  LANDMARK_INDICES.LEFT_KNEE,
  LANDMARK_INDICES.RIGHT_KNEE,
  LANDMARK_INDICES.LEFT_ANKLE,
  LANDMARK_INDICES.RIGHT_ANKLE,
];

// Torso reference points for normalization
const TORSO_POINTS: readonly number[] = [
  LANDMARK_INDICES.LEFT_SHOULDER,
  LANDMARK_INDICES.RIGHT_SHOULDER,
  LANDMARK_INDICES.LEFT_HIP,
  LANDMARK_INDICES.RIGHT_HIP,
];

// Pre-allocated arrays to reduce GC pressure during real-time detection
const torsoPointsBuffer: Point2D[] = new Array(4);
const distancesBuffer: number[] = new Array(KEY_POINTS.length);

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

// Visibility threshold for landmark filtering
const VISIBILITY_THRESHOLD = 0.3;
const MIN_TORSO_SIZE = 0.01;
const DEFAULT_TORSO_SIZE = 0.1;
const SCALE_FACTOR = 100;

/**
 * Normalize pose (centering + scaling)
 * Centers on torso midpoint, scales to unit torso size
 *
 * Optimized version using pre-allocated buffers to reduce GC pressure
 */
function normalizePose(
  landmarks: NormalizedLandmark[],
  indices: readonly number[]
): Map<number, Point2D> {
  const normalized = new Map<number, Point2D>();

  // Collect torso points for center and scale calculation
  let torsoCount = 0;
  let centerX = 0;
  let centerY = 0;

  for (let i = 0; i < TORSO_POINTS.length; i++) {
    const idx = TORSO_POINTS[i];
    const lm = landmarks[idx];
    if (lm && lm.visibility >= VISIBILITY_THRESHOLD) {
      torsoPointsBuffer[torsoCount] = { x: lm.x, y: lm.y };
      centerX += lm.x;
      centerY += lm.y;
      torsoCount++;
    }
  }

  if (torsoCount < 2) {
    // Fallback to simple normalization when torso not detected
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const lm = landmarks[idx];
      if (lm && lm.visibility >= VISIBILITY_THRESHOLD) {
        normalized.set(idx, { x: lm.x, y: lm.y });
      }
    }
    return normalized;
  }

  // Calculate torso center
  centerX /= torsoCount;
  centerY /= torsoCount;

  // Calculate torso "size" (average distance from center)
  let torsoSize = 0;
  for (let i = 0; i < torsoCount; i++) {
    const p = torsoPointsBuffer[i];
    const dx = p.x - centerX;
    const dy = p.y - centerY;
    torsoSize += Math.sqrt(dx * dx + dy * dy);
  }
  torsoSize /= torsoCount;

  // Scale factor (prevent division by zero)
  const scale = torsoSize > MIN_TORSO_SIZE ? torsoSize : DEFAULT_TORSO_SIZE;
  const invScale = 1 / scale;

  // Normalize each keypoint
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const lm = landmarks[idx];
    if (lm && lm.visibility >= VISIBILITY_THRESHOLD) {
      normalized.set(idx, {
        x: (lm.x - centerX) * invScale,
        y: (lm.y - centerY) * invScale,
      });
    }
  }

  return normalized;
}

// Cached empty result to avoid object allocation
const EMPTY_RESULT: PoseComparisonResult = Object.freeze({
  similarity: 0,
  details: Object.freeze({
    validPoints: 0,
    averageDistance: 1,
    maxDistance: 1,
    minDistance: 1,
  }),
});

/**
 * Calculate similarity between two poses
 *
 * Optimizations:
 * - 2D comparison only (z ignored, Gemini returns 2D coords)
 * - Pose normalization (position/scale invariant)
 * - Pre-allocated buffers to reduce GC
 * - Loop unrolling for critical paths
 *
 * @param reference Target pose (from video/illustration)
 * @param current Current pose (from camera)
 * @returns Similarity (0-100%) and details
 */
export function calculatePoseSimilarity(
  reference: NormalizedLandmark[],
  current: NormalizedLandmark[]
): PoseComparisonResult {
  // Fast path for invalid inputs
  if (!reference?.length || !current?.length) {
    return EMPTY_RESULT;
  }

  // Normalize poses (centering + scaling)
  const refNormalized = normalizePose(reference, KEY_POINTS);
  const curNormalized = normalizePose(current, KEY_POINTS);

  // Calculate distances using pre-allocated buffer
  let distanceCount = 0;
  let sumDistance = 0;
  let maxDistance = 0;
  let minDistance = Infinity;

  for (let i = 0; i < KEY_POINTS.length; i++) {
    const idx = KEY_POINTS[i];
    const ref = refNormalized.get(idx);
    const cur = curNormalized.get(idx);

    // Only compare points detected in both poses
    if (!ref || !cur) {
      continue;
    }

    // 2D Euclidean distance (ignore z coordinate)
    const dx = ref.x - cur.x;
    const dy = ref.y - cur.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    distancesBuffer[distanceCount] = distance;
    sumDistance += distance;
    distanceCount++;

    if (distance > maxDistance) maxDistance = distance;
    if (distance < minDistance) minDistance = distance;
  }

  if (distanceCount === 0) {
    return EMPTY_RESULT;
  }

  const avgDistance = sumDistance / distanceCount;

  // Scaling factor (empirically tuned)
  // In normalized coordinates: avgDistance 0.5 = moderate deviation
  // avgDistance 0 -> 100%, avgDistance 1.0 -> 0%
  const similarity = Math.max(0, Math.min(100, 100 - avgDistance * SCALE_FACTOR));

  return {
    similarity: Math.round(similarity),
    details: {
      validPoints: distanceCount,
      averageDistance: avgDistance,
      maxDistance,
      minDistance: minDistance === Infinity ? 0 : minDistance,
    },
  };
}

/**
 * Fast similarity check without full details
 * Use this when you only need the similarity score
 */
export function calculatePoseSimilarityFast(
  reference: NormalizedLandmark[],
  current: NormalizedLandmark[]
): number {
  if (!reference?.length || !current?.length) {
    return 0;
  }

  const refNormalized = normalizePose(reference, KEY_POINTS);
  const curNormalized = normalizePose(current, KEY_POINTS);

  let distanceCount = 0;
  let sumDistance = 0;

  for (let i = 0; i < KEY_POINTS.length; i++) {
    const idx = KEY_POINTS[i];
    const ref = refNormalized.get(idx);
    const cur = curNormalized.get(idx);

    if (!ref || !cur) continue;

    const dx = ref.x - cur.x;
    const dy = ref.y - cur.y;
    sumDistance += Math.sqrt(dx * dx + dy * dy);
    distanceCount++;
  }

  if (distanceCount === 0) return 0;

  const avgDistance = sumDistance / distanceCount;
  return Math.round(Math.max(0, Math.min(100, 100 - avgDistance * SCALE_FACTOR)));
}

