/**
 * PWA / favicon PNGs from the SVG app icon.   node scripts/build-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const brand = path.join(ROOT, "public", "brand");
const svg = fs.readFileSync(path.join(brand, "app-icon.svg"), "utf8");
// Maskable: full-bleed background, mark kept inside the 80% safe zone.
const maskable = svg.replace('<rect width="512" height="512" rx="112"', '<rect width="512" height="512" rx="0"').replace('translate(77 70) scale(5.6)', 'translate(115 112) scale(4.4)');

for (const [name, src, size] of [
  ["app-icon-192.png", svg, 192],
  ["app-icon-512.png", svg, 512],
  ["app-icon-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", maskable, 180],
]) {
  await sharp(Buffer.from(src), { density: 300 }).resize(size, size).png().toFile(path.join(brand, name));
}
await sharp(Buffer.from(svg), { density: 300 }).resize(48, 48).png().toFile(path.join(ROOT, "app", "icon.png"));
console.log("icons written");
