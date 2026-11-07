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

const expectClusterTextClear = async (page) => {
  const overlaps = await page.evaluate(() => {
    const pairs = [
      [".hero-copy", ".portrait-frame"],
      [".hero-copy", ".profile-orbit-copy"],
      [".hero-copy", ".latest-note"],
      [".hero-copy", ".project-note"],
      [".hero-actions", ".portrait-frame"],
      [".hero-actions", ".latest-note"],
      [".hero-actions", ".project-note"],
      [".portrait-frame", ".latest-note"],
      [".portrait-frame", ".project-note"],
      [".profile-orbit-copy", ".latest-note"],
      [".profile-orbit-copy", ".project-note"],
      [".latest-note", ".project-note"],
    ];
    const intersects = (a, b) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const contentIntersections = pairs.filter(([first, second]) =>
      intersects(
        document.querySelector(first).getBoundingClientRect(),
        document.querySelector(second).getBoundingClientRect(),
      ),
    );
    const latestRectangle = document.querySelector(".latest-note").getBoundingClientRect();
    const projectRectangle = document.querySelector(".project-note").getBoundingClientRect();
    const dock = document.querySelector(".mobile-dock");
    const dockRectangle = dock?.getBoundingClientRect();
    const bodyPaddingBottom = Number.parseFloat(getComputedStyle(document.body).paddingBottom);
    return {
      contentIntersections,
      latestDock:
        getComputedStyle(dock).display !== "none" &&
        intersects(latestRectangle, dockRectangle),
      projectDock:
        getComputedStyle(dock).display !== "none" &&
        intersects(projectRectangle, dockRectangle),
      dockSafeSpace:
        getComputedStyle(dock).display === "none" ||
        bodyPaddingBottom >= dockRectangle.height,
    };
  });
  expect(overlaps).toEqual({
    contentIntersections: [],
    latestDock: false,
    projectDock: false,
    dockSafeSpace: true,
  });
};

const expectClusterProportions = async (page) => {
  const metrics = await page.evaluate(() => {
    const cluster = document.querySelector(".home-hero");
    const portrait = document.querySelector(".portrait-frame");
    const orbitField = document.querySelector(".profile-space-orbits");
    const outerOrbit = getComputedStyle(orbitField, "::before");
    const innerOrbit = getComputedStyle(orbitField, "::after");
    return {
      viewportWidth: window.innerWidth,
      clusterWidth: cluster.getBoundingClientRect().width,
      portraitWidth: portrait.getBoundingClientRect().width,
      outerWidth: Number.parseFloat(outerOrbit.width),
      innerWidth: Number.parseFloat(innerOrbit.width),
    };
  });
  if (metrics.viewportWidth > 620) {
    expect(metrics.portraitWidth).toBe(198);
    expect(metrics.outerWidth / metrics.clusterWidth).toBeLessThan(0.55);
    expect(metrics.innerWidth).toBeLessThan(metrics.outerWidth);
  }
};

const expectApprovedTopLayout = async (page) => {
  const layout = await page.evaluate(() => {
    const box = (selector) =>
      document.querySelector(selector).getBoundingClientRect().toJSON();
    const latest = document.querySelector(".latest-note");
    const project = document.querySelector(".project-note");
    return {
      viewportWidth: innerWidth,
      hero: box(".hero-copy"),
      profile: box(".profile-orbit"),
      latest: box(".latest-note"),
      project: box(".project-note"),
      latestBackSheet: getComputedStyle(latest, "::before").content,
      latestFolderTab: getComputedStyle(latest, "::after").content,
      projectBackSheet: getComputedStyle(project, "::before").content,
      fontLoaded: [...document.fonts].some(
        (font) => font.family === "Wanted Sans" && font.status === "loaded",
      ),
    };
  });
  expect(layout.latestBackSheet).not.toBe("none");
  expect(layout.latestFolderTab).not.toBe("none");
  expect(layout.projectBackSheet).not.toBe("none");
  expect(layout.fontLoaded).toBeTruthy();
  if (layout.viewportWidth > 820) {
    if (layout.viewportWidth > 1024) {
      expect(layout.latest.left).toBeLessThan(layout.profile.left);
      expect(layout.latest.top).toBeGreaterThanOrEqual(layout.hero.bottom + 20);
      expect(layout.project.left).toBeGreaterThan(layout.profile.left);
      expect(layout.project.top).toBeLessThan(layout.latest.top - 100);
    } else {
      expect(layout.profile.top).toBeLessThan(layout.latest.top);
      expect(Math.abs(layout.latest.top - layout.project.top)).toBeLessThan(2);
    }
  } else if (layout.viewportWidth <= 620) {
    expect(layout.profile.top).toBeLessThan(layout.latest.top);
    expect(layout.latest.top).toBeLessThan(layout.project.top);
  } else {
    expect(layout.profile.top).toBeLessThan(layout.latest.top);
    expect(Math.abs(layout.latest.top - layout.project.top)).toBeLessThan(2);
  }
};

