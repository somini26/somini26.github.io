(() => {
  try {
    const saved = localStorage.getItem("somini-theme");
    if (saved === "dark" || saved === "light")
      document.documentElement.dataset.theme = saved;
  } catch {}
})();
