"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Torus, Icosahedron, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function FloatingGear({ position, scale, speed, color }: {
  position: [number, number, number];
  scale: number;
  speed: number;
  color: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.z += speed * 0.005;
    mesh.current.rotation.y += speed * 0.003;
    mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.4) * 0.3;
  });
  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <torusGeometry args={[1, 0.35, 8, 24]} />
      <meshStandardMaterial
        color={color}
        metalness={0.9}
        roughness={0.1}
        emissive={color}
        emissiveIntensity={0.15}
        wireframe={false}
      />
    </mesh>
  );
}

function FloatingSphere({ position, scale, speed }: {
  position: [number, number, number];
  scale: number;
  speed: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.x += 0.004 * speed;
    mesh.current.rotation.y += 0.006 * speed;
    mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.4;
  });
  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#DC2626"
        metalness={0.95}
        roughness={0.05}
        emissive="#7f1d1d"
        emissiveIntensity={0.3}
        wireframe
      />
    </mesh>
  );
}

function CoreOrb() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.x = state.clock.elapsedTime * 0.15;
    mesh.current.rotation.y = state.clock.elapsedTime * 0.2;
  });
  return (
    <mesh ref={mesh} position={[0, 0, 0]}>
      <torusKnotGeometry args={[1.2, 0.38, 180, 20, 2, 3]} />
      <meshStandardMaterial
        color="#1a1a1a"
        metalness={1}
        roughness={0}
        emissive="#DC2626"
        emissiveIntensity={0.12}
      />
    </mesh>
  );
}

function ParticleField() {
  const count = 260;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 28;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, []);

  const geom = useRef<THREE.BufferGeometry>(null);
  useFrame((state) => {
    if (!geom.current) return;
    const pos = geom.current.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += Math.sin(state.clock.elapsedTime * 0.3 + i) * 0.002;
    }
    geom.current.attributes.position.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geom}>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#DC2626" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function GridPlane() {
  return (
    <gridHelper
      args={[60, 40, "#DC2626", "#1a1a1a"]}
      position={[0, -4.5, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame((state) => {
    camera.position.x += (state.mouse.x * 1.2 - camera.position.x) * 0.04;
    camera.position.y += (state.mouse.y * 0.8 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#DC2626" />
      <pointLight position={[-10, -10, -5]} intensity={0.8} color="#7f1d1d" />
      <pointLight position={[0, 5, 5]} intensity={0.6} color="#ffffff" />
      <spotLight position={[0, 8, 0]} angle={0.3} intensity={2} color="#DC2626" castShadow />

      <CoreOrb />

      <FloatingGear position={[-5.5, 2, -2]} scale={0.85} speed={0.8} color="#3f3f3f" />
      <FloatingGear position={[5, -1.5, -3]} scale={1.1} speed={0.5} color="#2a2a2a" />
      <FloatingGear position={[-4, -2.5, 1]} scale={0.6} speed={1.2} color="#DC2626" />
      <FloatingGear position={[4.5, 3, -1]} scale={0.75} speed={0.7} color="#4a4a4a" />

      <FloatingSphere position={[3, 2.5, 1]} scale={0.7} speed={0.9} />
      <FloatingSphere position={[-3.5, -1, -1]} scale={0.5} speed={1.1} />
      <FloatingSphere position={[0, -3, 2]} scale={0.4} speed={1.4} />

      <ParticleField />
      <GridPlane />
      <CameraRig />
    </Canvas>
  );
}
