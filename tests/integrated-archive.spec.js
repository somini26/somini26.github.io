import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const reviewDirectory = path.resolve("test-results/space-redesign");
fs.mkdirSync(reviewDirectory, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("somani-intro-seen-v20261125", "1"),
  );
});

async function reveal(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll("[data-reveal]")
      .forEach((element) => {
        element.style.transition = "none";
        element.classList.add("is-visible");
      });
  });
}

async function expectNoOverflow(page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBeTruthy();
}

async function expectAccessible(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("launch sequence is optional, session-scoped and never blocks direct URLs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/?intro=1");
  const intro = page.locator("[data-launch-intro]");
  await expect(intro).toHaveClass(/is-visible/);
  await expect(page.getByRole("heading", { name: /Space Station/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /ENTER STATION/ })).toBeVisible();
  const animations = await page.evaluate(() =>
    [
      ".launch-stars",
      ".launch-nebula",
      ".launch-planet",
      ".launch-station",
      ".launch-ship",
    ].map((selector) => getComputedStyle(document.querySelector(selector)).animationName),
  );
  expect(new Set(animations).size).toBeGreaterThanOrEqual(4);
  await page.screenshot({
    path: path.join(reviewDirectory, "launch-1672x941.png"),
    animations: "allow",
  });
  await page.keyboard.press("Escape");
  await expect(intro).not.toHaveClass(/is-visible/);
  await page.reload();
  await expect(intro).not.toHaveClass(/is-visible/);
  await page.getByRole("button", { name: /Launch 다시 보기/ }).click();
  await expect(intro).toHaveClass(/is-visible/);
  await page.keyboard.press("Enter");
  await expect(intro).not.toHaveClass(/is-visible/, { timeout: 1500 });
  await page.goto("/archive/");
  await expect(page.locator("[data-launch-intro]")).toHaveCount(0);
  await expect(page.locator(".post-card").first()).toBeVisible();
});

