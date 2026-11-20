import {
  BOT_NAME,
  capacityAt,
  isLegalMove,
  type CellRef,
  type GameState,
  type Player,
} from "../engine/index.js";
import {
  readableAlt,
  readableInk,
  strengthenColor,
  type PlayerProfile,
} from "../platform/settings.js";

interface CellView {
  button: HTMLButtonElement;
  orbs: HTMLSpanElement[];
}

export interface BoardViewOptions {
  getProfiles: () => Record<Player, PlayerProfile>;
  /** The AI seat, if any, so its label never uses a player profile name. */
  getBotPlayer?: () => Player | null;
  /** True while the Bot is thinking; no human input is accepted. */
  isInputLocked?: () => boolean;
}

export interface BoardView {
  readonly element: HTMLElement;
  render(state: GameState): void;
  elementFor(ref: CellRef): HTMLElement | null;
  /** The configured colour for a player, used by the movement animations. */
  playerColor(player: Player): string;
  focusCell(ref: CellRef): void;
  focusDefault(): void;
}

const ARROW_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

function keyOf(row: number, col: number): string {
  return `${row}:${col}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function labelFor(
  state: GameState,
  profiles: Record<Player, PlayerProfile>,
  botPlayer: Player | null,
  row: number,
  col: number,
  orbs: number,
  capacity: number,
): string {
  const position = `Row ${row + 1}, column ${col + 1}`;
  const cell = state.board[row]?.[col] ?? null;

  if (cell === null) {
    return `${position}, empty`;
  }

  const name =
    cell.owner === botPlayer
      ? BOT_NAME
      : profiles[cell.owner].name.trim() || `Player ${cell.owner}`;
  return `${position}, ${name}, ${orbs} of ${capacity} orbs`;
}

export function createBoardView(
  element: HTMLElement,
  onSelect: (ref: CellRef) => void,
  options: BoardViewOptions,
): BoardView {
  const cells = new Map<string, CellView>();
  let rows = 0;
  let cols = 0;
  let lastState: GameState | null = null;
  let roving: CellRef = { row: 0, col: 0 };

  function build(nextRows: number, nextCols: number): void {
    rows = nextRows;
    cols = nextCols;
    cells.clear();
    element.replaceChildren();
    element.style.setProperty("--rows", String(nextRows));
    element.style.setProperty("--cols", String(nextCols));
    element.setAttribute("aria-label", `Board, ${nextRows} by ${nextCols}`);

    for (let row = 0; row < nextRows; row += 1) {
      for (let col = 0; col < nextCols; col += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell cell--empty";
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        button.dataset.orbs = "0";
        button.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}, empty`);

        const orbs: HTMLSpanElement[] = [];
        for (let index = 0; index < 4; index += 1) {
          const orb = document.createElement("span");
          orb.className = "orb";
          orb.setAttribute("aria-hidden", "true");
          button.append(orb);
          orbs.push(orb);
        }

        element.append(button);
        cells.set(keyOf(row, col), { button, orbs });
      }
    }
  }

  function cellAt(row: number, col: number): CellView | undefined {
    return cells.get(keyOf(row, col));
  }

  function isLegal(state: GameState, ref: CellRef): boolean {
    return isLegalMove(state, ref);
  }

  function firstLegal(state: GameState): CellRef | null {
    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        if (isLegal(state, { row, col })) return { row, col };
      }
    }
    return null;
  }

  function applyTabStops(active: CellRef, locked = false): void {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const node = cellAt(row, col);
        if (node === undefined) continue;
        node.button.tabIndex =
          !locked && row === active.row && col === active.col ? 0 : -1;
      }
    }
  }

  function render(state: GameState): void {
    lastState = state;
    if (state.rows !== rows || state.cols !== cols) {
      build(state.rows, state.cols);
    }

    if (roving.row >= rows || roving.col >= cols) {
      roving = { row: 0, col: 0 };
    }

    if (!state.gameOver && !isLegal(state, roving)) {
      const fallback = firstLegal(state);
      if (fallback !== null) roving = fallback;
    }

    const profiles = options.getProfiles();
    const botPlayer = options.getBotPlayer?.() ?? null;
    const locked = options.isInputLocked?.() ?? false;

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const node = cellAt(row, col);
        if (node === undefined) continue;

        const cell = state.board[row]?.[col] ?? null;
        const capacity = capacityAt(state.rows, state.cols, row, col);
        const legal = !locked && isLegal(state, { row, col });
        const orbs = cell?.orbs ?? 0;
        // Cells have four orb slots. A cell can briefly overshoot its capacity
        // while a cascade resolves, so cap the drawn count at the slot count.
        const shown = Math.min(orbs, node.orbs.length);
        // A cell one orb from bursting shows a dashed slot for the next orb, so
        // a corner/edge capacity is readable at a glance.
        const armed = cell !== null && orbs === capacity - 1;
        const profile = cell === null ? null : profiles[cell.owner];
        const name =
          cell === null
            ? ""
            : cell.owner === botPlayer
              ? BOT_NAME
              : profile?.name ?? `Player ${cell.owner}`;

        node.button.dataset.orbs = String(shown);
        node.button.dataset.capacity = String(capacity);
        node.button.title = cell
          ? `${name}: ${orbs} / ${capacity} orbs`
          : "Empty cell";
        node.button.setAttribute(
          "aria-label",
          labelFor(state, profiles, botPlayer, row, col, orbs, capacity),
        );

        if (profile === null) {
          node.button.style.removeProperty("--pc");
          node.button.style.removeProperty("--pc-strong");
          node.button.style.removeProperty("--orb-ink");
          node.button.style.removeProperty("--orb-alt");
        } else {
          node.button.style.setProperty("--pc", profile.color);
          node.button.style.setProperty(
            "--pc-strong",
            strengthenColor(profile.color),
          );
          node.button.style.setProperty("--orb-ink", readableInk(profile.color));
          node.button.style.setProperty("--orb-alt", readableAlt(profile.color));
        }
        node.button.setAttribute(
          "aria-disabled",
          legal ? "false" : "true",
        );

        const classes = ["cell", cell ? `cell--p${cell.owner}` : "cell--empty"];
        classes.push(legal ? "cell--legal" : "cell--blocked");
        node.button.className = classes.join(" ");

        for (let index = 0; index < node.orbs.length; index += 1) {
          const orb = node.orbs[index];
          if (orb === undefined) continue;
          orb.classList.toggle("is-visible", index < shown);
          orb.classList.toggle("is-ghost", armed && index === shown);
        }
      }
    }

    applyTabStops(roving, locked);
  }

  function focusCell(ref: CellRef): void {
    const node = cellAt(ref.row, ref.col);
    if (node === undefined) return;
    roving = { row: ref.row, col: ref.col };
    applyTabStops(roving, options.isInputLocked?.() ?? false);
    node.button.focus();
  }

  function focusDefault(): void {
    if (options.isInputLocked?.() ?? false) return;
    if (lastState !== null) {
      const legal = firstLegal(lastState);
      if (legal !== null) {
        focusCell(legal);
        return;
      }
    }
    focusCell({ row: 0, col: 0 });
  }

  element.addEventListener("click", (event) => {
    if (options.isInputLocked?.() ?? false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>("button[data-row]");
    if (button === null || !element.contains(button)) return;

    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    onSelect({ row, col });
  });

  element.addEventListener("keydown", (event) => {
    if (options.isInputLocked?.() ?? false) return;
    if (!ARROW_KEYS.has(event.key)) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>("button[data-row]");
    if (button === null || !element.contains(button)) return;

    let row = Number(button.dataset.row);
    let col = Number(button.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    switch (event.key) {
      case "ArrowUp":
        row -= 1;
        break;
      case "ArrowDown":
        row += 1;
        break;
      case "ArrowLeft":
        col -= 1;
        break;
      case "ArrowRight":
        col += 1;
        break;
      case "Home":
        col = 0;
        break;
      case "End":
        col = cols - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusCell({ row: clamp(row, 0, rows - 1), col: clamp(col, 0, cols - 1) });
  });

  element.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>("button[data-row]");
    if (button === null || !element.contains(button)) return;

    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    roving = { row, col };
    applyTabStops(roving);
  });

  return {
    element,
    render,
    elementFor: (ref) => cellAt(ref.row, ref.col)?.button ?? null,
    playerColor: (player) => options.getProfiles()[player].color,
    focusCell,
    focusDefault,
  };
}
