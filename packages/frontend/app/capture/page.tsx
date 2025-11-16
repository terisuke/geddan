'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { CameraView } from '@/components/camera/CameraView';
import { SimilarityMeter } from '@/components/camera/SimilarityMeter';
import { Timer } from '@/components/camera/Timer';

const TIMEOUT_SECONDS = 30; // 30秒タイムアウト

export default function CapturePage() {
  const router = useRouter();
  const {
    uniqueFrames,
    currentPoseIndex,
    capturedImages,
    addCapturedImage,
    nextPose,
    setStatus,
  } = useAppStore();

  const [similarity, setSimilarity] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  // 全ポーズが撮影済みかチェック
  useEffect(() => {
    if (uniqueFrames.length === 0) {
      router.push('/upload');
      return;
    }

    const allCaptured = uniqueFrames.every(
      (_, index) => capturedImages[index] !== undefined
    );

    if (allCaptured && uniqueFrames.length > 0) {
      // 全ポーズ撮影完了 → レビューページへ
      router.push('/review');
    }
  }, [uniqueFrames, capturedImages, router]);

  // 現在の目標ポーズ
  const targetPose = uniqueFrames[currentPoseIndex];

  const handleCapture = useCallback(
    async (blob: Blob) => {
      if (isCapturing) return;

      setIsCapturing(true);

      // フラッシュエフェクト（視覚的フィードバック）
      const flash = document.createElement('div');
      flash.className =
        'fixed inset-0 bg-white z-50 pointer-events-none opacity-0';
      document.body.appendChild(flash);

      // フラッシュアニメーション
      requestAnimationFrame(() => {
        flash.style.transition = 'opacity 0.1s';
        flash.style.opacity = '1';
        setTimeout(() => {
          flash.style.opacity = '0';
          setTimeout(() => {
            document.body.removeChild(flash);
          }, 100);
        }, 100);
      });

      // シャッター音（オプション）
      try {
        const audio = new Audio('/sounds/shutter.mp3');
        await audio.play().catch(() => {
          // 音声ファイルがない場合は無視
        });
      } catch {
        // エラーは無視
      }

      // 画像をストアに保存
      addCapturedImage(currentPoseIndex, blob);

      // 次のポーズへ（少し遅延）
      setTimeout(() => {
        if (currentPoseIndex < uniqueFrames.length - 1) {
          nextPose();
          setSimilarity(0);
        }
        setIsCapturing(false);
      }, 500);
    },
    [currentPoseIndex, uniqueFrames.length, addCapturedImage, nextPose, isCapturing]
  );

  const handleSkip = () => {
    if (currentPoseIndex < uniqueFrames.length - 1) {
      nextPose();
      setSimilarity(0);
    }
  };

  const handleTimeout = () => {
    // タイムアウト時はスキップ
    handleSkip();
  };

  if (!targetPose) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <p className="text-gray-600">ポーズデータを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              ポーズを撮影
            </h1>
            <p className="text-gray-600">
              ポーズ {currentPoseIndex + 1} / {uniqueFrames.length}
            </p>
          </div>
          <Timer
            initialSeconds={TIMEOUT_SECONDS}
            onTimeout={handleTimeout}
          />
        </div>

        {/* 類似度メーター */}
        <div className="mb-6">
          <SimilarityMeter similarity={similarity} threshold={85} />
        </div>

        {/* カメラビュー */}
        <div className="mb-6">
          <CameraView
            targetPose={targetPose}
            onCapture={handleCapture}
            onSimilarityChange={setSimilarity}
          />
        </div>

        {/* アクションボタン */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleSkip}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={() => router.push('/review')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            確認画面へ
          </button>
        </div>

        {/* 進捗表示 */}
        <div className="mt-6 text-center">
          <div className="flex justify-center gap-2">
            {uniqueFrames.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === currentPoseIndex
                    ? 'bg-purple-600'
                    : capturedImages[index]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

