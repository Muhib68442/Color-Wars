import {
  cloneState,
  type GameEvent,
  type GameState,
} from "../engine/index.js";
import { strengthenColor } from "../platform/settings.js";
import type { BoardView } from "./boardView.js";
import {
  applyGameEvent,
  groupEvents,
  type ReplayGroup,
} from "./replay.js";

type CellEffect = "place" | "add" | "explode";
type Tracker = (animation: Animation) => void;

export interface ReplayCallbacks {
  /** Show a board snapshot while the cascade is still resolving. */
  render(state: GameState): void;
  /** Called as each cell detonates, so a sound can accompany the visual. */
  onExplode?(): void;
  /** Called once every group has been shown. */
  done(): void;
}

export interface ReplayHandle {
  cancel(): void;
}

/** How long an orb spends in the air when it jumps to a neighbour. */
const FLIGHT_MS = 560;
/** Gap between two orbs leaving the same explosion. */
const TRANSFER_STAGGER_MS = 165;
/** Pulse on the cell that detonates. */
const EXPLODE_PULSE_MS = 400;
/** Pause after the last orb of a group lands before the next cell explodes. */
const LANDING_HOLD_MS = 180;
/** Pause on the full cell right before it detonates. */
const ARMED_HOLD_MS = 160;
/** Pause after placing/adding the opening orb. */
const PLACE_HOLD_MS = 360;
/** Cross-fade from the old owner colour to the new one. */
const TAKEOVER_MS = 480;
/** Fade-in for the orb that has just arrived. */
const ORB_REVEAL_MS = 220;
/** Expanding landing/explosion ring. */
const RING_MS = 440;
/**
 * Long cascades are compressed to this budget so a pathological chain cannot
 * lock the UI for minutes. Short cascades use the full, deliberately slow pace.
 */
const MAX_REPLAY_MS = 30_000;
/** A detonation is never allowed to flash past in fewer than this many ms. */
const MIN_EXPLODE_MS = 450;
/** Floor for the compression applied to very long cascades. */
const MIN_TIMING_SCALE = 0.65;

const active = new WeakMap<Element, Animation>();
const takeovers = new WeakMap<Element, Animation>();
let fxLayer: HTMLDivElement | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canAnimateElement(element: Element): boolean {
  return (
    typeof element.animate === "function" &&
    typeof KeyframeEffect !== "undefined"
  );
}

function canPlayEvents(view: BoardView): boolean {
  if (prefersReducedMotion()) return false;
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  return canAnimateElement(view.element);
}

function scaled(ms: number, scale: number): number {
  return Math.max(1, Math.round(ms * scale));
}

function groupDuration(group: ReplayGroup): number {
  if (group.lead.type !== "explode") return PLACE_HOLD_MS;

  const lastStart =
    group.transfers.length === 0
      ? 0
      : (group.transfers.length - 1) * TRANSFER_STAGGER_MS;
  return (
    ARMED_HOLD_MS +
    Math.max(EXPLODE_PULSE_MS, lastStart + FLIGHT_MS + TAKEOVER_MS) +
    LANDING_HOLD_MS
  );
}

function timingScale(groups: ReplayGroup[]): number {
  let total = 0;
  for (const group of groups) total += groupDuration(group);
  const scale = total > MAX_REPLAY_MS ? MAX_REPLAY_MS / total : 1;
  // Recursive cascades used to compress to the point where individual pops
  // were unreadable. Keep a floor so every step stays visible.
  return Math.max(scale, MIN_TIMING_SCALE);
}

function cellKeyframes(effect: CellEffect): Keyframe[] {
  switch (effect) {
    case "place":
      return [
        { transform: "scale(0.78)", filter: "brightness(1.4)", opacity: 0.45 },
        { transform: "scale(1)", filter: "brightness(1)", opacity: 1 },
      ];
    case "add":
      return [
        { transform: "scale(1)" },
        { transform: "scale(1.1)" },
        { transform: "scale(1)" },
      ];
    case "explode":
      return [
        {
          transform: "scale(1.16)",
          filter: "brightness(1.35)",
          boxShadow: "0 0 0 0 rgba(255,255,255,.95)",
        },
        {
          transform: "scale(0.92)",
          filter: "brightness(1)",
          boxShadow: "0 0 0 18px rgba(255,255,255,0)",
        },
        { transform: "scale(1)" },
      ];
  }
}