const expectClusterVisualSafety = async (page) => {
  const metrics = await page.evaluate(() => {
    const hero = document.querySelector(".home-hero").getBoundingClientRect();
    const cluster = document.querySelector(".home-hero");
    const clusterBox = cluster.getBoundingClientRect();
    const portrait = document.querySelector(".portrait-frame").getBoundingClientRect();
    const latest = document.querySelector(".latest-note");
    const project = document.querySelector(".project-note");
    const latestBox = latest.getBoundingClientRect();
    const projectBox = project.getBoundingClientRect();
    const svg = document.querySelector("[data-cluster-links]");
    const svgBox = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const point = (selector) => {
      const node = document.querySelector(selector);
      return {
        x:
          svgBox.left +
          Number(node.getAttribute("cx")) * (svgBox.width / viewBox.width),
        y:
          svgBox.top +
          Number(node.getAttribute("cy")) * (svgBox.height / viewBox.height),
      };
    };
    const pseudo = (node, selector) => {
      const style = getComputedStyle(node, selector);
      return {
        content: style.content,
        top: Number.parseFloat(style.top),
        height: Number.parseFloat(style.height),
        width: Number.parseFloat(style.width),
        border: Number.parseFloat(style.borderTopWidth),
      };
    };
    return {
      viewportWidth: innerWidth,
      hero: hero.toJSON(),
      cluster: clusterBox.toJSON(),
      portrait: portrait.toJSON(),
      latest: latestBox.toJSON(),
      project: projectBox.toJSON(),
      latestSheet: pseudo(latest, "::before"),
      latestTab: pseudo(latest, "::after"),
      projectSheet: pseudo(project, "::before"),
      projectTab: pseudo(project, "::after"),
      connections: {
        projectStart: point('[data-link-start="project"]'),
        projectEnd: point('[data-link-end="project"]'),
        latestStart: point('[data-link-start="latest"]'),
        latestEnd: point('[data-link-end="latest"]'),
      },
    };
  });

  for (const decoration of [
    metrics.latestSheet,
    metrics.latestTab,
    metrics.projectSheet,
    metrics.projectTab,
  ]) {
    expect(decoration.content).not.toBe("none");
    expect(decoration.border).toBeLessThanOrEqual(1);
  }
  expect(metrics.latestSheet.top).toBeGreaterThanOrEqual(-9);
  expect(metrics.projectSheet.top).toBeGreaterThanOrEqual(-9);
  expect(metrics.latestTab.height).toBeLessThanOrEqual(18);
  expect(metrics.projectTab.height).toBeLessThanOrEqual(18);
  expect(metrics.latestTab.width).toBeLessThanOrEqual(74);
  expect(metrics.projectTab.width).toBeLessThanOrEqual(74);

  if (metrics.viewportWidth > 1024) {
    expect(metrics.latest.left - metrics.hero.left).toBeGreaterThanOrEqual(14);
    expect(metrics.hero.right - metrics.project.right).toBeGreaterThanOrEqual(14);
    expect(metrics.project.top - metrics.hero.top).toBeGreaterThanOrEqual(24);
    expect(metrics.hero.bottom - metrics.latest.bottom).toBeGreaterThanOrEqual(24);
    expect(Math.abs(metrics.connections.projectStart.x - (metrics.portrait.right + 5))).toBeLessThan(4);
    expect(Math.abs(metrics.connections.projectEnd.x - (metrics.project.left - 2))).toBeLessThan(4);
    expect(Math.abs(metrics.connections.latestStart.x - (metrics.latest.right + 2))).toBeLessThan(4);
    expect(Math.abs(metrics.connections.latestEnd.x - (metrics.portrait.left - 7))).toBeLessThan(4);
  }
};

const expectOrbitalWordmark = async (page) => {
  const wordmark = page.locator(".site-wordmark");
  await expect(wordmark).toHaveAttribute("aria-label", "somani 홈");
  await expect(wordmark.locator(".wordmark-logo strong")).toHaveText("somani");
  await expect(wordmark.locator(".wordmark-logo svg ellipse")).toHaveCount(1);
  await expect(wordmark.locator(".wordmark-logo svg path")).toHaveCount(1);
  await expect(wordmark.locator('.wordmark-logo svg')).toHaveAttribute("focusable", "false");
  await expect(wordmark.locator(':scope > span:not(.wordmark-logo)')).toHaveCount(0);
  const bounds = await wordmark.evaluate((link) => {
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const logo = link.querySelector(".wordmark-logo").getBoundingClientRect();
    return { header: header.toJSON(), logo: logo.toJSON() };
  });
  expect(bounds.logo.left).toBeGreaterThanOrEqual(bounds.header.left);
  expect(bounds.logo.right).toBeLessThanOrEqual(bounds.header.right);
};

