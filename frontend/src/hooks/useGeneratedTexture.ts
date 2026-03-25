import { useEffect, useRef, useState } from "react";
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
  const [loaded, setLoaded] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    // Dispose previous texture
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }
    setLoaded(null);

    if (!url) return;

    const tex = loaderRef.current.load(
      url,
      // onLoad — texture is ready
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeatX, repeatY);
        t.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = t;
        setLoaded(t);
      },
      undefined,
      // onError — fall back to flat color
      () => {
        tex.dispose();
        setLoaded(null);
      },
    );

    return () => {
      tex.dispose();
      textureRef.current = null;
    };
  }, [url, repeatX, repeatY]);

  if (loaded) {
    return { map: loaded, color: "#ffffff" };
  }
  return { map: null, color: fallbackColor };
}
