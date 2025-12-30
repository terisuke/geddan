/**
 * API リトライロジック
 *
 * 指数バックオフを使用したリトライ機能を提供します。
 */

export interface RetryConfig {
  maxRetries: number; // 最大リトライ回数
  baseDelayMs: number; // 基本遅延時間（ミリ秒）
  maxDelayMs: number; // 最大遅延時間（ミリ秒）
  backoffMultiplier: number; // バックオフ乗数
  retryableStatuses: number[]; // リトライ対象のHTTPステータスコード
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void; // リトライ時コールバック
}

// デフォルト設定
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * 指数バックオフで遅延時間を計算
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Pick<RetryConfig, 'baseDelayMs' | 'maxDelayMs' | 'backoffMultiplier'>
): number {
  // 指数バックオフ計算（ジッターを追加してサーバー負荷を分散）
  const exponentialDelay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.3 + 0.85; // 85%-115%のジッター
  const delayWithJitter = exponentialDelay * jitter;

  return Math.min(delayWithJitter, config.maxDelayMs);
}

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * エラーがリトライ可能かどうかを判定
 */
export function isRetryableError(
  error: unknown,
  retryableStatuses: number[]
): boolean {
  // Axiosエラーの判定
  if (isAxiosError(error)) {
    const status = error.response?.status;

    // ステータスコードでリトライ可能か判定
    if (status && retryableStatuses.includes(status)) {
      return true;
    }

    // ネットワークエラー（レスポンスなし）
    if (error.request && !error.response) {
      const code = error.code;
      // タイムアウトまたはネットワークエラー
      if (
        code === 'ECONNABORTED' ||
        code === 'ERR_NETWORK' ||
        code === 'ETIMEDOUT'
      ) {
        return true;
      }
    }
  }

  // ネットワークエラーのメッセージ判定
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused')
    ) {
      return true;
    }
  }

  return false;
}

// Axiosエラーの型ガード
interface AxiosErrorLike {
  response?: {
    status?: number;
  };
  request?: unknown;
  code?: string;
}

function isAxiosError(error: unknown): error is AxiosErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'request' in error || 'isAxiosError' in error)
  );
}

/**
 * リトライ付きで関数を実行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最大リトライ回数に達した場合
      if (attempt > finalConfig.maxRetries) {
        break;
      }

      // リトライ不可能なエラー
      if (!isRetryableError(error, finalConfig.retryableStatuses)) {
        break;
      }

      // バックオフ遅延を計算
      const delay = calculateBackoffDelay(attempt, finalConfig);

      // リトライコールバック
      if (finalConfig.onRetry) {
        finalConfig.onRetry(attempt, error, delay);
      }

      // 待機
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * リトライ設定をカスタマイズするヘルパー
 */
export function createRetryConfig(
  overrides: Partial<RetryConfig>
): RetryConfig {
  return { ...DEFAULT_RETRY_CONFIG, ...overrides };
}
