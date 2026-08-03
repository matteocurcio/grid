/* Builds the grid as an SVG string. The preview and every export share this
   one renderer, so what you see on screen is exactly what lands in the file. */
window.Render = (function () {

  var COLOR = {
    trim: '#9a9a97', bleed: '#ff5b5b', margin: '#ff3ea5',
    col: '#7c6cf6', row: '#22c7d6', base: '#e8a33d',
    label: '#8f8f8c', dim: '#8a8a87', dimLabel: '#4a4a47',
    colFill: 'rgba(124,108,246,0.10)', rowFill: 'rgba(34,199,214,0.10)'
  };
  var MONO = {
    trim: '#9a9a97', bleed: '#9a9a97', margin: '#9a9a97',
    col: '#9a9a97', row: '#9a9a97', base: '#9a9a97',
    label: '#8f8f8c', dim: '#8a8a87', dimLabel: '#4a4a47',
    colFill: 'rgba(154,154,151,0.10)', rowFill: 'rgba(154,154,151,0.10)'
  };

  var MAX_BASELINES = 2000;
  var ZERO = { t: 0, b: 0, i: 0, o: 0 };

  function n(v) { return Math.round(v * 10000) / 10000; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  var _ctx = null;

  /* Estimating a monospace advance at 0.6 em is close but not exact — the "·"
     and "×" separators fall back to a proportional glyph, which pushed the run
     past the right margin. Measure it for real, falling back to the estimate
     only if there is no canvas to measure with. */
  function textWidth(text, fs, weight) {
    try {
      if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
      _ctx.font = (weight || 400) + ' ' + fs + 'px ' + FONT;
      var w = _ctx.measureText(text).width;
      if (w > 0) return w;
    } catch (e) {}
    return text.length * fs * 0.6;
  }

  /* Width scales linearly with size, so measuring once at 100 gives a factor
     that turns an available length straight into a font size. */
  function widthPerSize(items) {
    var w = 0;
    for (var i = 0; i < items.length; i++) {
      if (i) w += textWidth(GAP, 100);
      w += textWidth(items[i].l, 100, 600);
      w += textWidth(' ' + items[i].v, 100);
    }
    return (w / 100) * 1.01; /* a hair of slack against rounding */
  }

  /* Captions read like the readout under the preview: a stronger label, a
     lighter value, and a generous gap between parameters. SVG collapses runs
     of whitespace unless xml:space="preserve" is set, so the gap only survives
     because the text elements carry it. */
  var GAP = '    ';

  function val(v, s) { return Units.format(v, s.unit) + ' ' + s.unit; }

  function alt(v, s) {
    return s.unit === 'px'
      ? Units.format(Units.convert(v, 'px', 'mm'), 'mm') + ' mm'
      : Math.round(Units.toPixels(v, s.unit, s.exp.dpi)) + ' px';
  }

  function read(name, v, s, withAlt) {
    return { l: name, v: val(v, s) + (withAlt ? ' · ' + alt(v, s) : '') };
  }

  /* Asymmetric pairs drop the pixel reading rather than double their length. */
  function readPair(name, a, b, s, withAlt) {
    if (a === b) return read(name, a, s, withAlt);
    return { l: name, v: Units.format(a, s.unit) + ' / ' + Units.format(b, s.unit) + ' ' + s.unit };
  }

  function captionItems(s, g, axis, withAlt) {
    var p = [];
    if (axis === 'h') {
      p.push(read('Width', s.w, s, withAlt));
      if (s.bleedOn && (s.bleed.i || s.bleed.o))
        p.push(readPair('Bleed', s.bleed.i, s.bleed.o, s, withAlt));
      if (s.marginsOn && g.marginsFit) {
        p.push(readPair('Margin', s.margins.i, s.margins.o, s, withAlt));
        p.push(read('Content', g.marginBox.w, s, withAlt));
      }
      if (s.cols > 0 && g.colsFit) {
        var c = read('Column', g.colW, s, withAlt);
        c.v += ' × ' + s.cols;
        p.push(c);
      }
      if (s.cols > 1 && g.colsFit) p.push(read('Gutter', s.colGutter, s, withAlt));
      if (s.unit !== 'px' && withAlt) p.push({ l: 'Res', v: s.exp.dpi + ' dpi' });
    } else {
      p.push(read('Height', s.h, s, withAlt));
      if (s.bleedOn && (s.bleed.t || s.bleed.b))
        p.push(readPair('Bleed', s.bleed.t, s.bleed.b, s, withAlt));
      if (s.marginsOn && g.marginsFit) {
        p.push(readPair('Margin', s.margins.t, s.margins.b, s, withAlt));
        p.push(read('Content', g.marginBox.h, s, withAlt));
      }
      if (s.rows > 0 && g.rowsFit) {
        var r = read('Row', g.rowH, s, withAlt);
        r.v += ' × ' + s.rows;
        p.push(r);
      }
      if (s.rows > 1 && g.rowsFit) p.push(read('Gutter', s.rowGutter, s, withAlt));
      if (s.baselineOn && g.baselines > 0) {
        var b = read('Baseline', s.baseline, s, withAlt);
        b.v += ' × ' + g.baselines;
        p.push(b);
      }
    }
    return p;
  }

  function itemsSpans(items, C) {
    return items.map(function (i, idx) {
      return '<tspan fill="' + C.dimLabel + '" font-weight="600">' +
        (idx ? GAP : '') + esc(i.l) + '</tspan>' +
        '<tspan fill="' + C.dim + '"> ' + esc(i.v) + '</tspan>';
    }).join('');
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

    /* Per row, the ruling restarts at the top of every row band; otherwise it
       runs once from the top of the guide area straight through. */
    var perRow = s.baselinePerRow && s.rows > 0 && rowsFit;
    var baselines = 0, perBand = 0;
    if (s.baselineOn && s.baseline > 0) {
      var band = perRow ? rowH : guide.h;
      perBand = Math.floor((band - s.baselineStart) / s.baseline) + 1;
      if (perBand < 0) perBand = 0;
      baselines = Math.min(MAX_BASELINES, perRow ? perBand * s.rows : perBand);
      perBand = Math.min(perBand, MAX_BASELINES);
    }

    var g = {
      page: page, bleedBox: bleedBox, marginBox: marginBox, guide: guide,
      colW: colW, rowH: rowH, colsFit: colsFit, rowsFit: rowsFit,
      baselines: baselines, perBand: perBand, perRow: perRow,
      marginsFit: marginBox.w > 0 && marginBox.h > 0,
      fs: Math.max(s.w, s.h) / 70,
      hair: Math.max(s.w, s.h) / 800
    };

    g.canvasW = pageW;
    g.canvasH = pageH;
    return g;
  }

  function colX(g, s, i) { return g.guide.x + i * (g.colW + s.colGutter); }
  function rowY(g, s, j) { return g.guide.y + j * (g.rowH + s.rowGutter); }

  function rect(box, attrs) {
    return '<rect x="' + n(box.x) + '" y="' + n(box.y) + '" width="' + n(box.w) +
      '" height="' + n(box.h) + '" ' + attrs + '/>';
  }

  /* Measurements print inside the page. The margin strips are the only bands
     with no column, row or baseline guide running through them, so that is
     where the readings go — sized to the strip, never spilling past the trim.
     When a strip is too shallow to hold legible type (or margins are off, or
     the guides are fitted to the page) the reading moves just inside the last
     row / last column and takes a backing plate with it, so it still never
     sits on top of a guide. */
  var PLATE = 'fill="#ffffff" fill-opacity="0.9"';

  /* Both captions share one size, so the sheet reads as a pair rather than two
     unrelated notes. That means fitting against the tighter of the two axes —
     which is what keeps it working on short or narrow pages. When even the
     compact wording won't fit legibly, the runs step inside the last row and
     column and take a backing plate with them. */
  function captions(s, g) {
    var span = Math.max(s.w, s.h);
    var maxFs = span / 85, minFs = span / 175;
    var inset = span * 0.012;
    var align = s.marginsOn && s.fitTo !== 'page' && g.marginsFit;

    var hStrip = align ? s.margins.b : 0;
    var vStrip = align ? s.margins.o : 0;
    /* Runs are confined margin to margin so they start and end flush with the
       grid instead of bleeding out to the trim. The tighter axis — usually the
       page's shorter side — therefore sets the size both captions share. */
    var hStart = align ? g.marginBox.x : g.page.x + inset;
    var vStart = align ? g.marginBox.y + g.marginBox.h : g.page.y + g.page.h - inset;
    var hAlong = align ? g.marginBox.w : g.page.w - inset * 2;
    var vAlong = align ? g.marginBox.h : g.page.h - inset * 2;

    var inStrip = align && Math.min(hStrip, vStrip) * 0.34 >= minFs;

    function fit(withAlt) {
      var h = captionItems(s, g, 'h', withAlt), v = captionItems(s, g, 'v', withAlt);
      var hUnit = widthPerSize(h), vUnit = widthPerSize(v);
      var fs = Math.min(maxFs, hAlong / hUnit, vAlong / vUnit);
      if (inStrip) fs = Math.min(fs, hStrip * 0.34, vStrip * 0.34);
      return { fs: fs, h: h, v: v, hUnit: hUnit, vUnit: vUnit };
    }

    var r = fit(true);
    if (r.fs < minFs) {
      var compact = fit(false);
      if (compact.fs > r.fs) r = compact;
    }

    return { fs: r.fs, h: r.h, v: r.v, hUnit: r.hUnit, vUnit: r.vUnit,
             inStrip: inStrip, align: align,
             hStart: hStart, vStart: vStart, hStrip: hStrip, vStrip: vStrip };
  }

  function captionSVG(s, g, C) {
    var c = captions(s, g), fs = c.fs, out = '';
    var hw = c.hUnit * fs, vw = c.vUnit * fs;

    var hy;
    if (c.inStrip) {
      hy = g.page.y + g.page.h - c.hStrip / 2 + fs * 0.35;
    } else {
      hy = g.page.y + g.page.h - (c.align ? s.margins.b : 0) - fs * 0.7;
      out += rect({ x: c.hStart - fs * 0.35, y: hy - fs * 0.95,
                    w: hw + fs * 0.7, h: fs * 1.35 }, PLATE);
    }
    out += '<text xml:space="preserve" x="' + n(c.hStart) + '" y="' + n(hy) + '">' +
      itemsSpans(c.h, C) + '</text>';

    var vx;
    if (c.inStrip) {
      vx = g.page.x + g.page.w - c.vStrip / 2 + fs * 0.35;
    } else {
      vx = g.page.x + g.page.w - (c.align ? s.margins.o : 0) - fs * 0.7;
      out += rect({ x: vx - fs * 0.95, y: c.vStart - vw - fs * 0.35,
                    w: fs * 1.35, h: vw + fs * 0.7 }, PLATE);
    }
    out += '<text xml:space="preserve" x="' + n(vx) + '" y="' + n(c.vStart) +
      '" transform="rotate(-90 ' + n(vx) + ' ' + n(c.vStart) + ')">' +
      itemsSpans(c.v, C) + '</text>';

    return '<g id="measurements" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" ' +
      'font-size="' + n(fs) + '" fill="' + C.dim + '">' + out + '</g>';
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
        ? { x: 0, y: 0, w: g.canvasW, h: g.canvasH } : g.page;
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
      var bands = g.perRow ? s.rows : 1;
      var bandH = g.perRow ? g.rowH : g.guide.h;
      /* Ruling upward from each row's bottom lands the last baseline on the row
         edge, which is what you want when text bottoms align across a spread.
         Only meaningful per row — a single band has no bottom to key off. */
      var upward = g.perRow && s.baselineFromBottom;
      for (var bi = 0; bi < bands; bi++) {
        var top = g.perRow ? rowY(g, s, bi) : g.guide.y;
        for (var k = 0; k < g.perBand; k++) {
          var by = upward
            ? top + bandH - s.baselineStart - k * s.baseline
            : top + s.baselineStart + k * s.baseline;
          d.push('M' + n(g.guide.x) + ' ' + n(by) + 'H' + n(g.guide.x + g.guide.w));
        }
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

    /* measurements, printed inside the page */
    if (e.dims) o.push(captionSVG(s, g, C));

    o.push('</svg>');
    return o.join('');
  }

  return { build: build, geometry: geometry, COLOR: COLOR };
})();
