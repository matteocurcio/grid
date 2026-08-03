/* Unit conversion. Everything converts through millimetres.
   px uses the CSS reference of 96 px / inch, pt the typographic 72 pt / inch. */
window.Units = (function () {
  var TO_MM = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 };
  var DECIMALS = { mm: 2, cm: 3, in: 4, pt: 2, px: 0 };
  var STEP = { mm: 1, cm: 0.1, in: 0.125, pt: 1, px: 1 };
  var LABEL = { mm: 'mm', cm: 'cm', in: 'in', pt: 'pt', px: 'px' };

  function toMM(v, unit) { return v * TO_MM[unit]; }
  function fromMM(mm, unit) { return mm / TO_MM[unit]; }

  function convert(v, from, to) {
    if (from === to) return v;
    return round(fromMM(toMM(v, from), to), to);
  }

  function round(v, unit) {
    var d = DECIMALS[unit];
    var f = Math.pow(10, d);
    return Math.round(v * f) / f;
  }

  /* Trim trailing zeros so 12.70 reads as 12.7 but 0 stays 0. */
  function format(v, unit) {
    var r = round(v, unit);
    return String(parseFloat(r.toFixed(DECIMALS[unit])));
  }

  /* Accepts "210", "210mm", "8.5 in" — a trailing unit overrides the current one. */
  function parse(str, unit) {
    if (typeof str === 'number') return str;
    var s = String(str).trim().toLowerCase().replace(',', '.');
    var m = s.match(/^(-?[\d.]+)\s*(mm|cm|in|pt|px|")?$/);
    if (!m) return null;
    var v = parseFloat(m[1]);
    if (!isFinite(v)) return null;
    var u = m[2] === '"' ? 'in' : m[2];
    return u && u !== unit ? convert(v, u, unit) : v;
  }

  function toPixels(v, unit, dpiOrScale) {
    return unit === 'px' ? v * dpiOrScale : (toMM(v, unit) / 25.4) * dpiOrScale;
  }

  return {
    toMM: toMM, fromMM: fromMM, convert: convert, round: round,
    format: format, parse: parse, toPixels: toPixels,
    step: function (u) { return STEP[u]; },
    decimals: function (u) { return DECIMALS[u]; },
    label: function (u) { return LABEL[u]; }
  };
})();
