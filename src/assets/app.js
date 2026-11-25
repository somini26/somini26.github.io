const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const themeButtons = $$(".theme-toggle");
themeButtons.forEach((button) => (button.hidden = false));
function updateThemeControls() {
  const dark = document.documentElement.dataset.theme !== "light";
  themeButtons.forEach((button) => {
    button.setAttribute("aria-label", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
    $(".theme-icon", button).textContent = dark ? "☼" : "☾";
    $(".theme-label", button).textContent = dark ? "Light" : "Dark";
  });
}
updateThemeControls();
themeButtons.forEach((button) =>
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("somani-theme", next); } catch {}
    updateThemeControls();
  }),
);

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  const search = $("#global-search");
  if (!search || !matchMedia("(min-width: 901px)").matches) return;
  event.preventDefault();
  search.focus();
});

function initMobileMenu() {
  const menu = $("[data-mobile-menu]");
  if (!menu) return;
  const summary = $("summary", menu);
  menu.addEventListener("toggle", () => {
    document.body.classList.toggle("menu-open", menu.open);
    summary.setAttribute("aria-label", menu.open ? "메뉴 닫기" : "메뉴 열기");
    if (menu.open) requestAnimationFrame(() => $("a", menu)?.focus({ preventScroll: true }));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !menu.open) return;
    menu.open = false;
    summary.focus({ preventScroll: true });
  });
  $$("a", menu).forEach((link) => link.addEventListener("click", () => { menu.open = false; }));
}
initMobileMenu();

function initLaunchIntro() {
  const intro = $("[data-launch-intro]");
  if (!intro) return;
  document.body.classList.add("atlas-ready");
  const enter = $("[data-launch-enter]", intro);
  const skip = $("[data-launch-skip]", intro);
  const replays = $$("[data-intro-replay]");
  const key = "somani-intro-seen-orbital-atlas-v20261125";
  let open = false;
  let closing = false;
  let replayRequested = false;
  let timer = 0;
  const focusReplay = () => replays.find((item) => item.offsetParent !== null)?.focus({ preventScroll: true });
  const finish = (animateArrival = false) => {
    const restoreFocus = open && replayRequested;
    open = false;
    closing = false;
    clearTimeout(timer);
    intro.classList.remove("is-visible", "is-entering");
    intro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("intro-open");
    document.body.classList.remove("atlas-intro-arrived");
    if (animateArrival && !reducedMotion.matches) requestAnimationFrame(() => document.body.classList.add("atlas-intro-arrived"));
    if (restoreFocus) focusReplay();
    replayRequested = false;
  };
  const close = (travel = false) => {
    if (!open || closing) return;
    closing = true;
    clearTimeout(timer);
    try { sessionStorage.setItem(key, "1"); } catch {}
    if (travel && !reducedMotion.matches) {
      intro.classList.add("is-entering");
      setTimeout(() => finish(true), 220);
    } else finish(false);
  };
  const show = (replay = false) => {
    if (reducedMotion.matches) {
      try { sessionStorage.setItem(key, "1"); } catch {}
      finish(false);
      return;
    }
    document.body.classList.remove("atlas-intro-arrived");
    replayRequested = replay;
    open = true;
    closing = false;
    intro.classList.remove("is-entering");
    intro.classList.add("is-visible");
    intro.setAttribute("aria-hidden", "false");
    document.body.classList.add("intro-open");
    requestAnimationFrame(() => enter?.focus({ preventScroll: true }));
    clearTimeout(timer);
    timer = setTimeout(() => close(true), 1150);
  };
  enter?.addEventListener("click", () => close(true));
  skip?.addEventListener("click", () => close(false));
  replays.forEach((button) => button.addEventListener("click", () => show(true)));
  intro.addEventListener("pointerdown", (event) => { if (!event.target.closest("button, a")) close(true); });
  document.addEventListener("keydown", (event) => {
    if (!open || !["Enter", "Escape"].includes(event.key)) return;
    event.preventDefault();
    close(event.key === "Enter");
  });
  const params = new URLSearchParams(location.search);
  let seen = false;
  try { seen = sessionStorage.getItem(key) === "1"; } catch {}
  if (params.get("intro") === "1") {
    params.delete("intro");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
    show(true);
  } else if (!seen) show(false);
  else finish(false);
}
initLaunchIntro();

