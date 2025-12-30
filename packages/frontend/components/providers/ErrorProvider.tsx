'use client';

import { type ReactNode } from 'react';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useGlobalErrorHandler } from '@/hooks/useErrorHandler';

interface ErrorProviderProps {
  children: ReactNode;
}

/**
 * グローバルエラーハンドラを初期化するコンポーネント
 */
function GlobalErrorInitializer({ children }: { children: ReactNode }) {
  useGlobalErrorHandler();
  return <>{children}</>;
}

/**
 * エラーハンドリングプロバイダー
 *
 * アプリケーション全体のエラーハンドリングを提供します。
 * - Error Boundary: 予期しないReactエラーをキャッチ
 * - Toast Container: 通知を表示
 * - Global Error Handler: APIエラーを自動的にキャッチ
 */
export function ErrorProvider({ children }: ErrorProviderProps) {
  return (
    <ErrorBoundary>
      <GlobalErrorInitializer>
        {children}
        <ToastContainer />
      </GlobalErrorInitializer>
    </ErrorBoundary>
  );
}
