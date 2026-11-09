/** Uploaded images exist in two sizes: `<id>.webp` (up to 1200px) and `<id>-sm.webp` (480px). */
export const thumb = (url: string): string => url.replace(/\.webp$/, '-sm.webp')

const svg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#eef2f7'/>" +
  "<g fill='none' stroke='#9aa7b8' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'>" +
  "<rect x='140' y='95' width='120' height='90' rx='10'/><circle cx='175' cy='128' r='9'/>" +
  "<path d='M150 175l32-28 22 18 20-16 26 26'/></g></svg>"

export const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
