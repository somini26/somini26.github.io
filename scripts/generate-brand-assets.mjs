import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const iconDir = path.join(root, "src/assets/icons");
const imageDir = path.join(root, "src/assets/images");
const svgPath = path.join(iconDir, "planet-ring-v20261125.svg");
const backgroundPath = path.join(
  imageDir,
  "space/orbit-observatory-dark-v20261125.png",
);
const svg = fs.readFileSync(svgPath, "utf8");
const background = fs.readFileSync(backgroundPath).toString("base64");
const browser = await chromium.launch({ headless: true });

async function renderWebp(input, output, quality = 0.84) {
  const source = fs.readFileSync(input).toString("base64");
  const context = await browser.newContext({ viewport: { width: 32, height: 32 } });
  const page = await context.newPage();
  await page.setContent(`<img src="data:image/png;base64,${source}">`);
  const encoded = await page.locator("img").evaluate(
    async (image, imageQuality) => {
      if (!image.complete) await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", imageQuality).split(",")[1];
    },
    quality,
  );
  fs.writeFileSync(output, Buffer.from(encoded, "base64"));
  await context.close();
}

for (const name of [
  "station-launch-v20261125",
  "station-bridge-dark-v20261125",
  "station-bridge-light-v20261125",
  "orbit-observatory-dark-v20261125",
  "orbit-observatory-light-v20261125",
]) {
  await renderWebp(
    path.join(imageDir, `space/${name}.png`),
    path.join(imageDir, `space/${name}.webp`),
  );
}

async function renderIcon(size) {
  const context = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(
    `<style>*{box-sizing:border-box}html,body{margin:0;width:${size}px;height:${size}px;background:transparent}svg{display:block;width:100%;height:100%;padding:${Math.max(0, Math.round(size * 0.055))}px}</style>${svg}`,
  );
  const output = path.join(
    iconDir,
    `planet-ring-${size}-v20261125.png`,
  );
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
for (const [index, [size, png]] of [
  [16, png16],
  [32, png32],
].entries()) {
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
fs.writeFileSync(path.join(root, "src/favicon-v20261125.ico"), ico);
// Keep the conventional root fallback for user agents that never inspect <link>.
fs.writeFileSync(path.join(root, "src/favicon.ico"), ico);

const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.setContent(`<!doctype html><html lang="ko"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#090b16;color:#eef0f8;font-family:Arial,"Malgun Gothic",sans-serif}
.scene{position:absolute;inset:0;background:url(data:image/png;base64,${background}) center/cover no-repeat}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,11,22,.99) 0%,rgba(9,11,22,.96) 38%,rgba(9,11,22,.26) 72%,rgba(9,11,22,.02) 100%)}
.content{position:absolute;left:76px;top:70px;width:625px}.mark{display:flex;align-items:center;gap:16px;color:#adb4c8;font-size:15px;font-weight:700;letter-spacing:.15em}.mark svg{width:56px;height:56px}.eyebrow{margin:72px 0 13px;color:#a695f5;font-size:15px;font-weight:700;letter-spacing:.17em}.title{margin:0;font-size:72px;line-height:1.03;letter-spacing:-.055em}.title em{color:#bcafff;font-style:normal}.desc{width:570px;margin:24px 0 0;color:#adb4c8;font-size:21px;line-height:1.55;word-break:keep-all}.line{position:absolute;left:76px;right:76px;bottom:55px;height:1px;background:rgba(166,149,245,.28)}
</style><body><div class="scene"></div><div class="shade"></div><main class="content"><div class="mark">${svg}<span>ORBITAL OBSERVATORY</span></div><p class="eyebrow">SOMANI'S PERSONAL ARCHIVE</p><h1 class="title">somani's <em>archive</em></h1><p class="desc">개발, 보안, AI, 데이터 등 다양한 기술 분야를 공부하며 새롭게 배운 내용과 직접 경험한 것을 기록합니다.</p></main><div class="line"></div></body></html>`);
await page.screenshot({
  path: path.join(imageDir, "social-orbit-v2-20261125.png"),
});
await context.close();
await browser.close();