function initAtlasSelection() {
  const map = $("[data-atlas-map]");
  if (!map) return;
  const setActive = (route, active) => {
    $$("[data-orbit]", map).forEach((path) => path.classList.toggle("is-active", active && path.dataset.orbit === route));
  };
  $$('[data-category-trigger][data-route]', map).forEach((link) => {
    const activate = () => setActive(link.dataset.route, true);
    const deactivate = () => setActive(link.dataset.route, false);
    link.addEventListener("pointerenter", activate);
    link.addEventListener("pointerleave", deactivate);
    link.addEventListener("focus", activate);
    link.addEventListener("blur", deactivate);
  });
}
initAtlasSelection();

document.addEventListener("visibilitychange", () => document.body.classList.toggle("is-paused", document.hidden));

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
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code.textContent);
        else {
          const area = document.createElement("textarea"); area.value = code.textContent; area.style.position = "fixed"; area.style.opacity = "0"; document.body.append(area); area.select(); if (!document.execCommand("copy")) throw new Error("copy failed"); area.remove();
        }
        button.textContent = "복사 완료 ✓";
        button.setAttribute("aria-label", "복사 완료");
      } catch { button.textContent = "복사 실패"; }
      setTimeout(() => { button.textContent = "코드 복사"; button.setAttribute("aria-label", `${index + 1}번째 코드 복사`); }, 2000);
    });
    pre.prepend(button);
  });
  $$("table", content).forEach((table) => {
    const wrap = document.createElement("div"); wrap.className = "table-scroll"; wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "표 · 가로 스크롤 가능"); table.before(wrap); wrap.append(table);
  });
  const headings = $$("h2, h3", content);
  const navs = $$("[data-article-toc]");
  const tocDetails = $(".toc-panel");
  if (tocDetails && matchMedia("(max-width: 800px)").matches) tocDetails.removeAttribute("open");
  navs.forEach((nav) => headings.forEach((heading) => {
    const link = document.createElement("a"); link.href = `#${heading.id}`; link.textContent = heading.textContent; link.dataset.level = heading.tagName.slice(1); nav.append(link);
  }));
  if (headings.length && navs.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navs.forEach((nav) => { $$("a", nav).forEach((link) => link.removeAttribute("aria-current")); $$("a", nav).find((link) => decodeURIComponent(link.hash) === `#${entry.target.id}`)?.setAttribute("aria-current", "location"); });
    }), { rootMargin: "-14% 0px -68% 0px" });
    headings.forEach((heading) => observer.observe(heading));
  }
  const progress = $(".reading-progress");
  const updateProgress = () => {
    const article = $("[data-article]"); if (!article || !progress) return;
    const distance = article.offsetHeight - innerHeight;
    const value = distance > 0 ? ((scrollY - article.offsetTop) / distance) * 100 : 100;
    progress.style.width = `${Math.min(100, Math.max(0, value))}%`;
  };
  addEventListener("scroll", updateProgress, { passive: true }); addEventListener("resize", updateProgress); updateProgress();
}

