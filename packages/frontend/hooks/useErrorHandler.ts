'use client';

import { useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { parseError, type AppError } from '@/lib/errors';
import { setGlobalErrorHandler, clearGlobalErrorHandler } from '@/lib/api';

/**
 * エラーハンドリングフック
 *
 * APIエラーを自動的にキャッチしてToast通知を表示します。
 */
export function useErrorHandler() {
  const { addError, addToast, removeError, clearErrors } = useAppStore();

  /**
   * エラーを処理してストアに追加し、Toast通知を表示
   */
  const handleError = useCallback(
    (error: AppError | unknown, showToast = true) => {
      // AppErrorに変換
      const appError =
        error && typeof error === 'object' && 'code' in error
          ? (error as AppError)
          : parseError(error);

      // ストアに追加
      addError(appError);

      // Toast通知を表示
      if (showToast) {
        addToast({
          type: appError.severity === 'warning' ? 'warning' : 'error',
          title: appError.userMessage,
          message: appError.retryable ? '再試行できます' : undefined,
          duration: appError.severity === 'critical' ? 0 : 6000,
        });
      }

      return appError;
    },
    [addError, addToast]
  );

  /**
   * 成功通知を表示
   */
  const showSuccess = useCallback(
    (title: string, message?: string) => {
      addToast({
        type: 'success',
        title,
        message,
        duration: 4000,
      });
    },
    [addToast]
  );

  /**
   * 警告通知を表示
   */
  const showWarning = useCallback(
    (title: string, message?: string) => {
      addToast({
        type: 'warning',
        title,
        message,
        duration: 5000,
      });
    },
    [addToast]
  );

  /**
   * 情報通知を表示
   */
  const showInfo = useCallback(
    (title: string, message?: string) => {
      addToast({
        type: 'info',
        title,
        message,
        duration: 4000,
      });
    },
    [addToast]
  );

  /**
   * エラーをクリア
   */
  const dismissError = useCallback(
    (errorId: string) => {
      removeError(errorId);
    },
    [removeError]
  );

  /**
   * すべてのエラーをクリア
   */
  const dismissAllErrors = useCallback(() => {
    clearErrors();
  }, [clearErrors]);

  return {
    handleError,
    showSuccess,
    showWarning,
    showInfo,
    dismissError,
    dismissAllErrors,
  };
}

/**
 * グローバルエラーハンドラを設定するフック
 *
 * アプリケーションのルートで使用し、APIエラーを自動的にキャッチします。
 */
export function useGlobalErrorHandler() {
  const { handleError } = useErrorHandler();

  useEffect(() => {
    // グローバルエラーハンドラを設定
    setGlobalErrorHandler((error: AppError) => {
      handleError(error, true);
    });

    return () => {
      clearGlobalErrorHandler();
    };
  }, [handleError]);
}
