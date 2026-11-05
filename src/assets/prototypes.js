const select = (selector, root = document) => root.querySelector(selector);
const selectAll = (selector, root = document) => [...root.querySelectorAll(selector)];

const themeToggle = select(".prototype-theme-toggle");
if (themeToggle) {
  const updateThemeButton = () => {
    const dark = document.documentElement.dataset.theme !== "light";
    themeToggle.setAttribute(
      "aria-label",
      dark ? "라이트 모드로 전환" : "다크 모드로 전환",
    );
    select(".prototype-theme-icon", themeToggle).textContent = dark ? "☼" : "☾";
    select(".prototype-theme-label", themeToggle).textContent = dark
      ? "Light"
      : "Dark";
  };
  updateThemeButton();
  themeToggle.addEventListener("click", () => {
    const next =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("somani-prototype-theme", next);
    } catch {}
    updateThemeButton();
  });
}

for (const tablist of selectAll("[data-tablist]")) {
  const tabs = selectAll('[role="tab"]', tablist);
  const panels = tabs
    .map((tab) => document.getElementById(tab.getAttribute("aria-controls")))
    .filter(Boolean);
  const activate = (nextTab, focus = true) => {
    tabs.forEach((tab) => {
      const active = tab === nextTab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.id === nextTab.getAttribute("aria-controls");
      panel.classList.toggle("is-active", active);
      panel.toggleAttribute("inert", !active);
      if (active) panel.removeAttribute("aria-hidden");
      else panel.setAttribute("aria-hidden", "true");
    });
    if (focus) nextTab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab, false));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      activate(tabs[next]);
    });
  });
  const selected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
  if (selected) activate(selected, false);
}

const stage = select("[data-window-stage]");
if (stage) {
  const controls = selectAll("[data-window-target]");
  const windows = selectAll("[data-window]", stage);
  const activateWindow = (control, focusWindow = false) => {
    const targetId = control.dataset.windowTarget;
    controls.forEach((button) =>
      button.setAttribute("aria-pressed", String(button === control)),
    );
    windows.forEach((windowElement) =>
      windowElement.classList.toggle("is-active", windowElement.id === targetId),
    );
    const target = document.getElementById(targetId);
    if (focusWindow) target?.focus({ preventScroll: true });
    if (window.innerWidth <= 860)
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  controls.forEach((control) =>
    control.addEventListener("click", () => activateWindow(control, true)),
  );
}

const prototypeArticle = select("[data-prototype-article]");
if (prototypeArticle) {
  const prose = select("[data-prototype-prose]", prototypeArticle);
  const toc = select("[data-prototype-toc]", prototypeArticle);
  const headings = selectAll("h2, h3", prose);
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
    link.dataset.number =
      heading.tagName === "H2" ? String(section).padStart(2, "0") : "·";
    toc.append(link);
  });

  for (const [index, block] of selectAll("pre", prose).entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prototype-copy-button";
    button.textContent = "COPY";
    button.setAttribute("aria-label", `${index + 1}번째 코드 복사`);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(select("code", block)?.textContent || "");
        button.textContent = "COPIED";
        button.setAttribute("aria-label", "복사 완료");
        setTimeout(() => {
          button.textContent = "COPY";
          button.setAttribute("aria-label", `${index + 1}번째 코드 복사`);
        }, 1400);
      } catch {
        button.textContent = "FAILED";
      }
    });
    block.prepend(button);
  }

  for (const table of selectAll("table", prose)) {
    const wrapper = document.createElement("div");
    wrapper.className = "prototype-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "표 · 가로 스크롤 가능");
    table.before(wrapper);
    wrapper.append(table);
  }

  const progress = select(".prototype-reading-progress");
  const updateProgress = () => {
    const start = prototypeArticle.offsetTop;
    const distance = prototypeArticle.offsetHeight - window.innerHeight;
    const value = distance > 0 ? ((scrollY - start) / distance) * 100 : 100;
    progress.style.width = `${Math.min(100, Math.max(0, value))}%`;
  };
  updateProgress();
  addEventListener("scroll", updateProgress, { passive: true });
  addEventListener("resize", updateProgress, { passive: true });

  if ("IntersectionObserver" in window && headings.length) {
    const tocLinks = selectAll("a", toc);
    const headingObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        tocLinks.forEach((link) => {
          if (link.hash === `#${visible.target.id}`)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-18% 0px -70%", threshold: 0 },
    );
    headings.forEach((heading) => headingObserver.observe(heading));
  }
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const reveals = selectAll("[data-reveal]");
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
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );
  reveals.forEach((element) => observer.observe(element));
}

if (!reducedMotion.matches && matchMedia("(pointer: fine)").matches) {
  let animationFrame = 0;
  document.addEventListener(
    "pointermove",
    (event) => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        document.body.style.setProperty("--pointer-x", `${event.clientX}px`);
        document.body.style.setProperty("--pointer-y", `${event.clientY}px`);
      });
    },
    { passive: true },
  );
}
