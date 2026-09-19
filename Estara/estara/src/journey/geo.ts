import * as THREE from "three";

export const DESTINATION = {
  name: "New York City",
  country: "United States",
  latitude: 40.7128,
  longitude: -74.006,
};

/**
 * Real latitude/longitude → unit vector on a sphere whose texture is mapped
 * with THREE.SphereGeometry defaults (u=0 at -X seam, equirectangular).
 */
export function latLngToVec3(latDeg: number, lngDeg: number, radius = 1) {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lngDeg + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** Destination direction after the planet's own rotation is applied. */
export function destinationDirection(earthRotationY: number) {
  return latLngToVec3(DESTINATION.latitude, DESTINATION.longitude, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    earthRotationY
  );
}
