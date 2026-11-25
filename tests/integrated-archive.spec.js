import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const reviewDirectory = path.resolve("test-results/orbital-atlas-review");
fs.mkdirSync(reviewDirectory, { recursive: true });
const introKey = "somani-intro-seen-orbital-atlas-v20261125";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), introKey);
});

async function expectNoOverflow(page) {
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBeTruthy();
}

async function expectAccessible(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("short orbital entry is optional, session-scoped and absent from direct posts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?intro=1");
  const intro = page.locator("[data-launch-intro]");
  await expect(intro).toHaveClass(/is-visible/);
  await expect(page.getByRole("button", { name: /ENTER ATLAS/ })).toBeVisible();
  await expect(page.locator(".launch-ship-image")).toHaveAttribute("src", /atlas-ship/);
  await expect(page.locator(".launch-crystal")).toHaveAttribute("src", /atlas-crystal/);
  const animations = await page.evaluate(() => [
    getComputedStyle(document.querySelector(".launch-ship-image")).animationName,
    getComputedStyle(document.querySelector(".launch-crystal")).animationName,
    getComputedStyle(document.querySelector(".launch-pulse")).animationName,
  ]);
  expect(animations.every((name) => name && name !== "none")).toBeTruthy();
  expect(new Set(animations).size).toBe(3);
  await page.screenshot({
    path: path.join(reviewDirectory, "launch-1440x900.png"),
    animations: "allow",
  });
  await page.keyboard.press("Escape");
  await expect(intro).not.toHaveClass(/is-visible/);
  await expect(page.locator("body")).not.toHaveClass(/atlas-intro-arrived/);
  await page.reload();
  await expect(intro).not.toHaveClass(/is-visible/);
  await expect(page.locator("body")).not.toHaveClass(/atlas-intro-arrived/);
  await page.getByRole("button", { name: "인트로 다시 보기" }).click();
  await expect(intro).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: /Skip/ }).click();
  await expect(intro).not.toHaveClass(/is-visible/);
  await expect(page.locator("body")).not.toHaveClass(/atlas-intro-arrived/);
  await page.getByRole("button", { name: "인트로 다시 보기" }).click();
  await expect(intro).toHaveClass(/is-visible/);
  await page.keyboard.press("Enter");
  await expect(intro).not.toHaveClass(/is-visible/, { timeout: 1000 });
  await expect(page.locator("body")).toHaveClass(/atlas-intro-arrived/);
  await page.goto("/posts/bomblab-gdb-binary-patch/");
  await expect(page.locator("[data-launch-intro]")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/atlas-intro-arrived/);
  await expect(page.locator(".article-prose")).toBeVisible();
});

test("ordinary navigation is immediate and content is never reveal-gated", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-transition, [data-reveal]")).toHaveCount(0);
  const defaultWasPrevented = await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/categories/";
    link.textContent = "test navigation";
    document.body.append(link);
    let prevented = null;
    const inspect = (event) => {
      if (event.target === link) {
        prevented = event.defaultPrevented;
        event.preventDefault();
      }
    };
    document.addEventListener("click", inspect);
    link.click();
    document.removeEventListener("click", inspect);
    link.remove();
    return prevented;
  });
  expect(defaultWasPrevented).toBe(false);
  if (await page.locator(".desktop-nav").isVisible())
    await page.locator('.desktop-nav a[href="/categories/"]').click();
  else {
    await page.locator("[data-mobile-menu] summary").click();
    await page.locator('.mobile-menu-panel a[href="/categories/"]').click();
  }
  await expect(page).toHaveURL(/\/categories\/$/);
  await expect(page.locator("h1")).toBeVisible();
});

test("recent records use the current unique post collection in responsive order", async ({ page, request }) => {
  const posts = await (await request.get("/search.json")).json();
  await page.goto("/");
  const cards = page.locator(".atlas-recent-grid .recent-record");
  const expected = posts.slice(0, 3);
  await expect(cards).toHaveCount(expected.length);
  expect(await cards.evaluateAll((nodes) => new Set(nodes.map((node) => node.getAttribute("href"))).size)).toBe(expected.length);
  expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))).toEqual(expected.map((post) => post.url));
  await expect(cards.locator("strong")).toHaveText(expected.map((post) => post.title));
  if (expected[0]?.description)
    await expect(cards.first().locator(".recent-record-description")).toHaveText(expected[0].description);
  await expect(page.locator(".document-symbol")).toHaveCount(0);
  if (page.viewportSize().width > 900) {
    const desktopBoxes = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    expect(desktopBoxes[0].x).toBeLessThan(desktopBoxes[1].x);
    expect(desktopBoxes[0].height).toBeGreaterThan(desktopBoxes[1].height);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileBoxes = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  expect(mobileBoxes.every((box, index) => index === 0 || box.y > mobileBoxes[index - 1].y)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});

