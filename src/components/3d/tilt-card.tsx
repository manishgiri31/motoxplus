"use client";

import { useRef, ReactNode, MouseEvent } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export function TiltCard({ children, className = "", intensity = 12 }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -intensity;
    const rotateY = ((x - cx) / cx) * intensity;

    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

    if (glowRef.current) {
      const percentX = (x / rect.width) * 100;
      const percentY = (y / rect.height) * 100;
      glowRef.current.style.background = `radial-gradient(circle at ${percentX}% ${percentY}%, rgba(220,38,38,0.18) 0%, transparent 65%)`;
    }
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    if (glowRef.current) glowRef.current.style.background = "transparent";
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
      style={{ transformStyle: "preserve-3d", transition: "transform 0.1s ease-out" }}
    >
      <div ref={glowRef} className="absolute inset-0 rounded-2xl pointer-events-none z-10 transition-all duration-150" />
      {children}
    </div>
  );
}
