import { create } from "zustand";

interface ProjectState {
  footage: File[];
  processing: boolean;
  sceneReady: boolean;
  setFootage: (files: File[]) => void;
  setProcessing: (v: boolean) => void;
  setSceneReady: (v: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  footage: [],
  processing: false,
  sceneReady: false,
  setFootage: (files) => set({ footage: files }),
  setProcessing: (v) => set({ processing: v }),
  setSceneReady: (v) => set({ sceneReady: v }),
}));
