import type { ExplosionStyle } from "./settings.js";

export interface Sound {
  /** Human placement: a soft, bright pip. */
  place(): void;
  /** Bot placement: a lower, two-step pip so it is identifiable. */
  botPlace(): void;
  /** One detonation in a cascade, using the selected explosion style. */
  explode(): void;
  /** Choose which synthesised detonation cue `explode()` plays. */
  setExplosionStyle(style: ExplosionStyle): void;
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

interface NoiseOptions {
  frequency: number;
  duration: number;
  delay?: number;
  gain?: number;
  type?: BiquadFilterType;
  endFrequency?: number;
  q?: number;
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
  let explosionStyle: ExplosionStyle = "pop";

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

  function resume(ctx: AudioContext): void {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  }

  function tone(options: ToneOptions): void {
    const ctx = ensure();
    if (ctx === null) return;
    resume(ctx);

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

  /** Short filtered noise burst, used for the crisper explosion variants. */
  function noise(options: NoiseOptions): void {
    const ctx = ensure();
    if (ctx === null) return;
    resume(ctx);

    const {
      frequency,
      duration,
      delay = 0,
      gain = 0.04,
      type = "lowpass",
      endFrequency,
      q = 0.7,
    } = options;
    const start = ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(Math.max(frequency, 1), start);
    if (endFrequency !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(endFrequency, 1),
        start + duration,
      );
    }
    filter.Q.value = q;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function explode(): void {
    switch (explosionStyle) {
      case "boom":
        // Deep, rounded thump with a short low-frequency tail.
        tone({
          frequency: 120,
          endFrequency: 36,
          duration: 0.22,
          type: "sine",
          gain: 0.085,
        });
        tone({
          frequency: 70,
          endFrequency: 28,
          duration: 0.28,
          delay: 0.015,
          type: "triangle",
          gain: 0.05,
        });
        noise({
          frequency: 900,
          endFrequency: 180,
          duration: 0.16,
          gain: 0.035,
        });
        break;

      case "crackle":
        // Bright, snappy burst with three quick sparks.
        tone({
          frequency: 900,
          endFrequency: 260,
          duration: 0.07,
          type: "square",
          gain: 0.035,
        });
        tone({
          frequency: 1250,
          endFrequency: 420,
          duration: 0.05,
          delay: 0.025,
          type: "square",
          gain: 0.028,
        });
        tone({
          frequency: 720,
          endFrequency: 220,
          duration: 0.06,
          delay: 0.05,
          type: "square",
          gain: 0.026,
        });
        noise({
          frequency: 1400,
          duration: 0.1,
          type: "highpass",
          gain: 0.05,
        });
        break;

      case "fizz":
        // Softer, airy release rather than a hard pop.
        noise({
          frequency: 2600,
          endFrequency: 500,
          duration: 0.3,
          gain: 0.045,
          q: 1.1,
        });
        tone({
          frequency: 300,
          endFrequency: 120,
          duration: 0.2,
          type: "sine",
          gain: 0.025,
        });
        break;

      case "pop":
      default:
        // Punchy two-layer pop: a bright click over a small low thump.
        tone({
          frequency: 520,
          endFrequency: 90,
          duration: 0.1,
          type: "triangle",
          gain: 0.06,
        });
        tone({
          frequency: 150,
          endFrequency: 60,
          duration: 0.13,
          delay: 0.012,
          type: "sine",
          gain: 0.05,
        });
        break;
    }
  }

  return {
    place: () => tone({ frequency: 620, duration: 0.07, gain: 0.045 }),
    botPlace: () => {
      tone({ frequency: 400, duration: 0.06, gain: 0.04 });
      tone({ frequency: 480, duration: 0.07, delay: 0.06, gain: 0.04 });
    },
    explode,
    setExplosionStyle: (style) => {
      explosionStyle = style;
    },
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
  botPlace: () => undefined,
  explode: () => undefined,
  setExplosionStyle: () => undefined,
  win: () => undefined,
  reject: () => undefined,
};
