(function () {
  'use strict';

  var STORE = 'grid.state.v3';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------------- state */
  function defaults() {
    return {
      name: 'Untitled-1',
      unit: 'mm',
      w: 210, h: 297,
      orientation: 'portrait',
      facing: false,
      cols: 6, colGutter: 4, rows: 6, rowGutter: 4,
      fitTo: 'margins',
      marginsOn: true,
      margins: { t: 12.7, b: 12.7, i: 12.7, o: 12.7 }, marginsLinked: true,
      bleedOn: false,
      bleed: { t: 3, b: 3, i: 3, o: 3 }, bleedLinked: true,
      baselineOn: false, baseline: 4.233, baselineStart: 0,
      baselinePerRow: false, baselineFromBottom: false,
      layers: { trim: true, bleed: true, margins: true, cols: true, rows: true, baseline: true },
      style: 'color',
      exp: { svg: true, png: true, jpg: false, dpi: 300, scale: 2,
             includeBleed: true, paper: false, fills: true, labels: false, dims: false }
    };
  }

  var S = defaults();
  var zoom = { mode: 'fit', z: 1 };

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return;
      var d = JSON.parse(raw), base = defaults();
      Object.keys(base).forEach(function (k) {
        if (d[k] === undefined) return;
        if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
          Object.keys(base[k]).forEach(function (k2) {
            if (d[k][k2] !== undefined) base[k][k2] = d[k][k2];
          });
        } else base[k] = d[k];
      });
      S = base;
    } catch (e) {}
  }

  /* ------------------------------------------------------------- fields */
  /* Each numeric input reads and writes through here so linked margins,
     unit changes and the steppers all share one code path. */
  var F = {
    w:  { kind: 'len', min: 5, marks: 'page',
          get: function () { return S.w; },
          set: function (v) { S.w = v; S.orientation = S.w > S.h ? 'landscape' : 'portrait'; } },
    h:  { kind: 'len', min: 5, marks: 'page',
          get: function () { return S.h; },
          set: function (v) { S.h = v; S.orientation = S.w > S.h ? 'landscape' : 'portrait'; } },
    cols: { kind: 'int', min: 0, max: 200, marks: 'grid',
            get: function () { return S.cols; }, set: function (v) { S.cols = v; } },
    rows: { kind: 'int', min: 0, max: 200, marks: 'grid',
            get: function () { return S.rows; }, set: function (v) { S.rows = v; } },
    colGutter: { kind: 'len', min: 0, marks: 'grid',
                 get: function () { return S.colGutter; }, set: function (v) { S.colGutter = v; } },
    rowGutter: { kind: 'len', min: 0, marks: 'grid',
                 get: function () { return S.rowGutter; }, set: function (v) { S.rowGutter = v; } },
    baseline: { kind: 'len', min: 0,
                get: function () { return S.baseline; }, set: function (v) { S.baseline = v; } },
    baselineStart: { kind: 'len', min: 0,
                     get: function () { return S.baselineStart; }, set: function (v) { S.baselineStart = v; } },
    mT: margin('t'), mB: margin('b'), mI: margin('i'), mO: margin('o'),
    bT: bleed('t'), bB: bleed('b'), bI: bleed('i'), bO: bleed('o')
  };

  function margin(k) {
    return { kind: 'len', min: 0, marks: 'page',
      get: function () { return S.margins[k]; },
      set: function (v) {
        if (S.marginsLinked) S.margins = { t: v, b: v, i: v, o: v };
        else S.margins[k] = v;
      } };
  }
  function bleed(k) {
    return { kind: 'len', min: 0, marks: 'page',
      get: function () { return S.bleed[k]; },
      set: function (v) {
        if (S.bleedLinked) S.bleed = { t: v, b: v, i: v, o: v };
        else S.bleed[k] = v;
      } };
  }

  function fieldText(id) {
    var f = F[id];
    return f.kind === 'int' ? String(f.get()) : Units.format(f.get(), S.unit);
  }

  function commit(id, value) {
    var f = F[id];
    if (value === null || !isFinite(value)) return false;
    if (f.kind === 'int') value = Math.round(value);
    if (f.min !== undefined) value = Math.max(f.min, value);
    if (f.max !== undefined) value = Math.min(f.max, value);
    f.set(f.kind === 'int' ? value : Units.round(value, S.unit));
    if (f.marks === 'page') markCustom('page');
    if (f.marks === 'grid') markCustom('grid');
    return true;
  }

  /* Selecting an id the list no longer offers would silently land on the first
     option, so fall back to Custom when it isn't there. */
  function setSelect(sel, id) {
    var has = false;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === id) has = true;
    sel.value = has ? id : 'custom';
  }

  function markCustom(which) {
    if (which === 'page') setSelect($('pagePreset'), matchPage() || 'custom');
    if (which === 'grid') setSelect($('gridPreset'), matchGrid() || 'custom');
  }

  /* The grid list follows the page orientation, so it is rebuilt when that
     flips rather than filled once at boot. */
  var gridListFor = null;
  function syncGridList() {
    if (gridListFor === S.orientation) return;
    gridListFor = S.orientation;
    Presets.fill($('gridPreset'), Presets.gridsFor(S.orientation), 'Custom');
    markCustom('grid');
  }

  function matchPage() {
    var hit = null;
    Presets.PAGES.forEach(function (p) {
      if (hit || p.unit !== S.unit) return;
      var a = Math.min(p.w, p.h), b = Math.max(p.w, p.h);
      var x = Math.min(S.w, S.h), y = Math.max(S.w, S.h);
      if (Math.abs(a - x) < 0.01 && Math.abs(b - y) < 0.01) hit = p.id;
    });
    return hit;
  }

  function matchGrid() {
    var hit = null;
    Presets.GRIDS.forEach(function (p) {
      if (hit) return;
      var cg = Units.convert(p.gutter.c, p.gutter.unit, S.unit);
      var rg = Units.convert(p.gutter.r, p.gutter.unit, S.unit);
      var tol = S.unit === 'px' ? 0.6 : 0.02;
      if (p.cols === S.cols && p.rows === S.rows &&
          Math.abs(cg - S.colGutter) < tol &&
          (p.rows === 0 || Math.abs(rg - S.rowGutter) < tol)) hit = p.id;
    });
    return hit;
  }

  /* ------------------------------------------------------------ presets */
  function applyPage(id) {
    var p = Presets.page(id);
    if (!p) return;
    var from = S.unit;
    S.unit = p.unit;
    ['colGutter', 'rowGutter', 'baseline', 'baselineStart'].forEach(function (k) {
      S[k] = Units.convert(S[k], from, S.unit);
    });
    /* A preset owns its stated orientation — "Desktop — 1440 × 1024" should
       never come out portrait. The toggle flips it afterwards if you want. */
    S.w = p.w; S.h = p.h;
    S.orientation = S.w > S.h ? 'landscape' : 'portrait';
    S.margins = { t: p.margin, b: p.margin, i: p.margin, o: p.margin };
    S.bleed = { t: p.bleed, b: p.bleed, i: p.bleed, o: p.bleed };
    if (p.base) { S.baseline = p.base; S.baselineStart = 0; }
    zoom.mode = 'fit';
    markCustom('grid');
  }

  function applyGrid(id) {
    var p = Presets.grid(id);
    if (!p) return;
    S.cols = p.cols; S.rows = p.rows;
    S.colGutter = Units.round(Units.convert(p.gutter.c, p.gutter.unit, S.unit), S.unit);
    S.rowGutter = Units.round(Units.convert(p.gutter.r || p.gutter.c, p.gutter.unit, S.unit), S.unit);
  }

  function changeUnit(to) {
    var from = S.unit;
    if (from === to) return;
    ['w', 'h', 'colGutter', 'rowGutter', 'baseline', 'baselineStart'].forEach(function (k) {
      S[k] = Units.convert(S[k], from, to);
    });
    ['margins', 'bleed'].forEach(function (grp) {
      Object.keys(S[grp]).forEach(function (k) { S[grp][k] = Units.convert(S[grp][k], from, to); });
    });
    S.unit = to;
  }

  /* ------------------------------------------------------------- render */
  var wrap = $('canvasWrap'), inner = $('canvasInner');

  function basePxPerUnit() {
    return S.unit === 'px' ? 1 : Units.toPixels(1, S.unit, 96);
  }

  function fitZoom(g) {
    var cs = getComputedStyle(wrap);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var aw = Math.max(60, wrap.clientWidth - padX);
    var ah = Math.max(60, wrap.clientHeight - padY);
    var base = basePxPerUnit();
    return Math.min(aw / (g.canvasW * base), ah / (g.canvasH * base));
  }

  function draw() {
    var g = Render.geometry(S);
    var base = basePxPerUnit();
    var z = zoom.mode === 'fit' ? fitZoom(g) : zoom.z;
    if (!isFinite(z) || z <= 0) z = 1;

    inner.innerHTML = Render.build(S, {
      sizing: { w: g.canvasW * base * z, h: g.canvasH * base * z }
    });
    inner.className = 'canvas-inner ' + (S.exp.paper ? 'paper' : 'alpha');

    $('zVal').textContent = Math.round(z * 100) + '%';
    readout(g);
  }

  function readout(g) {
    var u = S.unit, f = function (v) { return Units.format(v, u); };
    var px = Exporter.rasterSize(S);
    var bits = [];

    bits.push('<span><b>Canvas</b> ' + f(g.canvasW) + ' × ' + f(g.canvasH) + ' ' + u + '</span>');
    bits.push('<span><b>Content</b> ' + f(g.marginBox.w) + ' × ' + f(g.marginBox.h) + ' ' + u + '</span>');
    if (S.cols > 0 && g.colsFit) bits.push('<span><b>Column</b> ' + f(g.colW) + ' ' + u + '</span>');
    if (S.rows > 0 && g.rowsFit) bits.push('<span><b>Row</b> ' + f(g.rowH) + ' ' + u + '</span>');
    if (S.baselineOn && g.baselines > 0)
      bits.push('<span><b>Baseline</b> ' + f(S.baseline) + ' ' + u + ' × ' + g.baselines + '</span>');
    bits.push('<span><b>Raster</b> ' + px.w + ' × ' + px.h + ' px</span>');

    if (!g.marginsFit) bits.push('<span class="warn">Margins exceed the page</span>');
    if (!g.colsFit) bits.push('<span class="warn">Columns don\'t fit — reduce count or gutter</span>');
    if (!g.rowsFit) bits.push('<span class="warn">Rows don\'t fit — reduce count or gutter</span>');
    if (px.clamped) bits.push('<span class="warn">Raster capped at 10000 px</span>');

    $('readout').innerHTML = bits.join('');
  }

  /* --------------------------------------------------------- sync to UI */
  function syncInputs() {
    syncGridList();
    Object.keys(F).forEach(function (id) {
      var el = $(id);
      if (el && document.activeElement !== el) el.value = fieldText(id);
    });

    var lbl = Units.label(S.unit);
    document.querySelectorAll('[data-unitlabel]').forEach(function (el) { el.textContent = lbl; });
    $('unit').value = S.unit;
    $('docName').value = S.name;

    document.querySelectorAll('[data-mlabel="in"]').forEach(function (el) { el.textContent = S.facing ? 'Inside' : 'Left'; });
    document.querySelectorAll('[data-mlabel="out"]').forEach(function (el) { el.textContent = S.facing ? 'Outside' : 'Right'; });

    $('oPortrait').classList.toggle('on', S.orientation === 'portrait');
    $('oLandscape').classList.toggle('on', S.orientation === 'landscape');
    $('facing').checked = S.facing;
    $('mLink').classList.toggle('on', S.marginsLinked);
    $('bLink').classList.toggle('on', S.bleedLinked);

    [['marginsOn', 'sectMargins'], ['bleedOn', 'sectBleed'], ['baselineOn', 'sectBaseline']]
      .forEach(function (pair) {
        var sw = $(pair[0]), on = !!S[pair[0]];
        sw.classList.toggle('on', on);
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        $(pair[1]).classList.toggle('off', !on);
      });
    $('incBleedRow').classList.toggle('muted', !S.bleedOn);

    /* Both row-dependent options are hidden rather than dimmed when there are
       no rows — there is nothing to restart against. */
    var perRow = S.baselinePerRow && S.rows > 0;
    $('baselinePerRow').checked = S.baselinePerRow;
    $('perRowRow').classList.toggle('hide', S.rows < 1);
    $('baselineFromBottom').checked = S.baselineFromBottom;
    $('fromBottomRow').classList.toggle('hide', !perRow);

    document.querySelectorAll('#fitTo button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.v === S.fitTo);
    });
    /* a visibility chip is meaningless while its feature is switched off */
    var active = { margins: S.marginsOn, bleed: S.bleedOn, baseline: S.baselineOn };
    document.querySelectorAll('#legend .chip').forEach(function (b) {
      var k = b.dataset.layer;
      b.classList.toggle('on', !!S.layers[k]);
      b.classList.toggle('muted', active[k] === false);
    });

    $('fSvg').checked = S.exp.svg; $('fPng').checked = S.exp.png; $('fJpg').checked = S.exp.jpg;
    $('incBleed').checked = S.exp.includeBleed; $('paper').checked = S.exp.paper;
    $('fills').checked = S.exp.fills; $('labels').checked = S.exp.labels;
    $('dims').checked = S.exp.dims;
    $('dpi').value = String(S.exp.dpi); $('scale').value = String(S.exp.scale);
    $('styleSel').value = S.style;

    var isPx = S.unit === 'px';
    $('dpiField').classList.toggle('hide', isPx);
    $('scaleField').classList.toggle('hide', !isPx);

    var count = (S.exp.svg ? 1 : 0) + (S.exp.png ? 1 : 0) + (S.exp.jpg ? 1 : 0);
    $('dlLabel').textContent = count === 0 ? 'Choose a format'
      : 'Download ' + count + ' file' + (count === 1 ? '' : 's');
    $('btnDownload').disabled = count === 0;
  }

  function refresh() { syncInputs(); draw(); save(); }

  /* ------------------------------------------------------------- wiring */
  function wireNumbers() {
    Object.keys(F).forEach(function (id) {
      var el = $(id);
      if (!el) return;

      el.addEventListener('input', function () {
        var v = F[id].kind === 'int' ? parseInt(el.value, 10) : Units.parse(el.value, S.unit);
        if (v === null || isNaN(v)) return;      /* mid-typing, leave it alone */
        if (commit(id, v)) { syncInputs(); draw(); }
      });

      el.addEventListener('blur', function () { el.value = fieldText(id); save(); });

      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { el.blur(); return; }
        if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
        ev.preventDefault();
        step(id, ev.key === 'ArrowUp' ? 1 : -1, ev.shiftKey);
      });
    });

    document.querySelectorAll('.numwrap .stepper button').forEach(function (btn) {
      var id = btn.closest('.numwrap').dataset.num;
      var dir = parseInt(btn.dataset.dir, 10);
      var timer, repeat;

      var start = function (ev) {
        step(id, dir, ev.shiftKey);
        timer = setTimeout(function () {
          repeat = setInterval(function () { step(id, dir, ev.shiftKey); }, 60);
        }, 420);
      };
      var stop = function () { clearTimeout(timer); clearInterval(repeat); };

      btn.addEventListener('mousedown', start);
      ['mouseup', 'mouseleave', 'blur'].forEach(function (e) { btn.addEventListener(e, stop); });
      btn.addEventListener('touchstart', function (ev) { ev.preventDefault(); start(ev); }, { passive: false });
      ['touchend', 'touchcancel'].forEach(function (e) { btn.addEventListener(e, stop); });
    });
  }

  function step(id, dir, big) {
    var f = F[id];
    var amount = f.kind === 'int' ? 1 : Units.step(S.unit);
    if (big) amount *= 10;
    if (commit(id, f.get() + dir * amount)) refresh();
  }

  function wire() {
    Presets.fill($('pagePreset'), Presets.PAGES, 'Custom');
    Presets.fill($('gridPreset'), Presets.GRIDS, 'Custom');

    $('pagePreset').addEventListener('change', function () {
      if (this.value === 'custom') return;
      applyPage(this.value); refresh();
    });
    $('gridPreset').addEventListener('change', function () {
      if (this.value === 'custom') return;
      applyGrid(this.value); refresh();
    });
    $('unit').addEventListener('change', function () {
      changeUnit(this.value); markCustom('page'); markCustom('grid'); refresh();
    });
    $('docName').addEventListener('input', function () { S.name = this.value || 'Untitled-1'; save(); });

    $('oPortrait').addEventListener('click', function () { setOrientation('portrait'); });
    $('oLandscape').addEventListener('click', function () { setOrientation('landscape'); });

    $('facing').addEventListener('change', function () { S.facing = this.checked; refresh(); });
    $('baselinePerRow').addEventListener('change', function () { S.baselinePerRow = this.checked; refresh(); });
    $('baselineFromBottom').addEventListener('change', function () { S.baselineFromBottom = this.checked; refresh(); });

    $('mLink').addEventListener('click', function () {
      S.marginsLinked = !S.marginsLinked;
      if (S.marginsLinked) S.margins = { t: S.margins.t, b: S.margins.t, i: S.margins.t, o: S.margins.t };
      markCustom('page'); refresh();
    });
    $('bLink').addEventListener('click', function () {
      S.bleedLinked = !S.bleedLinked;
      if (S.bleedLinked) S.bleed = { t: S.bleed.t, b: S.bleed.t, i: S.bleed.t, o: S.bleed.t };
      refresh();
    });

    document.querySelectorAll('#fitTo button').forEach(function (b) {
      b.addEventListener('click', function () { S.fitTo = b.dataset.v; refresh(); });
    });

    document.querySelectorAll('#legend .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        S.layers[b.dataset.layer] = !S.layers[b.dataset.layer];
        refresh();
      });
    });

    [['fSvg', 'svg'], ['fPng', 'png'], ['fJpg', 'jpg'], ['incBleed', 'includeBleed'],
     ['paper', 'paper'], ['fills', 'fills'], ['labels', 'labels'], ['dims', 'dims']].forEach(function (pair) {
      $(pair[0]).addEventListener('change', function () { S.exp[pair[1]] = this.checked; refresh(); });
    });

    /* section switches — they sit inside the collapse header, so swallow the click */
    ['marginsOn', 'bleedOn', 'baselineOn'].forEach(function (key) {
      $(key).addEventListener('click', function (ev) {
        ev.stopPropagation();
        S[key] = !S[key];
        if (S[key]) this.closest('.sect').classList.remove('closed');
        zoom.mode = 'fit';
        refresh();
      });
    });
    $('dpi').addEventListener('change', function () { S.exp.dpi = parseInt(this.value, 10); refresh(); });
    $('scale').addEventListener('change', function () { S.exp.scale = parseInt(this.value, 10); refresh(); });
    $('styleSel').addEventListener('change', function () { S.style = this.value; refresh(); });

    document.querySelectorAll('.sect-head[data-toggle]').forEach(function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('closed'); });
    });

    $('zIn').addEventListener('click', function () { nudgeZoom(1.25); });
    $('zOut').addEventListener('click', function () { nudgeZoom(1 / 1.25); });
    $('zFit').addEventListener('click', function () { zoom.mode = 'fit'; draw(); });

    $('btnReset').addEventListener('click', function () {
      S = defaults(); zoom.mode = 'fit';
      markCustom('page'); markCustom('grid'); refresh();
      toast('Reset to A4 defaults');
    });

    $('btnTheme').addEventListener('click', function () {
      var light = document.documentElement.classList.toggle('theme-light');
      document.documentElement.classList.toggle('theme-dark', !light);
      try { localStorage.setItem('grid.theme', light ? 'light' : 'dark'); } catch (e) {}
      requestAnimationFrame(draw);
    });

    $('btnDownload').addEventListener('click', function () {
      var btn = this, label = $('dlLabel').textContent;
      btn.disabled = true; $('dlLabel').textContent = 'Rendering…';
      Exporter.downloadAll(S, function (err, count) {
        btn.disabled = false; $('dlLabel').textContent = label;
        toast(err ? err.message : count + ' file' + (count === 1 ? '' : 's') + ' downloaded');
      });
    });

    $('btnCss').addEventListener('click', function () {
      var text = Exporter.css(S);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(function () { toast('CSS grid copied to clipboard'); })
          .catch(function () { toast('Could not access the clipboard'); });
      } else toast('Clipboard unavailable in this browser');
    });

    window.addEventListener('resize', function () { if (zoom.mode === 'fit') draw(); });
  }

  function setOrientation(o) {
    if (S.orientation === o) return;
    S.orientation = o;
    var t = S.w; S.w = S.h; S.h = t;
    zoom.mode = 'fit';
    refresh();
  }

  function nudgeZoom(k) {
    var g = Render.geometry(S);
    var current = zoom.mode === 'fit' ? fitZoom(g) : zoom.z;
    zoom.z = Math.min(8, Math.max(0.02, current * k));
    zoom.mode = 'manual';
    draw();
  }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    try {
      var th = localStorage.getItem('grid.theme');
      if (th === 'light') { document.documentElement.classList.add('theme-light'); document.documentElement.classList.remove('theme-dark'); }
    } catch (e) {}

    load();
    wire();
    wireNumbers();
    markCustom('page'); markCustom('grid');
    refresh();
    /* fonts change nothing structurally but the fit maths wants a settled layout */
    setTimeout(draw, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
