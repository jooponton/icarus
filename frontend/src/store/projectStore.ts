import { create } from "zustand";

export interface BuildingSpec {
  building_type: string;
  stories: number;
  footprint_width: number;
  footprint_depth: number;
  roof_style: string;
  material: string;
  style: string;
  notes: string;
}

interface ProjectState {
  footage: File[];
  processing: boolean;
  sceneReady: boolean;
  buildingSpec: BuildingSpec | null;
  setFootage: (files: File[]) => void;
  setProcessing: (v: boolean) => void;
  setSceneReady: (v: boolean) => void;
  setBuildingSpec: (spec: BuildingSpec) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  footage: [],
  processing: false,
  sceneReady: false,
  buildingSpec: null,
  setFootage: (files) => set({ footage: files }),
  setProcessing: (v) => set({ processing: v }),
  setSceneReady: (v) => set({ sceneReady: v }),
  setBuildingSpec: (spec) => set({ buildingSpec: spec }),
}));
