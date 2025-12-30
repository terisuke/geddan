'use client';

import { useEffect, useState } from 'react';
import type { Toast as ToastType } from '@/store/useAppStore';

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

// Toast アイコン
const icons = {
  success: (
    <svg
      className="w-5 h-5 text-green-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  error: (
    <svg
      className="w-5 h-5 text-red-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  warning: (
    <svg
      className="w-5 h-5 text-yellow-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg
      className="w-5 h-5 text-blue-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

// 背景色のマッピング
const bgColors = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
};

// テキスト色のマッピング
const textColors = {
  success: 'text-green-800',
  error: 'text-red-800',
  warning: 'text-yellow-800',
  info: 'text-blue-800',
};

const subTextColors = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
};

export function Toast({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300); // アニメーション時間
  };

  useEffect(() => {
    // マウント時にアニメーション
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // 自動消去（duration が 0 以外の場合）
    const duration = toast.duration ?? 5000;
    let hideTimer: NodeJS.Timeout | undefined;

    if (duration > 0) {
      hideTimer = setTimeout(() => {
        handleClose();
      }, duration);
    }

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duration, toast.id, onClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        w-full max-w-sm rounded-lg border shadow-lg p-4
        transition-all duration-300 ease-out
        ${bgColors[toast.type]}
        ${isVisible && !isLeaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className="flex-shrink-0">{icons[toast.type]}</div>

        {/* コンテンツ */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${textColors[toast.type]}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className={`mt-1 text-sm ${subTextColors[toast.type]}`}>
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className={`mt-2 text-sm font-medium underline ${textColors[toast.type]} hover:opacity-80`}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={handleClose}
          className={`flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors ${textColors[toast.type]}`}
          aria-label="閉じる"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
