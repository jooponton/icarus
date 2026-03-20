import { create } from "zustand";

export type WorkflowStep = "upload" | "reconstruct" | "design" | "place" | "export";

export const WORKFLOW_STEPS: { key: WorkflowStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "reconstruct", label: "Reconstruct" },
  { key: "design", label: "Design" },
  { key: "place", label: "Place" },
  { key: "export", label: "Export" },
];

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
  // Workflow
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  setStep: (step: WorkflowStep) => void;
  completeStep: (step: WorkflowStep) => void;

  // Upload
  footage: File[];
  processing: boolean;
  processingProgress: number;
  setFootage: (files: File[]) => void;
  setProcessing: (v: boolean) => void;
  setProcessingProgress: (v: number) => void;

  // Scene
  sceneReady: boolean;
  setSceneReady: (v: boolean) => void;

  // Design
  buildingSpec: BuildingSpec | null;
  setBuildingSpec: (spec: BuildingSpec) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentStep: "upload",
  completedSteps: new Set(),
  setStep: (step) => set({ currentStep: step }),
  completeStep: (step) =>
    set((s) => ({
      completedSteps: new Set([...s.completedSteps, step]),
    })),

  footage: [],
  processing: false,
  processingProgress: 0,
  setFootage: (files) => set({ footage: files }),
  setProcessing: (v) => set({ processing: v }),
  setProcessingProgress: (v) => set({ processingProgress: v }),

  sceneReady: false,
  setSceneReady: (v) => set({ sceneReady: v }),

  buildingSpec: null,
  setBuildingSpec: (spec) => set({ buildingSpec: spec }),
}));
