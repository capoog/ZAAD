/**
 * Generates designed dish illustrations (public/art/*.svg) used when no real
 * photo is available yet, and as the fallback when a remote photo fails.
 *
 *   node scripts/build-art.mjs
 *
 * Style: warm, top-lit, semi-flat; charcoal backdrop with an ember glow so the
 * art sits naturally next to the dark food photography.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "art");
fs.mkdirSync(OUT, { recursive: true });

const W = 800;
const H = 600;
const CX = 400;
const CY = 318;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (n) => Math.round(n * 10) / 10;

/** Uniform random points inside an ellipse. */
function* inEllipse(rand, cx, cy, rx, ry, n) {
  for (let i = 0; i < n; i++) {
    const t = rand() * Math.PI * 2;
    const u = Math.sqrt(rand());
    yield [cx + Math.cos(t) * rx * u, cy + Math.sin(t) * ry * u, rand()];
  }
}

function frame(body, { glow = "#ff8a45", defs = "" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0" stop-color="#2a1e16"/>
      <stop offset="0.55" stop-color="#18120e"/>
      <stop offset="1" stop-color="#0c0a08"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="blur2"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer>
      <feBlend in2="SourceGraphic" mode="overlay"/>
    </filter>
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="${CX}" cy="${CY + 40}" rx="360" ry="240" fill="url(#glow)"/>
  <g opacity="0.07" filter="url(#soft)">
    <path d="M60 120 C 200 60, 320 150, 470 90 S 700 60, 780 110" stroke="#d6c9b8" stroke-width="40" fill="none"/>
  </g>
  <g transform="translate(${CX} ${CY}) scale(1.16) translate(${-CX} ${-CY})">
    <ellipse cx="${CX}" cy="${CY + 150}" rx="300" ry="56" fill="url(#shadow)"/>
    ${body}
  </g>
  <rect width="${W}" height="${H}" fill="transparent" filter="url(#grain)"/>
</svg>
`;
}

/** A plate seen at a 3/4 angle. */
function plate({ rx = 280, ry = 150, cy = CY, rim = "#e7ddcd", rimShade = "#bfb3a1", well = "#f3ebdf" } = {}) {
  return `
  <ellipse cx="${CX}" cy="${cy + 14}" rx="${rx}" ry="${ry}" fill="${rimShade}"/>
  <ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${rim}"/>
  <ellipse cx="${CX}" cy="${cy + 6}" rx="${rx * 0.78}" ry="${ry * 0.76}" fill="${well}"/>`;
}

/** A deep bowl seen at a 3/4 angle. */
function bowl({ rx = 220, ry = 96, cy = CY - 10, depth = 120, outer = "#d8cdbb", outerShade = "#9d917f", inner = "#efe6d8" } = {}) {
  return `
  <path d="M${CX - rx} ${cy} C ${CX - rx} ${cy + depth * 1.15}, ${CX + rx} ${cy + depth * 1.15}, ${CX + rx} ${cy} Z" fill="${outerShade}"/>
  <path d="M${CX - rx} ${cy} C ${CX - rx + 10} ${cy + depth * 1.05}, ${CX + rx - 60} ${cy + depth * 1.1}, ${CX + rx} ${cy} Z" fill="${outer}" opacity="0.9"/>
  <ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${outer}"/>
  <ellipse cx="${CX}" cy="${cy + 3}" rx="${rx - 14}" ry="${ry - 10}" fill="${inner}"/>`;
}

function leaf(x, y, len, angle, color = "#5f7a2f", vein = "#8aa356") {
  const a = (angle * Math.PI) / 180;
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * len * 0.32;
  const ny = Math.cos(a) * len * 0.32;
  const mx = (x + ex) / 2;
  const my = (y + ey) / 2;
  return `<path d="M${r2(x)} ${r2(y)} Q ${r2(mx + nx)} ${r2(my + ny)} ${r2(ex)} ${r2(ey)} Q ${r2(mx - nx)} ${r2(my - ny)} ${r2(x)} ${r2(y)} Z" fill="${color}"/>
  <path d="M${r2(x)} ${r2(y)} L ${r2(ex)} ${r2(ey)}" stroke="${vein}" stroke-width="1.2" opacity="0.7"/>`;
}

// ───────────────────────────────────────────────────────────────────────────
const art = {};

// Nabulsi kunafa: round tray, orange shredded top, a cut wedge with cheese.
art["nabulsi-kunafa"] = (() => {
  const rand = rng(11);
  const rx = 250, ry = 132, cy = CY - 6;
  let strands = "";
  for (let i = 0; i < 520; i++) {
    const [x, y, k] = inEllipse(rand, CX, cy, rx - 26, ry - 18, 1).next().value;
    const len = 10 + k * 16;
    const ang = rand() * Math.PI;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len * 0.5;
    const col = ["#f08a2c", "#e2741e", "#f7a043", "#c95f15", "#ffb257"][Math.floor(rand() * 5)];
    strands += `<path d="M${r2(x)} ${r2(y)} q ${r2(dx / 2)} ${r2(dy - 4)} ${r2(dx)} ${r2(dy)}" stroke="${col}" stroke-width="${r2(1.6 + rand() * 1.6)}" stroke-linecap="round" fill="none"/>`;
  }
  let pist = "";
  for (const [x, y, k] of inEllipse(rand, CX - 10, cy - 6, 150, 70, 90)) {
    pist += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(2 + k * 3.4)}" fill="${k > 0.5 ? "#8fae3e" : "#6f8f2a"}"/>`;
  }
  // wedge cut-out (front-right) revealing white cheese
  const wedge = `
    <path d="M${CX} ${cy} L ${CX + 236} ${cy + 40} A ${rx - 14} ${ry - 10} 0 0 1 ${CX + 96} ${cy + 116} Z" fill="#2b221b"/>
    <path d="M${CX} ${cy} L ${CX + 96} ${cy + 116} L ${CX + 96} ${cy + 140} L ${CX} ${cy + 22} Z" fill="#fbf3e2"/>
    <path d="M${CX} ${cy} L ${CX + 96} ${cy + 116} L ${CX + 96} ${cy + 124} L ${CX} ${cy + 8} Z" fill="#e67a22"/>
    <path d="M${CX + 6} ${cy + 26} q 30 40 60 70" stroke="#fffaf0" stroke-width="5" stroke-linecap="round" opacity="0.8"/>`;
  return frame(`
  <ellipse cx="${CX}" cy="${cy + 20}" rx="${rx + 22}" ry="${ry + 16}" fill="#3a322b"/>
  <ellipse cx="${CX}" cy="${cy + 8}" rx="${rx + 22}" ry="${ry + 16}" fill="#6d6259"/>
  <ellipse cx="${CX}" cy="${cy + 4}" rx="${rx + 10}" ry="${ry + 8}" fill="#2a241f"/>
  <ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#d7681a"/>
  ${strands}
  <ellipse cx="${CX - 60}" cy="${cy - 40}" rx="120" ry="40" fill="#fff3d6" opacity="0.18"/>
  ${pist}
  ${wedge}`);
})();

