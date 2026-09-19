import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { journey, sceneProgress, smoothstep } from "../journey/journey";
import { destinationDirection } from "../journey/geo";
import { handoffState } from "../journey/handoff";
import { EARTH_SCALE, getEarthCenter } from "./CameraDirector";

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = 1.0 - max(dot(vNormal, vView), 0.0);
    float glow = pow(rim, 3.2) * uIntensity;
    gl_FragColor = vec4(uColor * glow, glow);
  }
`;

export function Earth({ quality }: { quality: number }) {
  const group = useRef<THREE.Group>(null!);
  const earth = useRef<THREE.Mesh>(null!);
  const clouds = useRef<THREE.Mesh>(null!);
  const atmo = useRef<THREE.ShaderMaterial>(null!);

  const [map, cloudMap, lights, normalMap, specMap] = useLoader(THREE.TextureLoader, [
    "textures/earth_atmos_2048.jpg",
    "textures/earth_clouds_1024.png",
    "textures/earth_lights_2048.png",
    "textures/earth_normal_2048.jpg",
    "textures/earth_specular_2048.jpg",
  ]);

  useMemo(() => {
    [map, cloudMap, lights, normalMap, specMap].forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });
    normalMap.colorSpace = THREE.NoColorSpace;
    specMap.colorSpace = THREE.NoColorSpace;
  }, [map, cloudMap, lights, normalMap, specMap]);

  const seg = quality > 0.8 ? 96 : quality > 0.5 ? 64 : 40;

  const atmoUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#7fa9d8") },
      uIntensity: { value: 0.0 },
    }),
    []
  );

  useFrame((_, dt) => {
    const p = journey.p;
    // continuous, never reset rotation — shared with every later scene
    const speed = journey.reducedMotion ? 0.004 : 0.014;
    if (p < 2.6) {
      handoffState.scene01.earthRotation += dt * speed;
      handoffState.scene01.cloudRotation += dt * speed * 1.45;
    }
    earth.current.rotation.y = handoffState.scene01.earthRotation;
    clouds.current.rotation.y = handoffState.scene01.cloudRotation;

    // emergence from darkness
    const birth = smoothstep(0.0, 0.22, sceneProgress(p, 1));
    const exit = 1 - smoothstep(2.12, 2.42, p);
    const vis = birth * exit;

    const em = earth.current.material as THREE.MeshStandardMaterial;
    em.opacity = vis;
    const cm = clouds.current.material as THREE.MeshStandardMaterial;
    cm.opacity = 0.42 * vis;
    atmoUniforms.uIntensity.value = 1.45 * vis;
    if (atmo.current) atmo.current.opacity = vis;
    group.current.visible = vis > 0.001;

    // planet lives in the single shared world space
    group.current.position.copy(getEarthCenter());
    group.current.scale.setScalar(EARTH_SCALE);
    handoffState.scene01.earthScale = EARTH_SCALE;
    handoffState.scene01.progress = sceneProgress(p, 1);
    handoffState.scene02.destinationDirection.copy(
      destinationDirection(handoffState.scene01.earthRotation)
    );
    handoffState.scene02.earthRotation = handoffState.scene01.earthRotation;
    handoffState.scene02.cloudRotation = handoffState.scene01.cloudRotation;
  });

  return (
    <group ref={group}>
      <mesh ref={earth}>
        <sphereGeometry args={[1, seg, seg / 2]} />
        <meshStandardMaterial
          map={map}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.6, 0.6)}
          roughnessMap={specMap}
          roughness={0.92}
          metalness={0.02}
          emissiveMap={lights}
          emissive={new THREE.Color("#ffc98a")}
          emissiveIntensity={0.55}
          transparent
        />
      </mesh>

      <mesh ref={clouds} scale={1.006}>
        <sphereGeometry args={[1, seg, seg / 2]} />
        <meshStandardMaterial
          map={cloudMap}
          alphaMap={cloudMap}
          transparent
          depthWrite={false}
          opacity={0.42}
          roughness={1}
        />
      </mesh>

      <mesh scale={1.055}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          ref={atmo}
          uniforms={atmoUniforms}
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
