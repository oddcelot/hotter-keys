// @ts-nocheck
import "@fontsource-variable/lilex";
import "virtual:uno.css";

document.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", () => {
  const root = document.documentElement;
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
});
