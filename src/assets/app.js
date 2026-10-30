const $ = (selector, root = document) => root.querySelector(selector);
const menu = $(".menu-toggle");
menu.hidden = false;
menu.addEventListener("click", () =>
  menu.setAttribute(
    "aria-expanded",
    String(menu.getAttribute("aria-expanded") !== "true"),
  ),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    menu.setAttribute("aria-expanded", "false");
    menu.focus();
  }
});
const theme = $(".theme-toggle");
theme.hidden = false;
function updateTheme() {
  const dark = document.documentElement.dataset.theme !== "light";
  theme.setAttribute(
    "aria-label",
    dark ? "라이트 모드로 전환" : "다크 모드로 전환",
  );
  theme.firstElementChild.textContent = dark ? "☼" : "☾";
}
updateTheme();
theme.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("somini-theme", next);
  } catch {}
  updateTheme();
});
for (const pre of document.querySelectorAll(".prose pre")) {
  const code = $("code", pre);
  if (!code) continue;
  const bar = document.createElement("div");
  bar.className = "code-bar";
  const lang = document.createElement("span");
  lang.textContent =
    [...code.classList].find((c) => c.startsWith("language-"))?.slice(9) ||
    "text";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "코드 복사";
  button.setAttribute("aria-live", "polite");
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
        const copied = document.execCommand("copy");
        area.remove();
        if (!copied) throw new Error("copy failed");
      }
      button.textContent = "복사 완료 ✓";
    } catch {
      button.textContent = "복사 실패 · 직접 선택해 주세요";
    }
    setTimeout(() => {
      button.textContent = "코드 복사";
    }, 2500);
  });
  bar.append(lang, button);
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";
  pre.before(wrapper);
  wrapper.append(bar, pre);
}
const content = $("#post-content");
if (content) {
  for (const table of content.querySelectorAll("table")) {
    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "표 · 가로 스크롤 가능");
    table.before(wrap);
    wrap.append(table);
  }
  const headings = [...content.querySelectorAll("h2, h3")];
  const toc = $(".toc");
  const nav = $("nav", toc);
  if (headings.length) {
    toc.hidden = false;
    headings.forEach((heading) => {
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      if (heading.tagName === "H3") link.className = "toc-sub";
      nav.append(link);
    });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              nav
                .querySelectorAll("a")
                .forEach((a) => a.removeAttribute("aria-current"));
              [...nav.querySelectorAll("a")]
                .find(
                  (a) =>
                    a.hash === `#${encodeURIComponent(entry.target.id)}` ||
                    decodeURIComponent(a.hash) === `#${entry.target.id}`,
                )
                ?.setAttribute("aria-current", "location");
            }
          });
        },
        { rootMargin: "-15% 0px -65% 0px" },
      );
      headings.forEach((h) => observer.observe(h));
    }
  }
  const progress = $(".reading-progress");
  const update = () => {
    const start = content.getBoundingClientRect().top + window.scrollY;
    const end = start + content.offsetHeight - window.innerHeight;
    progress.style.width = `${Math.min(100, Math.max(0, ((window.scrollY - start) / Math.max(1, end - start)) * 100))}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}
const archive = $("[data-archive]");
if (archive) initArchive(archive);
async function initArchive(root) {
  const search = $("#search", root),
    tags = $("#tag-filter", root),
    results = $("#archive-results", root),
    count = $("#result-count", root),
    reset = $(".reset-button", root);
  const form = $(".search-form", root);
  try {
    const response = await fetch("/search.json");
    if (!response.ok) throw new Error("Search index unavailable");
    const posts = await response.json();
    const category = root.dataset.category;
    const available = posts.filter(
      (p) => !category || p.categories.includes(category),
    );
    const tagNames = [...new Set(available.flatMap((p) => p.tags))].sort(
      (a, b) => a.localeCompare(b, "ko"),
    );
    for (const name of tagNames) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = `#${name}`;
      tags.append(option);
    }
    function readURL() {
      const params = new URLSearchParams(location.search);
      search.value = params.get("q") || "";
      const selected = params.get("tag") || "";
      if (selected && ![...tags.options].some((o) => o.value === selected)) {
        const option = document.createElement("option");
        option.value = selected;
        option.textContent = `#${selected}`;
        tags.append(option);
      }
      tags.value = selected;
    }
    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function draw(syncURL = true) {
      const q = search.value.trim().toLocaleLowerCase("ko"),
        tag = tags.value;
      const found = available.filter(
        (p) =>
          (!tag || p.tags.includes(tag)) &&
          (!q ||
            [p.title, p.description, p.text, ...p.tags, ...p.categories]
              .join(" ")
              .toLocaleLowerCase("ko")
              .includes(q)),
      );
      if (syncURL) {
        const url = new URL(location.href);
        q
          ? url.searchParams.set("q", search.value.trim())
          : url.searchParams.delete("q");
        tag ? url.searchParams.set("tag", tag) : url.searchParams.delete("tag");
        history.replaceState(null, "", url);
      }
      results.replaceChildren();
      count.textContent = `${found.length}개의 기록`;
      reset.hidden = !q && !tag;
      if (!found.length) {
        const empty = el("div", "empty-state");
        empty.append(
          el("span", "", "↳"),
          el(
            "h2",
            "",
            q || tag ? "검색 결과가 없습니다." : "아직 기록이 없습니다.",
          ),
          el(
            "p",
            "",
            q || tag
              ? "다른 검색어나 태그를 선택해 보세요."
              : "다른 카테고리의 글을 둘러보세요.",
          ),
        );
        results.append(empty);
      }
      for (const post of found) {
        const article = el("article", "post-card"),
          meta = el("div", "post-meta"),
          time = el("time", "", post.date);
        time.dateTime = post.date;
        meta.append(
          time,
          el("span", "", "·"),
          el("span", "", `${post.readingTime}분 읽기`),
        );
        const h3 = el("h3"),
          link = el("a", "", post.title);
        link.href = post.url;
        link.append(el("span", "", "↗"));
        h3.append(link);
        const bottom = el("div", "post-bottom"),
          chips = el("div", "tags");
        for (const name of post.tags) {
          const a = el("a", "", `#${name}`);
          a.href = `/archive/?tag=${encodeURIComponent(name)}`;
          chips.append(a);
        }
        const categoryLabels = el("div", "category-links");
        for (const category of post.categoryLinks) {
          const link = el("a", "category-label", category.name);
          link.href = `/categories/${category.slug}/`;
          categoryLabels.append(link);
        }
        bottom.append(chips, categoryLabels);
        article.append(meta, h3, el("p", "", post.description), bottom);
        results.append(article);
      }
    }
    readURL();
    draw(false);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      draw();
    });
    search.addEventListener("input", () => draw());
    tags.addEventListener("change", () => draw());
    reset.addEventListener("click", () => {
      search.value = "";
      tags.value = "";
      draw();
      search.focus();
    });
    window.addEventListener("popstate", () => {
      readURL();
      draw(false);
    });
  } catch {
    form.addEventListener("submit", (e) => e.preventDefault());
    search.disabled = true;
    tags.disabled = true;
    count.textContent =
      "검색을 불러오지 못했습니다. 게시글 목록이나 카테고리를 이용해 주세요.";
  }
}
