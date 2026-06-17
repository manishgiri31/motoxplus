"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-sm glass border border-[var(--border-color)] ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={`w-9 h-9 flex items-center justify-center rounded-sm border transition-all duration-200 ${
        isDark
          ? "glass border-[var(--border-color)] text-yellow-400 hover:border-yellow-500/40 hover:bg-yellow-500/10"
          : "bg-gray-100 border-gray-200 text-gray-700 hover:border-red-400 hover:bg-red-50"
      } ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
