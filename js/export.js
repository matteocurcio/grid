/* File output. SVG is serialised straight from the renderer; PNG and JPG are
   rasterised by drawing that same SVG onto a canvas. */
window.Exporter = (function () {

  var MAX_DIM = 10000; /* browsers refuse much larger canvases */

  function slug(str) {
    return String(str).trim().replace(/[^\w\-. ]+/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') || 'grid';
  }

  function filename(s, ext) {
    var size = Units.format(s.w, s.unit) + 'x' + Units.format(s.h, s.unit) + s.unit;
    var grid = s.cols + 'c' + (s.rows > 0 ? '-' + s.rows + 'r' : '');
    return slug(s.name) + '_' + size + '_' + grid + '.' + ext;
  }

  /* Target raster size, clamped to what a canvas can actually hold. */
  function rasterSize(s) {
    var g = Render.geometry(s);
    var factor = s.unit === 'px' ? s.exp.scale : s.exp.dpi;
    var w = Units.toPixels(g.canvasW, s.unit, factor);
    var h = Units.toPixels(g.canvasH, s.unit, factor);
    var clamped = false;
    var biggest = Math.max(w, h);
    if (biggest > MAX_DIM) {
      var k = MAX_DIM / biggest;
      w *= k; h *= k; clamped = true;
    }
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), clamped: clamped };
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function svgBlob(s) {
    var markup = '<?xml version="1.0" encoding="UTF-8"?>\n' + Render.build(s, { sizing: 'unit' });
    return new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  }

  function rasterBlob(s, mime, quality) {
    return new Promise(function (resolve, reject) {
      var size = rasterSize(s);
      var markup = Render.build(s, { sizing: { w: size.w, h: size.h } });
      var url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = size.w; cv.height = size.h;
        var ctx = cv.getContext('2d');
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size.w, size.h);
        }
        ctx.drawImage(img, 0, 0, size.w, size.h);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          b ? resolve(b) : reject(new Error('Could not encode ' + mime));
        }, mime, quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not rasterise the grid')); };
      img.src = url;
    });
  }

  /* Downloads every selected format, staggered so browsers don't drop them. */
  function downloadAll(s, onDone) {
    var jobs = [];
    if (s.exp.svg) jobs.push({ ext: 'svg', run: function () { return Promise.resolve(svgBlob(s)); } });
    if (s.exp.png) jobs.push({ ext: 'png', run: function () { return rasterBlob(s, 'image/png'); } });
    if (s.exp.jpg) jobs.push({ ext: 'jpg', run: function () { return rasterBlob(s, 'image/jpeg', 0.92); } });
    if (!jobs.length) { onDone(new Error('Pick at least one format')); return; }

    var i = 0;
    (function next() {
      if (i >= jobs.length) { onDone(null, jobs.length); return; }
      var job = jobs[i++];
      job.run().then(function (blob) {
        saveBlob(blob, filename(s, job.ext));
        setTimeout(next, 350);
      }).catch(function (err) { onDone(err); });
    })();
  }

  /* A CSS translation of the same grid, for the web half of the audience. */
  function css(s) {
    var g = Render.geometry(s);
    var u = s.unit === 'px' ? 'px' : s.unit;
    var f = function (v) { return Units.format(v, s.unit) + u; };
    var lines = [
      '/* ' + s.name + ' — ' + Units.format(s.w, s.unit) + ' × ' + Units.format(s.h, s.unit) + ' ' + s.unit + ' */',
      '.grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(' + Math.max(s.cols, 1) + ', 1fr);'
    ];
    if (s.rows > 0) lines.push('  grid-template-rows: repeat(' + s.rows + ', 1fr);');
    lines.push('  column-gap: ' + f(s.colGutter) + ';');
    if (s.rows > 0) lines.push('  row-gap: ' + f(s.rowGutter) + ';');
    lines.push('  padding: ' + f(s.margins.t) + ' ' + f(s.margins.o) + ' ' + f(s.margins.b) + ' ' + f(s.margins.i) + ';');
    lines.push('}');
    lines.push('');
    lines.push('/* column ' + Units.format(g.colW, s.unit) + u +
      (s.rows > 0 ? ' · row ' + Units.format(g.rowH, s.unit) + u : '') + ' */');
    return lines.join('\n');
  }

  return { downloadAll: downloadAll, rasterSize: rasterSize, filename: filename, css: css, saveBlob: saveBlob };
})();
