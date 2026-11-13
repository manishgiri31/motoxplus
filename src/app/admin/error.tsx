"use client";

import { RouteError } from "@/components/layout/route-error";

export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} scope="admin" homeHref="/admin/dashboard" homeLabel="Dashboard" />;
}
