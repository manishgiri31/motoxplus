"use client";

import { RouteError } from "@/components/layout/route-error";

export default function DealerError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} scope="dealer" homeHref="/dealer/dashboard" homeLabel="Dashboard" />;
}
