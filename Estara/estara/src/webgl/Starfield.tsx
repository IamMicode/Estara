import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { journey, smoothstep } from "../journey/journey";
import { EARTH_SCALE, getEarthCenter } from "./CameraDirector";

export function Starfield({ count = 2400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(38 + Math.random() * 26);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      size[i] = Math.random() < 0.06 ? 0.42 : 0.12 + Math.random() * 0.14;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSize;
          varying float vS;
          void main() {
            vS = aSize;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * 300.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying float vS;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.06, d);
            gl_FragColor = vec4(vec3(0.86, 0.9, 1.0), a * uOpacity);
          }
        `,
      }),
    []
  );

  useFrame((_, dt) => {
    const appear = smoothstep(0.04, 0.3, journey.p);
    const fade = 1 - smoothstep(1.85, 2.35, journey.p);
    material.uniforms.uOpacity.value = appear * fade;
    ref.current.visible = material.uniforms.uOpacity.value > 0.002;
    ref.current.position.copy(getEarthCenter());
    ref.current.scale.setScalar(EARTH_SCALE);
    if (!journey.reducedMotion) ref.current.rotation.y += dt * 0.0035;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
