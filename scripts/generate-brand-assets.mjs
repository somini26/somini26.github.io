import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const iconDir = path.join(root, "src/assets/icons");
const imageDir = path.join(root, "src/assets/images");
const svgPath = path.join(iconDir, "planet-ring-v20261125.svg");
const backgroundPath = path.join(
  imageDir,
  "space/station-launch-v20261125.png",
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
fs.writeFileSync(
  path.join(root, "src/favicon.ico"),
  Buffer.concat([header, entries, png16, png32]),
);

const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.setContent(`<!doctype html><html lang="ko"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#08071a;color:#fff;font-family:Arial,"Malgun Gothic",sans-serif}
.scene{position:absolute;inset:0;background:url(data:image/png;base64,${background}) center/cover no-repeat;transform:scale(1.015)}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,5,22,.94) 0%,rgba(10,7,32,.78) 42%,rgba(9,6,28,.08) 78%),linear-gradient(0deg,rgba(8,5,25,.72),transparent 42%)}
.frame{position:absolute;inset:28px;border:2px solid rgba(213,190,255,.68);clip-path:polygon(0 6%,3% 0,97% 0,100% 6%,100% 94%,97% 100%,3% 100%,0 94%)}
.frame:before,.frame:after{content:"";position:absolute;height:5px;background:#b98cff;box-shadow:0 0 22px #a86fff}.frame:before{top:-2px;left:46px;width:118px}.frame:after{right:46px;bottom:-2px;width:166px}
.content{position:absolute;left:82px;top:88px;width:660px}.mark{display:flex;align-items:center;gap:18px;color:#d8c5ff;font-size:19px;font-weight:700;letter-spacing:.16em}.mark svg{width:72px;height:72px;filter:drop-shadow(0 0 18px rgba(174,119,255,.55))}
.eyebrow{margin:55px 0 12px;color:#d6c3ff;font-size:17px;font-weight:700;letter-spacing:.2em}.title{margin:0;font-size:76px;line-height:1.02;letter-spacing:-.055em}.title em{color:#c29cff;font-style:normal}.desc{width:590px;margin:26px 0 0;color:#e4dcf2;font-size:23px;line-height:1.55;word-break:keep-all}.meta{position:absolute;left:84px;bottom:69px;display:flex;gap:17px;color:#c9b6e9;font-size:16px;letter-spacing:.08em}.meta span{padding:9px 15px;border:1px solid rgba(202,174,255,.42);background:rgba(34,24,67,.54)}
</style><body><div class="scene"></div><div class="shade"></div><div class="frame"></div><main class="content"><div class="mark">${svg}<span>ORBITAL SECURITY ARCHIVE</span></div><p class="eyebrow">SOMANI'S SPACE STATION</p><h1 class="title">somani's <em>archive</em></h1><p class="desc">개발, 보안, AI, 데이터 등 다양한 기술 분야를 공부하며 새롭게 배운 내용과 직접 경험한 것을 기록합니다.</p></main><div class="meta"><span>SECURITY</span><span>CTF</span><span>DEVELOPMENT</span></div></body></html>`);
await page.screenshot({
  path: path.join(imageDir, "social-space-v20261125.png"),
});
await context.close();
await browser.close();
