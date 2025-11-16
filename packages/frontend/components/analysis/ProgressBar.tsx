'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0-100
  currentStep?: string;
  etaSeconds?: number;
}

export function ProgressBar({ progress, currentStep, etaSeconds }: ProgressBarProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {currentStep || '処理中...'}
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

      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
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

