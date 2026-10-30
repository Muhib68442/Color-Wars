import type { CellRef, GameEvent } from "../engine/index.js";
import type { BoardView } from "./boardView.js";

type Effect = "place" | "add" | "explode" | "transfer";

interface EffectSpec {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

const active = new WeakMap<Element, Animation>();

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

function specFor(effect: Effect): EffectSpec {
  switch (effect) {
    case "place":
      return {
        keyframes: [
          { transform: "scale(0.78)", opacity: 0.4 },
          { transform: "scale(1)", opacity: 1 },
        ],
        options: { duration: 190, easing: "cubic-bezier(.2,.9,.3,1.2)" },
      };
    case "add":
      return {
        keyframes: [
          { transform: "scale(1)" },
          { transform: "scale(1.12)" },
          { transform: "scale(1)" },
        ],
        options: { duration: 180, easing: "ease-out" },
      };
    case "explode":
      return {
        keyframes: [
          {
            transform: "scale(1.14)",
            boxShadow: "0 0 0 0 rgba(255,255,255,.95)",
          },
          {
            transform: "scale(1)",
            boxShadow: "0 0 0 16px rgba(255,255,255,0)",
          },
        ],
        options: { duration: 340, easing: "cubic-bezier(.2,.7,.3,1)" },
      };
    case "transfer":
      return {
        keyframes: [
          { filter: "brightness(1.6)" },
          { filter: "brightness(1)" },
        ],
        options: { duration: 240, easing: "ease-out" },
      };
  }
}

function animate(element: Element, effect: Effect, delay: number): void {
  if (!canAnimate(element)) return;

  active.get(element)?.cancel();

  const spec = specFor(effect);
  const animation = element.animate(spec.keyframes, {
    ...spec.options,
    delay,
    fill: "none",
  });
  active.set(element, animation);
}

function targetOf(event: GameEvent): { ref: CellRef; effect: Effect } | null {
  switch (event.type) {
    case "place":
      return { ref: event.at, effect: "place" };
    case "add":
      return { ref: event.at, effect: "add" };
    case "explode":
      return { ref: event.at, effect: "explode" };
    case "transfer":
      return { ref: event.to, effect: "transfer" };
    case "cascade-limit":
    case "win":
      return null;
  }
}

/**
 * Replays engine events as short visual flourishes. The board is already
 * rendered from the final state, so a dropped or skipped animation can never
 * desynchronise the DOM from the model.
 */
export function playEvents(events: GameEvent[], view: BoardView): void {
  if (prefersReducedMotion()) return;

  const seen = new Set<string>();
  let order = 0;
  let animated = 0;

  for (const event of events) {
    const target = targetOf(event);
    if (target === null) continue;

    const key = `${target.ref.row}:${target.ref.col}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const element = view.elementFor(target.ref);
    if (element === null) continue;

    animate(element, target.effect, Math.min(order, 16) * 14);
    order += 1;
    animated += 1;

    if (animated >= 49) break;
  }
}