// Om Ali: terracotta oval dish, golden pastry, cream, nuts.
art["om-ali"] = (() => {
  const rand = rng(22);
  const rx = 250, ry = 130, cy = CY - 4;
  let puffs = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, rx - 50, ry - 34, 46)) {
    const w = 30 + k * 40;
    puffs += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(w)}" ry="${r2(w * 0.45)}" fill="${k > 0.55 ? "#c9802f" : "#e0a14a"}" opacity="0.85" transform="rotate(${r2(rand() * 40 - 20)} ${r2(x)} ${r2(y)})"/>`;
  }
  let nuts = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, rx - 40, ry - 26, 70)) {
    if (k < 0.4) nuts += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="7" ry="4" fill="#f3e3c3" transform="rotate(${r2(rand() * 180)} ${r2(x)} ${r2(y)})"/>`;
    else if (k < 0.7) nuts += `<path d="M${r2(x)} ${r2(y)} q 6 -7 12 0 q -6 7 -12 0" fill="#9a5a2a"/>`;
    else nuts += `<circle cx="${r2(x)}" cy="${r2(y)}" r="3" fill="#7e9b35"/>`;
  }
  return frame(`
  <ellipse cx="${CX}" cy="${cy + 34}" rx="${rx + 28}" ry="${ry + 24}" fill="#5a2a17"/>
  <ellipse cx="${CX}" cy="${cy + 10}" rx="${rx + 28}" ry="${ry + 24}" fill="#9a4a26"/>
  <ellipse cx="${CX}" cy="${cy + 4}" rx="${rx + 12}" ry="${ry + 10}" fill="#6b3119"/>
  <ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2e3c6"/>
  ${puffs}
  <ellipse cx="${CX - 50}" cy="${cy - 36}" rx="140" ry="46" fill="#fff8e8" opacity="0.25"/>
  ${nuts}`);
})();

// Baba ghanoush: shallow bowl, smoky dip swirl, olive oil, pomegranate, parsley.
art["baba-ghanoush"] = (() => {
  const rand = rng(33);
  const cy = CY - 4;
  let seeds = "";
  for (const [x, y, k] of inEllipse(rand, CX + 20, cy - 4, 120, 50, 34)) {
    seeds += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="5.5" ry="4.5" fill="${k > 0.5 ? "#b3122a" : "#d42540"}"/><circle cx="${r2(x - 1.5)}" cy="${r2(y - 1.5)}" r="1.4" fill="#ffd3da" opacity="0.8"/>`;
  }
  let herbs = "";
  for (const [x, y] of inEllipse(rand, CX - 40, cy - 10, 110, 46, 9)) herbs += leaf(x, y, 22, rand() * 360, "#4d6b23", "#86a04f");
  return frame(`
  ${plate({ rx: 270, ry: 140, cy, rim: "#ddd3c3", rimShade: "#a89c8a", well: "#e9e1d3" })}
  <ellipse cx="${CX}" cy="${cy + 4}" rx="196" ry="96" fill="#b39a7b"/>
  <ellipse cx="${CX}" cy="${cy}" rx="186" ry="88" fill="#c9b293"/>
  <path d="M${CX - 150} ${cy} C ${CX - 120} ${cy - 70}, ${CX + 130} ${cy - 70}, ${CX + 150} ${cy - 6} C ${CX + 110} ${cy + 46}, ${CX - 90} ${cy + 50}, ${CX - 110} ${cy + 4} C ${CX - 80} ${cy - 36}, ${CX + 80} ${cy - 38}, ${CX + 100} ${cy - 4}" fill="none" stroke="#a88d6b" stroke-width="10" stroke-linecap="round"/>
  <ellipse cx="${CX + 8}" cy="${cy}" rx="72" ry="26" fill="#c99a2e" opacity="0.55"/>
  <ellipse cx="${CX + 8}" cy="${cy - 4}" rx="46" ry="14" fill="#f1cf6a" opacity="0.45"/>
  ${seeds}
  ${herbs}
  <ellipse cx="${CX - 70}" cy="${cy - 40}" rx="70" ry="16" fill="#fff" opacity="0.18"/>`);
})();