test("About uses the transparent three-quarter helmet without a background plate", async ({ page, request }) => {
  await page.goto("/about/");
  const helmet = page.locator(".about-helmet");
  await expect(helmet).toHaveAttribute("src", "/assets/images/atlas/atlas-helmet-v20261125.webp");
  await expect.poll(() => helmet.evaluate((image) => [image.complete, image.naturalWidth, image.naturalHeight])).toEqual([true, 640, 640]);
  await expect(page.locator(".about-orbit > span, .about-orbit .nav-icon")).toHaveCount(0);
  const cornerAlpha = await helmet.evaluate((image) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    canvas.getContext("2d").drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
    return canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3];
  });
  expect(cornerAlpha).toBeLessThan(8);
  const response = await request.get("/assets/images/atlas/atlas-helmet-v20261125.webp");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
});

test("approved dark, light and responsive compositions stay stable", async ({ page }) => {
  test.setTimeout(90_000);
  const captures = [
    ["home-dark-1440x1000", 1440, 1000, "dark", "/"],
    ["home-light-1440x1000", 1440, 1000, "light", "/"],
    ["home-dark-1280x900", 1280, 900, "dark", "/"],
    ["home-dark-390x844", 390, 844, "dark", "/"],
    ["home-light-390x844", 390, 844, "light", "/"],
    ["home-dark-360x800", 360, 800, "dark", "/"],
    ["categories-dark-768x900", 768, 900, "dark", "/categories/"],
    ["archive-dark-1280x900", 1280, 900, "dark", "/archive/"],
    ["post-dark-1440x1000", 1440, 1000, "dark", "/posts/bomblab-gdb-binary-patch/"],
    ["about-dark-390x844", 390, 844, "dark", "/about/"],
  ];
  for (const [name, width, height, theme, url] of captures) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await page.evaluate((value) => {
      localStorage.setItem("somani-theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.reload();
    await expectNoOverflow(page);
    if (url === "/" && width >= 1280) {
      await expect(page.locator(".desktop-nav")).toBeVisible();
      await expect(page.locator(".atlas-destination")).toHaveCount(6);
      await expect(page.locator(".atlas-core img")).toBeVisible();
      const stageHeight = await page.locator(".atlas-stage").evaluate((node) => node.getBoundingClientRect().height);
      expect(stageHeight).toBeGreaterThanOrEqual(600);
      expect(stageHeight).toBeLessThanOrEqual(720);
    }
    if (url === "/" && width <= 390) {
      await expect(page.locator(".atlas-mobile-routes a")).toHaveCount(6);
      await expect(page.locator(".atlas-mobile-routes")).toBeVisible();
    }
    if (theme === "light") {
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim())).toBe("#fff");
    }
    await page.screenshot({
      path: path.join(reviewDirectory, `${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("atlas objects, archive controls and object selection work", async ({ page }, testInfo) => {
  await page.goto("/");
  const objects = page.locator(".atlas-destination");
  await expect(objects).toHaveCount(6);
  await expect(page.locator('.atlas-destination img[src*="/assets/images/atlas/"]')).toHaveCount(6);
  if (testInfo.project.name === "desktop") {
    const firstRoute = page.locator('[data-orbit="development"]');
    await objects.first().hover();
    await expect(firstRoute).toHaveClass(/is-active/);
    await objects.first().focus();
    await expect(firstRoute).toHaveClass(/is-active/);
  } else {
    await expect(page.locator(".atlas-mobile-routes a")).toHaveCount(6);
    await expect(page.locator('.atlas-mobile-routes img[src*="/assets/images/atlas/"]')).toHaveCount(6);
  }

  await page.goto("/categories/");
  const cards = page.locator(".topic-directory > li > a");
  await expect(cards).toHaveCount(6);
  await expect(cards).toContainText([
    "개발", "CTF/Wargame", "Bug Bounty", "블로그/기술문서", "논문/컨퍼런스", "공모전/자격증",
  ]);

  await page.goto("/archive/?category=CTF%2FWargame");
  await expect(page.locator("#category-filter")).toHaveValue("CTF/Wargame");
  expect(await page.locator("#archive-results .post-card").count()).toBeGreaterThan(0);
  await page.getByRole("searchbox", { name: "게시글 검색" }).fill("SECTOR");
  expect(await page.locator("#archive-results .post-card").count()).toBeGreaterThan(0);
  await page.locator("#tag-filter").selectOption("SECTOR");
  await expect(page).toHaveURL(/tag=SECTOR/);
  await page.getByRole("button", { name: "현재 최신순, 오래된순으로 전환" }).click();
  await expect(page).toHaveURL(/sort=oldest/);
  await page.evaluate(() => history.back());
  await expect(page).not.toHaveURL(/sort=oldest/);
});

test("post rail keeps TOC, chronology, related records and archive access available", async ({ page }) => {
  await page.goto("/posts/bomblab-gdb-binary-patch/");
  const rail = page.locator(".article-rail");
  await expect(rail.locator(":scope > .toc-panel")).toHaveCount(1);
  await expect(rail.locator(":scope > .record-navigation")).toHaveCount(1);
  await expect(rail.locator(":scope > .related-posts")).toHaveCount(1);
  await expect(rail.locator(":scope > .article-rail-link")).toHaveCount(1);
  const order = await rail.locator(":scope > *").evaluateAll((nodes) =>
    nodes.map((node) => node.className),
  );
  expect(order.slice(0, 4).join(" ")).toMatch(/toc-panel.*record-navigation.*related-posts.*article-rail-link/);
  const toc = page.locator(".toc-scroll");
  await expect(toc.locator("a")).not.toHaveCount(0);
  expect(await toc.evaluate((node) => getComputedStyle(node).overflowY)).toBe("auto");
  expect(await page.locator(".related-posts a").count()).toBeLessThanOrEqual(3);
  await expect(page.getByRole("navigation", { name: "글 탐색" })).toContainText("현재 글");
  await expect(page.locator(".article-bottom-navigation")).toBeVisible();
  await expect(page.locator(".article-bottom-navigation .all-records")).toHaveAttribute("href", "/archive/");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".toc-panel")).not.toHaveAttribute("open", "");
  await page.locator(".toc-panel summary").click();
  await expect(page.getByRole("navigation", { name: "게시글 목차" })).toBeVisible();
  await page.locator(".record-navigation").scrollIntoViewIfNeeded();
  await expect(page.locator(".record-navigation")).toBeVisible();
  await page.locator(".article-bottom-navigation").scrollIntoViewIfNeeded();
  await expect(page.locator(".article-bottom-navigation")).toBeVisible();
});

test("profile, dynamic counts and all category routes remain intact", async ({ page, request }) => {
  await page.goto("/about/");
  await expect(page.locator('.profile-card img[src="/assets/images/profile-hachiware-about.jpg"]')).toHaveAttribute(
    "alt", "컴퓨터 앞에 앉아 커피를 마시는 파란 귀의 하치와레 캐릭터",
  );
  await expect(page.locator(".about-content section").first()).toContainText(
    "시스템 해킹과 리버스 엔지니어링, CTF/Wargame도 여러 관심 분야 가운데 하나입니다.",
  );
  await expect(page.getByRole("link", { name: /amder1144@gmail.com/ })).toHaveAttribute("href", "mailto:amder1144@gmail.com");
  const posts = await (await request.get("/search.json")).json();
  expect(posts.length).toBeGreaterThan(0);
  expect(new Set(posts.map((post) => post.url)).size).toBe(posts.length);
  for (const route of [
    "/categories/development/", "/categories/ctf-wargame/", "/categories/bug-bounty/",
    "/categories/blog-docs/", "/categories/papers-conferences/", "/categories/competitions-certifications/",
  ]) {
    expect((await page.goto(route)).status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("versioned icon, manifest and Open Graph metadata are unique and reachable", async ({ page, request }) => {
  for (const url of ["/", "/posts/github-pages-blog/"]) {
    expect((await page.goto(url)).status()).toBe(200);
    for (const property of ["og:title", "og:description", "og:image"])
      await expect(page.locator(`meta[property="${property}"]`)).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content", "https://somini26.github.io/assets/images/social-orbital-atlas-v20261125.png",
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content", "https://somini26.github.io/assets/images/social-orbital-atlas-v20261125.png",
    );
    expect(await page.content()).not.toContain("social-orbit-v2-20261125.png");
  }
  await page.goto("/posts/github-pages-blog/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "GitHub Pages 블로그 구축 기록");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://somini26.github.io/posts/github-pages-blog/");
  for (const asset of [
    "/favicon-atlas-v20261125.ico", "/favicon.ico",
    "/assets/icons/atlas-planet-ring-v20261125.svg",
    "/assets/icons/atlas-planet-ring-16-v20261125.png",
    "/assets/icons/atlas-planet-ring-32-v20261125.png",
    "/assets/icons/atlas-planet-ring-180-v20261125.png",
    "/assets/images/social-orbital-atlas-v20261125.png",
    "/site-atlas-v20261125.webmanifest",
  ]) {
    const response = await request.get(asset);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  const manifest = await (await request.get("/site-atlas-v20261125.webmanifest")).json();
  expect(manifest.icons.map((icon) => icon.src)).toEqual([
    "/assets/icons/atlas-planet-ring-192-v20261125.png",
    "/assets/icons/atlas-planet-ring-512-v20261125.png",
  ]);
});

test("primary rooms remain accessible in both themes, narrow layouts and reduced motion", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  for (const theme of ["dark", "light"]) {
    await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("somani-theme", value), theme);
    for (const url of ["/", "/categories/", "/archive/", "/about/", "/posts/github-pages-blog/", "/404.html"]) {
      await page.goto(url);
      await expectNoOverflow(page);
      await expectAccessible(page);
    }
  }
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ["/", "/archive/", "/categories/", "/about/", "/posts/bomblab-gdb-binary-patch/"]) {
      await page.goto(url);
      await expectNoOverflow(page);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?intro=1");
  await expect(page.locator("[data-launch-intro]")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".atlas-stage")).toBeVisible();
  expect(errors).toEqual([]);
});
