const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");

const themeButton = $(".theme-toggle");
if (themeButton) themeButton.hidden = false;
function updateThemeControl() {
  if (!themeButton) return;
  const dark = document.documentElement.dataset.theme !== "light";
  themeButton.setAttribute(
    "aria-label",
    dark ? "라이트 모드로 전환" : "다크 모드로 전환",
  );
  $(".theme-icon", themeButton).textContent = dark ? "☼" : "☾";
  $(".theme-label", themeButton).textContent = dark ? "Light" : "Dark";
}
updateThemeControl();
themeButton?.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("somani-theme", next);
  } catch {}
  updateThemeControl();
});

document.addEventListener("keydown", (event) => {
  if (
    event.key !== "/" ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
  )
    return;
  const search = $("#global-search");
  if (!search) return;
  event.preventDefault();
  search.focus();
});

function initLaunchIntro() {
  const intro = $("[data-launch-intro]");
  if (!intro) return;
  const enter = $("[data-launch-enter]", intro);
  const skip = $("[data-launch-skip]", intro);
  const replay = $("[data-intro-replay]");
  let open = false;
  let closing = false;
  const key = "somani-intro-seen-v20261125";

  const finish = () => {
    open = false;
    closing = false;
    intro.classList.remove("is-visible", "is-entering");
    intro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("intro-open");
    replay?.focus({ preventScroll: true });
  };
  const close = (travel = false) => {
    if (!open || closing) return;
    closing = true;
    try {
      sessionStorage.setItem(key, "1");
    } catch {}
    if (travel && !reducedMotion.matches) {
      intro.classList.add("is-entering");
      setTimeout(finish, 580);
    } else {
      finish();
    }
  };
  const show = () => {
    closing = false;
    open = true;
    intro.classList.remove("is-entering");
    intro.classList.add("is-visible");
    intro.setAttribute("aria-hidden", "false");
    document.body.classList.add("intro-open");
    requestAnimationFrame(() => enter?.focus({ preventScroll: true }));
  };

  enter?.addEventListener("click", () => close(true));
  skip?.addEventListener("click", () => close(false));
  replay?.addEventListener("click", show);
  intro.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, .launch-copy")) return;
    close(true);
  });
  document.addEventListener("keydown", (event) => {
    if (!open || !["Enter", "Escape"].includes(event.key)) return;
    event.preventDefault();
    close(event.key === "Enter");
  });

  const params = new URLSearchParams(location.search);
  let seen = false;
  try {
    seen = sessionStorage.getItem(key) === "1";
  } catch {}
  if (params.get("intro") === "1") {
    params.delete("intro");
    const query = params.toString();
    history.replaceState(
      null,
      "",
      `${location.pathname}${query ? `?${query}` : ""}${location.hash}`,
    );
    show();
  } else if (!seen) {
    show();
  }
}
initLaunchIntro();

function initPageTransitions() {
  if (reducedMotion.matches) return;
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    const next = new URL(anchor.href, location.href);
    if (next.origin !== location.origin) return;
    if (
      next.pathname === location.pathname &&
      next.search === location.search &&
      next.hash
    )
      return;
    event.preventDefault();
    document.body.classList.add("is-leaving");
    setTimeout(() => {
      location.href = next.href;
    }, 310);
  });
  addEventListener("pageshow", () =>
    document.body.classList.remove("is-leaving"),
  );
}
initPageTransitions();

if (!reducedMotion.matches && finePointer.matches) {
  let frame = 0;
  document.addEventListener(
    "pointermove",
    (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = ((event.clientX / innerWidth) * 2 - 1) * -7;
        const y = ((event.clientY / innerHeight) * 2 - 1) * -5;
        document.documentElement.style.setProperty("--parallax-x", `${x}px`);
        document.documentElement.style.setProperty("--parallax-y", `${y}px`);
      });
    },
    { passive: true },
  );
}
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("is-paused", document.hidden);
});

const reveals = $$("[data-reveal]");
if (reducedMotion.matches || !("IntersectionObserver" in window)) {
  reveals.forEach((element) => element.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -5%", threshold: 0.06 },
  );
  reveals.forEach((element) => observer.observe(element));
}

