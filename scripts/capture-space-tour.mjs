import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const outputDirectory = path.resolve("test-results/v2-review");
const temporaryDirectory = path.join(outputDirectory, "video-temp");
fs.mkdirSync(temporaryDirectory, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--port=8080"], {
  stdio: "ignore",
  detached: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:8080/");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Preview server did not start");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: temporaryDirectory, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8080/?intro=1");
  await page.waitForTimeout(1900);
  await page.waitForTimeout(500);
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "Categories" }).click();
  await page.waitForURL("**/categories/");
  await page.waitForTimeout(1000);
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "Archive" }).click();
  await page.waitForURL("**/archive/");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
  await page.waitForTimeout(1200);
  const video = page.video();
  await page.close();
  await context.close();
  await video.saveAs(path.join(outputDirectory, "orbit-observatory-tour-v2-20261125.webm"));
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
