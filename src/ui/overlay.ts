import { requireElement } from "./query.js";

export interface OverlayAction {
  label: string;
  variant?: "primary" | "secondary";
  run: () => void;
}

export interface OverlayOptions {
  eyebrow: string;
  title: string;
  body: string;
  actions: OverlayAction[];
}

export interface Overlay {
  open(options: OverlayOptions): void;
  close(): void;
  isOpen(): boolean;
}

export function createOverlay(
  dialog: HTMLDialogElement,
  onClose: () => void,
): Overlay {
  const eyebrow = requireElement<HTMLElement>(
    dialog,
    "[data-role='overlay-eyebrow']",
  );
  const title = requireElement<HTMLElement>(
    dialog,
    "[data-role='overlay-title']",
  );
  const body = requireElement<HTMLElement>(
    dialog,
    "[data-role='overlay-body']",
  );
  const actions = requireElement<HTMLElement>(
    dialog,
    "[data-role='overlay-actions']",
  );

  let open = false;

  function close(): void {
    if (!open) return;
    open = false;

    let closed = false;
    if (typeof dialog.close === "function") {
      try {
        dialog.close();
        closed = true;
      } catch {
        closed = false;
      }
    }
    if (!closed) dialog.removeAttribute("open");

    onClose();
  }

  function openWith(options: OverlayOptions): void {
    eyebrow.textContent = options.eyebrow;
    title.textContent = options.title;
    body.textContent = options.body;

    actions.replaceChildren();
    for (const action of options.actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn btn--${action.variant ?? "secondary"}`;
      button.textContent = action.label;
      button.addEventListener("click", action.run);
      actions.append(button);
    }

    open = true;
    let shown = false;
    if (typeof dialog.showModal === "function") {
      try {
        dialog.showModal();
        shown = true;
      } catch {
        shown = false;
      }
    }
    if (!shown) dialog.setAttribute("open", "");

    const first = actions.querySelector<HTMLButtonElement>("button");
    first?.focus();
  }

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener("close", () => {
    if (!open) return;
    open = false;
    onClose();
  });

  return {
    open: openWith,
    close,
    isOpen: () => open,
  };
}
