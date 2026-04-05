import "@fontsource-variable/lilex";
import "virtual:uno.css";

document.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", () => {
  const root = document.documentElement;
  const order = ["dark", "light", "system"];
  const next = order[(order.indexOf(root.dataset.theme ?? "dark") + 1) % order.length];
  root.dataset.theme = next;
});
