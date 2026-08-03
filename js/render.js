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

  /* "27.43mm/324px" — the page's own unit, then pixels at the export
     resolution. Pixel documents get millimetres as the second reading. */
  function pair(v, s) {
    var primary = Units.format(v, s.unit) + s.unit;
    var secondary = s.unit === 'px'
      ? Units.format(Units.convert(v, 'px', 'mm'), 'mm') + 'mm'
      : Math.round(Units.toPixels(v, s.unit, s.exp.dpi)) + 'px';
    return primary + '/' + secondary;
  }

  function measure(name, v, s) { return name + ' ' + pair(v, s); }

  /* Monospace advance is a dependable 0.6 em, so text can be fitted without
     measuring it for real — which the renderer has no way to do anyway. */
  function textWidth(text, fs) { return text.length * fs * 0.6; }

  function hText(s, g) {
    var p = ['W ' + pair(s.w, s)];
    if (s.bleedOn && (s.bleed.i || s.bleed.o))
      p.push('bleed ' + (s.bleed.i === s.bleed.o ? pair(s.bleed.i, s)
        : pair(s.bleed.i, s) + ' / ' + pair(s.bleed.o, s)));
    if (s.marginsOn && g.marginsFit) {
      p.push('margin ' + (s.margins.i === s.margins.o ? pair(s.margins.i, s)
        : pair(s.margins.i, s) + ' / ' + pair(s.margins.o, s)));
      p.push('content ' + pair(g.marginBox.w, s));
    }
    if (s.cols > 0 && g.colsFit) p.push(s.cols + ' col ' + pair(g.colW, s));
    if (s.cols > 1 && g.colsFit) p.push('gutter ' + pair(s.colGutter, s));
    if (s.unit !== 'px') p.push('@' + s.exp.dpi + 'dpi');
    return p.join('  ·  ');
  }

  function vText(s, g) {
    var p = ['H ' + pair(s.h, s)];
    if (s.bleedOn && (s.bleed.t || s.bleed.b))
      p.push('bleed ' + (s.bleed.t === s.bleed.b ? pair(s.bleed.t, s)
        : pair(s.bleed.t, s) + ' / ' + pair(s.bleed.b, s)));
    if (s.marginsOn && g.marginsFit) {
      p.push('margin ' + (s.margins.t === s.margins.b ? pair(s.margins.t, s)
        : pair(s.margins.t, s) + ' / ' + pair(s.margins.b, s)));
      p.push('content ' + pair(g.marginBox.h, s));
    }
    if (s.rows > 0 && g.rowsFit) p.push(s.rows + ' row ' + pair(g.rowH, s));
    if (s.rows > 1 && g.rowsFit) p.push('gutter ' + pair(s.rowGutter, s));
    if (s.baselineOn && g.baselines > 0)
      p.push('baseline ' + pair(s.baseline, s) + ' ×' + g.baselines);
    return p.join('  ·  ');
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
  function place(s, g, text, axis) {
    var span = Math.max(s.w, s.h);
    var maxFs = span / 85, minFs = span / 175;
    var inset = span * 0.012;
    var useStrip = s.marginsOn && s.fitTo !== 'page' && g.marginsFit;
    var strip = useStrip ? (axis === 'h' ? s.margins.b : s.margins.o) : 0;
    var inStrip = strip * 0.34 >= minFs;

    /* The run starts at the content edge and ends at the trim, so the type has
       to be sized against that remaining length — not the whole page — or it
       overflows the trim on the right. */
    var start, along;
    if (axis === 'h') {
      start = useStrip ? g.marginBox.x : g.page.x + inset;
      along = (g.page.x + g.page.w - inset) - start;
    } else {
      start = useStrip ? g.marginBox.y + g.marginBox.h : g.page.y + g.page.h - inset;
      along = start - (g.page.y + inset);
    }

    var fs = Math.min(maxFs, along / (text.length * 0.6), inStrip ? strip * 0.34 : maxFs);
    return { fs: fs, strip: strip, inStrip: inStrip, useStrip: useStrip,
             start: start, width: textWidth(text, fs) };
  }

  function hLine(s, g) {
    var text = hText(s, g);
    var p = place(s, g, text, 'h');
    var x = p.start, y, plate = '';

    if (p.inStrip) {
      y = g.page.y + g.page.h - p.strip / 2 + p.fs * 0.35;
    } else {
      y = g.page.y + g.page.h - (p.useStrip ? s.margins.b : 0) - p.fs * 0.7;
      plate = rect({ x: x - p.fs * 0.35, y: y - p.fs * 0.95, w: p.width + p.fs * 0.7, h: p.fs * 1.35 },
        'fill="#ffffff" fill-opacity="0.9"');
    }
    return plate + '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + n(p.fs) +
      '">' + esc(text) + '</text>';
  }

  function vLine(s, g) {
    var text = vText(s, g);
    var p = place(s, g, text, 'v');
    var y = p.start, x, plate = '';

    if (p.inStrip) {
      x = g.page.x + g.page.w - p.strip / 2 + p.fs * 0.35;
    } else {
      x = g.page.x + g.page.w - (p.useStrip ? s.margins.o : 0) - p.fs * 0.7;
      plate = rect({ x: x - p.fs * 0.95, y: y - p.width - p.fs * 0.35, w: p.fs * 1.35, h: p.width + p.fs * 0.7 },
        'fill="#ffffff" fill-opacity="0.9"');
    }
    return plate + '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + n(p.fs) +
      '" transform="rotate(-90 ' + n(x) + ' ' + n(y) + ')">' + esc(text) + '</text>';
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

    /* measurements, printed inside the page */
    if (e.dims) {
      o.push('<g id="measurements" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" ' +
        'fill="' + C.dim + '">' + hLine(s, g, C) + vLine(s, g, C) + '</g>');
    }

    o.push('</svg>');
    return o.join('');
  }

  return { build: build, geometry: geometry, measure: measure, COLOR: COLOR };
})();