function cellDuration(effect: CellEffect, scale: number): number {
  switch (effect) {
    case "place":
      return scaled(280, scale);
    case "add":
      return scaled(240, scale);
    case "explode":
      return scaled(EXPLODE_PULSE_MS, scale);
  }
}

function cellEasing(effect: CellEffect): string {
  switch (effect) {
    case "place":
      return "cubic-bezier(.2,.9,.3,1.2)";
    case "add":
      return "ease-out";
    case "explode":
      return "cubic-bezier(.2,.7,.3,1)";
  }
}

function animateCell(
  element: Element,
  effect: CellEffect,
  delay: number,
  scale: number,
  track: Tracker,
): void {
  if (!canAnimateElement(element)) return;

  active.get(element)?.cancel();

  const animation = element.animate(cellKeyframes(effect), {
    duration: cellDuration(effect, scale),
    delay,
    easing: cellEasing(effect),
    fill: "none",
  });
  active.set(element, animation);
  track(animation);
}

/**
 * Cross-fades a captured cell from its old owner colour to the new one. It is
 * started when the orb lands, so the colour visibly changes on arrival.
 */
function takeover(
  cell: HTMLElement,
  fromColor: string,
  toColor: string,
  duration: number,
  track: Tracker,
): void {
  if (!canAnimateElement(cell)) return;

  takeovers.get(cell)?.cancel();

  const animation = cell.animate(
    [
      {
        backgroundColor: fromColor,
        borderColor: strengthenColor(fromColor),
      },
      {
        backgroundColor: toColor,
        borderColor: strengthenColor(toColor),
      },
    ],
    {
      duration,
      easing: "cubic-bezier(.2,.7,.3,1)",
      fill: "backwards",
    },
  );
  takeovers.set(cell, animation);
  track(animation);
}

/** Pops the freshly added orb in once the flying orb has landed. */
function revealOrb(
  cell: HTMLElement,
  orbs: number,
  duration: number,
  track: Tracker,
): void {
  const index = orbs - 1;
  const finalOrbs = Number(cell.dataset.orbs);
  if (!Number.isFinite(finalOrbs) || index < 0 || index >= finalOrbs) return;

  const orb = cell.querySelectorAll<HTMLElement>(".orb")[index];
  if (orb === undefined || !canAnimateElement(orb)) return;

  const animation = orb.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration,
    easing: "ease-out",
    fill: "backwards",
  });
  track(animation);
}

function createLayer(): HTMLDivElement {
  fxLayer?.remove();

  const layer = document.createElement("div");
  layer.className = "fx-layer";
  document.body.append(layer);
  fxLayer = layer;
  return layer;
}

function ringAt(
  rect: DOMRect,
  color: string,
  delay: number,
  duration: number,
  layer: HTMLDivElement,
  track: Tracker,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;

  const size = Math.max(10, Math.min(rect.width, rect.height) * 0.78);
  const ring = document.createElement("span");
  ring.className = "fx-ring";
  ring.style.borderColor = color;
  ring.style.width = `${size}px`;
  ring.style.height = `${size}px`;
  ring.style.left = `${rect.left + rect.width / 2 - size / 2}px`;
  ring.style.top = `${rect.top + rect.height / 2 - size / 2}px`;
  layer.append(ring);

  const animation = ring.animate(
    [
      { transform: "scale(0.4)", opacity: 0 },
      { transform: "scale(0.7)", opacity: 0.95, offset: 0.22 },
      { transform: "scale(2.1)", opacity: 0 },
    ],
    {
      duration,
      delay,
      easing: "cubic-bezier(.2,.7,.3,1)",
      fill: "backwards",
    },
  );
  animation.onfinish = () => ring.remove();
  track(animation);
}

interface OrbPaint {
  size: number;
  background: string;
  border: string;
  boxShadow: string;
}

