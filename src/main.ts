import "./styles/tokens.css";
import "./styles/app.css";

import { createHaptics } from "./platform/haptics.js";
import { installBackButton } from "./platform/backButton.js";
import { createSettingsStore } from "./platform/settings.js";
import { createSound } from "./platform/sound.js";
import { browserStore, createStorage } from "./platform/storage.js";
import { createWakeLock } from "./platform/wakeLock.js";
import { createApp } from "./ui/app.js";
import { SplashScreen } from "@capacitor/splash-screen";

// Never let a failed startup leave the launch splash covering the app.
function hideSplash(): void {
  void SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => undefined);
}
setTimeout(hideSplash, 450);

// WebKit gesture events bypass the viewport meta on some WebViews. Blocking
// them keeps pinch-zoom disabled everywhere in the app.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (event) => event.preventDefault(), {
    passive: false,
  });
}

const root = document.getElementById("app");

if (root === null) {
  throw new Error("Color Wars could not start: #app is missing.");
}

const store = browserStore();

const app = createApp(root, {
  storage: createStorage(store),
  settings: createSettingsStore(store),
  haptics: createHaptics(),
  sound: createSound(),
  wakeLock: createWakeLock(),
});

installBackButton(() => app.handleBack());

function persist(): void {
  app.persist();
}

window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
