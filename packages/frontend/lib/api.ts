import axios from 'axios';
import type {
  UploadResponse,
  AnalysisResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatusResponse,
} from '@/types';
import { USE_MOCK_API, API_BASE_URL } from './api/config';

// モックAPI（開発・テスト用）
import * as mockApi from './api/mock';

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
  // モックAPI使用時
  if (USE_MOCK_API) {
    return mockApi.mockUploadVideo(file);
  }

  // 実API使用時
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
 * 
 * フォールバック動作:
 * - 404/501/503エラー時: モックAPIにフォールバック
 * - pending/processingを返す場合: モックに切り替えず、実APIのレスポンスをそのまま使用
 *   （実装済みバックエンドからの正常なレスポンスとして扱う）
 */
export async function getAnalysisStatus(
  jobId: string
): Promise<AnalysisResponse> {
  // モックAPI使用時、または解析API未実装の場合はモックにフォールバック
  if (USE_MOCK_API) {
    return mockApi.mockGetAnalysisStatus(jobId);
  }

  // 実API使用時（解析API未実装の場合はモックにフォールバック）
  try {
    const response = await apiClient.get<AnalysisResponse>(
      `/api/analyze/${jobId}`
    );
    // pending/processingを返す場合はモックに切り替えず、実APIのレスポンスをそのまま使用
    return response.data;
  } catch (error: any) {
    // 404または501（未実装）/503（サービス利用不可）の場合はモックにフォールバック
    // ただし、pending/processingなどの正常なレスポンスは例外として扱わない
    if (
      error.response?.status === 404 ||
      error.response?.status === 501 ||
      error.response?.status === 503
    ) {
      console.warn(
        'Analysis API not available, falling back to mock',
        error.response?.status
      );
      return mockApi.mockGetAnalysisStatus(jobId);
    }
    throw error;
  }
}

/**
 * 動画生成を開始
 */
export async function generateVideo(
  request: GenerateRequest
): Promise<GenerateResponse> {
  // モックAPI使用時、または生成API未実装の場合はモックにフォールバック
  if (USE_MOCK_API) {
    return mockApi.mockGenerateVideo(request);
  }

  // 実API使用時（生成API未実装の場合はモックにフォールバック）
  try {
    const response = await apiClient.post<GenerateResponse>(
      '/api/generate',
      request
    );
    return response.data;
  } catch (error: any) {
    // 404または501（未実装）の場合はモックにフォールバック
    if (
      error.response?.status === 404 ||
      error.response?.status === 501 ||
      error.response?.status === 503
    ) {
      console.warn(
        'Generate API not available, falling back to mock',
        error.response?.status
      );
      return mockApi.mockGenerateVideo(request);
    }
    throw error;
  }
}

/**
 * 動画生成のステータスを取得
 */
export async function getGenerationStatus(
  generationId: string
): Promise<GenerationStatusResponse> {
  // モックAPI使用時、またはステータスAPI未実装の場合はモックにフォールバック
  if (USE_MOCK_API) {
    return mockApi.mockGetGenerationStatus(generationId);
  }

  // 実API使用時（ステータスAPI未実装の場合はモックにフォールバック）
  try {
    const response = await apiClient.get<GenerationStatusResponse>(
      `/api/status/${generationId}`
    );
    return response.data;
  } catch (error: any) {
    // 404または501（未実装）の場合はモックにフォールバック
    if (
      error.response?.status === 404 ||
      error.response?.status === 501 ||
      error.response?.status === 503
    ) {
      console.warn(
        'Status API not available, falling back to mock',
        error.response?.status
      );
      return mockApi.mockGetGenerationStatus(generationId);
    }
    throw error;
  }
}

/**
 * 完成動画をダウンロード
 */
export function getDownloadUrl(jobId: string): string {
  return `${API_BASE_URL}/api/download/${jobId}/final.mp4`;
}

