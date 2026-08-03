# Grid — layout system generator

A browser tool that builds print and screen layout grids the way InDesign's *New Document*
and *Create Guides* dialogs do — page size, margins, bleed, columns and rows — and exports
them as SVG, transparent PNG or JPG.

Live at **grid.matteocurcio.com**.

## What it does

- **Page presets** — ISO A0–A7, ISO B2–B5, US (Letter, Legal, Tabloid, Half Letter,
  Executive, US Trade, Digest), other print (square, DL, business cards, record sleeve)
  and screen sizes (desktop, laptop, tablet, phone, social, slides). Or set any custom
  size in mm, cm, inches, points or pixels.
- **Grid presets** — grouped by how they get used: portrait print (editorial 6 and 12
  column, Swiss 4 × 8, Müller-Brockmann 6 × 6, magazine 6 × 9, newspaper 5), landscape
  print (slide 12 × 6, panorama 16 × 9, spread 8) and web (Bootstrap, Material, Tailwind,
  tablet 8, mobile 4, modular 12 × 8).
- **Colour-coded preview** — bleed in red, margins in magenta, columns in violet, rows in
  cyan, trim in grey. Each layer toggles from the legend above the preview.
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

```bash
npx wrangler pages deploy . --project-name=grid
```

Then in the Cloudflare dashboard, add `grid.matteocurcio.com` as a custom domain on the
`grid` Pages project. `_headers` sets the security and cache headers; because the CSS and
JS filenames aren't content-hashed they're cached for an hour rather than immutably, so a
redeploy propagates within the hour.

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
