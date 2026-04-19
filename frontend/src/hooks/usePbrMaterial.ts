import { useEffect, useState } from "react";
import * as THREE from "three";
import { apiBlobUrl } from "../lib/api";
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
    const blobUrls: string[] = [];
    const loaded: {
      albedo: THREE.Texture | null;
      normal: THREE.Texture | null;
      roughness: THREE.Texture | null;
      ao: THREE.Texture | null;
    } = { albedo: null, normal: null, roughness: null, ao: null };

    // Texture endpoints are JWT-gated, so fetch each channel through
    // `apiBlobUrl` (which adds the Authorization header) and feed the
    // resulting blob: URL to three's loader.
    const load = async (
      key: keyof typeof loaded,
      url: string,
      linear: boolean,
    ): Promise<void> => {
      let blobUrl: string;
      try {
        blobUrl = await apiBlobUrl(url);
      } catch {
        return;
      }
      if (cancelled) {
        URL.revokeObjectURL(blobUrl);
        return;
      }
      blobUrls.push(blobUrl);
      return new Promise<void>((resolve) => {
        loader.load(
          blobUrl,
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
    };

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
      for (const b of blobUrls) URL.revokeObjectURL(b);
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
