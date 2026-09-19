import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  journey,
  clamp,
  lerp,
  sceneProgress,
  smootherstep,
  smoothstep,
} from "../journey/journey";
import { handoffState, writeCameraPose } from "../journey/handoff";
import { WORLD_ANCHOR, groundHeight } from "./anchor";

/**
 * ONE persistent camera. One authority at a time; every scene's pose is
 * evaluated as a continuous function of journey progress, and neighbouring
 * scenes are blended across their boundary — so the pose is C1-continuous and
 * no scene can ever teleport or reset the camera.
 */

const tmpPos = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const posA = new THREE.Vector3();
const posB = new THREE.Vector3();
const tgtA = new THREE.Vector3();
const tgtB = new THREE.Vector3();

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const out: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };

/** Earth space (radius 1) → world space (metres, landscape). */
export const EARTH_SCALE = 3000;
const earthCenter = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function updateEarthCenter() {
  _dir.copy(handoffState.scene02.destinationDirection);
  if (_dir.lengthSq() < 0.5) _dir.set(0.3, -0.55, 0.78);
  _dir.normalize();
  // surface point of the destination must sit exactly on the hero property
  earthCenter.copy(WORLD_ANCHOR).addScaledVector(_dir, -EARTH_SCALE);
  return earthCenter;
}

export const getEarthCenter = () => earthCenter;

function earthToWorld(v: THREE.Vector3) {
  return v.multiplyScalar(EARTH_SCALE).add(earthCenter);
}

/* ---------------------------------------------------------- scene poses ---- */

/** Scene 01 — THE WORLD. Earth emerges; camera drifts slowly closer. */
function scene01(t: number, pose: Pose) {
  const e = smootherstep(0, 1, t);
  const dist = lerp(6.4, 3.15, e);
  const ang = -0.28 + e * 0.30;
  const height = lerp(0.95, 0.42, e);
  pose.pos.set(Math.sin(ang) * dist, height, Math.cos(ang) * dist);
  pose.target.set(0, 0, 0);
  pose.fov = lerp(42, 38, e);
}

/** Scene 02 — THE JOURNEY. Orbit swings onto the New York vector and dives. */
function scene02(t: number, pose: Pose) {
  const e = smootherstep(0, 1, t);
  const dir = handoffState.scene02.destinationDirection.clone().normalize();
  if (dir.lengthSq() < 0.5) dir.set(0.3, -0.55, 0.78).normalize();

  // start from wherever scene 01 ended, swing toward the destination normal
  const start = new THREE.Vector3();
  const s1: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
  scene01(1, s1);
  start.copy(s1.pos).normalize();

  const swing = smootherstep(0, 0.72, t);
  const axisDir = start.clone().lerp(dir, swing).normalize();

  const alt = lerp(3.15, 1.055, smootherstep(0.12, 1, t)); // altitude above centre
  handoffState.scene02.altitude = alt - 1;

  pose.pos.copy(axisDir).multiplyScalar(alt);
  // gentle lateral offset so the approach is not a dead-straight dolly
  const lateral = new THREE.Vector3(0, 1, 0).cross(axisDir).normalize();
  pose.pos.addScaledVector(lateral, Math.sin(e * Math.PI) * 0.36 * (1 - e * 0.6));

  pose.target.copy(dir).multiplyScalar(lerp(0.0, 0.98, smootherstep(0.15, 0.95, t)));
  pose.fov = lerp(38, 52, smootherstep(0.5, 1, t));
}

/* Landscape-space poses (world units, ground ≈ 0). */

const HERO = WORLD_ANCHOR;

/**
 * Scene 03 — NYC AERIAL (descent).
 *
 * The procedural terrain/neighbourhood/property that used to be flown through
 * here has been removed. Real aerial footage of Manhattan now carries these
 * two scenes, scrubbed by scroll in `NYCVideoScene`.
 *
 * The camera still exists and still descends — it is what keeps the Earth
 * receding believably behind the footage as it fades up, and it is what
 * scenes 05/06 inherit from. It simply has nothing of its own left to look at.
 */
