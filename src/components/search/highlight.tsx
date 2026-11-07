import { Fragment } from "react";

/**
 * Wraps the parts of `text` that match any word of `query` in <mark>. Works on plain strings and returns
 * React nodes, so result titles are never parsed as HTML — a product named `<b>` renders as text.
 */
export function Highlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const words = Array.from(new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 0)))
    .sort((a, b) => b.length - a.length) // longest first, so "brake" wins over "b"
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return <>{text}</>;

  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        // split() with one capture group puts matches at odd indexes
        i % 2 === 1 ? (
          <mark key={i} className={className}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
