// A link that opens the source page scrolled to the quoted sentence (URL text fragments).
// `-`, `,` and `&` are syntax inside a fragment directive, so all three must be percent-encoded;
// encodeURIComponent already handles `,` and `&`.
export function fragmentUrl(pageUrl: string, span: string): string {
  const url = new URL(pageUrl);
  url.hash = "";
  const text = encodeURIComponent(span.replace(/\s+/g, " ").trim()).replaceAll("-", "%2D");
  return `${url.href}#:~:text=${text}`;
}
