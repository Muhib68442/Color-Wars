import type { GameEvent } from "../engine/index.js";
import { strengthenColor } from "../platform/settings.js";
import type { BoardView } from "./boardView.js";

type CellEffect = "place" | "add" | "explode";

/** How long an orb spends in the air when it jumps to a neighbour. */
const FLIGHT_MS = 280;
/** Delay between cascade steps, capped so long chains still feel immediate. */
const STEP_MS = 110;
const MAX_STEP = 10;
const MAX_FLIGHTS = 72;
const MAX_CELL_EFFECTS = 90;
const MAX_TRANSFER_EFFECTS = 120;

const active = new WeakMap<Element, Animation>();
let fxLayer: HTMLDivElement | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canAnimate(element: Element): boolean {
  return (
    typeof element.animate === "function" &&
    typeof KeyframeEffect !== "undefined"
  );
}

function stepDelay(step: number): number {
  return Math.min(Math.max(step, 0), MAX_STEP) * STEP_MS;
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

function cellOptions(effect: CellEffect): KeyframeAnimationOptions {
  switch (effect) {
    case "place":
      return { duration: 190, easing: "cubic-bezier(.2,.9,.3,1.2)" };
    case "add":
      return { duration: 180, easing: "ease-out" };
    case "explode":
      return { duration: 360, easing: "cubic-bezier(.2,.7,.3,1)" };
  }
}

function animateCell(element: Element, effect: CellEffect, delay: number): void {
  if (!canAnimate(element)) return;

  active.get(element)?.cancel();

  const animation = element.animate(cellKeyframes(effect), {
    ...cellOptions(effect),
    delay,
    fill: "none",
  });
  active.set(element, animation);
}

/**
 * Cross-fades a captured cell from its old owner colour to the new one. The
 * first keyframe is held through the delay (while the orb is still in the air),
 * so the colour visibly changes only when the orb lands.
 */
function takeover(
  cell: HTMLElement,
  fromColor: string,
  toColor: string,
  delay: number,
): void {
  if (!canAnimate(cell)) return;

  cell.animate(
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
      duration: 260,
      delay,
      easing: "cubic-bezier(.2,.7,.3,1)",
      fill: "backwards",
    },
  );
}

/** Hides the freshly added orb until the flying orb lands, then pops it in. */
function revealOrb(cell: HTMLElement, orbs: number, delay: number): void {
  const index = orbs - 1;
  const finalOrbs = Number(cell.dataset.orbs);
  if (!Number.isFinite(finalOrbs) || index < 0 || index >= finalOrbs) return;

  const orb = cell.querySelectorAll<HTMLElement>(".orb")[index];
  if (orb === undefined || !canAnimate(orb)) return;

  orb.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 150,
    delay,
    easing: "ease-out",
    fill: "backwards",
  });
}

function createLayer(): HTMLDivElement {
  fxLayer?.remove();

  const layer = document.createElement("div");
  layer.className = "fx-layer";
  document.body.append(layer);
  fxLayer = layer;
  return layer;
}

function disposeLayer(layer: HTMLDivElement, after: number): void {
  window.setTimeout(() => {
    layer.remove();
    if (fxLayer === layer) fxLayer = null;
  }, Math.max(after, 400) + 80);
}

function ringAt(
  rect: DOMRect,
  color: string,
  delay: number,
  duration: number,
  layer: HTMLDivElement,
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
  layer: HTMLDivElement,
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
      duration: FLIGHT_MS,
      delay,
      easing: "cubic-bezier(.24,.72,.32,1)",
    },
  );
  animation.onfinish = () => orb.remove();
}

/**
 * Replays engine events as short visual flourishes. The board is already
 * rendered from the final state, so a dropped or skipped animation can never
 * desynchronise the DOM from the model.
 */
export function playEvents(events: GameEvent[], view: BoardView): void {
  if (prefersReducedMotion()) return;
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!canAnimate(view.element)) return;

  const layer = createLayer();
  let step = -1;
  let lane = 0;
  let flights = 0;
  let cellEffects = 0;
  let transferEffects = 0;
  let lastEnd = 0;

  const mark = (end: number): void => {
    if (end > lastEnd) lastEnd = end;
  };

  for (const event of events) {
    switch (event.type) {
      case "place":
      case "add": {
        if (cellEffects >= MAX_CELL_EFFECTS) break;
        const cell = view.elementFor(event.at);
        if (cell !== null) {
          animateCell(cell, event.type, 0);
          cellEffects += 1;
        }
        break;
      }

      case "explode": {
        step += 1;
        lane = 0;
        if (cellEffects >= MAX_CELL_EFFECTS) break;

        const delay = stepDelay(step);
        const cell = view.elementFor(event.at);

        if (cell !== null) {
          animateCell(cell, "explode", delay);
          ringAt(
            cell.getBoundingClientRect(),
            view.playerColor(event.player),
            delay,
            FLIGHT_MS * 1.3,
            layer,
          );
          cellEffects += 1;
        }
        mark(delay + FLIGHT_MS * 1.3);
        break;
      }

      case "transfer": {
        if (transferEffects >= MAX_TRANSFER_EFFECTS) break;
        const destination = view.elementFor(event.to);
        if (destination === null) break;
        transferEffects += 1;

        const delay = stepDelay(step) + 30 + Math.min(lane, 4) * 16;
        lane += 1;

        const landing = delay + FLIGHT_MS * 0.86;
        const color = view.playerColor(event.player);
        const destinationRect = destination.getBoundingClientRect();

        if (event.captured && event.capturedFrom !== null) {
          takeover(
            destination,
            view.playerColor(event.capturedFrom),
            color,
            landing,
          );
        }

        revealOrb(destination, event.orbs, landing + 40);
        ringAt(destinationRect, color, landing, 340, layer);

        const source = view.elementFor(event.from);
        if (source !== null && flights < MAX_FLIGHTS) {
          jumpOrb(source, destination, color, delay, layer);
          flights += 1;
        }

        mark(delay + FLIGHT_MS + 120);
        break;
      }

      case "cascade-limit":
      case "win":
        break;
    }
  }

  disposeLayer(layer, lastEnd);
}
