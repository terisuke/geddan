'use client';

import { backgroundRemover } from '@/lib/BackgroundRemover';
import { useAppStore } from '@/store/useAppStore';
import { useState } from 'react';

export function useCaptureProcessor() {
  const {
    jobId,
    capturedImages,
    setRemovingBackground,
    setRemovalProgress,
    setGenerationId,
    setStatus
  } = useAppStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processAndUploadCaptures = async () => {
    if (!jobId) {
      setError("Job ID missing");
      return false;
    }

    try {
      setIsProcessing(true);
      setRemovingBackground(true);
      setRemovalProgress(0);
      setError(null);

      const indices = Object.keys(capturedImages).map(Number);
      const total = indices.length;
      let processed = 0;

      // 1. Process & Upload Loop
      for (const index of indices) {
        const originalBlob = capturedImages[index];

        // Remove Background
        let processedBlob = originalBlob;
        try {
          processedBlob = await backgroundRemover.removeBackground(originalBlob);
        } catch (err) {
          console.error(`Background removal failed for ${index}, using original`, err);
        }

        // Upload
        const formData = new FormData();
        formData.append('file', processedBlob, `capture-${index}.png`);
        formData.append('cluster_id', String(index));

        const res = await fetch(`http://localhost:8000/api/generate/${jobId}/capture`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed for index ${index}`);
        }

        processed++;
        setRemovalProgress(Math.round((processed / total) * 100));
      }

      setRemovingBackground(false);
      setIsProcessing(false);
      return true;

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Processing failed");
      setRemovingBackground(false);
      setIsProcessing(false);
      return false;
    }
  };

  return {
    processAndUploadCaptures,
    isProcessing,
    error
  };
}