function orbPaintFor(cell: HTMLElement, color: string): OrbPaint {
  const template = cell.querySelector<HTMLElement>(".orb");
  const cellRect = cell.getBoundingClientRect();
  const fallbackSize = Math.max(
    5,
    Math.min(cellRect.width, cellRect.height) * 0.2,
  );

  if (template === null || typeof window === "undefined") {
    return {
      size: fallbackSize,
      background: color,
      border: "2px solid rgba(0,0,0,.25)",
      boxShadow: "none",
    };
  }

  const style = window.getComputedStyle(template);
  const width = Number.parseFloat(style.width);
  const borderWidth = Number.parseFloat(style.borderTopWidth);

  return {
    size: Number.isFinite(width) && width > 0 ? width : fallbackSize,
    background:
      style.backgroundColor === "rgba(0, 0, 0, 0)"
        ? color
        : style.backgroundColor,
    border:
      Number.isFinite(borderWidth) && borderWidth > 0
        ? `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`
        : "none",
    boxShadow: style.boxShadow === "none" ? "none" : style.boxShadow,
  };
}

/**
 * Sends one orb along a curved, slightly diagonal hop from the exploded cell to
 * its destination. The clone uses the destination's rendered orb styling, so
 * every player keeps their own fill/ring pattern in flight.
 */
function jumpOrb(
  from: HTMLElement,
  to: HTMLElement,
  color: string,
  delay: number,
  duration: number,
  layer: HTMLDivElement,
  track: Tracker,
): void {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();
  if (
    fromRect.width <= 0 ||
    toRect.width <= 0 ||
    fromRect.height <= 0 ||
    toRect.height <= 0
  ) {
    return;
  }

  const paint = orbPaintFor(to, color);
  const orb = document.createElement("span");
  orb.className = "fx-orb";
  orb.style.width = `${paint.size}px`;
  orb.style.height = `${paint.size}px`;
  orb.style.left = `${fromRect.left + fromRect.width / 2 - paint.size / 2}px`;
  orb.style.top = `${fromRect.top + fromRect.height / 2 - paint.size / 2}px`;
  orb.style.background = paint.background;
  orb.style.border = paint.border;
  if (paint.boxShadow !== "none") orb.style.boxShadow = paint.boxShadow;
  layer.append(orb);

  const startX = fromRect.left + fromRect.width / 2;
  const startY = fromRect.top + fromRect.height / 2;
  const endX = toRect.left + toRect.width / 2;
  const endY = toRect.top + toRect.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy) || 1;

  // Bulge sideways along the perpendicular, then lift the midpoint so the orb
  // arcs like a hop instead of sliding in a straight line.
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const bend = Math.min(16, distance * 0.2);
  const lift = Math.min(26, 8 + distance * 0.16);
  const midX = dx * 0.5 + perpX * bend;
  const midY = dy * 0.5 + perpY * bend - lift;

  const animation = orb.animate(
    [
      {
        transform: "translate3d(0, 0, 0) scale(0.62)",
        opacity: 0.85,
        offset: 0,
      },
      {
        transform: `translate3d(${midX}px, ${midY}px, 0) scale(1.18)`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.62)`,
        opacity: 1,
        offset: 0.86,
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.26)`,
        opacity: 0,
        offset: 1,
      },
    ],
    {
      duration,
      delay,
      easing: "cubic-bezier(.24,.72,.32,1)",
    },
  );
  animation.onfinish = () => orb.remove();
  track(animation);
}

interface Clock {
  readonly cancelled: boolean;
  wait(ms: number): Promise<boolean>;
  cancel(): void;
}

function createClock(): Clock {
  let cancelled = false;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const waiters = new Set<() => void>();

  function wait(ms: number): Promise<boolean> {
    if (cancelled) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;

      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        timeouts.delete(timer);
        waiters.delete(cancelWait);
        resolve(value);
      };

      const cancelWait = (): void => finish(false);
      timer = setTimeout(() => finish(true), ms);
      timeouts.add(timer);
      waiters.add(cancelWait);
    });
  }

  function cancel(): void {
    if (cancelled) return;
    cancelled = true;
    for (const timer of timeouts) clearTimeout(timer);
    timeouts.clear();
    for (const waiter of [...waiters]) waiter();
    waiters.clear();
  }

  return {
    get cancelled() {
      return cancelled;
    },
    wait,
    cancel,
  };
}

