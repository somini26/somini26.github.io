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

test("home identity, equal category index and workspace are usable", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await revealPage(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "안녕하세요",
  );
  await expect(page.locator(".intro-copy")).toContainText(
    "다양한 분야에 호기심을 가지고 공부하며, 새롭게 배운 내용과 직접 경험한 것들을 기록하는 공간입니다.",
  );
  await expect(page.locator(".intro-copy")).not.toContainText("중심으로");

  const categoryLinks = page.locator("[data-category-trigger]");
  await expect(categoryLinks).toHaveCount(6);
  expect(
    await categoryLinks.locator(".category-title strong").allTextContents(),
  ).toEqual(expectedCategories);
  for (const href of await categoryLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  ))
    expect(href).toMatch(/^\/categories\/[a-z-]+\/$/);

  const blogCategory = categoryLinks.nth(3);
  await blogCategory.focus();
  if ((await page.viewportSize()).width <= 820) {
    await expect(blogCategory.locator(".category-mobile-detail")).toContainText(
      "GitHub Pages 블로그 구축 기록",
    );
  } else {
    await expect(page.locator("#category-preview-4")).toBeVisible();
    await expect(page.locator("#category-preview-4")).toContainText(
      "GitHub Pages 블로그 구축 기록",
    );
  }
  await blogCategory.press("ArrowDown");
  await expect(categoryLinks.nth(4)).toBeFocused();
  if ((await page.viewportSize()).width > 820) {
    await expect(page.locator("#category-preview-5")).toBeVisible();
    await expect(page.locator("#category-preview-5")).toContainText(
      "첫 기록을 준비하고 있습니다.",
    );
  }

  const profileImage = page.locator(
    '.profile-image-wrap img[src="/assets/images/profile-hachiware.jpg"]',
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

  const profileTab = page.getByRole("tab", { name: "Profile" });
  const latestTab = page.getByRole("tab", { name: "Latest" });
  const projectTab = page.getByRole("tab", { name: "Project" });
  await expect(profileTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".workspace-panel.is-active")).toHaveCount(1);
  await profileTab.focus();
  await profileTab.press("ArrowRight");
  await expect(latestTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#latest-panel")).toHaveClass(/is-active/);
  await projectTab.click();
  await expect(page.locator("#project-panel")).toHaveClass(/is-active/);
  await expect(page.locator("#project-panel")).toContainText("somani's archive");

  await expectNoOverflow(page);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("themes persist and responsive review captures stay clean", async ({
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
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectNoOverflow(page);
    await expect(page.locator(".workspace-panel.is-active")).toHaveCount(1);
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

  for (const tabName of ["Profile", "Latest", "Project"]) {
    await page.getByRole("tab", { name: tabName }).click();
    await page.screenshot({
      path: path.join(reviewDirectory, `workspace-${tabName.toLowerCase()}.png`),
      fullPage: false,
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});

test("about, archive, category and article share the design language", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("somani-theme", "dark"));

  const pages = [
    ["about", "/about/"],
    ["archive", "/archive/"],
    ["category", "/categories/blog-docs/"],
  ];
  for (const [name, url] of pages) {
    await page.goto(url);
    await expectNoOverflow(page);
    await expectAccessible(page);
    await page.screenshot({
      path: path.join(reviewDirectory, `desktop-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  await page.goto("/posts/github-pages-blog/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "GitHub Pages 블로그 구축 기록",
    }),
  ).toBeVisible();
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
  await expect(page.locator(".table-scroll").first()).toHaveAttribute(
    "tabindex",
    "0",
  );
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
    path: path.join(reviewDirectory, "desktop-article-top.png"),
    fullPage: false,
    animations: "disabled",
  });
  await page.screenshot({
    path: path.join(reviewDirectory, "desktop-article.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/posts/github-pages-blog/");
  await expectNoOverflow(page);
  expect(
    await page.locator(".article-prose pre").evaluateAll((blocks) =>
      blocks.some((block) => block.scrollWidth > block.clientWidth),
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: path.join(reviewDirectory, "mobile-390-article-top.png"),
    fullPage: false,
    animations: "disabled",
  });
  await page.screenshot({
    path: path.join(reviewDirectory, "mobile-390-article.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
