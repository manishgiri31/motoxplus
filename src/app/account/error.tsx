"use client";

import { RouteError } from "@/components/layout/route-error";

export default function AccountError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} scope="account" homeHref="/products" homeLabel="Continue shopping" />;
}
