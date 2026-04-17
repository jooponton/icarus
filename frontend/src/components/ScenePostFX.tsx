import { EffectComposer, Bloom, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Lightweight ArchViz post stack:
 *  - SMAA   : antialiasing without the texture-sharpness hit MSAA causes
 *  - Bloom  : low-threshold subtle bloom on glass/metal highlights
 *  - Tone   : ACES Filmic for a cinematic film response
 *
 * N8AO is intentionally omitted — the normal pass it needs blanks the
 * Canvas on some material/light combinations in this scene.
 */
export default function ScenePostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.35}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
