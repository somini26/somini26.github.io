(() => {
  document.documentElement.classList.add("has-js");
  try {
    const saved = localStorage.getItem("somani-prototype-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.dataset.theme = saved;
    }
  } catch {}
})();
