/* Page and grid presets.
   Page sizes are stored in their native unit; margins/bleed use that same unit.
   Grid gutters carry their own unit and are converted on apply. */
window.Presets = (function () {

  /* ---------- page sizes ----------
     `base` is the format's customary leading, in the preset's own unit: the
     classic 12 pt for A4 and Letter, scaled up for posters and down for cards,
     and an 8 px rhythm for screens. */
  function p(id, label, group, w, h, unit, margin, bleed, base) {
    return { id: id, label: label, group: group, w: w, h: h, unit: unit,
             margin: margin, bleed: bleed || 0, base: base };
  }

  var PAGES = [
    /* ISO A — the metric standard, √2 ratio. Leading runs 8 pt on a card up to
       30 pt on an A0 poster; the mm figures are those points converted. */
    p('a0', 'A0 — 841 × 1189 mm', 'ISO A series', 841, 1189, 'mm', 30, 5, 10.58),
    p('a1', 'A1 — 594 × 841 mm', 'ISO A series', 594, 841, 'mm', 25, 5, 8.47),
    p('a2', 'A2 — 420 × 594 mm', 'ISO A series', 420, 594, 'mm', 20, 5, 6.35),
    p('a3', 'A3 — 297 × 420 mm', 'ISO A series', 297, 420, 'mm', 15, 3, 4.94),
    p('a4', 'A4 — 210 × 297 mm', 'ISO A series', 210, 297, 'mm', 12.7, 3, 4.23),
    p('a5', 'A5 — 148 × 210 mm', 'ISO A series', 148, 210, 'mm', 12, 3, 3.88),
    p('a6', 'A6 — 105 × 148 mm', 'ISO A series', 105, 148, 'mm', 10, 3, 3.18),
    p('a7', 'A7 — 74 × 105 mm', 'ISO A series', 74, 105, 'mm', 7, 3, 2.82),

    /* ISO B — posters and books */
    p('b2', 'B2 — 500 × 707 mm', 'ISO B series', 500, 707, 'mm', 22, 5, 6.35),
    p('b3', 'B3 — 353 × 500 mm', 'ISO B series', 353, 500, 'mm', 18, 3, 4.94),
    p('b4', 'B4 — 250 × 353 mm', 'ISO B series', 250, 353, 'mm', 15, 3, 4.59),
    p('b5', 'B5 — 176 × 250 mm', 'ISO B series', 176, 250, 'mm', 14, 3, 3.88),

    /* US */
    p('letter', 'Letter — 8.5 × 11 in', 'US sizes', 8.5, 11, 'in', 0.5, 0.125, 0.1667),
    p('legal', 'Legal — 8.5 × 14 in', 'US sizes', 8.5, 14, 'in', 0.5, 0.125, 0.1667),
    p('tabloid', 'Tabloid — 11 × 17 in', 'US sizes', 11, 17, 'in', 0.5, 0.125, 0.1944),
    p('halfletter', 'Half Letter — 5.5 × 8.5 in', 'US sizes', 5.5, 8.5, 'in', 0.5, 0.125, 0.1528),
    p('executive', 'Executive — 7.25 × 10.5 in', 'US sizes', 7.25, 10.5, 'in', 0.5, 0.125, 0.1528),
    p('ustrade', 'US Trade book — 6 × 9 in', 'US sizes', 6, 9, 'in', 0.625, 0.125, 0.1806),
    p('digest', 'Digest — 5.5 × 8.5 in', 'US sizes', 5.5, 8.5, 'in', 0.5, 0.125, 0.1528),

    /* other print */
    p('sq210', 'Square — 210 × 210 mm', 'Other print', 210, 210, 'mm', 14, 3, 4.23),
    p('dl', 'DL — 99 × 210 mm', 'Other print', 99, 210, 'mm', 8, 3, 3.88),
    p('card-eu', 'Business card EU — 85 × 55 mm', 'Other print', 85, 55, 'mm', 5, 3, 2.82),
    p('card-us', 'Business card US — 3.5 × 2 in', 'Other print', 3.5, 2, 'in', 0.2, 0.125, 0.1111),
    p('vinyl', 'Record sleeve — 12 × 12 in', 'Other print', 12, 12, 'in', 0.75, 0.125, 0.1944),

    /* screen — the 8 px rhythm, halved on phones */
    p('desktop-hd', 'Desktop HD — 1920 × 1080', 'Screen', 1920, 1080, 'px', 80, 0, 8),
    p('desktop', 'Desktop — 1440 × 1024', 'Screen', 1440, 1024, 'px', 64, 0, 8),
    p('mbp14', 'MacBook Pro 14" — 1512 × 982', 'Screen', 1512, 982, 'px', 64, 0, 8),
    p('laptop', 'Laptop — 1280 × 800', 'Screen', 1280, 800, 'px', 48, 0, 8),
    p('tablet', 'iPad — 768 × 1024', 'Screen', 768, 1024, 'px', 32, 0, 8),
    p('ipadpro', 'iPad Pro 11" — 834 × 1194', 'Screen', 834, 1194, 'px', 32, 0, 8),
    p('mobile', 'iPhone — 390 × 844', 'Screen', 390, 844, 'px', 16, 0, 4),
    p('mobile-max', 'iPhone Pro Max — 430 × 932', 'Screen', 430, 932, 'px', 20, 0, 4),
    p('android', 'Android — 360 × 800', 'Screen', 360, 800, 'px', 16, 0, 4),
    p('social-sq', 'Social square — 1080 × 1080', 'Screen', 1080, 1080, 'px', 60, 0, 8),
    p('social-story', 'Social story — 1080 × 1920', 'Screen', 1080, 1920, 'px', 60, 0, 8),
    p('slide-169', 'Slide 16:9 — 1920 × 1080', 'Screen', 1920, 1080, 'px', 72, 0, 8)
  ];

  /* ---------- grids ---------- */
  function g(id, label, group, cols, cg, rows, rg, unit) {
    return { id: id, label: label, group: group, cols: cols, rows: rows, gutter: { c: cg, r: rg, unit: unit } };
  }

  var GRIDS = [
    /* portrait print */
    g('book1', 'Book — single column', 'Print · portrait', 1, 0, 0, 0, 'mm'),
    g('p2', 'Two column', 'Print · portrait', 2, 5, 0, 0, 'mm'),
    g('p3', 'Three column', 'Print · portrait', 3, 5, 0, 0, 'mm'),
    g('news5', 'Newspaper — 5 column', 'Print · portrait', 5, 4, 0, 0, 'mm'),
    g('ed6', 'Editorial — 6 column', 'Print · portrait', 6, 4, 0, 0, 'mm'),
    g('ed12', 'Editorial — 12 column', 'Print · portrait', 12, 4.233, 0, 0, 'mm'),
    g('mod34', 'Modular — 3 × 4', 'Print · portrait', 3, 5, 4, 5, 'mm'),
    g('swiss48', 'Swiss — 4 × 8', 'Print · portrait', 4, 4, 8, 4, 'mm'),
    g('mb66', 'Müller-Brockmann — 6 × 6', 'Print · portrait', 6, 4, 6, 4, 'mm'),
    g('mag69', 'Magazine — 6 × 9', 'Print · portrait', 6, 4, 9, 4, 'mm'),

    /* landscape print */
    g('l3', 'Presentation — 3 column', 'Print · landscape', 3, 6, 0, 0, 'mm'),
    g('l8', 'Spread — 8 column', 'Print · landscape', 8, 5, 0, 0, 'mm'),
    g('l126', 'Slide — 12 × 6', 'Print · landscape', 12, 5, 6, 5, 'mm'),
    g('l64', 'Wide modular — 6 × 4', 'Print · landscape', 6, 6, 4, 6, 'mm'),
    g('l169', 'Panorama — 16 × 9', 'Print · landscape', 16, 4, 9, 4, 'mm'),

    /* web */
    g('bs12', 'Bootstrap — 12 × 24 px', 'Web & UI', 12, 24, 0, 0, 'px'),
    g('md12', 'Material — 12 × 24 px', 'Web & UI', 12, 24, 0, 0, 'px'),
    g('tw12', 'Tailwind — 12 × 16 px', 'Web & UI', 12, 16, 0, 0, 'px'),
    g('w16', 'Dense — 16 × 20 px', 'Web & UI', 16, 20, 0, 0, 'px'),
    g('tab8', 'Tablet — 8 × 24 px', 'Web & UI', 8, 24, 0, 0, 'px'),
    g('mob4', 'Mobile — 4 × 16 px', 'Web & UI', 4, 16, 0, 0, 'px'),
    g('w128', 'Modular UI — 12 × 8', 'Web & UI', 12, 24, 8, 24, 'px'),
    g('w66', 'Card grid — 6 × 6', 'Web & UI', 6, 24, 6, 24, 'px')
  ];

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Build an optgroup-structured <select>, preserving source order of groups. */
  function fill(sel, list, customLabel) {
    sel.innerHTML = '';
    if (customLabel) {
      var o = document.createElement('option');
      o.value = 'custom'; o.textContent = customLabel;
      sel.appendChild(o);
    }
    var groups = [];
    list.forEach(function (item) { if (groups.indexOf(item.group) < 0) groups.push(item.group); });
    groups.forEach(function (name) {
      var og = document.createElement('optgroup');
      og.label = name;
      list.forEach(function (item) {
        if (item.group !== name) return;
        var opt = document.createElement('option');
        opt.value = item.id; opt.textContent = item.label;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
  }

  /* Print grids are drawn for one orientation, so only the matching set is
     offered; web grids suit either. */
  function gridsFor(orientation) {
    var wanted = orientation === 'landscape' ? 'Print · landscape' : 'Print · portrait';
    return GRIDS.filter(function (g) {
      return g.group === wanted || g.group === 'Web & UI';
    });
  }

  return { PAGES: PAGES, GRIDS: GRIDS, page: function (id) { return byId(PAGES, id); },
           grid: function (id) { return byId(GRIDS, id); }, fill: fill, gridsFor: gridsFor };
})();
