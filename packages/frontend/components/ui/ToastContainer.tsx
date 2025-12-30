'use client';

import { useAppStore } from '@/store/useAppStore';
import { Toast } from './Toast';

/**
 * Toast通知を表示するコンテナコンポーネント
 *
 * このコンポーネントは画面右上に固定され、すべてのToast通知を表示します。
 * Layoutコンポーネント内に配置してください。
 */
export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="通知"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  );
}
