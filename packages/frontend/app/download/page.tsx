'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { getDownloadUrl } from '@/lib/api';

export default function DownloadPage() {
  const router = useRouter();
  const { jobId, videoUrl, reset } = useAppStore();

  const handleDownload = () => {
    if (!jobId) return;

    const url = videoUrl || getDownloadUrl(jobId);
    const link = document.createElement('a');
    link.href = url;
    link.download = `danceframe-${jobId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStartOver = () => {
    reset();
    router.push('/upload');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold mb-4 text-gray-800">
            動画が完成しました！
          </h1>
          <p className="text-gray-600 mb-8">
            あなただけの「踊ってみた」動画をダウンロードできます
          </p>

          {/* 動画プレビュー */}
          {jobId && (
            <div className="mb-8">
              <video
                src={videoUrl || getDownloadUrl(jobId)}
                controls
                className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
              >
                お使いのブラウザは動画再生に対応していません。
              </video>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleDownload}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              📥 ダウンロード
            </button>
            <button
              onClick={handleStartOver}
              className="px-8 py-4 bg-gray-500 text-white text-xl font-semibold rounded-full hover:bg-gray-600 transition-colors"
            >
              🔄 もう一度作る
            </button>
          </div>

          {/* SNSシェア（将来的な機能） */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">SNSでシェア（準備中）</p>
            <div className="flex gap-4 justify-center">
              <button
                disabled
                className="px-4 py-2 bg-blue-500 text-white rounded-lg opacity-50 cursor-not-allowed"
              >
                Twitter
              </button>
              <button
                disabled
                className="px-4 py-2 bg-pink-500 text-white rounded-lg opacity-50 cursor-not-allowed"
              >
                Instagram
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

