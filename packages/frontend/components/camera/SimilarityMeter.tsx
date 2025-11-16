'use client';

import { motion } from 'framer-motion';

interface SimilarityMeterProps {
  similarity: number; // 0-100
  threshold?: number; // デフォルト85%
}

export function SimilarityMeter({
  similarity,
  threshold = 85,
}: SimilarityMeterProps) {
  const isAboveThreshold = similarity >= threshold;

  // 色を計算（赤→黄→緑）
  const getColor = () => {
    if (similarity >= threshold) return 'bg-green-500';
    if (similarity >= threshold * 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">類似度</span>
        <span
          className={`text-2xl font-bold ${
            isAboveThreshold ? 'text-green-600' : 'text-gray-700'
          }`}
        >
          {similarity}%
          {isAboveThreshold && ' 🎯'}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
        <motion.div
          className={`h-full ${getColor()} rounded-full transition-colors`}
          initial={{ width: 0 }}
          animate={{ width: `${similarity}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      </div>

      {isAboveThreshold && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 text-center"
        >
          <p className="text-green-600 font-semibold text-sm">
            ✓ ポーズが一致しました！
          </p>
        </motion.div>
      )}
    </div>
  );
}