const articleContent = $("[data-article-prose]");
if (articleContent) initArticle(articleContent);
function initArticle(content) {
  $$("pre", content).forEach((pre, index) => {
    const code = $("code", pre);
    if (!code) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "코드 복사";
    button.setAttribute("aria-label", `${index + 1}번째 코드 복사`);
    button.addEventListener("click", async () => {
      try {
        if (navigator.clipboard?.writeText)
          await navigator.clipboard.writeText(code.textContent);
        else {
          const area = document.createElement("textarea");
          area.value = code.textContent;
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.append(area);
          area.select();
          if (!document.execCommand("copy")) throw new Error("copy failed");
          area.remove();
        }
        button.textContent = "복사 완료 ✓";
        button.setAttribute("aria-label", "복사 완료");
      } catch {
        button.textContent = "복사 실패";
      }
      setTimeout(() => {
        button.textContent = "코드 복사";
        button.setAttribute("aria-label", `${index + 1}번째 코드 복사`);
      }, 2000);
    });
    pre.prepend(button);
  });
  $$("table", content).forEach((table) => {
    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "표 · 가로 스크롤 가능");
    table.before(wrap);
    wrap.append(table);
  });

  const headings = $$("h2, h3", content);
  const nav = $("[data-article-toc]");
  if (headings.length && nav) {
    let section = 0;
    headings.forEach((heading) => {
      if (heading.tagName === "H2") {
        section += 1;
        heading.dataset.sectionNumber = String(section).padStart(2, "0");
      }
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.dataset.level = heading.tagName.slice(1);
      nav.append(link);
    });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            $$("a", nav).forEach((link) =>
              link.removeAttribute("aria-current"),
            );
            $$("a", nav)
              .find(
                (link) =>
                  link.hash === `#${encodeURIComponent(entry.target.id)}` ||
                  decodeURIComponent(link.hash) === `#${entry.target.id}`,
              )
              ?.setAttribute("aria-current", "location");
          });
        },
        { rootMargin: "-15% 0px -65% 0px" },
      );
      headings.forEach((heading) => observer.observe(heading));
    }
  }

  const progress = $(".reading-progress");
  const updateProgress = () => {
    const article = $("[data-article]");
    if (!article || !progress) return;
    const distance = article.offsetHeight - innerHeight;
    const value =
      distance > 0 ? ((scrollY - article.offsetTop) / distance) * 100 : 100;
    progress.style.width = `${Math.min(100, Math.max(0, value))}%`;
  };
  addEventListener("scroll", updateProgress, { passive: true });
  addEventListener("resize", updateProgress);
  updateProgress();
}

