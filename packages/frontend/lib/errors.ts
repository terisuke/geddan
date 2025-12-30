/**
 * DanceFrame エラーハンドリング
 *
 * このモジュールは、APIエラーとネットワークエラーの統一的なハンドリングを提供します。
 */

// エラーコード定義
export const ErrorCode = {
  // ネットワーク関連
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',

  // API関連
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',

  // クライアント関連
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',

  // 一般エラー
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// エラーの重要度
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// アプリケーションエラーインターフェース
export interface AppError {
  code: ErrorCodeType;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  retryable: boolean;
  details?: Record<string, unknown>;
  timestamp: number;
  id: string;
}

// エラーメッセージのマッピング（日本語）
const ERROR_MESSAGES: Record<ErrorCodeType, { message: string; userMessage: string; severity: ErrorSeverity; retryable: boolean }> = {
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Network error occurred',
    userMessage: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
    severity: 'error',
    retryable: true,
  },
  [ErrorCode.TIMEOUT]: {
    message: 'Request timed out',
    userMessage: 'リクエストがタイムアウトしました。もう一度お試しください。',
    severity: 'warning',
    retryable: true,
  },
  [ErrorCode.CONNECTION_REFUSED]: {
    message: 'Connection refused',
    userMessage: 'サーバーに接続できませんでした。しばらく待ってからお試しください。',
    severity: 'error',
    retryable: true,
  },
  [ErrorCode.VALIDATION_ERROR]: {
    message: 'Validation error',
    userMessage: '入力内容に問題があります。確認してください。',
    severity: 'warning',
    retryable: false,
  },
  [ErrorCode.NOT_FOUND]: {
    message: 'Resource not found',
    userMessage: '要求されたリソースが見つかりませんでした。',
    severity: 'warning',
    retryable: false,
  },
  [ErrorCode.SERVER_ERROR]: {
    message: 'Internal server error',
    userMessage: 'サーバーエラーが発生しました。しばらく待ってからお試しください。',
    severity: 'error',
    retryable: true,
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    message: 'Service unavailable',
    userMessage: 'サービスが一時的に利用できません。しばらく待ってからお試しください。',
    severity: 'error',
    retryable: true,
  },
  [ErrorCode.RATE_LIMITED]: {
    message: 'Rate limited',
    userMessage: 'リクエストが多すぎます。しばらく待ってからお試しください。',
    severity: 'warning',
    retryable: true,
  },
  [ErrorCode.FILE_TOO_LARGE]: {
    message: 'File too large',
    userMessage: 'ファイルサイズが大きすぎます。',
    severity: 'warning',
    retryable: false,
  },
  [ErrorCode.INVALID_FILE_TYPE]: {
    message: 'Invalid file type',
    userMessage: 'サポートされていないファイル形式です。',
    severity: 'warning',
    retryable: false,
  },
  [ErrorCode.UNKNOWN]: {
    message: 'Unknown error',
    userMessage: '予期しないエラーが発生しました。',
    severity: 'error',
    retryable: true,
  },
};

// ユニークIDを生成
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * AppErrorを作成する
 */
export function createAppError(
  code: ErrorCodeType,
  customMessage?: string,
  details?: Record<string, unknown>
): AppError {
  const baseError = ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN];

  return {
    code,
    message: customMessage || baseError.message,
    userMessage: customMessage || baseError.userMessage,
    severity: baseError.severity,
    retryable: baseError.retryable,
    details,
    timestamp: Date.now(),
    id: generateErrorId(),
  };
}

/**
 * HTTPステータスコードからエラーコードを取得
 */
export function getErrorCodeFromStatus(status: number): ErrorCodeType {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 500:
      return ErrorCode.SERVER_ERROR;
    case 501:
    case 502:
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case 504:
      return ErrorCode.TIMEOUT;
    default:
      if (status >= 400 && status < 500) {
        return ErrorCode.VALIDATION_ERROR;
      }
      if (status >= 500) {
        return ErrorCode.SERVER_ERROR;
      }
      return ErrorCode.UNKNOWN;
  }
}

/**
 * Axiosエラーまたは一般的なエラーからAppErrorを作成
 */
export function parseError(error: unknown): AppError {
  // Axiosエラーの判定
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.detail || error.response?.data?.message;

    if (status) {
      const code = getErrorCodeFromStatus(status);
      return createAppError(code, serverMessage, {
        status,
        data: error.response?.data,
      });
    }

    // ネットワークエラー（レスポンスなし）
    if (error.request) {
      if (error.code === 'ECONNABORTED') {
        return createAppError(ErrorCode.TIMEOUT);
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        return createAppError(ErrorCode.CONNECTION_REFUSED);
      }
      return createAppError(ErrorCode.NETWORK_ERROR);
    }
  }

  // 標準Errorオブジェクト
  if (error instanceof Error) {
    // ネットワークエラーの検出
    if (error.message.includes('Network') || error.message.includes('network')) {
      return createAppError(ErrorCode.NETWORK_ERROR, error.message);
    }
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return createAppError(ErrorCode.TIMEOUT, error.message);
    }

    return createAppError(ErrorCode.UNKNOWN, error.message);
  }

  // 文字列エラー
  if (typeof error === 'string') {
    return createAppError(ErrorCode.UNKNOWN, error);
  }

  return createAppError(ErrorCode.UNKNOWN);
}

// Axiosエラーの型ガード
interface AxiosErrorLike {
  response?: {
    status?: number;
    data?: {
      detail?: string;
      message?: string;
    };
  };
  request?: unknown;
  code?: string;
  message?: string;
}

function isAxiosError(error: unknown): error is AxiosErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'request' in error || 'isAxiosError' in error)
  );
}
