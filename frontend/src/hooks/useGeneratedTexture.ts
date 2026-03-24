import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Load a texture from a URL with fallback to a flat color.
 * Returns material props: { map, color } to spread onto meshStandardMaterial.
 */
export function useGeneratedTexture(
  url: string | null,
  fallbackColor: string,
  repeatX: number = 1,
  repeatY: number = 1,
): { map: THREE.Texture | null; color: string } {
  const loaderRef = useRef(new THREE.TextureLoader());
  const textureRef = useRef<THREE.Texture | null>(null);

  const texture = useMemo(() => {
    if (!url) return null;

    // Dispose old texture
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }

    const tex = loaderRef.current.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
    return tex;
  }, [url, repeatX, repeatY]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
      textureRef.current = null;
    };
  }, []);

  if (texture) {
    return { map: texture, color: "#ffffff" };
  }
  return { map: null, color: fallbackColor };
}
