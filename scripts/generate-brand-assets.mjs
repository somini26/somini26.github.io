import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const iconDir = path.join(root, "src/assets/icons");
const imageDir = path.join(root, "src/assets/images");
const atlasDir = path.join(imageDir, "atlas");
const svgPath = path.join(iconDir, "atlas-planet-ring-v20261125.svg");
const svg = fs.readFileSync(svgPath, "utf8");
const asset = (name) =>
  `data:image/webp;base64,${fs.readFileSync(path.join(atlasDir, name)).toString("base64")}`;
const crystal = asset("atlas-crystal-v20261125.webp");
const development = asset("atlas-development-v20261125.webp");
const ctf = asset("atlas-ctf-wargame-v20261125.webp");
const documents = asset("atlas-blog-docs-v20261125.webp");
const browser = await chromium.launch({ headless: true });

async function renderIcon(size) {
  const context = await browser.newContext({ viewport: { width: size, height: size } });
  const page = await context.newPage();
  await page.setContent(
    `<style>*{box-sizing:border-box}html,body{margin:0;width:${size}px;height:${size}px;background:transparent}svg{display:block;width:100%;height:100%;padding:${Math.max(0, Math.round(size * 0.055))}px}</style>${svg}`,
  );
  const output = path.join(iconDir, `atlas-planet-ring-${size}-v20261125.png`);
  await page.screenshot({ path: output, omitBackground: true });
  await context.close();
  return fs.readFileSync(output);
}

const png16 = await renderIcon(16);
const png32 = await renderIcon(32);
await renderIcon(180);
await renderIcon(192);
await renderIcon(512);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(2, 4);
const entries = Buffer.alloc(32);
let offset = 6 + entries.length;
for (const [index, [size, png]] of [[16, png16], [32, png32]].entries()) {
  const base = index * 16;
  entries.writeUInt8(size, base);
  entries.writeUInt8(size, base + 1);
  entries.writeUInt8(0, base + 2);
  entries.writeUInt8(0, base + 3);
  entries.writeUInt16LE(1, base + 4);
  entries.writeUInt16LE(32, base + 6);
  entries.writeUInt32LE(png.length, base + 8);
  entries.writeUInt32LE(offset, base + 12);
  offset += png.length;
}
const ico = Buffer.concat([header, entries, png16, png32]);
fs.writeFileSync(path.join(root, "src/favicon-atlas-v20261125.ico"), ico);
// Keep the conventional fallback synchronized for user agents that skip <link>.
fs.writeFileSync(path.join(root, "src/favicon.ico"), ico);

const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
const page = await context.newPage();
await page.setContent(`<!doctype html><html lang="ko"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#17091f;color:#fbf7ff;font-family:Arial,"Malgun Gothic",sans-serif}
body{background:radial-gradient(circle at 75% 46%,rgba(143,47,202,.23),transparent 315px),linear-gradient(145deg,#1c0b26,#0c0612)}
.stars{position:absolute;inset:0;opacity:.42;background-image:radial-gradient(circle at 12% 21%,#fff 0 1px,transparent 1.4px),radial-gradient(circle at 88% 16%,#e9c9ff 0 1px,transparent 1.4px),radial-gradient(circle at 92% 75%,#fff 0 1px,transparent 1.4px);background-size:270px 240px,350px 310px,420px 360px}
.header{position:absolute;left:62px;right:62px;top:36px;height:66px;display:flex;align-items:center;border-bottom:1px solid rgba(217,157,255,.28)}
.header svg{width:48px;height:48px;margin-right:12px}.brand{font-size:23px;font-weight:700;letter-spacing:-.035em}.nav{margin-left:auto;color:#c9afd9;font-size:13px;letter-spacing:.08em;word-spacing:22px}
.copy{position:absolute;left:70px;top:164px;width:510px}.eyebrow{margin:0 0 20px;color:#cc86ff;font-size:14px;font-weight:700;letter-spacing:.2em}.copy h1{margin:0;font-size:67px;line-height:1.06;letter-spacing:-.058em}.copy h1 span{display:block;color:#d5a2fb}.desc{width:470px;margin:25px 0 0;color:#ceb8da;font-size:19px;line-height:1.65;word-break:keep-all}.url{margin-top:33px;color:#bf76ef;font-size:14px;letter-spacing:.08em}
.atlas{position:absolute;right:-18px;top:90px;width:650px;height:520px}.atlas svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.atlas ellipse,.atlas path{fill:none;stroke:#bc6cf0;stroke-width:1;opacity:.5}.atlas path{stroke-dasharray:5 8;opacity:.34}.crystal{position:absolute;left:182px;top:88px;width:300px;height:300px;object-fit:contain;filter:drop-shadow(0 0 28px rgba(189,79,255,.43))}.object{position:absolute;width:108px;height:108px;object-fit:contain;filter:drop-shadow(0 0 14px rgba(180,74,245,.37))}.one{left:23px;top:140px}.two{right:6px;top:127px}.three{left:105px;bottom:8px}.node{position:absolute;width:7px;height:7px;border-radius:50%;background:#fff;border:2px solid #bc6cf0;box-shadow:0 0 13px #b84fff}.n1{left:110px;top:134px}.n2{right:106px;top:115px}.n3{left:197px;bottom:65px}
.line{position:absolute;left:70px;bottom:46px;width:420px;height:1px;background:linear-gradient(90deg,#bc6cf0,transparent)}
</style><body><div class="stars"></div><header class="header">${svg}<span class="brand">somani's archive</span><span class="nav">HOME CATEGORIES ARCHIVE ABOUT</span></header><main class="copy"><p class="eyebrow">ORBITAL ATLAS · PERSONAL ARCHIVE</p><h1>somani's <span>archive</span></h1><p class="desc">개발, 보안, AI, 데이터 등 다양한 기술 분야를 공부하며 새롭게 배운 내용과 직접 경험한 것을 기록합니다.</p><p class="url">SOMINI26.GITHUB.IO</p></main><section class="atlas" aria-hidden="true"><svg viewBox="0 0 650 520"><ellipse cx="330" cy="265" rx="280" ry="130" transform="rotate(-10 330 265)"/><ellipse cx="330" cy="265" rx="225" ry="205" transform="rotate(22 330 265)"/><path d="M30 335C165 495 510 450 630 170"/></svg><img class="crystal" src="${crystal}"><img class="object one" src="${development}"><img class="object two" src="${ctf}"><img class="object three" src="${documents}"><i class="node n1"></i><i class="node n2"></i><i class="node n3"></i></section><div class="line"></div></body></html>`);
await page.screenshot({ path: path.join(imageDir, "social-orbital-atlas-v20261125.png") });
await context.close();
await browser.close();
