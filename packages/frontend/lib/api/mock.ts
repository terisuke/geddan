import type {
  UploadResponse,
  AnalysisResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatusResponse,
} from '@/types';

// モックデータ用のヘルパー関数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * モック: 動画アップロード
 */
export async function mockUploadVideo(file: File): Promise<UploadResponse> {
  await sleep(1000);
  return {
    job_id: `mock-${Date.now()}`,
    status: 'processing',
    message: 'Video uploaded successfully. Analysis will begin shortly.',
    filename: file.name,
    size: file.size,
    content_type: file.type || 'application/octet-stream',
    created_at: new Date().toISOString(),
  };
}

/**
 * モック: 解析ステータス取得
 */
export async function mockGetAnalysisStatus(
  jobId: string
): Promise<AnalysisResponse> {
  await sleep(500);
  
  // 進捗をシミュレート（0-100%）
  const progress = Math.min(100, ((Date.now() % 30000) / 300));
  
  if (progress >= 100) {
    // Generate mock clusters for completed analysis
    const mockClusters = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 15) + 5, // Random size between 5-20
      thumbnail_url: `/outputs/${jobId}/thumbnails/cluster-${i}.jpg`,
    }));

    return {
      job_id: jobId,
      status: 'completed',
      progress: 100,
      current_step: 'Done!',
      metadata: {
        original_fps: 24,
        duration: 5.0,
        total_frames: 120,
        unique_count: mockClusters.length,
        resolution: '1920x1080',
      },
      // New structure (preferred)
      result: {
        clusters: mockClusters,
      },
      // Legacy structure (deprecated, but kept for backward compatibility)
      frame_mapping: {
        '0': 0,
        '1': 1,
        '2': 0,
        '3': 2,
      },
      unique_frames: [
        {
          id: 0,
          thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          pose_landmarks: {
            landmarks: Array(33).fill(0).map(() => ({
              x: Math.random(),
              y: Math.random(),
              z: Math.random() * 0.1,
              visibility: 0.9,
            })),
          },
        },
      ],
    };
  }

  const steps = [
    'Extracting frames...',
    'Detecting poses...',
    'Generating thumbnails...',
  ];
  const stepIndex = Math.floor(progress / 33);

  return {
    job_id: jobId,
    status: 'processing',
    progress: Math.round(progress),
    current_step: steps[stepIndex] || 'Processing...',
    eta_seconds: Math.round((100 - progress) * 0.3),
  };
}

/**
 * モック: 動画生成
 */
export async function mockGenerateVideo(
  request: GenerateRequest
): Promise<GenerateResponse> {
  await sleep(1000);
  return {
    job_id: request.job_id,
    generation_id: `gen-${Date.now()}`,
    status: 'processing',
    message: 'Video generation started',
  };
}

/**
 * モック: 生成ステータス取得
 */
export async function mockGetGenerationStatus(
  generationId: string
): Promise<GenerationStatusResponse> {
  await sleep(500);
  
  const progress = Math.min(100, ((Date.now() % 20000) / 200));
  
  if (progress >= 100) {
    return {
      generation_id: generationId,
      status: 'completed',
      progress: 100,
      video_url: '/api/download/mock-job/final.mp4',
      video_size_bytes: 15728640,
      duration_seconds: 5.0,
    };
  }

  return {
    generation_id: generationId,
    status: 'processing',
    progress: Math.round(progress),
    current_step: 'Composing video...',
  };
}

