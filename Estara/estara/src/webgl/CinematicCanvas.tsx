import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import { useState } from "react";
import { Earth } from "./Earth";
import { Starfield } from "./Starfield";
import { Lighting } from "./Lighting";
import { CameraDirector } from "./CameraDirector";
import { journey, lerp, smoothstep, updateJourney } from "../journey/journey";

/** device quality profile — drives geometry, shadows and DPR budgets */
function detectQuality() {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = window.matchMedia("(max-width: 820px)").matches;
  let q = 1;
  if (mobile) q -= 0.35;
  if (mem <= 4) q -= 0.15;
  if (cores <= 4) q -= 0.15;
  return Math.max(0.3, Math.min(1, q));
}

/** single per-frame driver: journey progress + atmospheric background */
function JourneyDriver() {
  const { scene, gl } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(new THREE.Color("#0a0c10"), 0), []);
  const bg = useMemo(() => new THREE.Color("#000000"), []);
  const space = useMemo(() => new THREE.Color("#000206"), []);
  const day = useMemo(() => new THREE.Color("#9fb6c9"), []);
  const dusk = useMemo(() => new THREE.Color("#dfd6c8"), []);

  useFrame((_, dt) => {
    updateJourney(dt);
    const p = journey.p;

    const ground = smoothstep(1.95, 2.7, p);
    const settle = smoothstep(4.4, 5.4, p);
    bg.copy(space).lerp(day, ground).lerp(dusk, settle * 0.55);
    scene.background = bg;

    fog.color.copy(bg);
    fog.density = lerp(0, 0.0016, ground) * (1 - settle * 0.35);
    scene.fog = fog.density > 0.00001 ? fog : null;

    gl.toneMappingExposure = lerp(1.0, 1.12, ground);
  });
  return null;
}

export function CinematicCanvas() {
  const quality = useRef(detectQuality()).current;
  const [dpr, setDpr] = useState<number>(Math.min(window.devicePixelRatio, quality > 0.7 ? 1.75 : 1.25));

  return (
    <Canvas
      className="cinematic-canvas"
      dpr={dpr}
      shadows={quality > 0.45 ? "soft" : false}
      gl={{
        antialias: quality > 0.6,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        alpha: false,
      }}
      camera={{ fov: 42, near: 0.05, far: 40000, position: [0, 0.95, 6.4] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#000000");
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(1.75, d + 0.15))}
      />
      <AdaptiveDpr />
      <AdaptiveEvents />

      <JourneyDriver />
      <CameraDirector />
      <Lighting quality={quality} />

      <Suspense fallback={null}>
        <Earth quality={quality} />
      </Suspense>
      <Starfield count={quality > 0.7 ? 2600 : 1200} />
    </Canvas>
  );
}
