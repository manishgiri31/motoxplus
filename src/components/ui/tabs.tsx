"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 border-b border-[var(--border-color)]", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative px-4 py-2.5 text-xs font-semibold uppercase tracking-tech",
        "text-[var(--text-muted)] transition-colors",
        "hover:text-[var(--text-primary)]",
        "data-[state=active]:text-[var(--text-primary)]",
        "after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-[var(--accent)]",
        "after:scale-x-0 after:transition-transform after:duration-[var(--dur-2)] data-[state=active]:after:scale-x-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]", className)}
      {...props}
    />
  );
}
