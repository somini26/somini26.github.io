const cIndex = document.querySelector("[data-category-index]");

if (cIndex) {
  const triggers = [...cIndex.querySelectorAll("[data-category-trigger]")];
  const panels = [...cIndex.querySelectorAll("[data-category-panel]")];

  const activateCategory = (trigger) => {
    const targetId = trigger.dataset.previewId;
    triggers.forEach((item) => {
      const active = item === trigger;
      item.closest("li")?.classList.toggle("is-active", active);
      if (active) item.dataset.active = "true";
      else delete item.dataset.active;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== targetId;
    });
  };

  triggers.forEach((trigger, index) => {
    trigger.addEventListener("mouseenter", () => activateCategory(trigger));
    trigger.addEventListener("focus", () => activateCategory(trigger));
    trigger.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowUp")
        next = (index - 1 + triggers.length) % triggers.length;
      if (event.key === "ArrowDown") next = (index + 1) % triggers.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = triggers.length - 1;
      triggers[next].focus();
    });
  });
}
