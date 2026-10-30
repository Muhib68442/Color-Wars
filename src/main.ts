import "./styles/tokens.css";
import "./styles/app.css";

import { createHaptics } from "./platform/haptics.js";
import { browserStore, createStorage } from "./platform/storage.js";
import { createApp } from "./ui/app.js";

const root = document.getElementById("app");

if (root === null) {
  throw new Error("Color Wars could not start: #app is missing.");
}

const app = createApp(root, {
  storage: createStorage(browserStore()),
  haptics: createHaptics(),
});

function persist(): void {
  app.persist();
}

window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
