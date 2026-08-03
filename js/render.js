/* Builds the grid as an SVG string. The preview and every export share this
   one renderer, so what you see on screen is exactly what lands in the file. */
window.Render = (function () {

  var COLOR = {
    trim: '#9a9a97', bleed: '#ff5b5b', margin: '#ff3ea5',
    col: '#7c6cf6', row: '#22c7d6', label: '#8f8f8c',
    colFill: 'rgba(124,108,246,0.10)', rowFill: 'rgba(34,199,214,0.10)'
  };
  var MONO = {
    trim: '#9a9a97', bleed: '#9a9a97', margin: '#9a9a97',
    col: '#9a9a97', row: '#9a9a97', label: '#8f8f8c',
    colFill: 'rgba(154,154,151,0.10)', rowFill: 'rgba(154,154,151,0.10)'
  };

  function n(v) { return Math.round(v * 10000) / 10000; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* All boxes in document units. Origin is the top-left of the exported canvas. */
  function geometry(s) {
    var m = s.margins, b = s.bleed;
    var inc = s.exp.includeBleed;
    var bl = { t: inc ? b.t : 0, b: inc ? b.b : 0, l: inc ? b.i : 0, r: inc ? b.o : 0 };

    var ox = bl.l, oy = bl.t;
    var canvasW = s.w + bl.l + bl.r;
    var canvasH = s.h + bl.t + bl.b;

    var page = { x: ox, y: oy, w: s.w, h: s.h };
    var bleedBox = { x: ox - b.i, y: oy - b.t, w: s.w + b.i + b.o, h: s.h + b.t + b.b };
    var marginBox = { x: ox + m.i, y: oy + m.t, w: s.w - m.i - m.o, h: s.h - m.t - m.b };
    var guide = s.fitTo === 'page' ? page : marginBox;

    var colW = s.cols > 0 ? (guide.w - (s.cols - 1) * s.colGutter) / s.cols : guide.w;
    var rowH = s.rows > 0 ? (guide.h - (s.rows - 1) * s.rowGutter) / s.rows : guide.h;

    return {
      canvasW: canvasW, canvasH: canvasH, page: page, bleedBox: bleedBox,
      marginBox: marginBox, guide: guide, colW: colW, rowH: rowH,
      colsFit: !(s.cols > 0 && colW <= 0), rowsFit: !(s.rows > 0 && rowH <= 0),
      marginsFit: marginBox.w > 0 && marginBox.h > 0
    };
  }

  function colX(g, s, i) { return g.guide.x + i * (g.colW + s.colGutter); }
  function rowY(g, s, j) { return g.guide.y + j * (g.rowH + s.rowGutter); }

  function rect(box, attrs) {
    return '<rect x="' + n(box.x) + '" y="' + n(box.y) + '" width="' + n(box.w) +
      '" height="' + n(box.h) + '" ' + attrs + '/>';
  }

  /* opts: { sizing: 'unit' | {w,h} , layers: {...} } */
  function build(s, opts) {
    opts = opts || {};
    var g = geometry(s);
    var C = s.style === 'mono' ? MONO : COLOR;
    var L = opts.layers || s.layers;
    var e = s.exp;

    var hair = Math.max(g.canvasW, g.canvasH) / 800;
    var edge = hair * 1.25;
    var fs = Math.max(g.canvasW, g.canvasH) / 70;

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
      o.push('<g id="paper">' + rect(e.includeBleed ? { x: 0, y: 0, w: g.canvasW, h: g.canvasH } : g.page,
        'fill="#ffffff"') + '</g>');
    }

    /* bleed band — the area that gets trimmed off */
    if (L.bleed && (s.bleed.t || s.bleed.b || s.bleed.i || s.bleed.o)) {
      o.push('<g id="bleed">' +
        rect(g.bleedBox, 'fill="none" stroke="' + C.bleed + '" stroke-width="' + n(edge) +
          '" stroke-dasharray="' + n(hair * 7) + ' ' + n(hair * 5) + '"') + '</g>');
    }

    /* columns */
    if (L.cols && s.cols > 0 && g.colsFit) {
      var cparts = [];
      for (var i = 0; i < s.cols; i++) {
        var box = { x: colX(g, s, i), y: g.guide.y, w: g.colW, h: g.guide.h };
        cparts.push(rect(box, 'fill="' + (e.fills ? C.colFill : 'none') + '" stroke="' + C.col +
          '" stroke-width="' + n(hair) + '"'));
      }
      o.push('<g id="columns">' + cparts.join('') + '</g>');
    }

    /* rows */
    if (L.rows && s.rows > 0 && g.rowsFit) {
      var rparts = [];
      for (var j = 0; j < s.rows; j++) {
        var rbox = { x: g.guide.x, y: rowY(g, s, j), w: g.guide.w, h: g.rowH };
        rparts.push(rect(rbox, 'fill="' + (e.fills ? C.rowFill : 'none') + '" stroke="' + C.row +
          '" stroke-width="' + n(hair) + '"'));
      }
      o.push('<g id="rows">' + rparts.join('') + '</g>');
    }

    /* margins */
    if (L.margins && g.marginsFit) {
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
      var outsideTop = (g.guide.y - 0) >= fs * 1.5;
      var outsideLeft = (g.guide.x - 0) >= fs * 1.5;
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

    o.push('</svg>');
    return o.join('');
  }

  return { build: build, geometry: geometry, COLOR: COLOR };
})();
