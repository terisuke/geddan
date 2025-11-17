'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ClusterInfo } from '@/types';

interface AnalysisThumbnailGridProps {
  clusters: ClusterInfo[];
  thumbnailBaseUrl: string;
}

export function AnalysisThumbnailGrid({
  clusters,
  thumbnailBaseUrl,
}: AnalysisThumbnailGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const handleImageError = (clusterId: number, thumbnailUrl: string) => {
    console.error(`Failed to load thumbnail for cluster ${clusterId}:`, thumbnailUrl);
    setImageErrors((prev) => new Set(prev).add(clusterId));
  };

  const getThumbnailUrl = (cluster: ClusterInfo): string => {
    let url = cluster.thumbnail_url;
    if (!url.startsWith('http') && !url.startsWith('data:')) {
      url = `${thumbnailBaseUrl}${url}`;
    }
    return url;
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {clusters.map((cluster) => {
          const thumbnailUrl = getThumbnailUrl(cluster);
          const hasError = imageErrors.has(cluster.id);

          return (
            <div
              key={cluster.id}
              className="relative aspect-square bg-gray-100 rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setSelectedIndex(cluster.id)}
            >
              {hasError ? (
                // エラー時プレースホルダー
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-500">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-xs text-center px-2">画像を読み込めませんでした</p>
                  <p className="text-xs text-gray-400 mt-1 px-2 truncate w-full" title={thumbnailUrl}>
                    {cluster.id + 1}
                  </p>
                </div>
              ) : (
                <Image
                  src={thumbnailUrl}
                  alt={`Cluster ${cluster.id + 1} (${cluster.size} frames)`}
                  fill
                  className="object-cover"
                  unoptimized
                  onError={() => handleImageError(cluster.id, thumbnailUrl)}
                />
              )}

              {/* クラスタ情報バッジ */}
              <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                {cluster.size} フレーム
              </div>

              {/* クリックで拡大表示のヒント */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-xs text-center">クリックで拡大</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 拡大表示モーダル */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            {(() => {
              const selectedCluster = clusters.find((c) => c.id === selectedIndex);
              if (!selectedCluster) return null;

              const thumbnailUrl = getThumbnailUrl(selectedCluster);
              const hasError = imageErrors.has(selectedCluster.id);

              return hasError ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-gray-700 mb-2">画像を読み込めませんでした</p>
                  <p className="text-gray-500 text-sm mb-4">URL: {thumbnailUrl}</p>
                  <p className="text-gray-400 text-xs">
                    Cluster {selectedCluster.id + 1}: {selectedCluster.size} フレーム
                  </p>
                </div>
              ) : (
                <Image
                  src={thumbnailUrl}
                  alt={`Preview Cluster ${selectedCluster.id + 1}`}
                  width={800}
                  height={800}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  unoptimized
                  onError={() => handleImageError(selectedCluster.id, thumbnailUrl)}
                />
              );
            })()}
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