const expectCategoryStartClear = async (page) => {
  const startsBehindDock = await page.evaluate(() => {
    const list = document.querySelector(".category-switches").getBoundingClientRect();
    const dock = document.querySelector(".mobile-dock");
    if (getComputedStyle(dock).display === "none") return false;
    const dockRectangle = dock.getBoundingClientRect();
    return list.top + window.scrollY < dockRectangle.bottom;
  });
  expect(startsBehindDock).toBeFalsy();
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
  await expect(page.locator(".latest-note")).toContainText("최근 기록");
  await expect(page.locator(".project-note")).toBeVisible();
  await expect(page.locator(".project-note")).toContainText("다른 최근 기록");
  await expect(page.locator(".latest-note p")).not.toBeEmpty();
  await expect(page.locator(".project-note p")).not.toBeEmpty();
  await expect(page.locator(".switchboard-heading")).toHaveCount(0);
  await expect(page.locator(".archive-switchboard")).not.toContainText(
    "새롭게 작성한 글을 모아두었습니다.",
  );
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
  await expectOrbitalWordmark(page);

  if (testInfo.project.name === "mobile") {
    const dock = page.getByRole("navigation", { name: "모바일 주 메뉴" });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("link")).toHaveCount(4);
    await expect(page.locator(".desktop-nav")).not.toBeVisible();
  } else {
    await expect(page.locator(".desktop-nav")).toBeVisible();
    await expect(page.locator(".desktop-nav a")).toHaveCount(4);
    await expect(page.locator(".mobile-dock")).not.toBeVisible();
    const sidebar = page.locator(".site-header");
    await expect(sidebar).toHaveCSS("position", "fixed");
    const navBoxes = await page.locator(".desktop-nav a").evaluateAll((links) =>
      links.map((link) => link.getBoundingClientRect().toJSON()),
    );
    const navLefts = navBoxes.map((box) => box.left);
    expect(Math.max(...navLefts) - Math.min(...navLefts)).toBeLessThanOrEqual(4);
    expect(navBoxes[3].top).toBeGreaterThan(navBoxes[0].top + 100);
  }

  await expectNoOverflow(page);
  await expectClusterTextClear(page);
  await expectClusterProportions(page);
  await expectApprovedTopLayout(page);
  await expectClusterVisualSafety(page);
  await expectCategoryStartClear(page);
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

  if (await page.locator(".category-stage").isVisible()) {
    const node = page.locator(".signal-node");
    const listBox = await page.locator(".category-switches").boundingBox();
    const stageBox = await page.locator(".category-stage").boundingBox();
    expect(Math.abs(listBox.y - stageBox.y)).toBeLessThan(1);
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
      "나를 움직이는 기준, 그리고 앞으로의 7개월",
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
      "나를 움직이는 기준, 그리고 앞으로의 7개월",
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

test("orbital wordmark and content flow remain clear at responsive boundaries", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  const boundaries = [1440, 1280, 1081, 1080, 1025, 1024, 901, 900, 881, 880, 821, 820, 768, 390, 320];

  for (const width of boundaries) {
    await page.setViewportSize({ width, height: width <= 820 ? 900 : 820 });
    await page.goto("/");
    await page.evaluate(async () => document.fonts.ready);
    await revealPage(page);
    await expectOrbitalWordmark(page);
    await expectNoOverflow(page);
    await expectClusterTextClear(page);

    await page.locator(".project-note").hover();
    await page.waitForTimeout(320);
    await expectClusterTextClear(page);
    await page.locator(".latest-note").focus();
    await expectClusterTextClear(page);

    await page.evaluate(() => {
      document.querySelector(".hero-description").textContent +=
        " 소개 문장이 두세 줄 더 길어지는 상황에서도 각 콘텐츠의 공간을 유지합니다.";
      document.querySelector(".latest-note strong").textContent +=
        " — 여러 줄로 길어진 게시글 제목";
      document.querySelector(".latest-note p").textContent +=
        " 설명이 길어져 카드 높이가 늘어나는 경우도 확인합니다.";
    });
    await page.waitForTimeout(80);
    await expectNoOverflow(page);
    await expectClusterTextClear(page);
  }
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

  const project = page.locator(".project-note");
  const projectPath = page.locator(".path-one path");
  const projectPathBefore = await projectPath.evaluate(
    (node) => getComputedStyle(node).stroke,
  );
  await project.hover();
  await expect
    .poll(() =>
      projectPath.evaluate((node) => getComputedStyle(node).stroke),
    )
    .not.toBe(projectPathBefore);
  await page.locator(".home-hero").screenshot({
    path: path.join(reviewDirectory, "project-folder-hover.png"),
  });
  const projectBox = await project.boundingBox();
  await page.screenshot({
    path: path.join(reviewDirectory, "project-folder-hover-closeup.png"),
    clip: {
      x: Math.max(0, projectBox.x - 24),
      y: Math.max(0, projectBox.y - 24),
      width: Math.min(page.viewportSize().width - Math.max(0, projectBox.x - 24), projectBox.width + 48),
      height: projectBox.height + 48,
    },
  });
  await expectClusterTextClear(page);
  await expectClusterVisualSafety(page);

  await page.mouse.move(0, 0);
  const latest = page.locator(".latest-note");
  const latestPath = page.locator(".path-two path");
  const latestPathBefore = await latestPath.evaluate(
    (node) => getComputedStyle(node).stroke,
  );
  await latest.focus();
  await expect
    .poll(() =>
      latestPath.evaluate((node) => getComputedStyle(node).stroke),
    )
    .not.toBe(latestPathBefore);
  await page.locator(".home-hero").screenshot({
    path: path.join(reviewDirectory, "latest-folder-focus.png"),
  });
  await expectClusterTextClear(page);
  await expectClusterVisualSafety(page);
});

