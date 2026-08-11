// JSON.stringify escapes quotes/backslashes/control chars but NOT '<', '>',
// or '&' — a product name or description containing "</script><script>..."
// would close the tag early and inject executable script. Escaping those
// three characters as unicode escapes keeps the JSON semantically identical
// (they're only meaningful inside HTML, not inside a JSON string) while
// making it impossible to break out of the surrounding <script> tag. U+2028/
// U+2029 are escaped too since they're valid in JSON strings but invalid in
// JS source, which some non-browser JSON-LD parsers choke on.
function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
