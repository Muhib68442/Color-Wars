import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Sends Android hardware/gesture back presses to the app controller.
 *
 * `handleBack` returns true when the app consumed the press (closed a dialog,
 * opened the pause menu, or left an information screen). Returning false lets
 * Android close the app, which only happens on the home screen.
 */
export function installBackButton(handleBack: () => boolean): void {
  if (!Capacitor.isNativePlatform()) return;

  void CapacitorApp.addListener("backButton", () => {
    if (!handleBack()) void CapacitorApp.exitApp();
  });
}
