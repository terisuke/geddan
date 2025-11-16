'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAnalysisStatus } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { ProgressBar } from '@/components/analysis/ProgressBar';

const POLLING_INTERVAL = 2000; // 2秒

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');
  
  const { setStatus, setProgress, setCurrentStep, setUniqueFrames, setFrameMapping } = useAppStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      router.push('/upload');
      return;
    }

    let pollingInterval: NodeJS.Timeout;
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const response = await getAnalysisStatus(jobId);
        
        if (!isMounted) return;

        setProgress(response.progress);
        setCurrentStep(response.current_step || null);

        if (response.status === 'completed') {
          // 解析完了
          if (response.unique_frames && response.frame_mapping) {
            setUniqueFrames(response.unique_frames);
            setFrameMapping(response.frame_mapping);
            setStatus('ready');
            
            // 撮影ページへ遷移
            router.push('/capture');
          } else {
            setError('解析結果が不完全です');
          }
        } else if (response.status === 'failed') {
          setError(response.error || '解析に失敗しました');
          setStatus('idle');
        } else {
          // 処理中 - 継続してポーリング
          setStatus('analyzing');
        }
      } catch (err) {
        if (!isMounted) return;
        
        const errorMessage =
          err instanceof Error ? err.message : 'ステータス取得に失敗しました';
        setError(errorMessage);
        setStatus('idle');
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
  }, [jobId, router, setStatus, setProgress, setCurrentStep, setUniqueFrames, setFrameMapping]);

  const { progress, currentStep } = useAppStore();

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">エラーが発生しました</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/upload')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            もう一度試す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          動画を解析中...
        </h1>
        
        <ProgressBar
          progress={progress}
          currentStep={currentStep || undefined}
        />

        <div className="mt-8 text-center">
          <p className="text-gray-600 text-sm">
            AIが自動でユニークなポーズを検出しています
          </p>
        </div>
      </div>
    </div>
  );
}

