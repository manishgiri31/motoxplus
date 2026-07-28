"use client";

// Thin re-export — @radix-ui/react-slot is already on disk (transitive dependency
// of the Radix packages installed but previously unused in this codebase) and is
// now declared directly in package.json. Centralising the import here means every
// primitive that supports `asChild` (Button, Badge, …) imports from one place.
export { Slot } from "@radix-ui/react-slot";
