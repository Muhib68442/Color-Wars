/**
 * Static one-page site. Every visible string, link and image path lives in
 * content.json; this file only turns that data into DOM nodes.
 */
const app = document.querySelector("#app");
const dataUrl = new URL("./content.json", import.meta.url);

const FALLBACK_ERROR = {
  title: "Site content could not be loaded",
  body: "Open this page from a local web server (not directly as a file) and make sure content.json is next to index.html.",
  button: "Try again",
};

/** Tiny DOM builder. Text is always set with textContent, never as HTML. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }

  return node;
}

function applyMeta(meta) {
  document.documentElement.lang = meta.lang || "en";
  document.title = meta.title || "Color Wars";

  const description = document.querySelector('meta[name="description"]');
  if (description && meta.description) {
    description.setAttribute("content", meta.description);
  }

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && meta.favicon) favicon.setAttribute("href", meta.favicon);

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme && meta.themeColor) {
    theme.setAttribute("content", meta.themeColor);
    theme.setAttribute("media", "(prefers-color-scheme: light)");
  }
  if (theme && meta.themeColorDark) {
    document.head.append(
      el("meta", {
        name: "theme-color",
        content: meta.themeColorDark,
        media: "(prefers-color-scheme: dark)",
      }),
    );
  }
}

function brandMark(brand) {
  const light = brand.logo || "./assets/logo.svg";
  const dark = brand.logoDark || light;

  return el(
    "picture",
    {},
    el("source", { media: "(prefers-color-scheme: dark)", srcset: dark }),
    el("img", {
      class: "brand__mark",
      src: light,
      alt: brand.logoAlt || "",
      width: "38",
      height: "38",
    }),
  );
}

function buildBoard(cells) {
  const board = el("div", { class: "board" });

  for (const item of Array.isArray(cells) ? cells : []) {
    const cell = el("div", { class: "board__cell" });
    if (item) {
      const tone = `tone--${item.tone || "p1"}`;
      for (let index = 0; index < 4; index += 1) {
        cell.append(
          el("span", {
            class: `board__orb ${tone}${index < (item.orbs || 0) ? " is-visible" : ""}`,
          }),
        );
      }
    }
    board.append(cell);
  }

  return board;
}

function downloadButton(download) {
  const url = String(download.url || "").trim();
  const ready = /^https?:\/\/\S+$/i.test(url) && !url.includes("REPLACE_WITH");

  if (!ready) {
    console.warn(
      "Color Wars: set download.url in site/content.json to a real APK URL.",
    );
    return el(
      "button",
      { class: "btn btn--primary btn--large", type: "button", disabled: true },
      download.comingSoonLabel || "Download coming soon",
    );
  }

  return el(
    "a",
    {
      class: "btn btn--primary btn--large",
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    download.buttonLabel || "Download APK",
  );
}

function renderHeader(data) {
  const brand = data.brand || {};
  const links = Array.isArray(data.nav) ? data.nav : [];

  return el(
    "header",
    { class: "site-header shell" },
    el(
      "a",
      { class: "brand", href: brand.href || "#top" },
      brandMark(brand),
      el("span", { class: "brand__name" }, brand.name || "Color Wars"),
    ),
    el(
      "nav",
      { class: "site-nav", "aria-label": (data.a11y || {}).navLabel || "Sections" },
      ...links.map((link) =>
        el("a", { class: "site-nav__link", href: link.href || "#" }, link.label || ""),
      ),
    ),
  );
}

function renderHero(data) {
  const hero = data.hero || {};
  const facts = Array.isArray(hero.facts) ? hero.facts : [];

  return el(
    "section",
    { class: "hero", id: "top" },
    el(
      "div",
      { class: "hero__copy" },
      el("p", { class: "eyebrow" }, hero.eyebrow || ""),
      el("h1", {}, hero.title || ""),
      el("p", { class: "hero__subtitle" }, hero.subtitle || ""),
      el(
        "div",
        { class: "hero__actions" },
        hero.primaryCta &&
          el(
            "a",
            {
              class: "btn btn--primary btn--large",
              href: hero.primaryCta.href || "#download",
            },
            hero.primaryCta.label || "",
          ),
        hero.secondaryCta &&
          el(
            "a",
            {
              class: "btn btn--quiet btn--large",
              href: hero.secondaryCta.href || "#features",
            },
            hero.secondaryCta.label || "",
          ),
      ),
      el(
        "dl",
        { class: "facts" },
        ...facts.map((fact) =>
          el(
            "div",
            { class: "facts__item" },
            el("dt", {}, fact.value || ""),
            el("dd", {}, fact.label || ""),
          ),
        ),
      ),
    ),
    el(
      "div",
      {
        class: "hero__art",
        role: "img",
        "aria-label": (data.a11y || {}).heroArtLabel || "Color Wars board",
      },
      buildBoard(hero.previewBoard),
    ),
  );
}

function renderFeatures(data) {
  const features = data.features || {};
  const items = Array.isArray(features.items) ? features.items : [];

  return el(
    "section",
    { class: "features", id: "features" },
    el(
      "div",
      { class: "section-heading" },
      el("p", { class: "eyebrow" }, features.eyebrow || ""),
      el("h2", {}, features.title || ""),
      el("p", { class: "section-heading__subtitle" }, features.subtitle || ""),
    ),
    el(
      "div",
      { class: "feature-grid" },
      ...items.map((item) =>
        el(
          "article",
          { class: "feature" },
          el("span", {
            class: `feature__orb tone--${item.tone || "p1"}`,
            "aria-hidden": "true",
          }),
          el("h3", {}, item.title || ""),
          el("p", {}, item.description || ""),
        ),
      ),
    ),
  );
}

function renderDownload(data) {
  const download = data.download || {};
  const metadata = Array.isArray(download.metadata) ? download.metadata : [];

  return el(
    "section",
    { class: "download", id: "download" },
    el(
      "div",
      { class: "download__card" },
      el(
        "div",
        { class: "download__copy" },
        el("p", { class: "eyebrow" }, download.eyebrow || ""),
        el("h2", {}, download.title || ""),
        el("p", { class: "download__description" }, download.description || ""),
        el("div", { class: "download__actions" }, downloadButton(download)),
        el("p", { class: "download__note" }, download.note || ""),
      ),
      el(
        "dl",
        {
          class: "download__meta",
          "aria-label": download.metadataLabel || "Download details",
        },
        ...metadata.map((row) =>
          el(
            "div",
            { class: "download__meta-row" },
            el("dt", {}, row.label || ""),
            el("dd", {}, row.value || ""),
          ),
        ),
      ),
    ),
  );
}

function renderFooter(data) {
  const footer = data.footer || {};
  const links = Array.isArray(footer.links) ? footer.links : [];

  return el(
    "footer",
    { class: "site-footer shell" },
    el("p", { class: "site-footer__text" }, footer.text || ""),
    el(
      "nav",
      { class: "site-footer__links", "aria-label": "Links" },
      ...links.map((link) =>
        el(
          "a",
          {
            href: link.href || "#",
            target: "_blank",
            rel: "noopener noreferrer",
          },
          link.label || "",
        ),
      ),
    ),
    el("p", { class: "site-footer__copyright" }, footer.copyright || ""),
  );
}

function renderSite(data) {
  applyMeta(data.meta || {});

  app.replaceChildren(
    el("a", { class: "skip-link", href: "#main" }, (data.a11y || {}).skipLink || "Skip to content"),
    renderHeader(data),
    el(
      "main",
      { id: "main" },
      el("div", { class: "shell" }, renderHero(data)),
      el("div", { class: "shell" }, renderFeatures(data)),
      el("div", { class: "shell" }, renderDownload(data)),
    ),
    renderFooter(data),
  );
}

function renderError(messages = {}) {
  const text = { ...FALLBACK_ERROR, ...messages };
  app.replaceChildren(
    el(
      "main",
      { class: "error shell", id: "main" },
      el("h1", {}, text.title),
      el("p", {}, text.body),
      el(
        "button",
        { class: "btn btn--primary", type: "button", onClick: () => window.location.reload() },
        text.button,
      ),
    ),
  );
}

async function init() {
  if (!app) return;

  try {
    const response = await fetch(dataUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data || typeof data !== "object") throw new Error("Invalid content.json");
    renderSite(data);
  } catch (error) {
    console.error("Color Wars site data failed to load:", error);
    renderError();
  }
}

init();