test("approved desktop, light and narrow compositions stay stable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const captures = [
    { name: "home-dark-1672x941", width: 1672, height: 941, theme: "dark", url: "/" },
    { name: "home-light-1536x1024", width: 1536, height: 1024, theme: "light", url: "/" },
    { name: "home-dark-390x844", width: 390, height: 844, theme: "dark", url: "/" },
    { name: "home-light-390x844", width: 390, height: 844, theme: "light", url: "/" },
    { name: "home-dark-320x760", width: 320, height: 760, theme: "dark", url: "/" },
    { name: "categories-dark-1672x941", width: 1672, height: 941, theme: "dark", url: "/categories/" },
    { name: "archive-dark-1672x941", width: 1672, height: 941, theme: "dark", url: "/archive/" },
    { name: "about-dark-390x844", width: 390, height: 844, theme: "dark", url: "/about/" },
  ];
  for (const capture of captures) {
    await page.setViewportSize({ width: capture.width, height: capture.height });
    await page.goto(capture.url);
    await page.evaluate((theme) => {
      localStorage.setItem("somani-theme", theme);
      document.documentElement.dataset.theme = theme;
    }, capture.theme);
    await page.reload();
    await reveal(page);
    await expectNoOverflow(page);
    if (capture.width === 1672 && capture.url === "/") {
      const width = await page.locator(".site-header").evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      expect(width).toBeGreaterThanOrEqual(190);
      expect(width).toBeLessThanOrEqual(230);
      await expect(page.locator(".bridge-grid > .station-panel")).toHaveCount(3);
    }
    if (capture.theme === "light")
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim(),
        ),
      ).toBe("#f6f3ff");
    await page.screenshot({
      path: path.join(reviewDirectory, capture.name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("research cards, archive controls, theme and reading tools work", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/categories/");
  const cards = page.locator(".topic-directory > li > a");
  await expect(cards).toHaveCount(6);
  await expect(cards).toContainText([
    "개발",
    "CTF/Wargame",
    "Bug Bounty",
    "블로그/기술문서",
    "논문/컨퍼런스",
    "공모전/자격증",
  ]);
  const before = await cards.first().evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await cards.first().hover();
  await expect
    .poll(() =>
      cards.first().evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(before);

  await page.goto("/archive/?category=CTF%2FWargame");
  await expect(page.locator("#category-filter")).toHaveValue("CTF/Wargame");
  const archiveCards = page.locator("#archive-results .post-card");
  expect(await archiveCards.count()).toBeGreaterThan(0);
  await page.getByRole("searchbox", { name: "게시글 검색" }).fill("SECTOR");
  expect(await archiveCards.count()).toBeGreaterThan(0);
  await page.locator("#tag-filter").selectOption("SECTOR");
  await expect(page).toHaveURL(/tag=SECTOR/);
  await page.getByRole("button", { name: "현재 최신순, 오래된순으로 전환" }).click();
  await expect(page).toHaveURL(/sort=oldest/);
  await page.goBack();
  await expect(page).not.toHaveURL(/sort=oldest/);

  await page.goto("/posts/github-pages-blog/");
  await page.getByRole("button", { name: "코드 복사" }).first().click();
  await expect(page.getByRole("button", { name: "복사 완료" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("git clone");
  await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("profile content, posts, URLs and six category routes remain intact", async ({
  page,
  request,
}) => {
  await page.goto("/about/");
  const image = page.locator(
    '.profile-card img[src="/assets/images/profile-hachiware-about.jpg"]',
  );
  await expect(image).toHaveAttribute(
    "alt",
    "컴퓨터 앞에 앉아 커피를 마시는 파란 귀의 하치와레 캐릭터",
  );
  await expect(page.locator(".about-content section").first()).toContainText(
    "시스템 해킹과 리버스 엔지니어링, CTF/Wargame도 여러 관심 분야 가운데 하나입니다.",
  );
  await expect(page.getByRole("link", { name: /amder1144@gmail.com/ })).toHaveAttribute(
    "href",
    "mailto:amder1144@gmail.com",
  );
  const search = await request.get("/search.json");
  const posts = await search.json();
  expect(posts).toHaveLength(22);
  expect(new Set(posts.map((post) => post.url)).size).toBe(22);
  for (const route of [
    "/categories/development/",
    "/categories/ctf-wargame/",
    "/categories/bug-bounty/",
    "/categories/blog-docs/",
    "/categories/papers-conferences/",
    "/categories/competitions-certifications/",
  ]) {
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("versioned icon, manifest and Open Graph metadata are unique and reachable", async ({
  page,
  request,
}) => {
  for (const url of ["/", "/posts/github-pages-blog/"]) {
    const response = await page.goto(url);
    expect(response.status()).toBe(200);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://somini26.github.io/assets/images/social-space-v20261125.png",
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      "https://somini26.github.io/assets/images/social-space-v20261125.png",
    );
    expect(await page.content()).not.toContain("/assets/images/social.png");
  }
  await page.goto("/posts/github-pages-blog/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "GitHub Pages 블로그 구축 기록",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://somini26.github.io/posts/github-pages-blog/",
  );
  await page.goto("/");
  const loadedSpaceImages = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => url.includes("/assets/images/space/")),
  );
  expect(loadedSpaceImages.some((url) => url.endsWith(".webp"))).toBeTruthy();
  expect(loadedSpaceImages.some((url) => url.endsWith(".png"))).toBeFalsy();
  for (const asset of [
    "/favicon.ico",
    "/assets/icons/planet-ring-v20261125.svg",
    "/assets/icons/planet-ring-16-v20261125.png",
    "/assets/icons/planet-ring-32-v20261125.png",
    "/assets/icons/planet-ring-180-v20261125.png",
    "/assets/images/social-space-v20261125.png",
    "/site-v20261125.webmanifest",
  ]) {
    const response = await request.get(asset);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  const manifest = await (await request.get("/site-v20261125.webmanifest")).json();
  expect(manifest.icons.map((icon) => icon.src)).toEqual([
    "/assets/icons/planet-ring-192-v20261125.png",
    "/assets/icons/planet-ring-512-v20261125.png",
  ]);
});

test("primary rooms remain accessible in both themes and reduced motion", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const theme of ["dark", "light"]) {
    await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("somani-theme", value), theme);
    for (const url of [
      "/",
      "/categories/",
      "/archive/",
      "/about/",
      "/posts/github-pages-blog/",
      "/404.html",
    ]) {
      await page.goto(url);
      await reveal(page);
      await expectNoOverflow(page);
      await expectAccessible(page);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?intro=1");
  await expect(page.locator("[data-launch-intro]")).toHaveClass(/is-visible/);
  const duration = await page.locator(".launch-ship").evaluate(
    (element) => getComputedStyle(element).animationDuration,
  );
  expect(parseFloat(duration)).toBeLessThan(0.1);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
