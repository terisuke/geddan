'use client';

import { ProgressBar } from '@/components/analysis/ProgressBar';

interface GenerationProgressProps {
  progress: number;
  currentStep?: string;
  etaSeconds?: number;
}

export function GenerationProgress({
  progress,
  currentStep,
  etaSeconds,
}: GenerationProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        動画を生成中...
      </h2>
      <ProgressBar
        progress={progress}
        currentStep={currentStep}
        etaSeconds={etaSeconds}
      />
      <div className="mt-6 text-center">
        <p className="text-gray-600 text-sm">
          撮影画像と音源を合成しています
        </p>
      </div>
    </div>
  );
}