// Tabbouleh: bowl heaped with parsley, tomato, bulgur; lemon wedge.
art["tabbouleh"] = (() => {
  const rand = rng(44);
  const cy = CY - 20;
  let greens = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy - 6, 190, 82, 900)) {
    const c = ["#3f6b1f", "#4f7d27", "#5f8f2f", "#2f5617", "#6e9e3a"][Math.floor(k * 5)];
    greens += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(2.2 + rand() * 3.2)}" fill="${c}"/>`;
  }
  let tomato = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy - 8, 170, 70, 60)) {
    const s = 8 + k * 6;
    tomato += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(s)}" height="${r2(s * 0.8)}" rx="2" fill="${k > 0.5 ? "#d8382a" : "#ef5a3a"}" transform="rotate(${r2(rand() * 90)} ${r2(x)} ${r2(y)})"/>`;
  }
  let bulgur = "";
  for (const [x, y] of inEllipse(rand, CX, cy - 6, 180, 74, 160)) bulgur += `<circle cx="${r2(x)}" cy="${r2(y)}" r="1.8" fill="#e8cf8e"/>`;
  return frame(`
  ${bowl({ rx: 220, ry: 98, cy, depth: 130, outer: "#e4dacb", outerShade: "#a3967f", inner: "#d8ccb6" })}
  <ellipse cx="${CX}" cy="${cy - 2}" rx="200" ry="86" fill="#365c18"/>
  ${greens}${bulgur}${tomato}
  <g transform="translate(${CX + 160} ${cy + 96}) rotate(-18)">
    <path d="M-46 0 A 46 30 0 0 0 46 0 Z" fill="#f5d84a"/>
    <path d="M-38 0 A 38 22 0 0 0 38 0 Z" fill="#fff0a0"/>
    <path d="M0 0 L -24 14 M0 0 L 0 20 M0 0 L 24 14" stroke="#f5d84a" stroke-width="3"/>
  </g>`);
})();

