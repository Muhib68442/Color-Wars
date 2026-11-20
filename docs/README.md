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

`download.url` points at the APK committed alongside the site:

```json
"url": "https://muhib68442.github.io/Color-Wars/colorwars%20v1.0.2.apk"
```

The file is `docs/colorwars v1.0.2.apk`; `%20` is the URL-encoded space. The
button is active because the URL is absolute `http(s)`. If you rename or move
the APK, update this URL. `download.metadata` (version, size, updated date) is
kept in sync with the file.

## Preview locally

`fetch()` does not work from a `file://` page, so serve the folder over HTTP:

```powershell
cd docs
python -m http.server 5200
```

Then open <http://localhost:5200>.

## Deploy

Publish the **contents of `docs/`** (not the repository root) to your web host
or GitHub Pages branch. `index.html`, `styles.css`, `app.js`, `content.json`
and `assets/` must stay together in the same folder.

If you change `assets/logo.svg` or `font.ttf` in the game, copy the new file into
`docs/assets/` as well; the landing page is a standalone copy.
