import * as THREE from "three";

/**
 * The single world-space anchor the journey descends toward.
 *
 * This used to be `PROPERTY_POSITION`, exported by the procedural `Property`
 * module. The procedural environment (terrain, neighbourhood, vegetation,
 * hero property) has been removed in favour of real aerial footage, but the
 * camera rig, the lighting rig and the Earth→world mapping all still need a
 * fixed point on the "ground" to aim at so that scenes 01→02 remain a
 * continuous flight and scenes 05→06 inherit a sane pose.
 *
 * It is deliberately a plain constant now: nothing is generated, nothing is
 * rendered here.
 */
export const WORLD_ANCHOR = new THREE.Vector3(0, 0, 0);

/** Ground is a flat plane at y = 0 now that the procedural terrain is gone. */
export function groundHeight(_x: number, _z: number) {
  return 0;
}