// Za'atar manakish: round flatbread, golden rim, za'atar & oil.
art["zaatar-manakish"] = (() => {
  const rand = rng(55);
  const cy = CY - 6;
  let zaatar = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, 214, 112, 1400)) {
    const c = ["#4a4a1c", "#5b5a22", "#6c6a2a", "#3b3a14", "#7d7a35"][Math.floor(k * 5)];
    zaatar += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(1.4 + rand() * 2.2)}" fill="${c}"/>`;
  }
  let sesame = "";
  for (const [x, y] of inEllipse(rand, CX, cy, 210, 108, 120)) {
    sesame += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="3" ry="1.6" fill="#f4e6c4" transform="rotate(${r2(rand() * 180)} ${r2(x)} ${r2(y)})"/>`;
  }
  let char = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, 250, 132, 26)) {
    if (Math.hypot((x - CX) / 250, (y - cy) / 132) > 0.86) char += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(6 + k * 8)}" ry="${r2(4 + k * 4)}" fill="#8a4c18" opacity="0.7"/>`;
  }
  return frame(`
  ${plate({ rx: 300, ry: 158, cy: cy + 10, rim: "#3a322b", rimShade: "#221d19", well: "#2e2722" })}
  <ellipse cx="${CX}" cy="${cy + 8}" rx="252" ry="134" fill="#b8762e"/>
  <ellipse cx="${CX}" cy="${cy}" rx="252" ry="134" fill="#dba25a"/>
  ${char}
  <ellipse cx="${CX}" cy="${cy}" rx="222" ry="116" fill="#6c6526"/>
  ${zaatar}${sesame}
  <ellipse cx="${CX - 70}" cy="${cy - 40}" rx="110" ry="30" fill="#e0c55a" opacity="0.22"/>`);
})();

// Cheese manakish: golden flatbread, bubbling cheese.
art["cheese-manakish"] = (() => {
  const rand = rng(66);
  const cy = CY - 6;
  let blobs = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, 200, 102, 80)) {
    const s = 14 + k * 26;
    blobs += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(s)}" ry="${r2(s * 0.55)}" fill="${k > 0.75 ? "#f6dc8c" : "#fbeab4"}"/>`;
  }
  let browned = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, 200, 102, 34)) {
    browned += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(5 + k * 9)}" ry="${r2(3 + k * 5)}" fill="#c98a3a" opacity="${r2(0.45 + k * 0.4)}"/>`;
  }
  let nigella = "";
  for (const [x, y] of inEllipse(rand, CX, cy, 200, 100, 70)) nigella += `<circle cx="${r2(x)}" cy="${r2(y)}" r="1.8" fill="#1a1410"/>`;
  return frame(`
  ${plate({ rx: 300, ry: 158, cy: cy + 10, rim: "#3a322b", rimShade: "#221d19", well: "#2e2722" })}
  <ellipse cx="${CX}" cy="${cy + 8}" rx="252" ry="134" fill="#b8762e"/>
  <ellipse cx="${CX}" cy="${cy}" rx="252" ry="134" fill="#e2ab61"/>
  <ellipse cx="${CX}" cy="${cy}" rx="224" ry="118" fill="#f8e3a3"/>
  ${blobs}${browned}${nigella}
  <ellipse cx="${CX - 60}" cy="${cy - 40}" rx="120" ry="30" fill="#fff" opacity="0.2"/>`);
})();