function scene03(t: number, pose: Pose) {
  const e = smootherstep(0, 1, t);

  const alt = lerp(1450, 210, Math.pow(e, 0.78));
  const back = lerp(700, 300, Math.pow(e, 0.7));
  const side = lerp(-400, -60, Math.pow(e, 0.9));

  pose.pos.set(HERO.x + side, HERO.y + alt, HERO.z + back);

  const drift = Math.sin(e * Math.PI) * 90 * (1 - e * 0.55);
  pose.pos.x -= drift;

  pose.target.set(
    lerp(HERO.x - 140, HERO.x, smootherstep(0.15, 0.92, t)),
    lerp(80, HERO.y + 20, smootherstep(0.1, 0.95, t)),
    lerp(HERO.z - 170, HERO.z, smootherstep(0.15, 0.92, t))
  );
  pose.fov = lerp(54, 44, smootherstep(0.3, 1, t));
}

/**
 * Scene 04 — NYC AERIAL (hold).
 *
 * A slow, continuous settle behind the footage. No architectural stations any
 * more — those anchors belonged to the deleted procedural house.
 */
function scene04(t: number, pose: Pose) {
  const s3end: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
  scene03(1, s3end);

  const e = smootherstep(0, 1, t);

  pose.pos.copy(s3end.pos);
  pose.pos.y = lerp(s3end.pos.y, HERO.y + 150, e);
  pose.pos.z = lerp(s3end.pos.z, HERO.z + 230, e);
  pose.target.copy(s3end.target);
  pose.target.y = lerp(s3end.target.y, HERO.y + 12, e);
  pose.fov = lerp(s3end.fov, 42, e);

  if (!journey.reducedMotion) {
    const creep = Math.sin(t * Math.PI) * 4.5;
    pose.pos.x += creep;
    pose.pos.z -= creep * 0.6;
  }
}

/** Scene 05 — THE PLATFORM: continuous pull-back property → city → map view. */
function scene05(t: number, pose: Pose) {
  const s4end: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
  scene04(1, s4end);

  const e = smootherstep(0, 1, t);
  // continuous pull-back: property → neighbourhood → city → map/discovery
  const dir = s4end.pos.clone().sub(HERO);
  const d0 = dir.length();
  dir.normalize();
  const dist = lerp(d0, journey.reducedMotion ? d0 * 2.4 : 760, Math.pow(e, 0.88));

  pose.pos.copy(HERO).addScaledVector(dir, dist);
  // rise into a shallow oblique — the classic "map" read — as we pull out
  pose.pos.y = lerp(s4end.pos.y, HERO.y + 520, Math.pow(e, 0.82));
  pose.target.set(
    HERO.x,
    lerp(HERO.y + 8, HERO.y - 30, e),
    lerp(HERO.z, HERO.z + 40, e)
  );
  pose.fov = lerp(40, 47, e);
}

/** Scene 06 — YOUR NEXT MOVE: the world settles, calm high drift. */
function scene06(t: number, pose: Pose) {
  const s5end: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
  scene05(1, s5end);

  const e = smootherstep(0, 1, t);
  pose.pos.copy(s5end.pos);
  pose.pos.y += e * 120;
  pose.pos.x += e * (journey.reducedMotion ? 20 : 140);
  pose.target.copy(s5end.target);
  pose.target.y -= e * 30;
  pose.fov = lerp(s5end.fov, 44, e);
}

/* ------------------------------------------------------------- director ---- */

type PoseFn = (t: number, pose: Pose) => void;
const SCENES: PoseFn[] = [scene01, scene02, scene03, scene04, scene05, scene06];

/** blend width, in scene units, around each scene boundary */
const BLEND = 0.34;

