import axios from 'axios';
import type {
  UploadResponse,
  AnalysisResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatusResponse,
} from '@/types';

// API Base URL - 環境変数から取得、デフォルトは開発環境
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Axios インスタンス作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// エラーハンドリング
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // サーバーからのエラーレスポンス
      console.error('API Error:', error.response.data);
      throw new Error(
        error.response.data.detail || 'An error occurred while processing your request'
      );
    } else if (error.request) {
      // リクエストは送信されたが、レスポンスが受信されなかった
      console.error('Network Error:', error.request);
      throw new Error('Network error. Please check your connection.');
    } else {
      // リクエストの設定中にエラーが発生
      console.error('Error:', error.message);
      throw error;
    }
  }
);

/**
 * 動画ファイルをアップロード
 */
export async function uploadVideo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Upload progress: ${percentCompleted}%`);
      }
    },
  });

  return response.data;
}

/**
 * 解析ジョブのステータスを取得
 */
export async function getAnalysisStatus(
  jobId: string
): Promise<AnalysisResponse> {
  const response = await apiClient.get<AnalysisResponse>(
    `/api/analyze/${jobId}`
  );
  return response.data;
}

/**
 * 動画生成を開始
 */
export async function generateVideo(
  request: GenerateRequest
): Promise<GenerateResponse> {
  const response = await apiClient.post<GenerateResponse>(
    '/api/generate',
    request
  );
  return response.data;
}

/**
 * 動画生成のステータスを取得
 */
export async function getGenerationStatus(
  generationId: string
): Promise<GenerationStatusResponse> {
  const response = await apiClient.get<GenerationStatusResponse>(
    `/api/status/${generationId}`
  );
  return response.data;
}

/**
 * 完成動画をダウンロード
 */
export function getDownloadUrl(jobId: string): string {
  return `${API_BASE_URL}/api/download/${jobId}/final.mp4`;
}

