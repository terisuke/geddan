/**
 * BackgroundRemover Utility
 * 
 * Uses MediaPipe Pose segmentation to remove background from images.
 * Designed to run in the browser.
 */

interface MediaPipePose {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: MediaPipeResults) => void) => void;
  send: (input: { image: HTMLImageElement }) => Promise<void>;
}

interface MediaPipeResults {
  image: { width: number; height: number };
  segmentationMask?: ImageData;
}

declare global {
  interface Window {
    Pose?: new (config: { locateFile: (file: string) => string }) => MediaPipePose;
  }
}

export class BackgroundRemover {
  private static instance: BackgroundRemover;
  private isLoaded = false;
  private pose: MediaPipePose | null = null;

  private constructor() { }

  public static getInstance(): BackgroundRemover {
    if (!BackgroundRemover.instance) {
      BackgroundRemover.instance = new BackgroundRemover();
    }
    return BackgroundRemover.instance;
  }

  /**
   * Initialize MediaPipe Pose
   */
  public async init(): Promise<void> {
    if (this.isLoaded) return;

    // Load scripts dynamically
    if (!window.Pose) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
    }

    if (!window.Pose) {
      throw new Error('MediaPipe Pose failed to load');
    }

    this.pose = new window.Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: true,
      smoothSegmentation: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.isLoaded = true;
  }

  /**
   * Process an image blob and return a blob with transparent background
   */
  public async removeBackground(imageBlob: Blob): Promise<Blob> {
    if (!this.isLoaded) {
      await this.init();
    }

    const imageUrl = URL.createObjectURL(imageBlob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = imageUrl;

      img.onload = async () => {
        try {
          if (!this.pose) {
            reject(new Error('Pose not initialized'));
            return;
          }
          // Set up one-time listener for results
          this.pose.onResults((results: MediaPipeResults) => {
            const canvas = document.createElement('canvas');
            canvas.width = results.image.width;
            canvas.height = results.image.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error("Could not get canvas context"));
              return;
            }

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (results.segmentationMask) {
              // Draw mask
              ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

              // Keep only where mask is
              ctx.globalCompositeOperation = 'source-in';
              ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            } else {
              // Fallback
              ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            }

            // Return blob
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to create blob"));
            }, 'image/png');

            // Clean up URL
            URL.revokeObjectURL(imageUrl);
          });

          // Send to MediaPipe
          await this.pose.send({ image: img });

        } catch (e) {
          reject(e);
        }
      };

      img.onerror = (e) => reject(e);
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

export const backgroundRemover = BackgroundRemover.getInstance();
