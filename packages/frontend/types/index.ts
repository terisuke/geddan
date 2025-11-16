// API Response Types
export interface UploadResponse {
  job_id: string;
  status: 'processing';
  message: string;
  filename: string;
  size: number; // File size in bytes
  content_type: string; // MIME type
  created_at: string; // ISO 8601 datetime string
}

export interface ClusterInfo {
  id: number; // Cluster ID (0-indexed)
  size: number; // Number of frames in this cluster
  thumbnail_url: string; // URL path to cluster representative thumbnail
}

export interface AnalysisResult {
  clusters: ClusterInfo[]; // List of clusters with representative thumbnails
}

export interface AnalysisResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed' | 'pending';
  progress: number;
  current_step?: string;
  eta_seconds?: number;
  metadata?: {
    original_fps: number;
    duration: number;
    total_frames: number;
    unique_count: number;
    resolution?: string;
  };
  frame_mapping?: Record<string, number>;
  unique_frames?: UniqueFrame[]; // Deprecated: use result.clusters instead
  result?: AnalysisResult; // Analysis result with clusters (preferred)
  error?: string;
}

export interface UniqueFrame {
  id: number;
  thumbnail: string; // Base64 encoded image
  pose_landmarks: {
    landmarks: Array<{
      x: number;
      y: number;
      z: number;
      visibility: number;
    }>;
  };
}

export interface GenerateRequest {
  job_id: string;
  captured_frames: Array<{
    unique_frame_id: number;
    image: string; // Base64 encoded image
  }>;
}

export interface GenerateResponse {
  job_id: string;
  generation_id: string;
  status: 'processing';
  message?: string;
}

export interface GenerationStatusResponse {
  generation_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  current_step?: string;
  video_url?: string;
  video_size_bytes?: number;
  duration_seconds?: number;
  error?: string;
}