const archive = $("[data-archive]");
if (archive) initArchive(archive);
async function initArchive(root) {
  const search = $("#search", root); const tags = $("#tag-filter", root); const categories = $("#category-filter", root); const results = $("#archive-results", root); const count = $("#result-count", root); const reset = $(".reset-button", root); const sortToggle = $("#sort-toggle", root); const form = $(".search-form", root); const fixedCategory = root.dataset.category || "";
  let sort = "latest"; let posts = []; let searchTimer = 0;
  try { const response = await fetch("/search.json"); if (!response.ok) throw new Error(); posts = await response.json(); }
  catch { form?.classList.add("search-unavailable"); [search, tags, categories, sortToggle].forEach((control) => { if (control) control.disabled = true; }); search.placeholder = "검색 인덱스를 불러오지 못했습니다"; return; }
  [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b, "ko")).forEach((name) => { const option = document.createElement("option"); option.value = name; option.textContent = `#${name}`; tags.append(option); });
  const compareAscending = (a, b) => {
    const aDate = Number.isFinite(new Date(a.date).getTime()) ? new Date(a.date).getTime() : 0;
    const bDate = Number.isFinite(new Date(b.date).getTime()) ? new Date(b.date).getTime() : 0;
    const aOrder = Number.isFinite(Number(a.recordOrder)) ? Number(a.recordOrder) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b.recordOrder)) ? Number(b.recordOrder) : Number.MAX_SAFE_INTEGER;
    return aDate - bDate || aOrder - bOrder || String(a.url).localeCompare(String(b.url));
  };
  function updateSort() { const latest = sort === "latest"; sortToggle.textContent = latest ? "최신순 ↓" : "오래된순 ↑"; sortToggle.setAttribute("aria-label", latest ? "현재 최신순, 오래된순으로 전환" : "현재 오래된순, 최신순으로 전환"); }
  function readURL() {
    const params = new URLSearchParams(location.search); search.value = params.get("q") || ""; const selectedTag = params.get("tag") || "";
    if (selectedTag && !$$('option', tags).some((option) => option.value === selectedTag)) { const option = document.createElement("option"); option.value = selectedTag; option.textContent = `#${selectedTag}`; tags.append(option); }
    tags.value = selectedTag; categories.value = fixedCategory || params.get("category") || ""; sort = params.get("sort") === "oldest" ? "oldest" : "latest"; updateSort();
  }
  function syncURL(push) { const url = new URL(location.href); const q = search.value.trim(); q ? url.searchParams.set("q", q) : url.searchParams.delete("q"); tags.value ? url.searchParams.set("tag", tags.value) : url.searchParams.delete("tag"); if (!fixedCategory && categories.value) url.searchParams.set("category", categories.value); else url.searchParams.delete("category"); sort === "oldest" ? url.searchParams.set("sort", "oldest") : url.searchParams.delete("sort"); history[push ? "pushState" : "replaceState"](null, "", url); }
  const create = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
  function draw(sync = true, push = false) {
    const q = search.value.trim().toLocaleLowerCase("ko"); const tag = tags.value; const category = fixedCategory || categories.value;
    const found = posts.filter((post) => (!category || post.categories.includes(category)) && (!tag || post.tags.includes(tag)) && (!q || [post.title, post.description, post.text, ...post.tags, ...post.categories].join(" ").toLocaleLowerCase("ko").includes(q))).sort((a, b) => sort === "latest" ? compareAscending(b, a) : compareAscending(a, b));
    if (sync) syncURL(push); updateSort(); results.replaceChildren(); count.textContent = `${found.length}개의 기록`; reset.hidden = !q && !tag && (!categories.value || fixedCategory);
    if (!found.length) { const empty = create("div", "empty-state"); empty.append(create("span", "", "◇"), create("h2", "", q || tag || (!fixedCategory && category) ? "조건에 맞는 기록이 없습니다." : "아직 공개된 기록이 없습니다.")); results.append(empty); return; }
    found.forEach((post) => {
      const card = create("article", "post-card"); card.dataset.recordOrder = post.recordOrder;
      const time = create("time", "", post.date); time.dateTime = post.date;
      const copy = create("div", "post-row-copy"); const heading = create("h3"); const titleLink = create("a", "", post.title); titleLink.href = post.url; heading.append(titleLink);
      const meta = create("div", "post-meta"); meta.append(create("span", "", `No. ${String(post.recordOrder).padStart(3, "0")}`), create("span", "", `${post.readingTime}분 읽기`)); post.tags.slice(0, 3).forEach((name) => { const link = create("a", "", `#${name}`); link.href = `/archive/?tag=${encodeURIComponent(name)}`; meta.append(link); }); copy.append(heading, meta);
      const categoryLinks = create("div", "category-links"); post.categoryLinks.forEach((item) => { const link = create("a", "", item.name); link.href = `/categories/${item.slug}/`; categoryLinks.append(link); });
      const arrow = create("a", "post-row-arrow", "→"); arrow.href = post.url; arrow.setAttribute("aria-label", `${post.title} 읽기`); card.append(time, copy, categoryLinks, arrow); results.append(card);
    });
  }
  readURL(); draw(false);
  form.addEventListener("submit", (event) => { event.preventDefault(); draw(true, true); });
  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => draw(true), 120); });
  tags.addEventListener("change", () => draw(true, true));
  categories.addEventListener("change", () => { if (fixedCategory && categories.value !== fixedCategory) { const url = new URL("/archive/", location.origin); if (categories.value) url.searchParams.set("category", categories.value); location.href = `${url.pathname}${url.search}`; return; } draw(true, true); });
  sortToggle.addEventListener("click", () => { sort = sort === "latest" ? "oldest" : "latest"; draw(true, true); });
  reset.addEventListener("click", () => { search.value = ""; tags.value = ""; categories.value = fixedCategory; sort = "latest"; draw(true, true); search.focus(); });
  addEventListener("popstate", () => { readURL(); draw(false); });
}
