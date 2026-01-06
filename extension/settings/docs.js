(() => {
  const pairs = [
    {
      toggle: document.getElementById("docs-toggle-labels"),
      menu: document.getElementById("docs-menu-labels")
    },
    {
      toggle: document.getElementById("docs-toggle-variation"),
      menu: document.getElementById("docs-menu-variation")
    }
  ];

  pairs.forEach(({ toggle, menu }) => {
    if (!toggle || !menu) return;
    toggle.addEventListener("click", () => {
      const isHidden = menu.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!isHidden));
    });
  });
})();