function evaluate(p: number, pose: Pose) {
  const clamped = clamp(p, 0, 6 - 1e-4);
  const i = Math.min(5, Math.floor(clamped));
  const local = clamped - i;

  SCENES[i](local, out);
  if (i < 2) {
    earthToWorld(out.pos);
    earthToWorld(out.target);
  }
  posA.copy(out.pos);
  tgtA.copy(out.target);
  const fovA = out.fov;

  // blend with the next scene near the boundary
  if (i < 5 && local > 1 - BLEND) {
    const k = smootherstep(1 - BLEND, 1, local);
    SCENES[i + 1](0, out);
    if (i + 1 < 2) {
      earthToWorld(out.pos);
      earthToWorld(out.target);
    }
    posB.copy(out.pos);
    tgtB.copy(out.target);
    // scene i+1 evaluated at its true continuation param (0) — blend spatially
    pose.pos.copy(posA).lerp(posB, k);
    pose.target.copy(tgtA).lerp(tgtB, k);
    pose.fov = lerp(fovA, out.fov, k);
    return;
  }

  pose.pos.copy(posA);
  pose.target.copy(tgtA);
  pose.fov = fovA;
}

/**
 * Scenes 01–02 are authored in Earth space (planet radius = 1). They are mapped
 * into the single world space by EARTH_SCALE and an offset that pins the New
 * York surface point onto the world anchor, so the 02 → 03 boundary is a
 * genuine continuation of the same flight rather than a cut.
 */
export function CameraDirector() {
  const { camera } = useThree();
  const pose = useRef<Pose>({
    pos: new THREE.Vector3(0, 0.95, 6.4),
    target: new THREE.Vector3(),
    fov: 42,
  });
  const cur = useRef({
    pos: new THREE.Vector3(0, 0.95, 6.4),
    target: new THREE.Vector3(),
    fov: 42,
  });
  const primed = useRef(false);
  useFrame((_, dt) => {
    const p = journey.p;
    updateEarthCenter();
    evaluate(p, pose.current);

    if (!primed.current) {
      primed.current = true;
      cur.current.pos.copy(pose.current.pos);
      cur.current.target.copy(pose.current.target);
      cur.current.fov = pose.current.fov;
    }

    const k = Math.min(dt, 0.05);
    const lambda = journey.reducedMotion ? 14 : 7;
    const a = 1 - Math.exp(-lambda * k);

    cur.current.pos.lerp(pose.current.pos, a);
    cur.current.target.lerp(pose.current.target, a);
    cur.current.fov = lerp(cur.current.fov, pose.current.fov, a);

    camera.position.copy(cur.current.pos);
    camera.lookAt(cur.current.target);
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - cur.current.fov) > 0.01) {
      pc.fov = cur.current.fov;
      pc.updateProjectionMatrix();
    }

    // ---- handoff contracts (live state, never reconstructed) ----
    const sp = (n: number) => sceneProgress(p, n);
    writeCameraPose(handoffState.scene01.camera, pc, cur.current.target);
    handoffState.scene01.progress = sp(1);
    writeCameraPose(handoffState.scene02.camera, pc, cur.current.target);
    handoffState.scene02.progress = sp(2);
    writeCameraPose(handoffState.scene03.camera, pc, cur.current.target);
    handoffState.scene03.progress = sp(3);
    handoffState.scene03.activePhase = Math.min(5, Math.floor(sp(3) * 5) + 1);
    writeCameraPose(handoffState.scene04.camera, pc, cur.current.target);
    handoffState.scene04.progress = sp(4);
    writeCameraPose(handoffState.scene05.camera, pc, cur.current.target);
    handoffState.scene05.progress = sp(5);
    handoffState.scene05.platformOpacity = smoothstep(4.3, 5.05, p);
    handoffState.scene04.worldOpacity = 1 - smoothstep(4.7, 5.5, p);

    tmpPos.copy(cur.current.pos);
    tmpTarget.copy(cur.current.target);
  });

  return null;
}

/** exported for the world group so Earth can be scaled out of the way */
export function useGroundAltitude(x: number, z: number) {
  return groundHeight(x, z);
}