test("themes and required viewport captures stay visually stable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  const viewports = [
    { name: "desktop-1440", width: 1440, height: 1000 },
    { name: "laptop-1280", width: 1280, height: 900 },
    { name: "boundary-1080", width: 1080, height: 900 },
    { name: "zoom-125", width: 1152, height: 800 },
    { name: "zoom-150", width: 960, height: 800 },
    { name: "compact-1024", width: 1024, height: 900 },
    { name: "boundary-900", width: 900, height: 900 },
    { name: "boundary-820", width: 820, height: 1000 },
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
    await expectClusterTextClear(page);
    await expectClusterProportions(page);
    await expectApprovedTopLayout(page);
    await expectClusterVisualSafety(page);
    await expectCategoryStartClear(page);
    await page.screenshot({
      path: path.join(reviewDirectory, `${viewport.name}-home-dark.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("somani-theme", "light"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg")
          .trim(),
      ),
    ).toBe("#f7f3ff");
    await revealPage(page);
    await expectNoOverflow(page);
    await expectClusterTextClear(page);
    await expectApprovedTopLayout(page);
    await expectClusterVisualSafety(page);
    await page.screenshot({
      path: path.join(reviewDirectory, `${viewport.name}-home-light.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expectAccessible(page);
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
  await expect(
    page.locator(".post-card").filter({ hasText: "GitHub Pages 블로그 구축 기록" }),
  ).toHaveCount(1);
  await page.goto("/about/");
  const aboutImage = page.locator(
    '.profile-card .avatar img[src="/assets/images/profile-hachiware-about.jpg"]',
  );
  await expect(aboutImage).toHaveAttribute(
    "alt",
    "컴퓨터 앞에 앉아 커피를 마시는 파란 귀의 하치와레 캐릭터",
  );
  await expect
    .poll(() =>
      aboutImage.evaluate(
        (image) =>
          image.complete &&
          image.naturalWidth === 736 &&
          image.naturalHeight === 736,
      ),
    )
    .toBeTruthy();
  await expect(aboutImage).not.toHaveAttribute(
    "src",
    "/assets/images/profile-hachiware.jpg",
  );
  const aboutIntroduction = page.locator(".about-content section").first();
  await expect(aboutIntroduction.getByRole("heading", { level: 2 })).toHaveText(
    "안녕하세요, somani입니다.",
  );
  await expect(aboutIntroduction.locator("p")).toHaveText([
    "울산대학교 ICT융합학부에서 컴퓨터공학을 공부하고 있습니다. 보안뿐 아니라 다양한 분야에 경계를 두지 않고 폭넓게 배우고 싶습니다.",
    "시스템 해킹과 리버스 엔지니어링, CTF/Wargame도 여러 관심 분야 가운데 하나입니다. 배운 내용을 다시 설명할 수 있을 만큼 이해하고, 프로젝트와 학습 과정에서 직접 겪은 문제를 다음에 꺼내 볼 수 있는 기록으로 차근차근 쌓아 가고 싶습니다.",
  ]);
  await page.goto("/posts/github-pages-blog/");
  const sequence = page.locator(".article-sequence");
  const expectedSequence = await page.evaluate(async () => {
    const posts = await fetch("/search.json").then((response) => response.json());
    return String(
      posts.find((post) => post.url === "/posts/github-pages-blog/").recordOrder,
    ).padStart(3, "0");
  });
  await expect(sequence).toHaveText(expectedSequence);
  await expect(sequence).toHaveAttribute("aria-hidden", "true");
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
