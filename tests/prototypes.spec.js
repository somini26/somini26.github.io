import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const previewDirectory = path.resolve("design-previews");
fs.mkdirSync(previewDirectory, { recursive: true });

const variants = [
  {
    key: "a",
    url: "/prototypes/editorial-workspace/",
    article: "/prototypes/editorial-workspace/github-pages-blog/",
    title: "somani.",
    categories: ".editorial-index > li",
  },
  {
    key: "b",
    url: "/prototypes/creative-desktop/",
    article: "/prototypes/creative-desktop/github-pages-blog/",
    title: "archive.",
    categories: ".b-index > li",
  },
];

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

for (const variant of variants) {
  test(`prototype ${variant.key.toUpperCase()} theme, data and interaction`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto(variant.url);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      variant.title,
    );
    await expect(page.locator(variant.categories)).toHaveCount(6);
    const categoryLinks = page.locator(`${variant.categories} a`);
    for (const href of await categoryLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    )) {
      expect(href).toMatch(/^\/categories\/[a-z-]+\/$/);
    }

    const profile = page.locator(
      'img[src="/assets/images/profile-hachiware.jpg"]',
    );
    await expect(profile.first()).toHaveAttribute(
      "alt",
      "파란 귀를 가진 하치와레 캐릭터",
    );
    await expect
      .poll(() =>
        profile
          .first()
          .evaluate((image) => image.complete && image.naturalWidth === 736),
      )
      .toBeTruthy();
    await expectNoOverflow(page);
    await revealWholePage(page);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.screenshot({
      path: path.join(
        previewDirectory,
        `prototype-${variant.key}-${testInfo.project.name}-dark.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      page.getByRole("button", { name: "다크 모드로 전환" }),
    ).toContainText("Dark");
    await revealWholePage(page);
    await page.screenshot({
      path: path.join(
        previewDirectory,
        `prototype-${variant.key}-${testInfo.project.name}-light.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "다크 모드로 전환" }).click();
    if (variant.key === "a") {
      const projectTab = page.getByRole("tab", { name: "Project" });
      await projectTab.click();
      await expect(projectTab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#a-project-panel")).toHaveClass(/is-active/);
      await page.getByRole("tab", { name: "Project" }).press("ArrowLeft");
      await expect(
        page.getByRole("tab", { name: "Latest note" }),
      ).toHaveAttribute("aria-selected", "true");
      await projectTab.click();
    } else {
      const projectButton = page.getByRole("button", { name: "03 Project" });
      await projectButton.click();
      await expect(projectButton).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#b-project-window")).toHaveClass(/is-active/);
    }
    await page.screenshot({
      path: path.join(
        previewDirectory,
        `prototype-${variant.key}-${testInfo.project.name}-interaction.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  });

  test(`prototype ${variant.key.toUpperCase()} long-form article`, async ({
    page,
    context,
  }, testInfo) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(variant.article);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "GitHub Pages 블로그 구축 기록",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "프로토타입 게시글 목차" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "프로토타입 게시글 목차" })
        .getByRole("link"),
    ).toHaveCount(22);
    await expect(page.locator(".prototype-prose table")).toHaveCount(2);
    await expect(
      page.locator(
        '.prototype-prose img[src="/assets/images/archive-flow.svg"]',
      ),
    ).toHaveAttribute("alt", /Markdown 콘텐츠/);
    await page.screenshot({
      path: path.join(
        previewDirectory,
        `prototype-${variant.key}-article-${testInfo.project.name}-top.png`,
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
    await expectNoOverflow(page);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: path.join(
        previewDirectory,
        `prototype-${variant.key}-article-${testInfo.project.name}.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  });
}
