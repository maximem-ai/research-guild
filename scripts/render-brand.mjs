// Renders the brand images from design/mark.svg with headless Chromium (Playwright):
//   src/app/icon.svg, src/app/favicon.ico (16/32/48), src/app/apple-icon.png (180)
//   src/app/opengraph-image.png + .github/social-card.png (1280×640 share card)
//   .github/banner-light.png, .github/banner-dark.png (README header, 1280×360)
//   public/illustration-paper.png (home-page hero illustration, transparent, 2x)
// Usage: node scripts/render-brand.mjs   (set CHROMIUM_PATH if Playwright can't find a browser)
import { chromium } from "@playwright/test";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const mark = readFileSync("design/mark.svg", "utf8");
const markUri = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;
// Single quotes only: these are interpolated into style="..." attributes.
const SERIF = `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'DejaVu Serif', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif`;
const MONO = `ui-monospace, Menlo, 'DejaVu Sans Mono', monospace`;

// The illustration: a paper with feedback rounds and an endorsement check, i.e. what the product does.
function paper({ dark }) {
  const ink = dark ? "#0a0a0a" : "#0a0a0a";
  const line = "#d4d4d4";
  return `
  <div style="position:relative;width:400px;height:470px">
    <div style="position:absolute;inset:0;transform:rotate(-4deg);background:${dark ? "#1c1c1c" : "#ececec"};border-radius:18px"></div>
    <div style="position:absolute;inset:0;background:#fff;border-radius:18px;padding:36px 34px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:${SANS};color:${ink}">
      <div style="font:600 13px ${SANS};letter-spacing:.12em;color:#b3460a">ABSTRACT · cs.CL</div>
      <div style="margin-top:12px;font:700 25px/1.2 ${SERIF}">Low-resource speech recognition for Indian languages</div>
      ${[96, 88, 92, 70].map((w) => `<div style="height:9px;width:${w}%;background:${line};border-radius:5px;margin-top:14px"></div>`).join("")}
      <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px">
        <div style="align-self:flex-start;max-width:82%;background:#f4f4f5;border-radius:12px 12px 12px 4px;padding:10px 14px;font-size:15px">Round 1 · Add a baseline for Hindi.</div>
        <div style="align-self:flex-end;max-width:82%;background:#0a0a0a;color:#fff;border-radius:12px 12px 4px 12px;padding:10px 14px;font-size:15px">v2 uploaded with the baseline.</div>
      </div>
      <div style="position:absolute;right:28px;bottom:28px;display:flex;align-items:center;gap:10px;border:2.5px solid #ff6a13;color:#e65a0a;border-radius:999px;padding:8px 16px;font:700 16px ${SANS};letter-spacing:.06em;transform:rotate(-6deg)">
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#ff6a13" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ENDORSED
      </div>
    </div>
  </div>`;
}

function card() {
  const grid = `background-image:linear-gradient(#161616 1px,transparent 1px),linear-gradient(90deg,#161616 1px,transparent 1px);background-size:64px 64px`;
  return `<body style="margin:0;width:1280px;height:640px;background:#0a0a0a;${grid};font-family:${SANS};overflow:hidden">
  <div style="position:absolute;left:96px;top:92px;display:flex;align-items:center;gap:20px">
    <img src="${markUri}" width="72" height="72"><span style="font:700 34px ${SERIF};color:#fafafa">ResearchGuild</span>
  </div>
  <div style="position:absolute;left:96px;top:206px;width:640px">
    <div style="font:700 60px/1.08 ${SERIF};color:#fafafa;letter-spacing:-.01em">Get your first paper reviewed and endorsed.</div>
    <div style="margin-top:22px;font:400 25px/1.4 ${SANS};color:#a3a3a3">Feedback from people who have published, and a path to an arXiv endorsement.</div>
  </div>
  <div style="position:absolute;left:96px;bottom:58px;font:500 22px ${MONO};color:#ff8a47">Free · open source · researchguild.org</div>
  <div style="position:absolute;right:110px;top:84px">${paper({ dark: true })}</div>
</body>`;
}

function banner(theme) {
  const dark = theme === "dark";
  const bg = dark ? "#0a0a0a" : "#fafafa";
  const fg = dark ? "#fafafa" : "#0a0a0a";
  const sub = dark ? "#a3a3a3" : "#525252";
  return `<body style="margin:0;width:1280px;height:360px;background:${bg};font-family:${SANS};overflow:hidden;position:relative">
  <div style="position:absolute;left:80px;top:70px;display:flex;align-items:center;gap:18px">
    <img src="${markUri}" width="64" height="64"><span style="font:700 46px ${SERIF};color:${fg}">ResearchGuild</span>
  </div>
  <div style="position:absolute;left:80px;top:168px;width:700px;font:600 34px/1.25 ${SERIF};color:${fg}">Get your first paper reviewed and endorsed.</div>
  <div style="position:absolute;left:80px;top:262px;font:500 20px ${MONO};color:${dark ? "#ff8a47" : "#b3460a"}">Free · open source · researchguild.org</div>
  <div style="position:absolute;right:90px;top:34px;transform:scale(.62);transform-origin:top right">${paper({ dark })}</div>
</body>`;
}

/** Packs PNG buffers into a .ico (PNG-compressed entries, supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function shot(html, width, height, path, scale = 1) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: "load" });
  const buf = await page.screenshot({ path, omitBackground: true });
  await page.close();
  return buf;
}
const markAt = (s) => `<body style="margin:0;background:transparent"><img src="${markUri}" width="${s}" height="${s}" style="display:block"></body>`;

writeFileSync("src/app/icon.svg", mark);
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push({ size: s, data: await shot(markAt(s), s, s) });
writeFileSync("src/app/favicon.ico", ico(pngs));
await shot(`<body style="margin:0;background:#0a0a0a"><img src="${markUri}" width="180" height="180" style="display:block"></body>`, 180, 180, "src/app/apple-icon.png");
await shot(card(), 1280, 640, ".github/social-card.png");
copyFileSync(".github/social-card.png", "src/app/opengraph-image.png");
await shot(banner("light"), 1280, 360, ".github/banner-light.png");
await shot(banner("dark"), 1280, 360, ".github/banner-dark.png");
await shot(`<body style="margin:0;background:transparent;padding:70px">${paper({ dark: false })}</body>`, 540, 610,
  "public/illustration-paper.png", 2);
await browser.close();
console.log("brand images rendered");
