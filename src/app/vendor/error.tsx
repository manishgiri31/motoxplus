"use client";

import { RouteError } from "@/components/layout/route-error";

export default function VendorError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} scope="vendor" homeHref="/vendor/dashboard" homeLabel="Dashboard" />;
}
