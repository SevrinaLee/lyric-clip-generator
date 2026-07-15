// The SERVER decides an uploaded file's type from its magic bytes — never the
// client-supplied name or Content-Type. Accept only PNG and JPEG; anything
// else (a renamed .html, an SVG, a GIF, empty) returns null and is rejected.
export function sniffImage(bytes: Uint8Array): "png" | "jpeg" | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 && // P
    bytes[2] === 0x4e && // N
    bytes[3] === 0x47 // G
  ) {
    return "png";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  return null;
}
