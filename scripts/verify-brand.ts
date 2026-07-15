// Unit check for the brand-logo upload guard (v1.5 S5.3): the server sniffs
// magic bytes, so a renamed/hostile file is rejected regardless of its name.
// Run: npm run verify:brand
import assert from "node:assert/strict";
import { sniffImage } from "../lib/imageSniff";

let passed = 0;
const ok = (n: string) => { passed++; console.log("  ✓", n); };

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const html = new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>");
const gif = new TextEncoder().encode("GIF89a....");
const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
const empty = new Uint8Array([]);

assert.equal(sniffImage(png), "png"); ok("real PNG magic → png");
assert.equal(sniffImage(jpeg), "jpeg"); ok("real JPEG magic → jpeg");
assert.equal(sniffImage(html), null); ok("HTML (e.g. evil.html renamed logo.png) → rejected");
assert.equal(sniffImage(gif), null); ok("GIF → rejected (only png/jpeg allowed)");
assert.equal(sniffImage(svg), null); ok("SVG → rejected (script-capable)");
assert.equal(sniffImage(empty), null); ok("empty buffer → rejected");

console.log(`\n${passed} checks passed`);
