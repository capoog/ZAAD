/**
 * Builds the text-based SVG logo as pure vector paths (no font dependency).
 * Arabic is shaped with HarfBuzz so letters join correctly, then outlined.
 *
 *   node scripts/build-logo.mjs
 *
 * Outputs:
 *   components/brand/logo-paths.ts   (used by <Logo/>)
 *   public/brand/logo.svg            (horizontal lockup, dark backgrounds)
 *   public/brand/logo-mark.svg       (mark only)
 *
 * Fonts: Reem Kufi (OFL) from Google Fonts, downloaded at build time.
 */
import fs from "node:fs";
import path from "node:path";
import * as hb from "harfbuzzjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FONT_URLS = {
  kufi700: "https://fonts.gstatic.com/s/reemkufi/v28/2sDPZGJLip7W2J7v7wQZZE1I0yCmYzzQtgFgEGE.ttf",
  kufi500: "https://fonts.gstatic.com/s/reemkufi/v28/2sDPZGJLip7W2J7v7wQZZE1I0yCmYzzQttRnEGE.ttf",
};

async function loadFont(url) {
  const cache = path.join(ROOT, ".data", "fonts", path.basename(url));
  if (!fs.existsSync(cache)) {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font download failed ${res.status}`);
    fs.writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
  }
  const data = fs.readFileSync(cache);
  const blob = new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  const face = new hb.Face(blob);
  return { font: new hb.Font(face), upem: face.upem };
}

/** Transform an absolute SVG path (font units, y-up) into target space. */
function transformPath(d, fn) {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let out = "";
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    out += cmd;
    const arity = { M: 1, L: 1, Q: 2, C: 3, Z: 0 }[cmd.toUpperCase()];
    for (let p = 0; p < arity; p++) {
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      const [nx, ny] = fn(x, y);
      out += `${round(nx)} ${round(ny)}${p < arity - 1 ? " " : ""}`;
    }
  }
  return out;
}
const round = (n) => Math.round(n * 100) / 100;

/**
 * Shape text and return { d, width, ascent } in a box where the baseline is
 * at y = ascent, scaled so that 1 em = size px. letterSpacing in em.
 */
function outline({ font, upem }, text, size, { letterSpacing = 0, features = [] } = {}) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer, features.join(",") || undefined);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const s = size / upem;
  const extents = font.hExtents ? font.hExtents() : null;
  const ascent = (extents?.ascender ?? upem * 0.9) * s;
  let x = 0;
  let d = "";
  infos.forEach((info, idx) => {
    const pos = positions[idx];
    const gp = font.glyphToPath(info.codepoint);
    if (gp) {
      const ox = x + pos.xOffset * s;
      const oy = pos.yOffset * s;
      d += transformPath(gp, (gx, gy) => [ox + gx * s, ascent - (gy * s + oy)]);
    }
    x += pos.xAdvance * s + letterSpacing * size;
  });
  const width = x - letterSpacing * size;
  return { d, width, ascent };
}

/** Tight vertical bounds of a path (approximate, from its points). */
function bounds(d) {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, maxX, minY, maxY };
}

function shift(d, dx, dy) {
  return transformPath(d, (x, y) => [x + dx, y + dy]);
}

// ── Mark: a flame over grill bars, with a za'atar leaf as its heart ─────────
const MARK = {
  size: 64,
  flame:
    "M32 3C35.5 12.5 47.5 19.5 47.5 35.5C47.5 46.8 40.6 54 32 54C23.4 54 16.5 46.8 16.5 35.5C16.5 27.2 21 22 24.2 16.8C25 22.6 27.6 26.4 30.6 27.6C29.4 19.6 29.8 11.2 32 3Z",
  leaf: "M32.6 29.5C38.6 33.6 40.4 40.6 35.4 48.4C28.9 46.9 26.4 39.4 32.6 29.5Z",
  rib: "M32.9 33.2C33.6 38.4 33.6 43 34.6 47.2",
  bars: [{ x: 14, y: 57, w: 36, h: 3.2 }],
};

async function main() {
  const kufi700 = await loadFont(FONT_URLS.kufi700);
  const kufi500 = await loadFont(FONT_URLS.kufi500);

  const ar = outline(kufi700, "فحم وزعتر", 44);
  const en = outline(kufi500, "FAHM & ZAATAR", 11.5, { letterSpacing: 0.32 });

  const arB = bounds(ar.d);
  const enB = bounds(en.d);

  // Horizontal lockup: [wordmark block] [mark] — in RTL reading order the mark
  // sits on the right (start) of the Arabic wordmark.
  const gap = 14;
  const arH = arB.maxY - arB.minY;
  const enH = enB.maxY - enB.minY;
  const textBlockH = arH + 9 + enH;
  const height = Math.max(64, textBlockH);
  const textW = Math.max(arB.maxX - arB.minX, enB.maxX - enB.minX);

  const arTop = (height - textBlockH) / 2;
  const arD = shift(ar.d, -arB.minX + (textW - (arB.maxX - arB.minX)), -arB.minY + arTop);
  const enTop = arTop + arH + 9;
  const enD = shift(en.d, -enB.minX + (textW - (enB.maxX - enB.minX)), -enB.minY + enTop);
  const markX = textW + gap;
  const markY = (height - 64) / 2;
  const width = markX + 64;

  const ts = `/* Generated by scripts/build-logo.mjs — do not edit by hand. */
export const LOGO = {
  width: ${round(width)},
  height: ${round(height)},
  wordmarkAr: ${JSON.stringify(arD)},
  wordmarkEn: ${JSON.stringify(enD)},
  textWidth: ${round(textW)},
  mark: { x: ${round(markX)}, y: ${round(markY)} },
} as const;

export const MARK = ${JSON.stringify(MARK, null, 2)} as const;
`;
  fs.writeFileSync(path.join(ROOT, "components/brand/logo-paths.ts"), ts);

  const defs = `<defs>
    <linearGradient id="fz-ember" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFC65C"/>
      <stop offset="0.55" stop-color="#FF8A45"/>
      <stop offset="1" stop-color="#E4561A"/>
    </linearGradient>
  </defs>`;
  const markSvg = (x, y) => `<g transform="translate(${round(x)} ${round(y)})">
    <path d="${MARK.flame}" fill="url(#fz-ember)"/>
    <path d="${MARK.leaf}" fill="#1A1410"/>
    <path d="${MARK.rib}" fill="none" stroke="#A3B46B" stroke-width="1.6" stroke-linecap="round"/>
    ${MARK.bars.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" fill="#F3E9DA" opacity="0.9"/>`).join("")}
  </g>`;

  fs.mkdirSync(path.join(ROOT, "public/brand"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "public/brand/logo.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="فحم وزعتر — Fahm &amp; Zaatar">
  ${defs}
  <path d="${arD}" fill="#F3E9DA"/>
  <path d="${enD}" fill="#FF8A45"/>
  ${markSvg(markX, markY)}
</svg>
`,
  );
  fs.writeFileSync(
    path.join(ROOT, "public/brand/logo-mark.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="فحم وزعتر">
  ${defs}
  ${markSvg(0, 0)}
</svg>
`,
  );
  // Monochrome lockup for light backgrounds and thermal kitchen-ticket printers.
  fs.writeFileSync(
    path.join(ROOT, "public/brand/logo-mono.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="فحم وزعتر — Fahm &amp; Zaatar">
  <path d="${arD}" fill="#000"/>
  <path d="${enD}" fill="#000"/>
  <g transform="translate(${round(markX)} ${round(markY)})">
    <path d="${MARK.flame}" fill="#000"/>
    <path d="${MARK.leaf}" fill="#fff"/>
    ${MARK.bars.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" fill="#000"/>`).join("")}
  </g>
</svg>
`,
  );
  // App icon: mark on a charcoal rounded square (used for favicon + PWA icons).
  fs.writeFileSync(
    path.join(ROOT, "public/brand/app-icon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <radialGradient id="fz-glow" cx="0.5" cy="0.62" r="0.6">
    <stop offset="0" stop-color="#3A2418"/>
    <stop offset="1" stop-color="#110E0C"/>
  </radialGradient>
  <rect width="512" height="512" rx="112" fill="url(#fz-glow)"/>
  <g transform="translate(77 70) scale(5.6)">
    <path d="${MARK.flame}" fill="url(#fz-ember)"/>
    <path d="${MARK.leaf}" fill="#1A1410"/>
    <path d="${MARK.rib}" fill="none" stroke="#A3B46B" stroke-width="1.6" stroke-linecap="round"/>
    ${MARK.bars.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" fill="#F3E9DA" opacity="0.9"/>`).join("")}
  </g>
</svg>
`,
  );
  console.log(`logo ${round(width)}×${round(height)} written`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
