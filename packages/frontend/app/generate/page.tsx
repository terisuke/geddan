'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getGenerationStatus } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { GenerationProgress } from '@/components/generate/GenerationProgress';

const POLLING_INTERVAL = 2000; // 2秒

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const generationId = searchParams.get('generationId');

  const { setStatus, setVideoUrl } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!generationId) {
      router.push('/review');
      return;
    }

    let pollingInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const response = await getGenerationStatus(generationId);

        if (!isMounted) return;

        setProgress(response.progress);
        setCurrentStep(response.current_step || null);

        if (response.status === 'completed') {
          // 生成完了
          if (response.video_url) {
            setVideoUrl(response.video_url);
            setStatus('ready');
            router.push('/download');
          } else {
            setError('動画URLが取得できませんでした');
          }
        } else if (response.status === 'failed') {
          setError(response.error || '動画生成に失敗しました');
          setStatus('ready');
        } else {
          // 処理中 - 継続してポーリング
          setStatus('generating');
        }
      } catch (err) {
        if (!isMounted) return;

        const errorMessage =
          err instanceof Error ? err.message : 'ステータス取得に失敗しました';
        setError(errorMessage);
        setStatus('ready');
      }
    };

    // 初回実行
    pollStatus();

    // ポーリング開始
    pollingInterval = setInterval(pollStatus, POLLING_INTERVAL);

    return () => {
      isMounted = false;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [generationId, router, setStatus, setVideoUrl]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            エラーが発生しました
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/review')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <GenerationProgress
          progress={progress}
          currentStep={currentStep || undefined}
        />
      </div>
    </div>
  );
}

