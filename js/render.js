/* Builds the grid as an SVG string. The preview and every export share this
   one renderer, so what you see on screen is exactly what lands in the file. */
window.Render = (function () {

  var COLOR = {
    trim: '#9a9a97', bleed: '#ff5b5b', margin: '#ff3ea5',
    col: '#7c6cf6', row: '#22c7d6', base: '#e8a33d',
    label: '#8f8f8c', dim: '#6b6b68',
    colFill: 'rgba(124,108,246,0.10)', rowFill: 'rgba(34,199,214,0.10)'
  };
  var MONO = {
    trim: '#9a9a97', bleed: '#9a9a97', margin: '#9a9a97',
    col: '#9a9a97', row: '#9a9a97', base: '#9a9a97',
    label: '#8f8f8c', dim: '#6b6b68',
    colFill: 'rgba(154,154,151,0.10)', rowFill: 'rgba(154,154,151,0.10)'
  };

  var MAX_BASELINES = 2000;
  var ZERO = { t: 0, b: 0, i: 0, o: 0 };

  function n(v) { return Math.round(v * 10000) / 10000; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* "Column 27.43 mm · 324 px" — the page's own unit first, then pixels at the
     export resolution. Pixel documents get millimetres as the second reading. */
  function measure(name, v, s) {
    var primary = Units.format(v, s.unit) + ' ' + s.unit;
    var secondary = s.unit === 'px'
      ? Units.format(Units.convert(v, 'px', 'mm'), 'mm') + ' mm'
      : Math.round(Units.toPixels(v, s.unit, s.exp.dpi)) + ' px';
    return name + ' ' + primary + ' · ' + secondary;
  }

  /* All boxes in document units. Origin is the top-left of the exported canvas. */
  function geometry(s) {
    var m = s.marginsOn ? s.margins : ZERO;
    var b = s.bleedOn ? s.bleed : ZERO;
    var inc = s.exp.includeBleed && s.bleedOn;
    var bl = { t: inc ? b.t : 0, b: inc ? b.b : 0, l: inc ? b.i : 0, r: inc ? b.o : 0 };

    var ox = bl.l, oy = bl.t;
    var pageW = s.w + bl.l + bl.r;
    var pageH = s.h + bl.t + bl.b;

    var page = { x: ox, y: oy, w: s.w, h: s.h };
    var bleedBox = { x: ox - b.i, y: oy - b.t, w: s.w + b.i + b.o, h: s.h + b.t + b.b };
    var marginBox = { x: ox + m.i, y: oy + m.t, w: s.w - m.i - m.o, h: s.h - m.t - m.b };
    var guide = s.fitTo === 'page' ? page : marginBox;

    var colW = s.cols > 0 ? (guide.w - (s.cols - 1) * s.colGutter) / s.cols : guide.w;
    var rowH = s.rows > 0 ? (guide.h - (s.rows - 1) * s.rowGutter) / s.rows : guide.h;
    var colsFit = !(s.cols > 0 && colW <= 0);
    var rowsFit = !(s.rows > 0 && rowH <= 0);

    var baselines = 0;
    if (s.baselineOn && s.baseline > 0) {
      baselines = Math.min(MAX_BASELINES,
        Math.floor((guide.h - s.baselineStart) / s.baseline) + 1);
      if (baselines < 0) baselines = 0;
    }

    var g = {
      page: page, bleedBox: bleedBox, marginBox: marginBox, guide: guide,
      colW: colW, rowH: rowH, colsFit: colsFit, rowsFit: rowsFit,
      baselines: baselines, marginsFit: marginBox.w > 0 && marginBox.h > 0,
      fs: Math.max(s.w, s.h) / 70,
      hair: Math.max(s.w, s.h) / 800
    };

    /* The measurement band lives entirely outside the page, so its labels can
       never collide with the guides — and one measure per band row means they
       can't collide with each other either. */
    g.dfs = Math.max(s.w, s.h) / 80;
    g.step = g.dfs * 2.5;
    g.hMeasures = s.exp.dims ? horizontalMeasures(s, g) : [];
    g.vMeasures = s.exp.dims ? verticalMeasures(s, g) : [];

    var padR = g.vMeasures.length ? g.step * (g.vMeasures.length + 0.9) : 0;
    var padB = g.hMeasures.length ? g.step * (g.hMeasures.length + 0.9) : 0;

    g.canvasW = pageW + padR;
    g.canvasH = pageH + padB;
    g.pageAreaW = pageW;
    g.pageAreaH = pageH;
    return g;
  }

  function colX(g, s, i) { return g.guide.x + i * (g.colW + s.colGutter); }
  function rowY(g, s, j) { return g.guide.y + j * (g.rowH + s.rowGutter); }

  function horizontalMeasures(s, g) {
    var out = [{ a: g.page.x, b: g.page.x + g.page.w, t: measure('Page W', s.w, s) }];
    if (s.bleedOn && s.bleed.i > 0)
      out.push({ a: g.bleedBox.x, b: g.page.x, t: measure('Bleed L', s.bleed.i, s) });
    if (s.marginsOn && g.marginsFit) {
      out.push({ a: g.page.x, b: g.marginBox.x, t: measure(s.facing ? 'Inside' : 'Margin L', s.margins.i, s) });
      out.push({ a: g.marginBox.x, b: g.marginBox.x + g.marginBox.w, t: measure('Content W', g.marginBox.w, s) });
      out.push({ a: g.marginBox.x + g.marginBox.w, b: g.page.x + g.page.w, t: measure(s.facing ? 'Outside' : 'Margin R', s.margins.o, s) });
    }
    if (s.cols > 0 && g.colsFit)
      out.push({ a: colX(g, s, 0), b: colX(g, s, 0) + g.colW, t: measure('Column', g.colW, s) });
    if (s.cols > 1 && g.colsFit)
      out.push({ a: colX(g, s, 0) + g.colW, b: colX(g, s, 1), t: measure('Col gutter', s.colGutter, s) });
    return out;
  }

  function verticalMeasures(s, g) {
    var out = [{ a: g.page.y, b: g.page.y + g.page.h, t: measure('Page H', s.h, s) }];
    if (s.bleedOn && s.bleed.t > 0)
      out.push({ a: g.bleedBox.y, b: g.page.y, t: measure('Bleed T', s.bleed.t, s) });
    if (s.marginsOn && g.marginsFit) {
      out.push({ a: g.page.y, b: g.marginBox.y, t: measure('Margin T', s.margins.t, s) });
      out.push({ a: g.marginBox.y, b: g.marginBox.y + g.marginBox.h, t: measure('Content H', g.marginBox.h, s) });
      out.push({ a: g.marginBox.y + g.marginBox.h, b: g.page.y + g.page.h, t: measure('Margin B', s.margins.b, s) });
    }
    if (s.rows > 0 && g.rowsFit)
      out.push({ a: rowY(g, s, 0), b: rowY(g, s, 0) + g.rowH, t: measure('Row', g.rowH, s) });
    if (s.rows > 1 && g.rowsFit)
      out.push({ a: rowY(g, s, 0) + g.rowH, b: rowY(g, s, 1), t: measure('Row gutter', s.rowGutter, s) });
    if (s.baselineOn && s.baseline > 0) {
      var y0 = g.guide.y + s.baselineStart;
      out.push({ a: y0, b: y0 + s.baseline, t: measure('Baseline', s.baseline, s) });
    }
    return out;
  }

  function rect(box, attrs) {
    return '<rect x="' + n(box.x) + '" y="' + n(box.y) + '" width="' + n(box.w) +
      '" height="' + n(box.h) + '" ' + attrs + '/>';
  }

  /* Monospace advance is a reliable ~0.6em, so labels can be kept inside the
     canvas without measuring text for real. */
  function clamp(centre, text, fs, limit) {
    var half = text.length * fs * 0.6 / 2 + fs * 0.3;
    return Math.min(Math.max(centre, half), Math.max(half, limit - half));
  }

  function dimH(mm, y, g, C) {
    var fs = g.dfs, tick = fs * 0.32;
    var tx = clamp((mm.a + mm.b) / 2, mm.t, fs, g.canvasW);
    return '<path d="M' + n(mm.a) + ' ' + n(y - tick) + 'V' + n(y + tick) +
      'M' + n(mm.a) + ' ' + n(y) + 'H' + n(mm.b) +
      'M' + n(mm.b) + ' ' + n(y - tick) + 'V' + n(y + tick) +
      '" fill="none" stroke="' + C.dim + '" stroke-width="' + n(g.hair * 0.9) + '"/>' +
      '<text x="' + n(tx) + '" y="' + n(y - fs * 0.5) + '" text-anchor="middle">' + esc(mm.t) + '</text>';
  }

  function dimV(mm, x, g, C) {
    var fs = g.dfs, tick = fs * 0.32;
    var ty = clamp((mm.a + mm.b) / 2, mm.t, fs, g.canvasH);
    var lx = x - fs * 0.5;
    return '<path d="M' + n(x - tick) + ' ' + n(mm.a) + 'H' + n(x + tick) +
      'M' + n(x) + ' ' + n(mm.a) + 'V' + n(mm.b) +
      'M' + n(x - tick) + ' ' + n(mm.b) + 'H' + n(x + tick) +
      '" fill="none" stroke="' + C.dim + '" stroke-width="' + n(g.hair * 0.9) + '"/>' +
      '<text x="' + n(lx) + '" y="' + n(ty) + '" text-anchor="middle" transform="rotate(-90 ' +
      n(lx) + ' ' + n(ty) + ')">' + esc(mm.t) + '</text>';
  }

  /* opts: { sizing: 'unit' | {w,h} , layers: {...} } */
  function build(s, opts) {
    opts = opts || {};
    var g = geometry(s);
    var C = s.style === 'mono' ? MONO : COLOR;
    var L = opts.layers || s.layers;
    var e = s.exp;

    var hair = g.hair, edge = hair * 1.25, fs = g.fs;

    var dim;
    if (opts.sizing === 'unit') {
      var u = s.unit === 'px' ? '' : s.unit;
      dim = 'width="' + n(g.canvasW) + u + '" height="' + n(g.canvasH) + u + '"';
    } else {
      dim = 'width="' + Math.round(opts.sizing.w) + '" height="' + Math.round(opts.sizing.h) + '"';
    }

    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      dim + ' viewBox="0 0 ' + n(g.canvasW) + ' ' + n(g.canvasH) + '">');
    o.push('<title>' + esc(s.name) + ' — grid</title>');
    o.push('<desc>' + n(s.w) + ' × ' + n(s.h) + ' ' + s.unit + ' · ' +
      s.cols + ' columns · ' + s.rows + ' rows · generated with grid.matteocurcio.com</desc>');

    /* paper */
    if (e.paper) {
      var sheet = (e.includeBleed && s.bleedOn)
        ? { x: 0, y: 0, w: g.pageAreaW, h: g.pageAreaH } : g.page;
      o.push('<g id="paper">' + rect(sheet, 'fill="#ffffff"') + '</g>');
    }

    /* bleed band — the area that gets trimmed off */
    if (L.bleed && s.bleedOn && (s.bleed.t || s.bleed.b || s.bleed.i || s.bleed.o)) {
      o.push('<g id="bleed">' +
        rect(g.bleedBox, 'fill="none" stroke="' + C.bleed + '" stroke-width="' + n(edge) +
          '" stroke-dasharray="' + n(hair * 7) + ' ' + n(hair * 5) + '"') + '</g>');
    }

    /* columns */
    if (L.cols && s.cols > 0 && g.colsFit) {
      var cparts = [];
      for (var i = 0; i < s.cols; i++) {
        cparts.push(rect({ x: colX(g, s, i), y: g.guide.y, w: g.colW, h: g.guide.h },
          'fill="' + (e.fills ? C.colFill : 'none') + '" stroke="' + C.col +
          '" stroke-width="' + n(hair) + '"'));
      }
      o.push('<g id="columns">' + cparts.join('') + '</g>');
    }

    /* rows */
    if (L.rows && s.rows > 0 && g.rowsFit) {
      var rparts = [];
      for (var j = 0; j < s.rows; j++) {
        rparts.push(rect({ x: g.guide.x, y: rowY(g, s, j), w: g.guide.w, h: g.rowH },
          'fill="' + (e.fills ? C.rowFill : 'none') + '" stroke="' + C.row +
          '" stroke-width="' + n(hair) + '"'));
      }
      o.push('<g id="rows">' + rparts.join('') + '</g>');
    }

    /* baseline */
    if (L.baseline && s.baselineOn && g.baselines > 0) {
      var d = [];
      for (var k = 0; k < g.baselines; k++) {
        var by = g.guide.y + s.baselineStart + k * s.baseline;
        d.push('M' + n(g.guide.x) + ' ' + n(by) + 'H' + n(g.guide.x + g.guide.w));
      }
      o.push('<g id="baseline"><path d="' + d.join('') + '" fill="none" stroke="' + C.base +
        '" stroke-width="' + n(hair * 0.7) + '"/></g>');
    }

    /* margins */
    if (L.margins && s.marginsOn && g.marginsFit) {
      o.push('<g id="margins">' + rect(g.marginBox, 'fill="none" stroke="' + C.margin +
        '" stroke-width="' + n(hair * 1.1) + '"') + '</g>');
    }

    /* trim */
    if (L.trim) {
      o.push('<g id="trim">' + rect(g.page, 'fill="none" stroke="' + C.trim +
        '" stroke-width="' + n(edge) + '"') + '</g>');
    }

    /* numbering */
    if (e.labels && (s.cols > 1 || s.rows > 1)) {
      var lparts = [];
      var outsideTop = g.guide.y >= fs * 1.5;
      var outsideLeft = g.guide.x >= fs * 1.5;
      var ta = 'font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="' + n(fs) +
        '" fill="' + C.label + '"';

      if (s.cols > 1 && g.colsFit) {
        for (var ci = 0; ci < s.cols; ci++) {
          var cx = colX(g, s, ci) + g.colW / 2;
          var cy = outsideTop ? g.guide.y - fs * 0.45 : g.guide.y + fs * 1.15;
          lparts.push('<text x="' + n(cx) + '" y="' + n(cy) + '" text-anchor="middle" ' + ta + '>' + (ci + 1) + '</text>');
        }
      }
      if (s.rows > 1 && g.rowsFit) {
        for (var rj = 0; rj < s.rows; rj++) {
          var ry = rowY(g, s, rj) + g.rowH / 2 + fs * 0.35;
          var rx = outsideLeft ? g.guide.x - fs * 0.45 : g.guide.x + fs * 0.4;
          lparts.push('<text x="' + n(rx) + '" y="' + n(ry) + '" text-anchor="' +
            (outsideLeft ? 'end' : 'start') + '" ' + ta + '>' + (rj + 1) + '</text>');
        }
      }
      o.push('<g id="labels">' + lparts.join('') + '</g>');
    }

    /* measurements, in their own band clear of the page */
    if (e.dims && (g.hMeasures.length || g.vMeasures.length)) {
      var dparts = [];
      for (var hi = 0; hi < g.hMeasures.length; hi++) {
        dparts.push(dimH(g.hMeasures[hi], g.pageAreaH + g.step * (hi + 1), g, C));
      }
      for (var vi = 0; vi < g.vMeasures.length; vi++) {
        dparts.push(dimV(g.vMeasures[vi], g.pageAreaW + g.step * (vi + 1), g, C));
      }
      o.push('<g id="measurements" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" ' +
        'font-size="' + n(g.dfs) + '" fill="' + C.dim + '">' + dparts.join('') + '</g>');
    }

    o.push('</svg>');
    return o.join('');
  }

  return { build: build, geometry: geometry, measure: measure, COLOR: COLOR };
})();
