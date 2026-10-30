export interface Sound {
  place(): void;
  explode(): void;
  win(): void;
  reject(): void;
}

interface ToneOptions {
  frequency: number;
  duration?: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
  endFrequency?: number;
}

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return candidate.AudioContext ?? candidate.webkitAudioContext ?? null;
}

/**
 * Tiny Web Audio feedback adapter. No asset files, no network, and the
 * context is only created after a user gesture (the first accepted move).
 */
export function createSound(): Sound {
  let context: AudioContext | null = null;

  function ensure(): AudioContext | null {
    if (context !== null) return context;
    const Constructor = audioContextConstructor();
    if (Constructor === null) return null;

    try {
      context = new Constructor();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(options: ToneOptions): void {
    const ctx = ensure();
    if (ctx === null) return;

    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }

    const {
      frequency,
      duration = 0.08,
      delay = 0,
      type = "sine",
      gain = 0.05,
      endFrequency,
    } = options;
    const start = ctx.currentTime + delay;

    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(endFrequency, 1),
        start + duration,
      );
    }

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(envelope);
    envelope.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  return {
    place: () => tone({ frequency: 540, duration: 0.07, gain: 0.045 }),
    explode: () =>
      tone({
        frequency: 180,
        endFrequency: 60,
        duration: 0.13,
        type: "sawtooth",
        gain: 0.07,
      }),
    win: () => {
      tone({ frequency: 523, duration: 0.12, gain: 0.06 });
      tone({ frequency: 659, duration: 0.12, delay: 0.1, gain: 0.06 });
      tone({ frequency: 784, duration: 0.18, delay: 0.2, gain: 0.06 });
    },
    reject: () =>
      tone({
        frequency: 130,
        duration: 0.07,
        type: "square",
        gain: 0.04,
      }),
  };
}

export const noopSound: Sound = {
  place: () => undefined,
  explode: () => undefined,
  win: () => undefined,
  reject: () => undefined,
};
