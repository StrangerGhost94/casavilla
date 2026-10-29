/** Structured data for search engines (schema.org JSON-LD). */
export function JsonLd({ data }: { data: object | object[] }) {
  // Escape "<" so text from listings can't close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
