import type { UniqueFrame } from '@/types';
import type { AppError } from '@/lib/errors';
import { create } from 'zustand';

// Toast通知の型
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ミリ秒（0=自動消去なし）
  action?: {
    label: string;
    onClick: () => void;
  };
}

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
  isRemovingBackground: boolean;
  removalProgress: number;

  // Error State
  errors: AppError[];
  lastError: AppError | null;

  // Toast Notifications
  toasts: Toast[];

  // Actions
  setRemovingBackground: (isRemoving: boolean) => void;
  setRemovalProgress: (progress: number) => void;
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

  // Error Actions
  addError: (error: AppError) => void;
  removeError: (errorId: string) => void;
  clearErrors: () => void;

  // Toast Actions
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (toastId: string) => void;
  clearToasts: () => void;
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
  isRemovingBackground: false,
  removalProgress: 0,
  errors: [] as AppError[],
  lastError: null as AppError | null,
  toasts: [] as Toast[],
};

// Toast IDを生成
function generateToastId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setRemovingBackground: (isRemoving) => set({ isRemovingBackground: isRemoving }),
  setRemovalProgress: (progress) => set({ removalProgress: progress }),
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

  // Error Actions
  addError: (error) =>
    set((state) => ({
      errors: [...state.errors, error],
      lastError: error,
    })),
  removeError: (errorId) =>
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== errorId),
      lastError: state.lastError?.id === errorId ? null : state.lastError,
    })),
  clearErrors: () =>
    set({
      errors: [],
      lastError: null,
    }),

  // Toast Actions
  addToast: (toast) => {
    const id = generateToastId();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },
  removeToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== toastId),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

