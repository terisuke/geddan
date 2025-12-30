import axios from 'axios';
import type {
  UploadResponse,
  AnalysisResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatusResponse,
} from '@/types';
import { USE_MOCK_API, API_BASE_URL } from './api/config';
import { withRetry, createRetryConfig } from './api/retry';
import { parseError, type AppError } from './errors';

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

// リトライ設定（API種別ごとにカスタマイズ可能）
const uploadRetryConfig = createRetryConfig({
  maxRetries: 2, // アップロードは2回まで
  baseDelayMs: 2000,
});

const pollingRetryConfig = createRetryConfig({
  maxRetries: 3,
  baseDelayMs: 1000,
});

// エラーハンドリングコールバック（オプショナル）
let globalErrorHandler: ((error: AppError) => void) | null = null;

/**
 * グローバルエラーハンドラを設定
 */
export function setGlobalErrorHandler(handler: (error: AppError) => void): void {
  globalErrorHandler = handler;
}

/**
 * グローバルエラーハンドラをクリア
 */
export function clearGlobalErrorHandler(): void {
  globalErrorHandler = null;
}

// エラーハンドリング（インターセプター簡素化 - リトライはwithRetryで処理）
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // エラーをそのままスロー（リトライロジックで処理）
    throw error;
  }
);

/**
 * APIエラーを処理してAppErrorに変換
 */
function handleApiError(error: unknown): never {
  const appError = parseError(error);

  // グローバルエラーハンドラがあれば呼び出し
  if (globalErrorHandler) {
    globalErrorHandler(appError);
  }

  throw appError;
}

/**
 * 動画ファイルをアップロード
 *
 * ネットワークエラー時は自動的にリトライします。
 */
export async function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void,
  onRetry?: (attempt: number, nextDelayMs: number) => void
): Promise<UploadResponse> {
  // モックAPI使用時
  if (USE_MOCK_API) {
    return mockApi.mockUploadVideo(file);
  }

  // 実API使用時（リトライ付き）
  try {
    return await withRetry(
      async () => {
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
              onProgress?.(percentCompleted);
            }
          },
        });

        return response.data;
      },
      {
        ...uploadRetryConfig,
        onRetry: (attempt, _error, nextDelayMs) => {
          console.warn(`Upload retry attempt ${attempt}, waiting ${nextDelayMs}ms`);
          onRetry?.(attempt, nextDelayMs);
        },
      }
    );
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * 解析ジョブのステータスを取得
 *
 * フォールバック動作:
 * - 404/501/503エラー時: モックAPIにフォールバック
 * - pending/processingを返す場合: モックに切り替えず、実APIのレスポンスをそのまま使用
 *   （実装済みバックエンドからの正常なレスポンスとして扱う）
 *
 * ネットワークエラー時は自動的にリトライします。
 */
export async function getAnalysisStatus(
  jobId: string,
  onRetry?: (attempt: number, nextDelayMs: number) => void
): Promise<AnalysisResponse> {
  // モックAPI使用時、または解析API未実装の場合はモックにフォールバック
  if (USE_MOCK_API) {
    return mockApi.mockGetAnalysisStatus(jobId);
  }

  // 実API使用時（解析API未実装の場合はモックにフォールバック、リトライ付き）
  try {
    return await withRetry(
      async () => {
        try {
          const response = await apiClient.get<AnalysisResponse>(
            `/api/analyze/${jobId}`
          );
          // pending/processingを返す場合はモックに切り替えず、実APIのレスポンスをそのまま使用
          return response.data;
        } catch (error: unknown) {
          // 404または501（未実装）/503（サービス利用不可）の場合はモックにフォールバック
          // ただし、pending/processingなどの正常なレスポンスは例外として扱わない
          const axiosError = error as { response?: { status?: number } };
          if (
            axiosError.response?.status === 404 ||
            axiosError.response?.status === 501 ||
            axiosError.response?.status === 503
          ) {
            console.warn(
              'Analysis API not available, falling back to mock',
              axiosError.response?.status
            );
            return mockApi.mockGetAnalysisStatus(jobId);
          }
          throw error;
        }
      },
      {
        ...pollingRetryConfig,
        onRetry: (attempt, _error, nextDelayMs) => {
          console.warn(`Analysis status retry attempt ${attempt}, waiting ${nextDelayMs}ms`);
          onRetry?.(attempt, nextDelayMs);
        },
      }
    );
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * 動画生成を開始
 *
 * ネットワークエラー時は自動的にリトライします。
 */
export async function generateVideo(
  request: GenerateRequest,
  onRetry?: (attempt: number, nextDelayMs: number) => void
): Promise<GenerateResponse> {
  // モックAPI使用時、または生成API未実装の場合はモックにフォールバック
  if (USE_MOCK_API) {
    return mockApi.mockGenerateVideo(request);
  }

  // 実API使用時（生成API未実装の場合はモックにフォールバック、リトライ付き）
  try {
    return await withRetry(
      async () => {
        try {
          const response = await apiClient.post<GenerateResponse>(
            '/api/generate',
            request
          );
          return response.data;
        } catch (error: unknown) {
          // 404または501（未実装）の場合はモックにフォールバック
          const axiosError = error as { response?: { status?: number } };
          if (
            axiosError.response?.status === 404 ||
            axiosError.response?.status === 501 ||
            axiosError.response?.status === 503
          ) {
            console.warn(
              'Generate API not available, falling back to mock',
              axiosError.response?.status
            );
            return mockApi.mockGenerateVideo(request);
          }
          throw error;
        }
      },
      {
        ...pollingRetryConfig,
        onRetry: (attempt, _error, nextDelayMs) => {
          console.warn(`Generate video retry attempt ${attempt}, waiting ${nextDelayMs}ms`);
          onRetry?.(attempt, nextDelayMs);
        },
      }
    );
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * 動画生成のステータスを取得
 *
 * ネットワークエラー時は自動的にリトライします。
 */
export async function getGenerationStatus(
  generationId: string,
  onRetry?: (attempt: number, nextDelayMs: number) => void
): Promise<GenerationStatusResponse> {
  // モックAPI使用時、またはステータスAPI未実装の場合はモックにフォールバック
  if (USE_MOCK_API) {
    return mockApi.mockGetGenerationStatus(generationId);
  }

  // 実API使用時（ステータスAPI未実装の場合はモックにフォールバック、リトライ付き）
  try {
    return await withRetry(
      async () => {
        try {
          const response = await apiClient.get<GenerationStatusResponse>(
            `/api/status/${generationId}`
          );
          return response.data;
        } catch (error: unknown) {
          // 404または501（未実装）の場合はモックにフォールバック
          const axiosError = error as { response?: { status?: number } };
          if (
            axiosError.response?.status === 404 ||
            axiosError.response?.status === 501 ||
            axiosError.response?.status === 503
          ) {
            console.warn(
              'Status API not available, falling back to mock',
              axiosError.response?.status
            );
            return mockApi.mockGetGenerationStatus(generationId);
          }
          throw error;
        }
      },
      {
        ...pollingRetryConfig,
        onRetry: (attempt, _error, nextDelayMs) => {
          console.warn(`Generation status retry attempt ${attempt}, waiting ${nextDelayMs}ms`);
          onRetry?.(attempt, nextDelayMs);
        },
      }
    );
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * 完成動画をダウンロード
 */
export function getDownloadUrl(jobId: string): string {
  return `${API_BASE_URL}/api/download/${jobId}/final.mp4`;
}

