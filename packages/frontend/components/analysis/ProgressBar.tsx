'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0-100
  currentStep?: string;
  etaSeconds?: number;
  isStub?: boolean; // スタブレスポンスの場合
}

export function ProgressBar({ progress, currentStep, etaSeconds, isStub }: ProgressBarProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}分${remainingSeconds}秒`;
  };

  // バックエンドが返す値を優先し、0%の間も前向きな文言を表示
  const displayStep = currentStep || (progress === 0 ? 'キュー待ち中...' : '処理中...');

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {displayStep}
          </span>
          <span className="text-sm font-semibold text-purple-600">
            {Math.round(progress)}%
          </span>
        </div>
        {etaSeconds !== undefined && etaSeconds > 0 && (
          <p className="text-xs text-gray-500">
            推定残り時間: {formatTime(etaSeconds)}
          </p>
        )}
      </div>

      <div
        className="w-full bg-gray-200 rounded-full h-4 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`進捗: ${Math.round(progress)}%`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

