import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const previewDirectory = path.resolve("test-results/integrated-archive");
fs.mkdirSync(previewDirectory, { recursive: true });

const mainUrl = "/";
const articleUrl = "/posts/github-pages-blog/";

const expectNoOverflow = async (page) => {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
};

const revealWholePage = async (page) => {
  const sections = page.locator("[data-reveal]");
  for (let index = 0; index < (await sections.count()); index += 1)
    await sections.nth(index).scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-reveal]")].every(
      (element) => getComputedStyle(element).opacity === "1",
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
};

test("integrated archive index, workspace, themes and mobile header", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(mainUrl);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("somani");
  await expect(page.locator("[data-category-trigger]")).toHaveCount(6);
  for (const href of await page
    .locator("[data-category-trigger]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
    expect(href).toMatch(/^\/categories\/[a-z-]+\/$/);
  }

  const profile = page.locator(
    '.c-profile-body img[src="/assets/images/profile-hachiware.jpg"]',
  );
  await expect(profile).toHaveAttribute(
    "alt",
    "파란 귀를 가진 하치와레 캐릭터",
  );
  await expect
    .poll(() =>
      profile.evaluate(
        (image) => image.complete && image.naturalWidth === 736,
      ),
    )
    .toBeTruthy();
  expect((await profile.boundingBox()).width).toBeGreaterThanOrEqual(
    testInfo.project.name === "mobile" ? 110 : 130,
  );

  await revealWholePage(page);
  await expectNoOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-${testInfo.project.name}-dark.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });

  const blogCategory = page.locator(
    '[data-category-trigger][href="/categories/blog-docs/"]',
  );
  await blogCategory.focus();
  if (testInfo.project.name === "mobile") {
    await expect(page.locator("#c-category-4")).not.toHaveAttribute("hidden");
    await expect(
      blogCategory.locator(".c-mobile-category-summary"),
    ).toContainText("1개 기록");
    await expect(
      blogCategory.locator(".c-mobile-category-summary"),
    ).toContainText("GitHub Pages 블로그 구축 기록");
  } else {
    await expect(page.locator("#c-category-4")).toBeVisible();
  }
  await expect(page.locator("#c-category-4")).toContainText("1 NOTE");
  await expect(
    page.locator('#c-category-4 a[href="/posts/github-pages-blog/"]'),
  ).toContainText("GitHub Pages 블로그 구축 기록");
  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-${testInfo.project.name}-category-preview.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });

  const firstCategory = page.locator("[data-category-trigger]").first();
  await firstCategory.focus();
  await firstCategory.press("ArrowDown");
  await expect(page.locator("[data-category-trigger]").nth(1)).toBeFocused();
  if (testInfo.project.name === "mobile")
    await expect(page.locator("#c-category-2")).not.toHaveAttribute("hidden");
  else await expect(page.locator("#c-category-2")).toBeVisible();

  const profileTab = page.getByRole("tab", { name: "01 Profile" });
  const latestTab = page.getByRole("tab", { name: "02 Latest" });
  const projectTab = page.getByRole("tab", { name: "03 Project" });
  await expect(profileTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".c-window.is-active")).toHaveCount(1);
  await expect(page.locator(".c-note-body")).toHaveCSS("visibility", "hidden");
  await profileTab.focus();
  await profileTab.press("ArrowRight");
  await expect(latestTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#c-note-window")).toHaveClass(/is-active/);
  await expect(page.locator(".c-profile-body")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-${testInfo.project.name}-window-latest.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });
  await projectTab.click();
  await expect(projectTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#c-project-window")).toHaveClass(/is-active/);
  if (testInfo.project.name === "mobile")
    await expect(page.locator(".c-window:visible")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-${testInfo.project.name}-window-project.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });

  if (testInfo.project.name === "mobile") {
    const header = page.locator(".prototype-header");
    const main = page.locator(".c-hero");
    const headerBox = await header.boundingBox();
    const mainBox = await main.boundingBox();
    expect(mainBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    await page.locator(".c-workspace").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    await expect
      .poll(() =>
        page.evaluate(() =>
          document
            .elementFromPoint(innerWidth / 2, 10)
            ?.closest(".prototype-header")
            ? true
            : false,
        ),
      )
      .toBeTruthy();
    await page.screenshot({
      path: path.join(previewDirectory, "integrated-archive-mobile-scroll.png"),
      fullPage: false,
      animations: "disabled",
    });
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await revealWholePage(page);
  const lightAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(lightAccessibility.violations).toEqual([]);
  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-${testInfo.project.name}-light.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });

  if (testInfo.project.name === "desktop") {
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(mainUrl);
      await expectNoOverflow(page);
      await expect(page.locator(".c-window:visible")).toHaveCount(1);
      await page.goto(articleUrl);
      await expectNoOverflow(page);
      await expect(page.locator(".prototype-table-scroll").first()).toHaveAttribute(
        "tabindex",
        "0",
      );
    }
  }
  expect(errors).toEqual([]);
});

test("integrated archive article preserves content and readability", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(articleUrl);
  const title = page.getByRole("heading", {
    level: 1,
    name: "GitHub Pages 블로그 구축 기록",
  });
  await expect(title).toBeVisible();
  await expect(page.locator("[data-prototype-prose]")).toContainText(
    "Everything up-to-date",
  );
  await expect(page.locator("[data-prototype-prose]")).toContainText(
    "GH007 이메일 공개 방지 오류",
  );
  await expect(
    page.getByRole("navigation", { name: "게시글 목차" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "게시글 목차" })
      .getByRole("link"),
  ).toHaveCount(22);
  await expect(page.locator(".prototype-prose table")).toHaveCount(2);
  await expectNoOverflow(page);

  if (testInfo.project.name === "mobile") {
    const titleBox = await title.boundingBox();
    const headerBox = await page.locator(".prototype-article-header").boundingBox();
    expect(titleBox.y).toBeGreaterThan(headerBox.y + 195);
  }

  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-article-${testInfo.project.name}-top.png`,
    ),
    fullPage: false,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "1번째 코드 복사", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "복사 완료" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "git clone",
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  if (testInfo.project.name === "mobile") {
    expect(
      await page
        .locator(".prototype-prose pre")
        .evaluateAll((blocks) =>
          blocks.some((block) => block.scrollWidth > block.clientWidth),
        ),
    ).toBeTruthy();
  }
  await page.screenshot({
    path: path.join(
      previewDirectory,
      `integrated-archive-article-${testInfo.project.name}.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
