'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAnalysisStatus } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { ProgressBar } from '@/components/analysis/ProgressBar';
import { AnalysisThumbnailGrid } from '@/components/analysis/AnalysisThumbnailGrid';
import { API_BASE_URL } from '@/lib/api/config';
import type { ClusterInfo } from '@/types';

const POLLING_INTERVAL = 5000; // 5秒（ログの過多を防ぐため延長）
const MAX_RETRY_COUNT = 60; // 最大リトライ回数（5分間）

/**
 * バックエンド未実装/未設定を検知する関数
 * statusやerrorだけで判定し、実装済みバックエンドからの通常レスポンスと区別
 */
function checkBackendNotConfigured(response: {
  status: string;
  error?: string | null;
  current_step?: string | null;
}): boolean {
  // エラーがある場合、または未設定系のステップメッセージがある場合のみ未設定と判定
  const step = response.current_step?.toLowerCase() || '';
  const isNotConfiguredStep =
    step.includes('not configured') ||
    step.includes('waiting for backend') ||
    step.includes('redis/celery not configured');
  
  // status=failed でエラーがある場合は実装済みバックエンドの正常なエラーハンドリング
  if (response.status === 'failed' && response.error) {
    return false;
  }
  
  // pending で未設定系メッセージがある場合のみ未設定と判定
  return response.status === 'pending' && isNotConfiguredStep;
}

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');
  
  const { setStatus, setProgress, setCurrentStep, setUniqueFrames, setFrameMapping } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [isBackendNotConfigured, setIsBackendNotConfigured] = useState(false);
  const [completedClusters, setCompletedClusters] = useState<ClusterInfo[] | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!jobId) {
      router.push('/upload');
      return;
    }

    let pollingInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pollStatus = async () => {
      try {
        // リトライ回数の上限チェック
        if (retryCountRef.current >= MAX_RETRY_COUNT) {
          if (!isMounted) return;
          setError('解析タイムアウト: 最大待機時間（5分）を超えました。もう一度試してください。');
          setStatus('idle');
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          return;
        }

        const response = await getAnalysisStatus(jobId);
        
        if (!isMounted) return;

        retryCountRef.current += 1;

        // バックエンド未実装/未設定の検知
        const isNotConfigured = checkBackendNotConfigured(response);
        setIsBackendNotConfigured(isNotConfigured);

        // バックエンドが返す値をそのまま使用（進捗とステップ）
        setProgress(response.progress);
        setCurrentStep(response.current_step || null);

        if (response.status === 'completed') {
          // ポーリングを停止してから処理
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }

          // 解析完了 - result.clusters[]を優先して使用
          if (response.result?.clusters && response.result.clusters.length > 0) {
            // 新しい形式（クラスタ情報）を使用
            const clusters: ClusterInfo[] = response.result.clusters;
            
            // サムネイル表示用にクラスタ情報を保存
            setCompletedClusters(clusters);
            
            // クラスタ情報をUniqueFrame形式に変換してstoreに保存
            const convertedFrames = clusters.map((cluster) => {
              // サムネイルURLの構築: 相対パスの場合はAPI URLを追加
              let thumbnailUrl = cluster.thumbnail_url;
              if (!thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('data:')) {
                thumbnailUrl = `${API_BASE_URL}${cluster.thumbnail_url}`;
              }
              
              return {
                id: cluster.id,
                thumbnail: thumbnailUrl,
                pose_landmarks: {
                  landmarks: [], // クラスタ情報にはlandmark情報がないため空配列
                },
              };
            });
            
            setUniqueFrames(convertedFrames);
            setFrameMapping({}); // クラスタ形式ではframe_mappingは不要
            setStatus('ready');
            
            // 自動遷移を削除: サムネイル表示ビューに切り替える
          } else if (response.unique_frames && response.frame_mapping) {
            // 後方互換性のため、旧形式もサポート
            setUniqueFrames(response.unique_frames);
            setFrameMapping(response.frame_mapping);
            setStatus('ready');
            
            // 旧形式の場合も自動遷移を削除
            // ただし、旧形式ではクラスタ情報がないため、ユーザーに確認を求めるか、直接遷移する
            // ここでは旧形式の場合は直接遷移（後方互換性）
            setTimeout(() => {
              if (isMounted) {
                router.push('/capture');
              }
            }, 0);
          } else {
            setError('解析結果が不完全です（クラスタ情報またはフレーム情報がありません）');
          }
        } else if (response.status === 'failed') {
          setError(response.error || '解析に失敗しました');
          setStatus('idle');
          // ポーリングを停止
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        } else if (response.status === 'pending') {
          // pending = キュー投入済み/進捗待ち
          // バックエンドが未設定の場合のみ警告を表示（current_stepで判定）
          setStatus('analyzing');
        } else {
          // processing = 処理中 - 継続してポーリング
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

  // 解析完了時: サムネイル表示ビュー
  if (completedClusters && completedClusters.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                解析完了！
              </h1>
              <p className="text-gray-600 text-lg mb-2">
                {completedClusters.length}個のユニークなポーズを検出しました
              </p>
              <p className="text-gray-500 text-sm">
                これらのポーズを撮影して、あなただけの踊ってみた動画を作成しましょう
              </p>
            </div>

            <div className="mb-8">
              <AnalysisThumbnailGrid
                clusters={completedClusters}
                thumbnailBaseUrl={API_BASE_URL}
              />
            </div>

            <div className="text-center">
              <button
                onClick={() => router.push('/capture')}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                撮影を開始する →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 解析中: 進捗表示ビュー
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          動画を解析中...
        </h1>
        
        <ProgressBar
          progress={progress}
          currentStep={currentStep || undefined}
          isStub={isBackendNotConfigured}
        />

        <div className="mt-8 text-center">
          {isBackendNotConfigured ? (
            // バックエンド未設定の場合
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium mb-2">
                ⚠️ バックエンド未設定
              </p>
              <p className="text-yellow-700 text-sm mb-2">
                {currentStep || 'バックエンドサービス（Redis/Celery）が設定されていません。'}
              </p>
              <p className="text-yellow-600 text-xs">
                解析を実行するには、RedisとCeleryワーカーを起動してください。
              </p>
            </div>
          ) : progress === 0 && currentStep && !currentStep.toLowerCase().includes('not configured') && !currentStep.toLowerCase().includes('waiting for backend') ? (
            // pending = キュー投入済み/待機中（バックエンドは設定済み）
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium mb-2">
                ⏳ キュー待ち中
              </p>
              <p className="text-blue-700 text-sm">
                {currentStep || '解析ジョブをキューに投入しました。処理が開始されるまでお待ちください...'}
              </p>
            </div>
          ) : (
            // 処理中または完了待ち
            <p className="text-gray-600 text-sm">
              {currentStep || 'AIが自動でユニークなポーズを検出しています'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

