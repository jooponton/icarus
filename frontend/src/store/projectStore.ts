import { create } from "zustand";
import * as THREE from "three";

export type WorkflowStep =
  | "upload"
  | "reconstruct"
  | "design"
  | "place"
  | "export";

export const WORKFLOW_STEPS: { key: WorkflowStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "reconstruct", label: "Reconstruct" },
  { key: "design", label: "Design" },
  { key: "place", label: "Place" },
  { key: "export", label: "Export" },
];

// --- Types ---

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

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  resolution?: string;
  duration?: string;
  status: "uploading" | "uploaded" | "queued" | "error";
  progress?: number;
  tags?: string[];
  file: File;
}

export interface QualityChecks {
  gps: boolean | null;
  overlap: boolean | null;
  exposure: boolean | null;
}

export type PipelineStageStatus = "pending" | "running" | "completed" | "error";

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  progress: number;
  stats: Record<string, string>;
}

export interface Measurement {
  id: string;
  label: string;
  distance: string;
}

export type TransformMode = "translate" | "rotate";

export interface BuildingPlacement {
  position: [number, number, number];
  rotation: [number, number, number];
}

export type ViewportMode = "grid" | "street" | "wireframe";
export type ExportFormat = "gltf" | "obj" | "stl";
export type ExportPreviewTab =
  | "preview"
  | "dual"
  | "tiles"
  | "streaming"
  | "design";
export type FileBrowserFilter =
  | "all"
  | "video"
  | "raw"
  | "gps"
  | "low-quality";

// --- State ---

interface ProjectState {
  // Workflow
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  setStep: (step: WorkflowStep) => void;
  completeStep: (step: WorkflowStep) => void;

  // Project metadata
  projectName: string;
  projectId: string;
  location: string;
  targetType: string;
  setProjectMeta: (meta: Partial<Pick<ProjectState, "projectName" | "projectId" | "location" | "targetType">>) => void;

  // Upload
  footage: File[];
  uploadedFiles: UploadedFile[];
  processing: boolean;
  processingProgress: number;
  qualityChecks: QualityChecks;
  setFootage: (files: File[]) => void;
  addUploadedFiles: (files: UploadedFile[]) => void;
  updateUploadedFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeUploadedFile: (id: string) => void;
  setProcessing: (v: boolean) => void;
  setProcessingProgress: (v: number) => void;
  setQualityChecks: (checks: Partial<QualityChecks>) => void;

  // File browser
  fileBrowserOpen: boolean;
  fileBrowserFilter: FileBrowserFilter;
  fileBrowserSort: string;
  selectedBrowserFiles: Set<string>;
  setFileBrowserOpen: (v: boolean) => void;
  setFileBrowserFilter: (f: FileBrowserFilter) => void;
  setFileBrowserSort: (s: string) => void;
  toggleBrowserFileSelection: (id: string) => void;
  clearBrowserSelection: () => void;

  // Scene
  sceneReady: boolean;
  setSceneReady: (v: boolean) => void;
  viewportMode: ViewportMode;
  setViewportMode: (m: ViewportMode) => void;

  // Reconstruction
  pipelineStages: PipelineStage[];
  reconstructionPaused: boolean;
  setPipelineStages: (stages: PipelineStage[]) => void;
  updatePipelineStage: (id: string, updates: Partial<PipelineStage>) => void;
  setReconstructionPaused: (v: boolean) => void;

  // Design
  buildingSpec: BuildingSpec | null;
  setBuildingSpec: (spec: BuildingSpec) => void;
  meshSmoothing: number;
  meshDetailLevel: number;
  measurements: Measurement[];
  setMeshSmoothing: (v: number) => void;
  setMeshDetailLevel: (v: number) => void;
  setMeasurements: (m: Measurement[]) => void;
  addMeasurement: (m: Measurement) => void;
  removeMeasurement: (id: string) => void;

  // Placement
  buildingPlacement: BuildingPlacement;
  transformMode: TransformMode;
  setBuildingPlacement: (p: Partial<BuildingPlacement>) => void;
  setTransformMode: (m: TransformMode) => void;

  // Scene ref (for export)
  sceneGroup: THREE.Group | null;
  setSceneGroup: (g: THREE.Group | null) => void;

  // Export
  exportFormat: ExportFormat;
  exportBundle: { obj: boolean; pointCloud: boolean; texturedMesh: boolean };
  exportPreviewTab: ExportPreviewTab;
  setExportFormat: (f: ExportFormat) => void;
  setExportBundle: (b: Partial<{ obj: boolean; pointCloud: boolean; texturedMesh: boolean }>) => void;
  setExportPreviewTab: (t: ExportPreviewTab) => void;

  // Chat drawer
  chatDrawerOpen: boolean;
  setChatDrawerOpen: (v: boolean) => void;
}