const archive = $("[data-archive]");
if (archive) initArchive(archive);
async function initArchive(root) {
  const search = $("#search", root);
  const tags = $("#tag-filter", root);
  const categories = $("#category-filter", root);
  const results = $("#archive-results", root);
  const count = $("#result-count", root);
  const reset = $(".reset-button", root);
  const sortToggle = $("#sort-toggle", root);
  const form = $(".search-form", root);
  const fixedCategory = root.dataset.category || "";
  let sort = "latest";
  let posts = [];
  let searchTimer = 0;

  try {
    const response = await fetch("/search.json");
    if (!response.ok) throw new Error("Search index unavailable");
    posts = await response.json();
  } catch {
    form?.classList.add("search-unavailable");
    search.disabled = true;
    tags.disabled = true;
    categories.disabled = true;
    sortToggle.disabled = true;
    search.placeholder = "검색 인덱스를 불러오지 못했습니다";
    return;
  }

  const allTagNames = [...new Set(posts.flatMap((post) => post.tags))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
  allTagNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `#${name}`;
    tags.append(option);
  });

  function readURL() {
    const params = new URLSearchParams(location.search);
    search.value = params.get("q") || "";
    const selectedTag = params.get("tag") || "";
    if (
      selectedTag &&
      !$$("option", tags).some((option) => option.value === selectedTag)
    ) {
      const option = document.createElement("option");
      option.value = selectedTag;
      option.textContent = `#${selectedTag}`;
      tags.append(option);
    }
    tags.value = selectedTag;
    categories.value = fixedCategory || params.get("category") || "";
    sort = params.get("sort") === "oldest" ? "oldest" : "latest";
    updateSortControl();
  }
  function updateSortControl() {
    const latest = sort === "latest";
    sortToggle.textContent = latest ? "최신순 ↓" : "오래된순 ↑";
    sortToggle.setAttribute(
      "aria-label",
      latest
        ? "현재 최신순, 오래된순으로 전환"
        : "현재 오래된순, 최신순으로 전환",
    );
  }
  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function syncURL(pushHistory) {
    const url = new URL(location.href);
    const q = search.value.trim();
    q ? url.searchParams.set("q", q) : url.searchParams.delete("q");
    tags.value
      ? url.searchParams.set("tag", tags.value)
      : url.searchParams.delete("tag");
    if (!fixedCategory && categories.value)
      url.searchParams.set("category", categories.value);
    else url.searchParams.delete("category");
    sort === "oldest"
      ? url.searchParams.set("sort", "oldest")
      : url.searchParams.delete("sort");
    history[pushHistory ? "pushState" : "replaceState"](null, "", url);
  }
  function draw(sync = true, pushHistory = false) {
    const q = search.value.trim().toLocaleLowerCase("ko");
    const tag = tags.value;
    const category = fixedCategory || categories.value;
    const found = posts
      .filter(
        (post) =>
          (!category || post.categories.includes(category)) &&
          (!tag || post.tags.includes(tag)) &&
          (!q ||
            [
              post.title,
              post.description,
              post.text,
              ...post.tags,
              ...post.categories,
            ]
              .join(" ")
              .toLocaleLowerCase("ko")
              .includes(q)),
      )
      .sort((a, b) => {
        const direction = sort === "latest" ? -1 : 1;
        return direction * (Number(a.recordOrder) - Number(b.recordOrder));
      });
    if (sync) syncURL(pushHistory);
    updateSortControl();
    results.replaceChildren();
    count.textContent = `${found.length}개의 기록`;
    reset.hidden = !q && !tag && (!categories.value || fixedCategory);
    if (!found.length) {
      const empty = create("div", "empty-state");
      empty.append(
        create("span", "", "◇"),
        create(
          "h2",
          "",
          q || tag || (!fixedCategory && category)
            ? "조건에 맞는 기록이 없습니다."
            : "아직 공개된 기록이 없습니다.",
        ),
      );
      results.append(empty);
      return;
    }
    found.forEach((post) => {
      const card = create("article", "post-card");
      const meta = create("div", "post-meta");
      const time = create("time", "", post.date);
      time.dateTime = post.date;
      meta.append(
        create(
          "span",
          "",
          `No. ${String(post.recordOrder).padStart(3, "0")}`,
        ),
        create("span", "", "·"),
        time,
        create("span", "", "·"),
        create("span", "", `${post.readingTime}분 읽기`),
      );
      const heading = create("h3");
      const link = create("a", "", post.title);
      link.href = post.url;
      link.append(create("span", "", "↗"));
      heading.append(link);
      const description = create("p", "", post.description);
      const bottom = create("div", "post-bottom");
      const tagLinks = create("div", "tags");
      post.tags.forEach((name) => {
        const tagLink = create("a", "", `#${name}`);
        const tagURL = new URL("/archive/", location.origin);
        tagURL.searchParams.set("tag", name);
        if (sort === "oldest") tagURL.searchParams.set("sort", "oldest");
        tagLink.href = `${tagURL.pathname}${tagURL.search}`;
        tagLinks.append(tagLink);
      });
      const categoryLinks = create("div", "category-links");
      post.categoryLinks.forEach((item) => {
        const categoryLink = create("a", "category-label", item.name);
        categoryLink.href = `/categories/${item.slug}/`;
        categoryLinks.append(categoryLink);
      });
      bottom.append(tagLinks, categoryLinks);
      card.append(meta, heading, description, bottom);
      results.append(card);
    });
  }

  readURL();
  draw(false);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    draw(true, true);
  });
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => draw(true), 120);
  });
  tags.addEventListener("change", () => draw(true, true));
  categories.addEventListener("change", () => {
    if (fixedCategory && categories.value !== fixedCategory) {
      const url = new URL("/archive/", location.origin);
      if (categories.value)
        url.searchParams.set("category", categories.value);
      location.href = `${url.pathname}${url.search}`;
      return;
    }
    draw(true, true);
  });
  sortToggle.addEventListener("click", () => {
    sort = sort === "latest" ? "oldest" : "latest";
    draw(true, true);
  });
  reset.addEventListener("click", () => {
    search.value = "";
    tags.value = "";
    categories.value = fixedCategory;
    sort = "latest";
    draw(true, true);
    search.focus();
  });
  addEventListener("popstate", () => {
    readURL();
    draw(false);
  });
}
