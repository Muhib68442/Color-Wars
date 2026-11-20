# Color Wars landing page

A single static page: `index.html`, `styles.css`, `app.js`, `content.json`, and
the copied brand assets in `assets/`. No build step and no dependencies.

## Edit content

All visible text, links, images, metadata, feature cards and download details
come from **`content.json`**. Change a value there and refresh the page — no
JavaScript or HTML edits needed.

Common edits:

| What | JSON key |
| --- | --- |
| Page title / description / favicon / theme colours | `meta` |
| Logo and app name | `brand` |
| Header links | `nav` |
| Hero headline, buttons, stats, board preview | `hero` |
| Feature cards | `features.items` |
| Download button, version, size, date, requirements | `download` |
| Footer text and links | `footer` |
| Accessible labels and error text | `a11y`, `errors` |

### Publish the APK link

`download.url` is deliberately set to `REPLACE_WITH_APK_URL`. While it is a
placeholder the page shows a disabled **Download coming soon** button instead
of a broken link. Replace it with the direct file URL, for example:

```json
"url": "https://raw.githubusercontent.com/muhib68442/Color-Wars/main/site/assets/color-wars-1.0.2.apk"
```

Then update `download.metadata` (version, size, updated date) and the button
becomes active automatically.

Copy the APK into `site/assets/` if you want to host it from your own domain or
GitHub Pages; `raw.githubusercontent.com` works for a public repository but is
not intended as a CDN.

## Preview locally

`fetch()` does not work from a `file://` page, so serve the folder over HTTP:

```powershell
cd site
python -m http.server 5200
```

Then open <http://localhost:5200>.

## Deploy

Publish the **contents of `site/`** (not the repository root) to your web host
or GitHub Pages branch. `index.html`, `styles.css`, `app.js`, `content.json`
and `assets/` must stay together in the same folder.

If you change `assets/logo.svg` or `font.ttf` in the game, copy the new file into
`site/assets/` as well; the landing page is a standalone copy.
