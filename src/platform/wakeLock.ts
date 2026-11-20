import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Capacitor removed the official keep-awake plugin in v8, so the Android shell
 * exposes this small plugin directly. Web builds simply keep the no-op path.
 */
interface KeepAwakePlugin {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
}

const KeepAwake = registerPlugin<KeepAwakePlugin>("KeepAwake");

export interface WakeLock {
  keepAwake(): void;
  allowSleep(): void;
}

export function createWakeLock(): WakeLock {
  const native = Capacitor.isNativePlatform();
  let active = false;

  return {
    keepAwake() {
      if (!native || active) return;
      active = true;
      void KeepAwake.keepAwake().catch(() => {
        active = false;
      });
    },
    allowSleep() {
      if (!native || !active) return;
      active = false;
      void KeepAwake.allowSleep().catch(() => undefined);
    },
  };
}

export const noopWakeLock: WakeLock = {
  keepAwake: () => undefined,
  allowSleep: () => undefined,
};
