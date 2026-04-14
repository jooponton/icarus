import { useEffect, useState } from "react";
import * as THREE from "three";
import type { PbrChannelUrls } from "../store/projectStore";

export interface PbrMaterialProps {
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
  color: string;
  normalScale: THREE.Vector2;
}

const NORMAL_SCALE = new THREE.Vector2(1.4, 1.4);

function configureAlbedo(tex: THREE.Texture, repeatX: number, repeatY: number) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
}

function configureLinear(tex: THREE.Texture, repeatX: number, repeatY: number) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
}

/**
 * Load all four PBR channels for a single surface. Returns material props that
 * spread onto a <meshStandardMaterial>. Falls back to a flat color while maps
 * stream in or when the URL set is null.
 */
export function usePbrMaterial(
  urls: PbrChannelUrls | null,
  fallbackColor: string,
  repeatX: number = 1,
  repeatY: number = 1,
): PbrMaterialProps {
  const [maps, setMaps] = useState<{
    albedo: THREE.Texture | null;
    normal: THREE.Texture | null;
    roughness: THREE.Texture | null;
    ao: THREE.Texture | null;
  }>({ albedo: null, normal: null, roughness: null, ao: null });

  useEffect(() => {
    if (!urls) {
      setMaps({ albedo: null, normal: null, roughness: null, ao: null });
      return;
    }

    const loader = new THREE.TextureLoader();
    let cancelled = false;
    const loaded: {
      albedo: THREE.Texture | null;
      normal: THREE.Texture | null;
      roughness: THREE.Texture | null;
      ao: THREE.Texture | null;
    } = { albedo: null, normal: null, roughness: null, ao: null };

    const load = (key: keyof typeof loaded, url: string, linear: boolean) =>
      new Promise<void>((resolve) => {
        loader.load(
          url,
          (tex) => {
            if (cancelled) {
              tex.dispose();
              return resolve();
            }
            if (linear) configureLinear(tex, repeatX, repeatY);
            else configureAlbedo(tex, repeatX, repeatY);
            loaded[key] = tex;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      });

    Promise.all([
      load("albedo", urls.albedo, false),
      load("normal", urls.normal, true),
      load("roughness", urls.roughness, true),
      load("ao", urls.ao, true),
    ]).then(() => {
      if (!cancelled) setMaps(loaded);
    });

    return () => {
      cancelled = true;
      loaded.albedo?.dispose();
      loaded.normal?.dispose();
      loaded.roughness?.dispose();
      loaded.ao?.dispose();
    };
  }, [urls, repeatX, repeatY]);

  return {
    map: maps.albedo,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    aoMap: maps.ao,
    color: maps.albedo ? "#ffffff" : fallbackColor,
    normalScale: NORMAL_SCALE,
  };
}
