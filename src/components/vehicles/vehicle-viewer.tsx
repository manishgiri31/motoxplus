"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center } from "@react-three/drei";
import { Maximize2, RotateCw, RotateCcw } from "lucide-react";

function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/**
 * Stand-in geometry until real per-vehicle GLTF models are sourced.
 * Swapped automatically for `GltfModel` once Vehicle.modelUrl is set.
 */
function PlaceholderBike({ color = "#DC2626" }: { color?: string }) {
  const tireMaterial = <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />;
  return (
    <group>
      {/* wheels */}
      <mesh position={[-1.6, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.18, 16, 32]} />
        {tireMaterial}
      </mesh>
      <mesh position={[1.6, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.18, 16, 32]} />
        {tireMaterial}
      </mesh>
      {/* frame */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.6, 0.25, 0.4]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* fuel tank */}
      <mesh position={[0.3, 0.5, 0]}>
        <capsuleGeometry args={[0.35, 0.6, 4, 12]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
      </mesh>
      {/* seat */}
      <mesh position={[-0.6, 0.55, 0]}>
        <boxGeometry args={[1.1, 0.15, 0.45]} />
        <meshStandardMaterial color="#111111" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* handlebar */}
      <mesh position={[1.5, 0.7, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.7]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Scene({ modelUrl, colorHex, autoRotate }: { modelUrl?: string | null; colorHex?: string; autoRotate: boolean }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} />
      <directionalLight position={[-5, -2, -5]} intensity={0.5} color="#DC2626" />
      <pointLight position={[0, 3, 4]} intensity={0.6} color="#ffffff" />

      <Center>
        <Suspense fallback={null}>
          {modelUrl ? <GltfModel url={modelUrl} /> : <PlaceholderBike color={colorHex} />}
        </Suspense>
      </Center>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate={autoRotate}
        autoRotateSpeed={2.5}
        minDistance={2}
        maxDistance={10}
        makeDefault
      />
    </>
  );
}

export function VehicleViewer({ modelUrl, colorHex }: { modelUrl?: string | null; colorHex?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const resetCamera = useCallback(() => setResetKey((k) => k + 1), []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[420px] md:h-[520px] rounded-2xl overflow-hidden glass border border-[var(--border-color)] bg-[var(--bg-secondary)]"
    >
      <Canvas
        key={resetKey}
        camera={{ position: [3, 1.5, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Scene modelUrl={modelUrl} colorHex={colorHex} autoRotate={autoRotate} />
      </Canvas>

      <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={() => setAutoRotate((r) => !r)}
          title="Auto Rotate"
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
            autoRotate
              ? "bg-red-600 border-red-600 text-white"
              : "glass border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
          }`}
        >
          <RotateCw size={16} />
        </button>
        <button
          onClick={resetCamera}
          title="Reset Camera"
          className="w-9 h-9 rounded-full flex items-center justify-center glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={toggleFullscreen}
          title="Full Screen"
          className="w-9 h-9 rounded-full flex items-center justify-center glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {!modelUrl && (
        <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-widest font-semibold text-[var(--text-muted)] bg-[var(--bg-primary)]/70 px-2.5 py-1 rounded-full">
          Preview model — real 3D coming soon
        </div>
      )}
    </div>
  );
}
