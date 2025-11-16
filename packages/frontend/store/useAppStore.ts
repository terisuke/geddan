import { create } from 'zustand';
import type { UniqueFrame } from '@/types';

interface AppStore {
  // Upload & Analysis
  jobId: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'generating';
  progress: number;
  currentStep: string | null;
  uniqueFrames: UniqueFrame[];
  frameMapping: Record<string, number> | null;

  // Capture
  currentPoseIndex: number;
  capturedImages: Record<number, Blob>;

  // Generation
  generationId: string | null;
  videoUrl: string | null;

  // Actions
  setJobId: (id: string) => void;
  setStatus: (status: AppStore['status']) => void;
  setProgress: (progress: number) => void;
  setCurrentStep: (step: string | null) => void;
  setUniqueFrames: (frames: UniqueFrame[]) => void;
  setFrameMapping: (mapping: Record<string, number>) => void;
  addCapturedImage: (index: number, blob: Blob) => void;
  setCurrentPoseIndex: (index: number) => void;
  nextPose: () => void;
  goToCapture: (index: number) => void;
  setGenerationId: (id: string) => void;
  setVideoUrl: (url: string) => void;
  reset: () => void;
}

const initialState = {
  jobId: null,
  status: 'idle' as const,
  progress: 0,
  currentStep: null,
  uniqueFrames: [],
  frameMapping: null,
  currentPoseIndex: 0,
  capturedImages: {},
  generationId: null,
  videoUrl: null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setJobId: (id) => set({ jobId: id }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setUniqueFrames: (frames) => set({ uniqueFrames: frames }),
  setFrameMapping: (mapping) => set({ frameMapping: mapping }),
  addCapturedImage: (index, blob) =>
    set((state) => ({
      capturedImages: { ...state.capturedImages, [index]: blob },
    })),
  setCurrentPoseIndex: (index) => set({ currentPoseIndex: index }),
  nextPose: () =>
    set((state) => ({
      currentPoseIndex: state.currentPoseIndex + 1,
    })),
  goToCapture: (index) => set({ currentPoseIndex: index }),
  setGenerationId: (id) => set({ generationId: id }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  reset: () => set(initialState),
}));

