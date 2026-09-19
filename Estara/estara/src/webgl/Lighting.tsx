import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { journey, lerp, smoothstep } from "../journey/journey";
import { getEarthCenter, EARTH_SCALE } from "./CameraDirector";
import { WORLD_ANCHOR } from "./anchor";

/**
 * Continuous daylight rig.
 *
 * In space the key is a hard, neutral sun. As the camera descends it slides
 * into a real New York afternoon: a warm low sun at ~28° altitude, a blue
 * sky-fill hemisphere from above, a warm ground bounce from below, and a
 * physically plausible sun/sky intensity ratio. Shadows tighten onto the
 * property so the shadow map resolution goes where the camera is looking.
 */

const SUN_AZIMUTH = -0.72; // radians, sun to the west/north-west
const SUN_ALTITUDE = 0.5; // radians above horizon (~28°)

export function Lighting({ quality }: { quality: number }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const sky = useRef<THREE.HemisphereLight>(null!);
  const bounce = useRef<THREE.DirectionalLight>(null!);
  const ambient = useRef<THREE.AmbientLight>(null!);
  const { scene } = useThree();

  const spacePos = useMemo(() => new THREE.Vector3(), []);
  const sunDir = useMemo(
    () =>
      new THREE.Vector3(
        Math.cos(SUN_ALTITUDE) * Math.cos(SUN_AZIMUTH),
        Math.sin(SUN_ALTITUDE),
        Math.cos(SUN_ALTITUDE) * Math.sin(SUN_AZIMUTH)
      ).normalize(),
    []
  );
  const groundPos = useMemo(
    () => WORLD_ANCHOR.clone().addScaledVector(sunDir, 420),
    [sunDir]
  );

  const spaceSun = useMemo(() => new THREE.Color("#fff6ea"), []);
  const daySun = useMemo(() => new THREE.Color("#ffd9a8"), []);
  const eveningSun = useMemo(() => new THREE.Color("#ffbf80"), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  // subtle image-based fill so glass and metal have something to reflect
  const env = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 32;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, "#7fa8cc");
    g.addColorStop(0.5, "#dfe8ee");
    g.addColorStop(0.52, "#b0a693");
    g.addColorStop(1, "#6b6355");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 32);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useFrame(() => {
    const p = journey.p;
    const ground = smoothstep(1.75, 2.7, p);
    const evening = smoothstep(3.3, 4.8, p);

    // --- key light -------------------------------------------------------
    spacePos
      .set(0.62, 0.3, 0.72)
      .normalize()
      .multiplyScalar(EARTH_SCALE * 4)
      .add(getEarthCenter());
    sun.current.position.lerpVectors(spacePos, groundPos, ground);
    sun.current.target.position.lerpVectors(getEarthCenter(), WORLD_ANCHOR, ground);
    sun.current.target.updateMatrixWorld();

    tmp.copy(spaceSun).lerp(daySun, ground).lerp(eveningSun, evening * 0.8);
    sun.current.color.copy(tmp);
    sun.current.intensity = lerp(2.7, 3.5, ground) * (1 - evening * 0.18);

    // tighten the shadow frustum onto the property once we are on the ground
    const cam = sun.current.shadow.camera as THREE.OrthographicCamera;
    const extent = lerp(600, 90, ground);
    if (Math.abs(cam.right - extent) > 0.5) {
      cam.left = -extent;
      cam.right = extent;
      cam.top = extent;
      cam.bottom = -extent;
      cam.near = 1;
      cam.far = lerp(2000, 900, ground);
      cam.updateProjectionMatrix();
    }

    // --- sky fill --------------------------------------------------------
    sky.current.intensity = lerp(0.02, 0.95, ground) * (1 - evening * 0.25);
    sky.current.color.setHSL(0.58, lerp(0.1, 0.45, ground), lerp(0.5, 0.72, ground));
    sky.current.groundColor.setHSL(0.09, 0.3, lerp(0.1, 0.34, ground));

    // --- warm ground bounce ---------------------------------------------
    bounce.current.position.set(
      WORLD_ANCHOR.x - sunDir.x * 200,
      WORLD_ANCHOR.y - 60,
      WORLD_ANCHOR.z - sunDir.z * 200
    );
    bounce.current.target.position.copy(WORLD_ANCHOR);
    bounce.current.target.updateMatrixWorld();
    bounce.current.intensity = ground * 0.42 * (1 + evening * 0.4);

    ambient.current.intensity = lerp(0.03, 0.22, ground);

    scene.environment = ground > 0.15 ? env : null;
    scene.environmentIntensity = ground * (0.6 + evening * 0.3);
  });

  const shadowSize = quality > 0.8 ? 2560 : quality > 0.55 ? 1536 : 1024;

  return (
    <>
      <ambientLight ref={ambient} intensity={0.03} />
      <hemisphereLight ref={sky} intensity={0} />
      <directionalLight ref={bounce} color="#ffd9b0" intensity={0} />
      <directionalLight
        ref={sun}
        intensity={2.7}
        castShadow={quality > 0.45}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
    </>
  );
}