// --- Default pipeline stages ---

const DEFAULT_PIPELINE: PipelineStage[] = [
  { id: "feature", name: "Feature extraction", status: "pending", progress: 0, stats: {} },
  { id: "sparse", name: "Sparse point cloud", status: "pending", progress: 0, stats: {} },
  { id: "dense", name: "Dense mesh generation", status: "pending", progress: 0, stats: {} },
];

// --- Store ---

export const useProjectStore = create<ProjectState>((set) => ({
  // Workflow
  currentStep: "upload",
  completedSteps: new Set(),
  setStep: (step) => set({ currentStep: step }),
  completeStep: (step) =>
    set((s) => ({
      completedSteps: new Set([...s.completedSteps, step]),
    })),

  // Project metadata
  projectName: "Untitled Project",
  projectId: "",
  location: "",
  targetType: "As-built CAD",
  setProjectMeta: (meta) => set((s) => ({ ...s, ...meta })),

  // Upload
  footage: [],
  uploadedFiles: [],
  processing: false,
  processingProgress: 0,
  qualityChecks: { gps: null, overlap: null, exposure: null },
  setFootage: (files) => set({ footage: files }),
  addUploadedFiles: (files) =>
    set((s) => ({ uploadedFiles: [...s.uploadedFiles, ...files] })),
  updateUploadedFile: (id, updates) =>
    set((s) => ({
      uploadedFiles: s.uploadedFiles.map((f) =>
        f.id === id ? { ...f, ...updates } : f,
      ),
    })),
  removeUploadedFile: (id) =>
    set((s) => ({
      uploadedFiles: s.uploadedFiles.filter((f) => f.id !== id),
    })),
  setProcessing: (v) => set({ processing: v }),
  setProcessingProgress: (v) => set({ processingProgress: v }),
  setQualityChecks: (checks) =>
    set((s) => ({ qualityChecks: { ...s.qualityChecks, ...checks } })),

  // File browser
  fileBrowserOpen: false,
  fileBrowserFilter: "all",
  fileBrowserSort: "newest",
  selectedBrowserFiles: new Set(),
  setFileBrowserOpen: (v) => set({ fileBrowserOpen: v }),
  setFileBrowserFilter: (f) => set({ fileBrowserFilter: f }),
  setFileBrowserSort: (s) => set({ fileBrowserSort: s }),
  toggleBrowserFileSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedBrowserFiles);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedBrowserFiles: next };
    }),
  clearBrowserSelection: () => set({ selectedBrowserFiles: new Set() }),

  // Scene
  sceneReady: false,
  setSceneReady: (v) => set({ sceneReady: v }),
  viewportMode: "grid",
  setViewportMode: (m) => set({ viewportMode: m }),

  // Reconstruction
  pipelineStages: DEFAULT_PIPELINE,
  reconstructionPaused: false,
  setPipelineStages: (stages) => set({ pipelineStages: stages }),
  updatePipelineStage: (id, updates) =>
    set((s) => ({
      pipelineStages: s.pipelineStages.map((stage) =>
        stage.id === id ? { ...stage, ...updates } : stage,
      ),
    })),
  setReconstructionPaused: (v) => set({ reconstructionPaused: v }),

  // Design
  buildingSpec: null,
  setBuildingSpec: (spec) => set({ buildingSpec: spec }),
  meshSmoothing: 50,
  meshDetailLevel: 75,
  measurements: [],
  setMeshSmoothing: (v) => set({ meshSmoothing: v }),
  setMeshDetailLevel: (v) => set({ meshDetailLevel: v }),
  setMeasurements: (m) => set({ measurements: m }),
  addMeasurement: (m) =>
    set((s) => ({ measurements: [...s.measurements, m] })),
  removeMeasurement: (id) =>
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
    })),

  // Placement
  buildingPlacement: { position: [0, 0, 0], rotation: [0, 0, 0] },
  transformMode: "translate",
  setBuildingPlacement: (p) =>
    set((s) => ({ buildingPlacement: { ...s.buildingPlacement, ...p } })),
  setTransformMode: (m) => set({ transformMode: m }),

  // Scene ref
  sceneGroup: null,
  setSceneGroup: (g) => set({ sceneGroup: g }),

  // Export
  exportFormat: "gltf",
  exportBundle: { obj: true, pointCloud: false, texturedMesh: true },
  exportPreviewTab: "preview",
  setExportFormat: (f) => set({ exportFormat: f }),
  setExportBundle: (b) =>
    set((s) => ({ exportBundle: { ...s.exportBundle, ...b } })),
  setExportPreviewTab: (t) => set({ exportPreviewTab: t }),

  // Chat drawer
  chatDrawerOpen: false,
  setChatDrawerOpen: (v) => set({ chatDrawerOpen: v }),
}));
