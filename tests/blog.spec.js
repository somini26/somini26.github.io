import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const waitForReveals = async (page) => {
  const reveals = page.locator("[data-reveal]");
  if (!(await reveals.count())) return;
  for (let index = 0; index < (await reveals.count()); index += 1)
    await reveals.nth(index).scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-reveal]")].every(
      (element) => getComputedStyle(element).opacity === "1",
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
};

test("navigation, six category pages, empty states and accessibility", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("안녕하세요");
  await expect(page.locator("h1")).toContainText("somani");
  await expect(page.locator(".hero-description")).toContainText(
    "다양한 분야에 호기심을 가지고 공부하며, 새롭게 배운 내용과 직접 경험한 것들을 기록하는 공간입니다.",
  );
  await expect(page.locator("[data-category-trigger]")).toHaveCount(6);
  await expect(page.locator(".project-note")).toContainText("다른 최근 기록");
  await expect(
    page.locator(
      '.portrait-frame img[src="/assets/images/profile-hachiware.jpg"]',
    ),
  ).toHaveAttribute("alt", "파란 귀를 가진 하치와레 캐릭터");
  await expect(
    page.locator(
      '.project-note[href="/posts/retrospective-2026/"]',
    ),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "라이트 모드로 전환" }),
  ).toContainText("Light");
  if (testInfo.project.name === "mobile") {
    const mobileNavigation = page.getByRole("navigation", {
      name: "모바일 주 메뉴",
    });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole("link")).toHaveCount(4);
  }
  await waitForReveals(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.goto("/about/");
  const profileImage = page.locator(
    '.avatar img[src="/assets/images/profile-hachiware-about.jpg"]',
  );
  await expect(profileImage).toHaveAttribute(
    "alt",
    "컴퓨터 앞에 앉아 커피를 마시는 파란 귀의 하치와레 캐릭터",
  );
  await expect
    .poll(() =>
      profileImage.evaluate(
        (image) =>
          image.complete &&
          image.naturalWidth === 736 &&
          image.naturalHeight === 736,
      ),
    )
    .toBeTruthy();
  await page.goto("/categories/");
  const cards = page.locator(".topic-directory > li > a");
  await expect(cards).toHaveCount(6);
  for (const url of await cards.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("href")),
  )) {
    await page.goto(url);
    await expect(page.locator("h1")).toBeVisible();
    if (await page.locator(".empty-state").count())
      await expect(page.locator(".empty-state")).toContainText(
        "아직 공개된 기록이 없습니다",
      );
    else await expect(page.locator(".post-card").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("search, tags, URL restoration and safe search input", async ({
  page,
}) => {
  await page.goto("/archive/");
  for (const tag of ["전체 태그", "#Eleventy", "#GitHub", "#CTF", "#SECTOR"])
    await expect(page.locator("#tag-filter")).toContainText(tag);
  await page.getByRole("searchbox").fill("GitHub Pages 블로그 구축 기록");
  await expect(page.locator("#archive-results .post-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("없는검색어");
  await expect(page.locator("#archive-results")).toContainText(
    "조건에 맞는 기록이 없습니다",
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
    "조건에 맞는 기록이 없습니다",
  );
});
test("record order sorting preserves filters and URL state", async ({ page }) => {
  await page.goto("/archive/?tag=SECTOR");
  const numbers = page.locator("#archive-results .post-meta span:first-child");
  await expect(numbers.first()).toHaveText("No. 006");
  await page.getByRole("button", { name: "현재 최신순, 오래된순으로 전환" }).click();
  await expect(page).toHaveURL(/tag=SECTOR/);
  await expect(page).toHaveURL(/sort=oldest/);
  await expect(page.locator("#tag-filter")).toHaveValue("SECTOR");
  await expect(numbers.first()).toHaveText("No. 002");
  await page.goBack();
  await expect(numbers.first()).toHaveText("No. 006");
  await page.goForward();
  await expect(numbers.first()).toHaveText("No. 002");
  await page.reload();
  await expect(page.getByRole("button", { name: "현재 오래된순, 최신순으로 전환" })).toBeVisible();
  await expect(numbers.first()).toHaveText("No. 002");
  await page.getByRole("button", { name: "현재 오래된순, 최신순으로 전환" }).press("Enter");
  await expect(numbers.first()).toHaveText("No. 006");
  await expect(page).not.toHaveURL(/sort=oldest/);
});

test("gapped fixture keeps record numbers while reversing the list", async ({ page }) => {
  const fixture = [3, 8, 12].map((recordOrder) => ({
    title: `기록 ${recordOrder}`,
    description: "격리된 정렬 검사",
    url: `/fixture/${recordOrder}/`,
    date: "2026-01-01",
    recordOrder,
    categories: ["개발"],
    tags: ["fixture"],
    readingTime: 1,
    categoryLinks: [{ name: "개발", slug: "development" }],
    text: "fixture",
  }));
  await page.route("**/search.json", (route) => route.fulfill({ json: fixture }));
  await page.goto("/archive/?sort=oldest");
  await expect(page.locator("#archive-results .post-meta span:first-child")).toHaveText([
    "No. 003", "No. 008", "No. 012",
  ]);
  await page.getByRole("button", { name: "현재 오래된순, 최신순으로 전환" }).click();
  await expect(page.locator("#archive-results .post-meta span:first-child")).toHaveText([
    "No. 012", "No. 008", "No. 003",
  ]);
});
test("post, TOC, code copy, theme persistence, overflow and accessibility", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/posts/github-pages-blog/");
  await expect(page.locator(".article-prose .token").first()).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "게시글 목차" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "글 탐색" })).toContainText(
    "현재 글 · 001",
  );
  await page
    .getByRole("navigation", { name: "게시글 목차" })
    .getByRole("link", { name: "Markdown 글이 공개되기까지" })
    .click();
  await expect(page).toHaveURL(/#5-markdown-/);
  await expect(
    page.getByRole("heading", { name: "Markdown 글이 공개되기까지" }),
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
    "git clone",
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
    await page.waitForTimeout(250);
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
    "/posts/sector-2026-overview/",
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
test("static navigation works without JavaScript", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8080/");
  const navigation = page.getByRole("navigation", {
    name: testInfo.project.name === "mobile" ? "모바일 주 메뉴" : "주 메뉴",
  });
  await expect(navigation).toBeVisible();
  await navigation
    .getByRole("link", { name: "Archive", exact: true })
    .click();
  await page.locator('.post-card h3 a[href="/posts/github-pages-blog/"]').click();
  await expect(page.locator(".article-prose")).toContainText(
    "블로그를 만든 이유",
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
      "/posts/joint-ctf-overview/",
      "/posts/apeows/",
      "/404.html",
    ]) {
      await page.goto(url);
      await waitForReveals(page);
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
      "/posts/bomblab-gdb-binary-patch/",
      "/posts/apeows/",
      "/posts/zigzag/",
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
