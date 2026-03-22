import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportGLTF(scene: THREE.Object3D, name: string) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
  download(blob, `${name}.glb`);
}

export function exportOBJ(scene: THREE.Object3D, name: string) {
  const exporter = new OBJExporter();
  const result = exporter.parse(scene);
  const blob = new Blob([result], { type: "text/plain" });
  download(blob, `${name}.obj`);
}

export function exportPLY(scene: THREE.Object3D, name: string) {
  const exporter = new PLYExporter();
  exporter.parse(scene, (result) => {
    const blob = new Blob([result], { type: "application/octet-stream" });
    download(blob, `${name}.ply`);
  }, { binary: true });
}

export function exportSTL(scene: THREE.Object3D, name: string) {
  const exporter = new STLExporter();
  const result = exporter.parse(scene, { binary: true });
  const blob = new Blob([result], { type: "application/octet-stream" });
  download(blob, `${name}.stl`);
}
