import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const reviewDirectory = path.resolve("test-results/design-review");
fs.mkdirSync(reviewDirectory, { recursive: true });

const expectedCategories = [
  "개발",
  "CTF/Wargame",
  "Bug Bounty",
  "블로그/기술문서",
  "논문/컨퍼런스",
  "공모전/자격증",
];
const expectedInterests = ["CTF", "Security", "AI", "Development"];
const forbiddenPhrases = [
  "LEARNING LOG · ULSAN 2026",
  "A CURIOUS LEARNING ARCHIVE",
  "somani's living archive.",
  "Working set.",
  "Choose a field note.",
];

const expectNoOverflow = async (page) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
};

const revealPage = async (page) => {
  const elements = page.locator("[data-reveal]");
  for (let index = 0; index < (await elements.count()); index += 1)
    await elements.nth(index).scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-reveal]")].every(
      (element) => getComputedStyle(element).opacity === "1",
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
};

const expectAccessible = async (page) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
};

const collectErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
};

test("identity, direct navigation and personal cluster remain immediately visible", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await revealPage(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "안녕하세요",
  );
  await expect(page.locator(".hero-description")).toHaveText(
    "다양한 분야에 호기심을 가지고 공부하며, 새롭게 배운 내용과 직접 경험한 것들을 기록하는 공간입니다.",
  );
  expect(await page.locator(".interest-keywords li").allTextContents()).toEqual(
    expectedInterests,
  );
  for (const phrase of forbiddenPhrases)
    await expect(page.locator("body")).not.toContainText(phrase);

  await expect(page.locator(".profile-orbit")).toBeVisible();
  await expect(page.locator(".latest-note")).toBeVisible();
  await expect(page.locator(".project-note")).toBeVisible();
  await expect(page.locator(".project-note")).toContainText("somani's archive");
  const profileImage = page.locator(
    '.portrait-frame img[src="/assets/images/profile-hachiware.jpg"]',
  );
  await expect(profileImage).toHaveAttribute(
    "alt",
    "파란 귀를 가진 하치와레 캐릭터",
  );
  await expect
    .poll(() =>
      profileImage.evaluate(
        (image) => image.complete && image.naturalWidth === 736,
      ),
    )
    .toBeTruthy();

  if (testInfo.project.name === "mobile") {
    const dock = page.getByRole("navigation", { name: "모바일 주 메뉴" });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("link")).toHaveCount(4);
    await expect(page.locator(".desktop-nav")).not.toBeVisible();
  } else {
    await expect(page.locator(".desktop-nav")).toBeVisible();
    await expect(page.locator(".desktop-nav a")).toHaveCount(4);
    await expect(page.locator(".mobile-dock")).not.toBeVisible();
  }

  await expectNoOverflow(page);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("archive switchboard visibly follows hover and keyboard focus", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await revealPage(page);
  const categories = page.locator("[data-category-trigger]");
  await expect(categories).toHaveCount(6);
  expect(await categories.locator(".switch-title strong").allTextContents()).toEqual(
    expectedCategories,
  );

  if ((await page.viewportSize()).width > 820) {
    const node = page.locator(".signal-node");
    const before = await node.evaluate((element) => element.offsetTop);
    await page.locator("#archive-map").screenshot({
      path: path.join(reviewDirectory, "switchboard-before.png"),
      animations: "disabled",
    });
    await categories.nth(3).hover();
    await expect(page.locator("#category-preview-4")).toBeVisible();
    await expect(page.locator("[data-selected-topic]")).toHaveText(
      "블로그/기술문서",
    );
    await expect(page.locator("#category-preview-4")).toContainText(
      "GitHub Pages 블로그 구축 기록",
    );
    await expect
      .poll(() => node.evaluate((element) => element.offsetTop))
      .toBeGreaterThan(before + 150);
    await page.locator("#archive-map").screenshot({
      path: path.join(reviewDirectory, "switchboard-after.png"),
      animations: "disabled",
    });
  } else {
    await expect(categories.nth(3).locator(".switch-mobile-note")).toContainText(
      "GitHub Pages 블로그 구축 기록",
    );
    await expect(page.locator(".category-stage")).not.toBeVisible();
  }

  await categories.first().focus();
  await categories.first().press("ArrowDown");
  await expect(categories.nth(1)).toBeFocused();
  await categories.nth(1).press("End");
  await expect(categories.last()).toBeFocused();
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test("profile detail has a visible but restrained hover response", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Hover is desktop-only");
  await page.goto("/");
  const profile = page.locator(".profile-orbit");
  const image = profile.locator("img");
  const initialTransform = await image.evaluate(
    (node) => getComputedStyle(node).transform,
  );
  await profile.screenshot({
    path: path.join(reviewDirectory, "hachiware-before.png"),
    animations: "disabled",
  });
  await profile.hover();
  await expect
    .poll(() => image.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(initialTransform);
  await profile.screenshot({
    path: path.join(reviewDirectory, "hachiware-after.png"),
  });
});

test("themes and required viewport captures stay visually stable", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const viewports = [
    { name: "desktop-1440", width: 1440, height: 1000 },
    { name: "laptop-1280", width: 1280, height: 900 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "mobile-320", width: 320, height: 760 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("somani-theme", "dark"));
    await page.reload();
    await revealPage(page);
    await expectNoOverflow(page);
    await page.screenshot({
      path: path.join(reviewDirectory, `${viewport.name}-home-dark.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await revealPage(page);
  await expectAccessible(page);
  await page.screenshot({
    path: path.join(reviewDirectory, "desktop-1440-home-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("about, archive, categories and article preserve content and usability", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = collectErrors(page);
  const pages = [
    ["about", "/about/"],
    ["archive", "/archive/"],
    ["categories", "/categories/"],
    ["category", "/categories/blog-docs/"],
  ];
  for (const [name, url] of pages) {
    await page.goto(url);
    await expectNoOverflow(page);
    await expectAccessible(page);
    await page.screenshot({
      path: path.join(reviewDirectory, `${testInfo.project.name}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await expect(page.locator(".post-card")).toContainText(
    "GitHub Pages 블로그 구축 기록",
  );

  await page.goto("/posts/github-pages-blog/");
  await expect(page.locator("[data-article-prose]")).toContainText(
    "Everything up-to-date",
  );
  await expect(page.locator("[data-article-prose]")).toContainText(
    "GH007 이메일 공개 방지 오류",
  );
  await expect(
    page.getByRole("navigation", { name: "게시글 목차" }).getByRole("link"),
  ).toHaveCount(22);
  await expect(page.locator(".article-prose table")).toHaveCount(2);
  await page
    .getByRole("button", { name: "1번째 코드 복사", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "복사 완료" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "git clone",
  );
  await expectNoOverflow(page);
  await expectAccessible(page);
  await page.screenshot({
    path: path.join(reviewDirectory, `${testInfo.project.name}-article.png`),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/posts/github-pages-blog/");
  await expectNoOverflow(page);
  await expect(page.locator(".mobile-dock")).toBeVisible();
  await page.screenshot({
    path: path.join(reviewDirectory, "mobile-390-article.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
