/**
 * Estara — global journey state.
 * One normalized progress value drives the entire cinematic experience.
 * Raw scroll never touches camera transforms: it feeds a damped progress value.
 */

export const SCENE_COUNT = 6;

export type ScenePhase =
  | "loading"
  | "scene01"
  | "scene02"
  | "scene03"
  | "scene04"
  | "scene05"
  | "scene06";

export type CameraAuthority =
  | "scene01"
  | "scene02"
  | "scene03"
  | "scene04"
  | "scene05"
  | "scene06";

export interface JourneyState {
  /** raw scroll progress, 0 → SCENE_COUNT */
  raw: number;
  /** damped progress, 0 → SCENE_COUNT (this is what scenes read) */
  p: number;
  /** 0 → 1 across the whole journey */
  global: number;
  phase: ScenePhase;
  authority: CameraAuthority;
  reducedMotion: boolean;
  mobile: boolean;
  ready: boolean;
}

export const journey: JourneyState = {
  raw: 0,
  p: 0,
  global: 0,
  phase: "loading",
  authority: "scene01",
  reducedMotion: false,
  mobile: false,
  ready: false,
};

/* ---------------------------------------------------------------- math ---- */

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** frame-rate independent damping */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** local progress inside a scene track: scene 1 → p in [0,1) */
export const sceneProgress = (p: number, scene: number) => clamp(p - (scene - 1));

/* --------------------------------------------------------------- phases ---- */

export function phaseFor(p: number): ScenePhase {
  const i = Math.min(SCENE_COUNT, Math.floor(p) + 1);
  return `scene0${i}` as ScenePhase;
}

export function authorityFor(p: number): CameraAuthority {
  const i = Math.min(SCENE_COUNT, Math.floor(p) + 1);
  return `scene0${i}` as CameraAuthority;
}

/* ------------------------------------------------------- scroll binding ---- */

export function initJourney() {
  const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mqMobile = window.matchMedia("(max-width: 820px)");
  journey.reducedMotion = mqMotion.matches;
  journey.mobile = mqMobile.matches;
  mqMotion.addEventListener("change", (e) => (journey.reducedMotion = e.matches));
  mqMobile.addEventListener("change", (e) => (journey.mobile = e.matches));

  const read = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const t = max > 0 ? window.scrollY / max : 0;
    journey.raw = clamp(t) * SCENE_COUNT;
  };

  read();
  window.addEventListener("scroll", read, { passive: true });
  window.addEventListener("resize", read);
  return read;
}

/** called once per frame from the render loop */
export function updateJourney(dt: number) {
  const lambda = journey.reducedMotion ? 18 : 6.5;
  journey.p = damp(journey.p, journey.raw, lambda, Math.min(dt, 0.05));
  journey.global = journey.p / SCENE_COUNT;
  journey.phase = phaseFor(journey.p);
  journey.authority = authorityFor(journey.p);
}
