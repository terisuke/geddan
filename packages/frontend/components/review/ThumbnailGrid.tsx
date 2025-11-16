'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { UniqueFrame } from '@/types';

interface ThumbnailGridProps {
  uniqueFrames: UniqueFrame[];
  capturedImages: Record<number, Blob>;
  onRetake: (index: number) => void;
}

export function ThumbnailGrid({
  uniqueFrames,
  capturedImages,
  onRetake,
}: ThumbnailGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const getImageUrl = (index: number): string => {
    const captured = capturedImages[index];
    if (captured) {
      return URL.createObjectURL(captured);
    }
    return uniqueFrames[index]?.thumbnail || '';
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {uniqueFrames.map((frame, index) => {
          const isCaptured = capturedImages[index] !== undefined;
          const imageUrl = getImageUrl(index);

          return (
            <div
              key={index}
              className="relative aspect-square bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setSelectedIndex(index)}
            >
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt={`Frame ${index + 1}`}
                  fill
                  className="object-cover"
                  unoptimized={isCaptured} // Blob URLの場合は最適化しない
                />
              )}

              {/* ステータスバッジ */}
              <div className="absolute top-2 right-2">
                {isCaptured ? (
                  <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    ✓
                  </div>
                ) : (
                  <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    ❌
                  </div>
                )}
              </div>

              {/* 撮り直しボタン（未撮影またはクリック時） */}
              {!isCaptured && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetake(index);
                    }}
                    className="px-4 py-2 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
                  >
                    撮影する
                  </button>
                </div>
              )}
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
            <Image
              src={getImageUrl(selectedIndex)}
              alt={`Preview ${selectedIndex + 1}`}
              width={800}
              height={800}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              unoptimized={capturedImages[selectedIndex] !== undefined}
            />
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

