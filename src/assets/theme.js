(() => {
  try {
    const saved =
      localStorage.getItem("somani-theme") ||
      localStorage.getItem("somini-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.dataset.theme = saved;
      localStorage.setItem("somani-theme", saved);
      localStorage.removeItem("somini-theme");
    }
  } catch {}
})();
