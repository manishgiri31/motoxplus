"use client";

import { Component, Suspense, useCallback, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Environment, ContactShadows, useProgress, Bounds } from "@react-three/drei";
import { Maximize2, RotateCw, RotateCcw, AlertTriangle } from "lucide-react";

function GltfModel({ url }: { url: string }) {
  // Draco + Meshopt compressed GLBs are decoded automatically (drei ships
  // default decoder paths) — no local decoder assets required.
  const { scene } = useGLTF(url, true, true);
  return <primitive object={scene} />;
}

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-secondary)]/80 backdrop-blur-sm pointer-events-none z-10">
      <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-red-600 rounded-full animate-spin" />
      <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">
        Loading model — {Math.round(progress)}%
      </span>
    </div>
  );
}

/** Catches GLTF parse/network failures so a broken model file can't crash the page. */
class ModelErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function Scene({ modelUrl, autoRotate }: { modelUrl: string; autoRotate: boolean }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} />
      <directionalLight position={[-5, -2, -5]} intensity={0.5} color="#DC2626" />
      <pointLight position={[0, 3, 4]} intensity={0.6} color="#ffffff" />
      <Environment preset="city" />

      <Bounds fit clip observe margin={1.3}>
        <Center>
          <GltfModel url={modelUrl} />
        </Center>
      </Bounds>

      <ContactShadows position={[0, -1, 0]} opacity={0.5} scale={10} blur={2.5} far={4} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate={autoRotate}
        autoRotateSpeed={2.5}
        minDistance={1.5}
        maxDistance={12}
        makeDefault
      />
    </>
  );
}

export function VehicleViewer({ modelUrl }: { modelUrl?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [failed, setFailed] = useState(false);

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

  if (!modelUrl || failed) {
    return (
      <div className="w-full h-[420px] md:h-[520px] rounded-2xl glass border border-[var(--border-color)] flex flex-col items-center justify-center gap-3 text-center px-6">
        <AlertTriangle size={24} className="text-[var(--text-muted)]" />
        <p className="text-[var(--text-muted)] text-sm max-w-xs">
          Interactive 3D model is currently unavailable for this vehicle.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[420px] md:h-[520px] rounded-2xl overflow-hidden glass border border-[var(--border-color)] bg-white"
    >
      <ModelErrorBoundary onError={() => setFailed(true)}>
        <Canvas
          key={resetKey}
          camera={{ position: [3, 1.5, 3], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene modelUrl={modelUrl} autoRotate={autoRotate} />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>

      <Loader />

      <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={() => setAutoRotate((r) => !r)}
          title="Auto Rotate"
          aria-label="Toggle auto-rotate"
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
          aria-label="Reset camera"
          className="w-9 h-9 rounded-full flex items-center justify-center glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={toggleFullscreen}
          title="Full Screen"
          aria-label="Toggle fullscreen"
          className="w-9 h-9 rounded-full flex items-center justify-center glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
