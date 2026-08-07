# Grid — layout system generator

A browser tool that builds print and screen layout grids the way InDesign's *New Document*
and *Create Guides* dialogs do — page size, margins, bleed, columns, rows and a baseline —
and exports them as SVG, transparent PNG or JPG.

Live at **grid.matteocurcio.com**. Current revision **rev0.4**.

Every change bumps the rev badge by one decimal point — it appears in the `<h1>` and the
panel footer — and the `?v=` on the asset URLs moves with it. The badge is how you tell a
deployed build apart on refresh; the `?v=` is what makes that reliable.

## What it does

- **Page presets** — ISO A0–A7, ISO B2–B5, US (Letter, Legal, Tabloid, Half Letter,
  Executive, US Trade, Digest), other print (square, DL, business cards, record sleeve)
  and screen sizes (desktop, laptop, tablet, phone, social, slides). Or set any custom
  size in mm, cm, inches, points or pixels.
- **Grid presets** — grouped by how they get used: portrait print (editorial 6 and 12
  column, Swiss 4 × 8, Müller-Brockmann 6 × 6, magazine 6 × 9, newspaper 5), landscape
  print (slide 12 × 6, panorama 16 × 9, spread 8) and web (Bootstrap, Material, Tailwind,
  tablet 8, mobile 4, modular 12 × 8).
- **Facing pages** — turns the document into a spread: two pages of the document size side
  by side, joined at a spine drawn down the centre. The inside margin sits at the spine on
  both, so the margins mirror, and each page carries its own columns, rows and baseline. A
  **binding allowance** widens both inside margins to cover what the bind swallows. Bleed
  on a spread applies to the two outer edges only — nothing bleeds at the spine.
- **Margins, bleed and baseline switch on and off** as whole features, from the switch in
  each section header. Margins start on; bleed and baseline start off. A disabled section
  keeps its values but contributes nothing to the geometry, so turning bleed off gives a
  canvas at exactly trim size.
- **Baseline grid** — an increment and a start offset, ruled from the top of the guide area
  in the page's own units, optionally restarting at the top of every row band.
- **Colour-coded preview** — bleed in red, margins in magenta, columns in violet, rows in
  cyan, baseline in amber, trim in grey. Each layer toggles from the legend above the
  preview.
- **Printed measurements** — an optional band outside the page annotating every dimension
  along both axes (page, bleed, margins, content, column, gutter, row, baseline), each in
  the page's unit and in pixels at the export resolution. The band sits entirely outside
  the trim, and carries one measure per row, so labels can collide with neither the guides
  nor each other.
- **Export** — every selected format downloads at once. SVG carries real physical units
  (`width="216mm"`) and named layer groups that open cleanly in Illustrator or Affinity.
  PNG is transparent, JPG is flattened onto white.
- **Copy CSS Grid** — the same grid as `grid-template-columns` / `gap` / `padding`.

Settings persist in `localStorage`, so the tool reopens where you left it.

## Running locally

No build step, no dependencies — it's static files.

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Deploying to Cloudflare

Deployed as the Cloudflare Pages project `grid`, served at https://grid-96p.pages.dev
(the `-96p` suffix is Cloudflare's — `grid.pages.dev` was already taken by another
account) and fronted by `grid.matteocurcio.com`.

The project is connected to `github.com/matteocurcio/Grid`, so **deploying is just pushing
to `main`** — Cloudflare builds and publishes on its own. There is no build command and no
output directory; it serves the repo root.

```bash
git push
```

Manual uploads with `wrangler pages deploy` are no longer the path and would sit outside
the Git history. If you ever need one, run it from this directory — `.` uploads wholesale.

`_headers` sets the security and cache headers, and only takes effect on Cloudflare, so
it can't be tested locally. Everything now revalidates on each request.

Assets used to carry `max-age=3600`, which broke two consecutive releases: the HTML is
served uncached, so a redeploy shipped new markup against hour-old CSS and JS. It renders
as a half-updated page rather than an obvious failure — switches drawn as bare dashes, new
defaults silently ignored.

The `?v=` query on the script and stylesheet tags only fixes the *browser* half of that.
**Cloudflare's edge caches by path and ignores the query string**, so a `?v=` bump does not
reach the CDN — verified by fetching a unique `?cb=` and still getting the old file. That
is why the assets are now `max-age=0, must-revalidate`. Bumping `?v=` on release is still
worth doing for browser caches, but it is not what makes a deploy safe.

Long caching only becomes safe with content-hashed filenames, which needs a build step.

**On `grid.matteocurcio.com` the zone overrides that anyway.** The custom domain returns
`max-age=14400` on `.js` and `.css` regardless of `_headers`, because the zone's Browser
Cache TTL applies to cacheable file types — `pages.dev` still honours `max-age=0`, so the
two hosts disagree. Bumping `?v=` per release is what keeps this safe: a new query string
is a new URL, so the four-hour cache on the old one never gets consulted. Ship a change
without bumping and returning visitors can hold stale assets for four hours. To remove the
hazard entirely, set Caching → Configuration → Browser Cache TTL to *Respect Existing
Headers* on the `matteocurcio.com` zone.

After any deploy, verify against the deployment-specific URL wrangler prints
(`https://<hash>.grid-96p.pages.dev`) rather than the alias — the alias can lag behind
whatever the edge is still holding.

The per-deployment preview URLs (`<hash>.grid-96p.pages.dev`) need a
`*.grid-96p.pages.dev` certificate that takes a few minutes to issue after a new project
is created. Before it lands, those URLs fail the TLS handshake — Firefox reports it as
`SSL_ERROR_NO_CYPHER_OVERLAP`. The bare `grid-96p.pages.dev` address works throughout.

## How it's put together

| File | Role |
| --- | --- |
| `index.html` | Markup for the control panel and preview stage |
| `styles.css` | Design tokens and layout, light and dark themes |
| `js/units.js` | Conversion between mm, cm, in, pt and px (96 dpi CSS reference) |
| `js/presets.js` | Page and grid preset tables |
| `js/render.js` | Geometry and SVG generation |
| `js/export.js` | SVG serialisation, canvas rasterisation, downloads, CSS output |
| `js/app.js` | State, input binding, preset application, preview |

The preview and all three export formats come from one renderer in `js/render.js`, so what
you see on screen is exactly what lands in the file. PNG and JPG are produced by drawing
that same SVG onto a canvas, which is capped at 10 000 px on the long edge — beyond that
browsers refuse to allocate the bitmap, and the readout says when a raster has been capped.
