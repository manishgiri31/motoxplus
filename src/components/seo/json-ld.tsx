export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify escapes all string content, so this is not
      // vulnerable to injection — the output is data, not executable script.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
