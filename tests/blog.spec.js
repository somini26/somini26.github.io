import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("navigation, six category pages, empty states and accessibility", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("somani.");
  await expect(
    page.locator(".interest-strip > span:not(.micro-label)"),
  ).toHaveText([
    "System Hacking",
    "Reverse Engineering",
    "CTF & Wargame",
    "Development",
  ]);
  await expect(page.locator(".project-card")).toHaveCount(1);
  await expect(page.locator(".project-card")).toContainText("somani's archive");
  await expect(
    page.locator('.project-card a[href="/posts/github-pages-blog/"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "라이트 모드로 전환" }),
  ).toContainText("Light");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "메뉴" }).click();
    await expect(
      page.getByRole("navigation", { name: "주 메뉴" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "메뉴" })).toBeFocused();
  }
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.goto("/about/");
  const profileImage = page.locator('.avatar img[src="/assets/images/profile-hachiware.jpg"]');
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
  await page.goto("/categories/");
  const cards = page.locator(".topic-card");
  await expect(cards).toHaveCount(6);
  for (const url of await cards.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("href")),
  )) {
    await page.goto(url);
    await expect(page.locator("h1")).toBeVisible();
    if (!url.includes("blog-docs"))
      await expect(page.locator(".empty-state")).toContainText(
        "아직 기록이 없습니다",
      );
  }
  expect(errors).toEqual([]);
});
test("search, tags, URL restoration and safe search input", async ({
  page,
}) => {
  await page.goto("/archive/");
  await expect(page.locator("#tag-filter option")).toContainText([
    "전체 태그",
    "#Eleventy",
    "#GitHub",
    "#GitHub Actions",
    "#Markdown",
  ]);
  await page.getByRole("searchbox").fill("정적");
  await expect(page.locator("#archive-results .post-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("없는검색어");
  await expect(page.locator("#archive-results")).toContainText(
    "검색 결과가 없습니다",
  );
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await page.locator("#tag-filter").selectOption("Eleventy");
  await expect(page).toHaveURL(/tag=Eleventy/);
  await page.reload();
  await expect(page.locator("#tag-filter")).toHaveValue("Eleventy");
  await expect(page.locator("#archive-results .post-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("<img src=x onerror=alert(1)>");
  await expect(page.locator("#archive-results img")).toHaveCount(0);
  await page.goto("/archive/?tag=Unknown");
  await expect(page.locator("#archive-results")).toContainText(
    "검색 결과가 없습니다",
  );
});
test("post, TOC, code copy, theme persistence, overflow and accessibility", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/posts/github-pages-blog/");
  await expect(page.locator(".prose .token").first()).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "게시글 목차" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "게시글 목차" })
    .getByRole("link", { name: "Markdown으로 게시글 작성" })
    .click();
  await expect(page).toHaveURL(/#markdown/);
  await expect(
    page.getByRole("heading", { name: "Markdown으로 게시글 작성" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".reading-progress")
        .evaluate((node) => parseFloat(node.style.width)),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "코드 복사" }).first().click();
  await expect(page.getByRole("button", { name: "복사 완료" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "title:",
  );
  await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "다크 모드로 전환" }),
  ).toContainText("Dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "다크 모드로 전환" }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  for (const url of [
    "/",
    "/archive/",
    "/categories/",
    "/about/",
    "/posts/github-pages-blog/",
    "/404.html",
  ]) {
    await page.goto(url);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${url === "/" ? "home" : url.split("/").filter(Boolean)[0]}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});
test("static navigation works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8080/");
  await expect(page.getByRole("navigation", { name: "주 메뉴" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "Archive", exact: true })
    .click();
  await page.locator(".post-card h3 a").click();
  await expect(page.locator(".prose")).toContainText(
    "GitHub Pages를 선택한 이유",
  );
  await context.close();
});

test("all primary pages remain accessible in both themes and narrow layouts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const theme of ["dark", "light"]) {
    await page.goto("/");
    await page.evaluate((theme) => {
      localStorage.setItem("somani-theme", theme);
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const url of [
      "/",
      "/archive/",
      "/categories/",
      "/about/",
      "/404.html",
    ]) {
      await page.goto(url);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  }
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [
      "/",
      "/archive/",
      "/categories/",
      "/about/",
      "/posts/github-pages-blog/",
    ]) {
      await page.goto(url);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
});