/**
 * Replays a move from its pre-move state, one explosion at a time. Each group
 * (an `explode` plus the transfers it launches) is applied to a private clone
 * and rendered as it happens, so the board never jumps to the final cascade.
 */
export function playEvents(
  preState: GameState,
  events: GameEvent[],
  view: BoardView,
  callbacks: ReplayCallbacks,
): ReplayHandle | null {
  if (!canPlayEvents(view)) return null;

  const groups = groupEvents(events);
  if (groups.length === 0) return null;

  const work = cloneState(preState);
  const layer = createLayer();
  const clock = createClock();
  const scale = timingScale(groups);
  const animations = new Set<Animation>();
  let finished = false;

  const track: Tracker = (animation) => {
    animations.add(animation);
  };

  const cleanup = (): void => {
    layer.remove();
    if (fxLayer === layer) fxLayer = null;
    animations.clear();
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    cleanup();
    callbacks.done();
  };

  async function runCascade(): Promise<void> {
    for (const group of groups) {
      if (clock.cancelled) return;

      if (group.lead.type === "place" || group.lead.type === "add") {
        applyGameEvent(work, group.lead);
        callbacks.render(work);

        const cell = view.elementFor(group.lead.at);
        if (cell !== null) {
          animateCell(cell, group.lead.type, 0, scale, track);
        }
        if (!(await clock.wait(scaled(PLACE_HOLD_MS, scale)))) return;
        continue;
      }

      // Hold on the full cell before it clears. A compressed long cascade can
      // otherwise flash past the orb that actually trips the detonation, which
      // makes a 4-orb pop look like it happened at 3.
      const armed = view.elementFor(group.lead.at);
      if (armed !== null) animateCell(armed, "add", 0, scale, track);
      if (!(await clock.wait(scaled(ARMED_HOLD_MS, scale)))) return;

      applyGameEvent(work, group.lead);
      callbacks.render(work);
      callbacks.onExplode?.();

      const source = view.elementFor(group.lead.at);
      if (source !== null) {
        animateCell(source, "explode", 0, scale, track);
        ringAt(
          source.getBoundingClientRect(),
          view.playerColor(group.lead.player),
          0,
          scaled(RING_MS, scale),
          layer,
          track,
        );
      }

      const stagger = Math.max(1, scaled(TRANSFER_STAGGER_MS, scale));
      const flight = scaled(FLIGHT_MS, scale);
      const landingDuration = scaled(TAKEOVER_MS, scale);
      const revealDuration = scaled(ORB_REVEAL_MS, scale);

      const landings = group.transfers.map(async (transfer, index) => {
        const delay = index * stagger;
        const destination = view.elementFor(transfer.to);
        if (destination === null) return;

        const color = view.playerColor(transfer.player);
        if (source !== null) {
          jumpOrb(source, destination, color, delay, flight, layer, track);
        }

        if (!(await clock.wait(delay + flight))) return;

        applyGameEvent(work, transfer);
        callbacks.render(work);

        if (transfer.captured && transfer.capturedFrom !== null) {
          takeover(
            destination,
            view.playerColor(transfer.capturedFrom),
            color,
            landingDuration,
            track,
          );
        }
        revealOrb(destination, transfer.orbs, revealDuration, track);
        ringAt(
          destination.getBoundingClientRect(),
          color,
          0,
          scaled(RING_MS, scale),
          layer,
          track,
        );
      });

      const lastStart =
        group.transfers.length === 0
          ? 0
          : (group.transfers.length - 1) * stagger;
      const groupEnd =
        Math.max(
          scaled(EXPLODE_PULSE_MS, scale),
          lastStart + flight + landingDuration,
        ) + scaled(LANDING_HOLD_MS, scale);

      // Even a heavily compressed chain gives each detonation a readable pause.
      const hold = Math.max(groupEnd, MIN_EXPLODE_MS);
      if (!(await clock.wait(hold))) return;
      await Promise.all(landings);
    }

    if (clock.cancelled) return;
    finish();
  }

  void runCascade();

  return {
    cancel(): void {
      if (finished) return;
      finished = true;
      clock.cancel();
      for (const animation of animations) {
        try {
          animation.cancel();
        } catch {
          // The animation may already have finished and been detached.
        }
      }
      cleanup();
    },
  };
}
