import * as THREE from "three";
import { DESTINATION } from "./geo";

/**
 * Deterministic scene handoff contracts.
 * Each scene writes its live state here; the next scene inherits it instead of
 * reconstructing anything. Nothing is ever reset between scenes.
 */

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const pose = (): CameraPose => ({
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
  fov: 45,
});

export const handoffState = {
  scene01: {
    camera: pose(),
    earthRotation: 0,
    cloudRotation: 0,
    earthScale: 1,
    progress: 0,
  },
  scene02: {
    destination: DESTINATION.name,
    latitude: DESTINATION.latitude,
    longitude: DESTINATION.longitude,
    camera: pose(),
    altitude: 0,
    earthRotation: 0,
    cloudRotation: 0,
    destinationDirection: new THREE.Vector3(),
    progress: 0,
  },
  scene03: {
    destination: DESTINATION.name,
    property: "Estara Residence 01",
    camera: pose(),
    propertyPosition: new THREE.Vector3(),
    propertyRotationY: 0,
    progress: 0,
    activePhase: 1,
  },
  scene04: {
    camera: pose(),
    propertyVisible: true,
    worldOpacity: 1,
    progress: 0,
  },
  scene05: {
    camera: pose(),
    worldOpacity: 1,
    platformOpacity: 0,
    progress: 0,
  },
};

export const getSceneHandoff = () => handoffState.scene01;
export const getScene02Handoff = () => handoffState.scene02;
export const getScene03Handoff = () => handoffState.scene03;
export const getScene04Handoff = () => handoffState.scene04;
export const getScene05Handoff = () => handoffState.scene05;

export function writeCameraPose(target: CameraPose, cam: THREE.PerspectiveCamera, look: THREE.Vector3) {
  target.position.copy(cam.position);
  target.target.copy(look);
  target.fov = cam.fov;
}
