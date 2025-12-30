import { ThumbnailGrid } from '@/components/review/ThumbnailGrid';
import { useCaptureProcessor } from '@/hooks/useCaptureProcessor';
import { useAppStore } from '@/store/useAppStore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ReviewPage() {
  const router = useRouter();
  const {
    uniqueFrames,
    capturedImages,
    jobId,
    goToCapture,
    isRemovingBackground,
    removalProgress,
  } = useAppStore();

  const { processAndUploadCaptures, isProcessing, error: uploadError } = useCaptureProcessor();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ state: '', percent: 0 });

  const handleRetake = (index: number) => {
    goToCapture(index);
    router.push('/capture');
  };

  const startGeneration = async () => {
    if (!jobId) return;

    // 1. Process & Upload
    const success = await processAndUploadCaptures();
    if (!success) {
      alert(uploadError || "Failed to process images");
      return;
    }

    // 2. Trigger Generation
    try {
      setIsGenerating(true);
      const res = await fetch(`http://localhost:8000/api/generate/${jobId}/start`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to start generation");

      // 3. Poll
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:8000/api/generate/${jobId}/status`);
          const statusData = await statusRes.json();

          setGenerationProgress({
            state: statusData.status,
            percent: parseInt(statusData.progress || '0')
          });

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            const videoUrl = `http://localhost:8000${statusData.result_url}`;
            window.open(videoUrl, '_blank');
            setIsGenerating(false);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            alert("Generation failed: " + statusData.message);
            setIsGenerating(false);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1000);

    } catch {
      alert("Generation initialization failed");
      setIsGenerating(false);
    }
  };

  if (uniqueFrames.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Review Captures</h1>

        {/* Status Overlay */}
        {(isRemovingBackground || isGenerating || isProcessing) && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
            <div className="w-64">
              <div className="mb-2 flex justify-between text-sm">
                <span>
                  {isProcessing
                    ? 'Processing Images...'
                    : isRemovingBackground
                      ? 'Removing Backgrounds...'
                      : 'Generating Video...'}
                </span>
                <span>
                  {isRemovingBackground
                    ? removalProgress
                    : generationProgress.percent}
                  %
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${isRemovingBackground ? removalProgress : generationProgress.percent}%`,
                  }}
                />
              </div>
              <p className="mt-4 text-center text-gray-400 text-sm">
                {isGenerating &&
                  generationProgress.state !== 'processing' &&
                  generationProgress.state}
              </p>
            </div>
          </div>
        )}

        <div className="mb-8">
          <ThumbnailGrid
            uniqueFrames={uniqueFrames}
            capturedImages={capturedImages}
            onRetake={handleRetake}
          />
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => router.push('/capture')}
            className="px-6 py-3 bg-gray-800 rounded hover:bg-gray-700"
          >
            Back to Capture
          </button>

          <button
            onClick={startGeneration}
            disabled={isRemovingBackground || isGenerating || isProcessing}
            className="px-8 py-3 bg-blue-600 rounded font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            Create Video 🎬
          </button>
        </div>
      </div>
    </div>
  );
}

