'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uploadVideo } from '@/lib/api';
import { getUploadRules, type UploadRules } from '@/lib/api/rules';
import { useAppStore } from '@/store/useAppStore';

// デフォルト値（サーバーから取得できない場合のフォールバック）
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_ALLOWED_TYPES = ['video/mp4', 'image/gif'];

interface FileUploaderProps {
  onUploadStart?: () => void;
  onUploadComplete?: (jobId: string) => void;
  onError?: (error: string) => void;
}

export function FileUploader({
  onUploadStart,
  onUploadComplete,
  onError,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadRules, setUploadRules] = useState<UploadRules | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { setJobId, setStatus } = useAppStore();

  // サーバーからバリデーションルールを取得
  useEffect(() => {
    getUploadRules()
      .then((rules) => {
        setUploadRules(rules);
        // ファイル入力のaccept属性を更新
        if (fileInputRef.current) {
          fileInputRef.current.accept = rules.allowed_types.join(',');
        }
      })
      .catch((err) => {
        console.error('Failed to load upload rules:', err);
        // エラー時はデフォルト値を使用
        setUploadRules({
          max_file_size_mb: 100,
          max_file_size_bytes: DEFAULT_MAX_FILE_SIZE,
          allowed_types: DEFAULT_ALLOWED_TYPES,
          allowed_extensions: ['.mp4', '.gif'],
        });
      });
  }, []);

  const validateFile = (file: File): string | null => {
    const rules = uploadRules || {
      max_file_size_bytes: DEFAULT_MAX_FILE_SIZE,
      allowed_types: DEFAULT_ALLOWED_TYPES,
      allowed_extensions: ['.mp4', '.gif'],
    };

    // ファイルタイプチェック
    if (!rules.allowed_types.includes(file.type)) {
      const allowedExtensions = rules.allowed_extensions.join(', ');
      return `対応していないファイル形式です。${allowedExtensions}をアップロードしてください。`;
    }

    // ファイルサイズチェック
    if (file.size > rules.max_file_size_bytes) {
      const maxSizeMB = rules.max_file_size_mb || Math.round(rules.max_file_size_bytes / (1024 * 1024));
      return `ファイルサイズが大きすぎます。最大${maxSizeMB}MBまでアップロード可能です。`;
    }

    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);
      onUploadStart?.();

      try {
        setStatus('uploading');
        const response = await uploadVideo(file);
        
        setJobId(response.job_id);
        setStatus('analyzing');
        onUploadComplete?.(response.job_id);
        
        // 解析ページへ遷移
        router.push(`/analysis?jobId=${response.job_id}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'アップロードに失敗しました';
        setError(errorMessage);
        onError?.(errorMessage);
        setStatus('idle');
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadStart, onUploadComplete, onError, router, setJobId, setStatus]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="動画ファイルをアップロード"
        aria-disabled={isUploading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`
          relative border-2 border-dashed rounded-xl p-12
          transition-all cursor-pointer
          ${
            isDragging
              ? 'border-purple-600 bg-purple-50'
              : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={uploadRules?.allowed_types.join(',') || 'video/mp4,image/gif'}
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
          aria-label="動画ファイルを選択"
        />

        <div className="text-center">
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-gray-700">
                アップロード中...
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">📹</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                動画ファイルをドラッグ&ドロップ
              </h3>
              <p className="text-gray-500 mb-4">
                またはクリックしてファイルを選択
              </p>
              <p className="text-sm text-gray-400">
                {uploadRules
                  ? `${uploadRules.allowed_extensions.join(', ')}形式、最大${uploadRules.max_file_size_mb}MB`
                  : 'MP4またはGIF形式、最大100MB'}
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