// Shawarma fatteh: deep bowl, yoghurt, shawarma strips, chickpeas, pine nuts.
art["shawarma-fatteh"] = (() => {
  const rand = rng(77);
  const cy = CY - 24;
  let strips = "";
  for (const [x, y, k] of inEllipse(rand, CX + 10, cy - 8, 120, 44, 26)) {
    const len = 26 + k * 22;
    const ang = rand() * 180;
    strips += `<rect x="${r2(x - len / 2)}" y="${r2(y - 5)}" width="${r2(len)}" height="${r2(9 + k * 4)}" rx="5" fill="${k > 0.5 ? "#a8561f" : "#c46e2c"}" transform="rotate(${r2(ang)} ${r2(x)} ${r2(y)})"/>`;
  }
  let peas = "";
  for (const [x, y, k] of inEllipse(rand, CX, cy, 180, 72, 40)) {
    if (Math.hypot((x - CX - 10) / 120, (y - cy + 8) / 44) > 0.9) peas += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(6 + k * 2)}" fill="#e3bf7a"/><circle cx="${r2(x - 2)}" cy="${r2(y - 2)}" r="2" fill="#f6dfa8"/>`;
  }
  let pine = "";
  for (const [x, y] of inEllipse(rand, CX, cy - 6, 150, 56, 36)) pine += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="4.5" ry="2.6" fill="#f0d79a" transform="rotate(${r2(rand() * 180)} ${r2(x)} ${r2(y)})"/>`;
  let paprika = "";
  for (const [x, y] of inEllipse(rand, CX, cy, 170, 68, 160)) paprika += `<circle cx="${r2(x)}" cy="${r2(y)}" r="1.5" fill="#c2401c" opacity="0.8"/>`;
  let herbs = "";
  for (const [x, y] of inEllipse(rand, CX, cy, 150, 56, 7)) herbs += leaf(x, y, 18, rand() * 360, "#4d6b23", "#86a04f");
  return frame(`
  ${bowl({ rx: 230, ry: 100, cy, depth: 140, outer: "#2f2925", outerShade: "#1b1714", inner: "#3a332d" })}
  <ellipse cx="${CX}" cy="${cy}" rx="212" ry="88" fill="#efe9dc"/>
  <ellipse cx="${CX - 40}" cy="${cy - 20}" rx="120" ry="34" fill="#fffdf7" opacity="0.6"/>
  ${paprika}${peas}${strips}${pine}${herbs}`);
})();

// Generic fallbacks per category (used when a remote photo fails to load).
const generic = (seed, glyph) =>
  frame(`
  ${plate({ rx: 270, ry: 140, cy: CY, rim: "#3a322b", rimShade: "#221d19", well: "#2a241f" })}
  <g transform="translate(${CX} ${CY - 8})" opacity="0.9">${glyph}</g>`);

art["fallback-grills"] = generic(1, `
  <g stroke="#6b5a4b" stroke-width="5" stroke-linecap="round"><path d="M-170 40 L170 -10"/><path d="M-170 70 L170 20"/></g>
  ${[-120, -60, 0, 60, 120].map((x, i) => `<rect x="${x - 24}" y="${-8 - i * 7}" width="48" height="30" rx="14" fill="${i % 2 ? "#7a3b18" : "#9a4a1c"}"/>`).join("")}
  ${[-110, 10, 130].map((x, i) => `<rect x="${x - 22}" y="${24 - i * 7}" width="44" height="28" rx="13" fill="#8a4320"/>`).join("")}`);
art["fallback-shawarma"] = generic(2, `
  <path d="M-150 30 C -120 -40, 120 -40, 150 30 C 100 70, -100 70, -150 30 Z" fill="#e3c08a"/>
  <path d="M-120 20 C -90 -20, 90 -20, 120 20" stroke="#a8561f" stroke-width="22" stroke-linecap="round" fill="none"/>
  <path d="M-100 34 C -70 6, 70 6, 100 34" stroke="#5f8f2f" stroke-width="8" stroke-linecap="round" fill="none"/>`);
art["fallback-pies"] = art["zaatar-manakish"];
art["fallback-appetizers"] = art["baba-ghanoush"];
art["fallback-desserts"] = art["nabulsi-kunafa"];
art["fallback-drinks"] = generic(3, `
  <path d="M-60 -110 L 60 -110 L 46 70 Q 0 86 -46 70 Z" fill="#f3e9da" opacity="0.18" stroke="#f3e9da" stroke-opacity="0.5" stroke-width="3"/>
  <path d="M-54 -40 L 54 -40 L 46 70 Q 0 86 -46 70 Z" fill="#e6d24a" opacity="0.75"/>
  ${leaf(-20, -60, 40, -60, "#4f7d27", "#8aa356")}${leaf(0, -64, 36, -110, "#5f8f2f", "#8aa356")}
  <circle cx="30" cy="-110" r="26" fill="#f5d84a"/><circle cx="30" cy="-110" r="18" fill="#fff0a0"/>`);
art["fallback-dish"] = generic(4, `
  <g fill="none" stroke="#ff8a45" stroke-width="6" stroke-linecap="round" opacity="0.8">
    <path d="M0 -70 C 16 -40 46 -26 46 10 C 46 40 26 60 0 60 C -26 60 -46 40 -46 10 C -46 -14 -32 -28 -24 -44 C -22 -26 -12 -16 -4 -14 C -8 -36 -6 -54 0 -70 Z"/>
  </g>`);

for (const [name, svg] of Object.entries(art)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
}
console.log(`wrote ${Object.keys(art).length} illustrations to public/art`);
