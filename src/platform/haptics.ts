export interface Haptics {
  tap(): void;
  reject(): void;
}

function vibrate(ms: number): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;

  try {
    navigator.vibrate(ms);
  } catch {
    // Vibration is a nicety; ignore platform refusals.
  }
}

/**
 * Web adapter. In the Capacitor shell this will be swapped for
 * `@capacitor/haptics`; the interface stays identical.
 */
export function createHaptics(): Haptics {
  return {
    tap: () => vibrate(8),
    reject: () => vibrate(18),
  };
}

export const noopHaptics: Haptics = {
  tap: () => undefined,
  reject: () => undefined,
};
