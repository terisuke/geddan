'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { ThumbnailGrid } from '@/components/review/ThumbnailGrid';
import { generateVideo } from '@/lib/api';

export default function ReviewPage() {
  const router = useRouter();
  const {
    uniqueFrames,
    capturedImages,
    jobId,
    goToCapture,
    setStatus,
    setGenerationId,
  } = useAppStore();

  const handleRetake = (index: number) => {
    goToCapture(index);
    router.push('/capture');
  };

  const handleGenerate = async () => {
    if (!jobId) {
      alert('ジョブIDがありません');
      return;
    }

    // 未撮影ポーズがあるかチェック
    const missingPoses = uniqueFrames
      .map((_, index) => index)
      .filter((index) => !capturedImages[index]);

    if (missingPoses.length > 0) {
      const confirm = window.confirm(
        `${missingPoses.length}個のポーズが未撮影です。このまま生成しますか？`
      );
      if (!confirm) return;
    }

    try {
      setStatus('generating');

      // 撮影画像をBase64に変換
      const capturedFrames = await Promise.all(
        Object.entries(capturedImages).map(async ([indexStr, blob]) => {
          const index = parseInt(indexStr, 10);
          const base64 = await blobToBase64(blob);
          return {
            unique_frame_id: index,
            image: base64,
          };
        })
      );

      const response = await generateVideo({
        job_id: jobId,
        captured_frames: capturedFrames,
      });

      setGenerationId(response.generation_id);
      router.push(`/generate?generationId=${response.generation_id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '動画生成に失敗しました';
      alert(errorMessage);
      setStatus('ready');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  if (uniqueFrames.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <p className="text-gray-600">データを読み込み中...</p>
      </div>
    );
  }

  const capturedCount = Object.keys(capturedImages).length;
  const totalCount = uniqueFrames.length;
  const missingCount = totalCount - capturedCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">
          撮影完了！確認してね 📸
        </h1>

        {missingCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              ⚠️ {missingCount}個のポーズが未撮影です。未撮影のポーズは元の画像が使用されます。
            </p>
          </div>
        )}

        <div className="mb-8">
          <ThumbnailGrid
            uniqueFrames={uniqueFrames}
            capturedImages={capturedImages}
            onRetake={handleRetake}
          />
        </div>

        {/* アクションボタン */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            ← 戻る
          </button>
          <button
            onClick={handleGenerate}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            動画を生成! 🎬
          </button>
        </div>
      </div>
    </div>
  );
}

