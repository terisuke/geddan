'use client';

import { FileUploader } from '@/components/upload/FileUploader';

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">
          動画をアップロード
        </h1>
        <p className="text-center text-gray-600 mb-8">
          手描きループアニメーション動画をアップロードしてください
        </p>

        <FileUploader />
      </div>
    </div>
  );
}

