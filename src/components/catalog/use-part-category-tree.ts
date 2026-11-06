"use client";

import { useCallback, useEffect, useState } from "react";
import type { PartCategoryGroup } from "@/lib/catalog/part-category-selection";

export type PartCategoryTreeState =
  | { status: "loading" }
  | { status: "ready"; groups: PartCategoryGroup[] }
  | { status: "error" };

// One fetch per page view, shared by every component that needs the tree (picker + review summary).
let cached: Promise<PartCategoryGroup[]> | null = null;

function load(): Promise<PartCategoryGroup[]> {
  if (!cached) {
    cached = fetch("/api/part-categories", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { groups?: PartCategoryGroup[] }) => (Array.isArray(body.groups) ? body.groups : []))
      .catch((e) => {
        cached = null; // let a retry fetch again
        throw e;
      });
  }
  return cached;
}

/** The automotive parts catalogue (GET /api/part-categories). */
export function usePartCategoryTree() {
  const [state, setState] = useState<PartCategoryTreeState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    load().then(
      (groups) => live && setState({ status: "ready", groups }),
      () => live && setState({ status: "error" })
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
