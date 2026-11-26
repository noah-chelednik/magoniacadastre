/* The Magonia Cadastre: the dossier for a place and a moment. Reads the static indexes under data/dossier/ of this site
   only, computes the sky with the sky module of this site, fills the tested query links for the date and place, and
   draws the dossier. Nothing is stored and nothing is sent anywhere. Every value shown names its source. */
(function (root) {
  'use strict';

  var EARTH_KM = 6371.0088;
  var MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  var POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  var PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  var KINDS = ['dataset', 'catalogue', 'archive', 'periodical', 'register', 'service'];
  function finite(x) { return typeof x === 'number' && isFinite(x); }
  function pad(n, w) { var s = String(Math.abs(n)); while (s.length < w) { s = '0' + s; } return (n < 0 ? '-' : '') + s; }
  function own(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }

  /* ---- time ---------------------------------------------------------------------------------------------------- */
  function utcMs(y, mo, d, h, mi) {
    var t = new Date(0);
    t.setUTCFullYear(y, mo - 1, d);
    t.setUTCHours(h || 0, mi || 0, 0, 0);
    return t.getTime();
  }
  function parseMoment(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d)Z?)?$/.exec(String(s || ''));   /* the whole string, nothing after */
    if (!m) { return null; }
    var y = +m[1], mo = +m[2], d = +m[3], h = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) { return null; }
    var ms = utcMs(y, mo, d, h, mi);
    var t = new Date(ms);
    if (t.getUTCDate() !== d) { return null; }
    return ms;
  }
  function isoDate(ms) {
    var t = new Date(ms);
    return pad(t.getUTCFullYear(), 4) + '-' + pad(t.getUTCMonth() + 1, 2) + '-' + pad(t.getUTCDate(), 2);
  }
  function isoMinute(ms) {
    var t = new Date(ms);
    return isoDate(ms) + 'T' + pad(t.getUTCHours(), 2) + ':' + pad(t.getUTCMinutes(), 2) + 'Z';
  }
  function hhmm(iso) { var m = /T(\d\d:\d\d)/.exec(String(iso || '')); return m ? m[1] : ''; }
  function dayText(ms) { var t = new Date(ms); return t.getUTCDate() + ' ' + MONTH_NAMES[t.getUTCMonth()] + ' ' + t.getUTCFullYear(); }

  /* Era labels: a year before year 1 is written N BC/BCE; a span crossing year 1 adds AD/CE to its later end. */
  function yearText(y) { return y < 0 ? (-y) + ' BC/BCE' : String(y); }
  function spanText(lo, hi) {
    var a = lo === null || lo === undefined ? null : lo;
    var b = hi === 'present' ? 'present' : (hi === null || hi === undefined ? null : hi);
    if (a === null && b === null) { return 'years not stated'; }
    if (a === null && b === 'present') { return 'start not stated, to present'; }
    var bt = b === null ? 'an end not stated' : (b === 'present' ? 'present' : (a !== null && a < 0 && b > 0 ? b + ' AD/CE' : yearText(b)));
    var at = a === null ? 'a start not stated' : yearText(a);
    return at + ' to ' + bt;
  }

  /* a licence name is shown only beside an open verdict; beside unknown or restricted it would read as a contradiction */
  function licenceText(verdict, label) {
    return verdict === 'open' ? (label || 'open') : (verdict || 'unknown');
  }

  /* ---- query links (the same filling as the registry list of link patterns) ------------------------------------------ */
  function fmt4(x) {
    var s = x.toFixed(4);
    if (s.indexOf('.') >= 0) { s = s.replace(/0+$/, '').replace(/\.$/, ''); }
    return s;
  }
  function linkValues(date, lat, lon, half) {
    var v = {};
    var ms = parseMoment(date);
    if (ms !== null) {
      var t = new Date(ms), y = t.getUTCFullYear(), mo = t.getUTCMonth() + 1, d = t.getUTCDate();
      v.date = isoDate(ms); v.year = pad(y, 4); v.yy = pad(y % 100, 2); v.month = pad(mo, 2); v.mon = MON[mo - 1];
      v.day = pad(d, 2); v.month_n = String(mo); v.day_n = String(d); v.yyyymmdd = pad(y, 4) + pad(mo, 2) + pad(d, 2);
      v.date_next = isoDate(ms + 86400000);
    }
    if (finite(lat) && finite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      var h = finite(half) ? half : 1.0;
      var w = Math.max(-180, lon - h), s = Math.max(-90, lat - h), e = Math.min(180, lon + h), n = Math.min(90, lat + h);
      v.lat = fmt4(lat); v.lon = fmt4(lon); v.west = fmt4(w); v.south = fmt4(s); v.east = fmt4(e); v.north = fmt4(n);
      v.bbox = [w, s, e, n].map(fmt4).join(',');
    }
    return v;
  }
  function fill(pattern, date, lat, lon, half) {
    var v = linkValues(date, lat, lon, half), missing = false;
    var out = String(pattern).replace(/\{([^{}]*)\}/g, function (m0, k) {
      if (!own(v, k)) { missing = true; return m0; }
      return v[k];
    });
    if (missing) { return null; }
    return safeUrl(out);
  }
  /* an address is linked only when it parses as http or https, names no user or password, and holds no control
     character, space or backslash; it is linked exactly as given */
  function safeUrl(u) {
    if (typeof u !== 'string' || !/^https?:\/\/[^\s\\\u0000-\u001f\u007f]+$/i.test(u)) { return null; }
    if (typeof URL !== 'function') { return /^https?:\/\/[^\/?#@]+(?:[\/?#]|$)/i.test(u) ? u : null; }   /* no parser: no user part */
    try {
      var p = new URL(u);
      if ((p.protocol !== 'http:' && p.protocol !== 'https:') || p.username || p.password || !p.hostname) { return null; }
    } catch (e) { return null; }
    return u;
  }
  function needsStation(pattern) { return /\{station\}/.test(String(pattern)); }
  function inSpan(lo, hi, y) {
    if (lo !== null && lo !== undefined && y < +lo) { return false; }
    if (hi !== null && hi !== undefined && hi !== 'present' && y > +hi) { return false; }
    return true;
  }

  /* ---- geometry ----------------------------------------------------------------------------------------------------- */
  function rad(x) { return x * Math.PI / 180; }
  function distanceKm(lat1, lon1, lat2, lon2) {
    var a = Math.sin(rad(lat2 - lat1) / 2), b = Math.sin(rad(lon2 - lon1) / 2);
    var h = a * a + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * b * b;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function tileName(lat0, lon0) {
    return (lat0 >= 0 ? 'n' : 's') + pad(Math.abs(lat0), 2) + (lon0 >= 0 ? 'e' : 'w') + pad(Math.abs(lon0), 3);
  }
  function tilesFor(lat, lon, km) {
    var dlat = km / 111.2, lo = Math.max(-90, lat - dlat), hi = Math.min(89.999, lat + dlat);
    var c = Math.cos(rad(Math.min(89.9, Math.max(Math.abs(lo), Math.abs(hi)))));
    var dlon = c > 0.02 ? km / (111.2 * c) : 360;
    var names = [], seen = {};
    for (var a = Math.floor(lo / 10) * 10; a <= Math.floor(hi / 10) * 10; a += 10) {
      if (dlon >= 180) {
        for (var b0 = -180; b0 < 180; b0 += 10) { add(a, b0); }
      } else {
        for (var b = Math.floor((lon - dlon) / 10) * 10; b <= Math.floor((lon + dlon) / 10) * 10; b += 10) {
          add(a, ((b + 180) % 360 + 360) % 360 - 180);
        }
      }
    }
    function add(x, y) { var n = tileName(x, y); if (!seen[n]) { seen[n] = true; names.push(n); } }
    return names;
  }
  function compass(az) { return POINTS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16]; }
  /* ---- places ------------------------------------------------------------------------------------------------------- */
  function placeOf(lat, lon, grid) {
    var la = Math.floor(lat), lo = Math.floor(lon);
    for (var ring = 0; ring <= 3; ring++) {
      var hits = [], cont = {}, regs = [];
      for (var a = la - ring; a <= la + ring; a++) {
        for (var b = lo - ring; b <= lo + ring; b++) {
          if (Math.max(Math.abs(a - la), Math.abs(b - lo)) !== ring) { continue; }
          var bb = ((b + 180) % 360 + 360) % 360 - 180;
          var k = a + ',' + bb;
          if (own(grid, k)) {
            grid[k][0].forEach(function (c) { if (hits.indexOf(c) < 0) { hits.push(c); } });
            (grid[k][2] || []).forEach(function (r) { if (regs.indexOf(r) < 0) { regs.push(r); } });
            if (grid[k][1]) { cont[grid[k][1]] = (cont[grid[k][1]] || 0) + 1; }
          }
        }
      }
      if (hits.length) {
        var best = null;
        Object.keys(cont).forEach(function (c) { if (best === null || cont[c] > cont[best]) { best = c; } });
        return { countries: hits, continent: best, ring: ring, regions: regs };
      }
    }
    return { countries: [], continent: null, ring: null, regions: [] };
  }
  function regionKeys(lat, lon, place, meta) {
    var keys = [];
    function add(k) { if (own(meta.regions, k) && keys.indexOf(k) < 0) { keys.push(k); } }
    place.countries.forEach(function (c) {
      add(c);
      /* the parts of the country (ISO 3166-2 regions) the point lies in: rows naming a part are listed only there */
      (place.regions || []).forEach(function (r) { if (r.indexOf(c + '-') === 0) { add('s-' + r); } });
      var info = meta.countries[c];
      if (info && info.region) { add('r-' + info.region); }
      if (info && info.continent) { add('r-' + info.continent); }
    });
    if (place.continent) { add('r-' + place.continent); }
    if (lat >= 66.56) { add('r-Arctic'); }
    if (lat <= -60) { add('r-Antarctica'); }
    add(lat >= 0 ? 'r-Northern Hemisphere' : 'r-Southern Hemisphere');
    /* latitude bands a row names ("tropics (40 S to 40 N)"): key b-<south>_<north> */
    Object.keys(meta.regions || {}).sort().forEach(function (k) {
      var b = /^b-(\d+(?:\.\d)?)([NS])_(\d+(?:\.\d)?)([NS])$/.exec(k);
      if (!b) { return; }
      var lo = (b[2] === 'S' ? -1 : 1) * parseFloat(b[1]), hi = (b[4] === 'S' ? -1 : 1) * parseFloat(b[3]);
      if (lo <= lat && lat <= hi) { add(k); }
    });
    add('global');
    return keys;
  }

  /* ---- registry sources ---------------------------------------------------------------------------------------------- */
  function linksFor(meta, rowId, year) {
    var out = [];
    (meta.links || []).forEach(function (e) {
      if (e[0] === rowId && inSpan(e[3], e[4], year)) { out.push(e); }
    });
    return out;
  }
  function sourcesFor(year, docs, meta, date, lat, lon) {
    var seen = {}, covers = [], partial = [], undated = [];
    docs.forEach(function (doc) {
      if (!doc) { return; }
      var dec = String(Math.floor(year / 10) * 10), pool = null;
      if (year >= 1700 && doc.decades) {
        pool = {};
        (doc.decades[dec] || []).forEach(function (i) { pool[i] = true; });
      }
      doc.rows.forEach(function (r, i) {
        var id = r[0];
        if (own(seen, id)) { if (seen[id].via.indexOf(r[12]) < 0) { seen[id].via.push(r[12]); } return; }
        var lo = finite(r[7]) ? r[7] : null, hi = r[8] === 'present' ? meta.snapshot_year : (finite(r[8]) ? r[8] : null);
        var ent = { id: id, title: r[1], kind: r[2], access: r[3], verdict: r[4], licence: r[5], url: r[6],
          start: r[7], end: r[8], language: r[9], tier: r[10], places: Array.isArray(r[11]) ? r[11] : [], via: [r[12]],
          region: doc.key, links: [], stations: [] };
        var group = null;
        if (lo !== null && hi !== null) {
          if (pool !== null && !pool[i]) { return; }
          if (lo <= year && year <= hi) { group = covers; }
        } else if (lo !== null || hi !== null) {
          if ((lo === null || lo <= year) && (hi === null || hi >= year)) { group = partial; }
        } else {
          group = undated;
        }
        if (!group) { return; }
        seen[id] = ent;
        /* every tested pattern of the row, each with its own label, its box filled at the half-width it was tested with */
        linksFor(meta, id, year).forEach(function (e) {
          if (needsStation(e[1])) { ent.stations.push({ note: e[6], label: e[5] }); return; }
          var url = fill(e[1], date, lat, lon, finite(e[7]) && e[7] > 0 ? e[7] : 1.0);
          if (url) { ent.links.push({ url: url, label: e[5], granularity: e[2] }); }
        });
        group.push(ent);
      });
    });
    /* sources of accounts first (tier B, then C), under their own heading, then the context datasets (tier A) by
       kind; within each group, sources with a tested link for this date first, then by title */
    function rank(a, b) {
      var la = a.links.length ? 0 : 1, lb = b.links.length ? 0 : 1;
      if (la !== lb) { return la - lb; }
      var ta = String(a.title).toLowerCase(), tb = String(b.title).toLowerCase();
      return ta < tb ? -1 : (ta > tb ? 1 : 0);
    }
    function byKind(list) {
      var acc = { B: [], C: [] }, g = {};
      list.forEach(function (e) {
        if (e.tier === 'B' || e.tier === 'C') { acc[e.tier].push(e); } else { (g[e.kind] = g[e.kind] || []).push(e); }
      });
      var out = [];
      if (acc.B.length) { out.push({ kind: 'sources of accounts, core: tier B', rows: acc.B.sort(rank) }); }
      if (acc.C.length) { out.push({ kind: 'sources of accounts, the long tail: tier C', rows: acc.C.sort(rank) }); }
      var order = KINDS.filter(function (k) { return own(g, k); });
      Object.keys(g).forEach(function (k) { if (order.indexOf(k) < 0) { order.push(k); } });
      return out.concat(order.map(function (k) { return { kind: 'context ' + k + 's', rows: g[k].sort(rank) }; }));
    }
    return { covers: byKind(covers), partial: byKind(partial), undated: byKind(undated),
      counts: { covers: covers.length, partial: partial.length, undated: undated.length },
      linked: covers.concat(partial, undated).filter(function (e) { return e.links.length > 0; }).length };
  }

  /* ---- stations ------------------------------------------------------------------------------------------------------ */
  function stationsNear(lat, lon, km, year, tiles, meta) {
    var nets = meta.networks.map(function (n) { return { net: n, operating: [], undated: [], closed: 0, unlisted: 0 }; });
    tiles.forEach(function (t) {
      if (!t) { return; }
      /* held stations this page does not list (terms not known; not run by a US federal agency): aggregate counts per
         1 degree square and decade; a square counts when any part of it lies within the radius */
      var dec = Math.floor(year / 10) * 10;
      (t.others || []).forEach(function (o) {
        var g = nets[o[0]];
        if (!g || !finite(o[1]) || !finite(o[2]) || o[3] !== dec || !finite(o[4])) { return; }
        var nlat = Math.max(o[1], Math.min(o[1] + 1, lat)), nlon = Math.max(o[2], Math.min(o[2] + 1, lon));
        if (distanceKm(lat, lon, nlat, nlon) <= km) { g.unlisted += o[4]; }
      });
      t.stations.forEach(function (s) {
        if (!finite(s[3]) || !finite(s[4])) { return; }
        var d = distanceKm(lat, lon, s[3], s[4]);
        if (d > km) { return; }
        var g = nets[s[0]];
        if (!g) { return; }
        var ent = { id: s[1], name: s[2], lat: s[3], lon: s[4], first: s[5], last: s[6], km: d,
          measures: (s[7] || []).map(function (i) { return meta.measures[i]; }), elevation: s[8], country: s[9], type: s[10] };
        if (finite(s[5]) && finite(s[6])) {
          if (s[5] <= year && year <= s[6]) { g.operating.push(ent); } else { g.closed += 1; }
        } else {
          g.undated.push(ent);
        }
      });
    });
    nets.forEach(function (g) {
      g.operating.sort(function (a, b) { return a.km - b.km; });
      g.undated.sort(function (a, b) { return a.km - b.km; });
    });
    return nets;
  }

  /* ---- spine ----------------------------------------------------------------------------------------------------------- */
  function kpNear(ms, docs) {
    var out = [];
    [-1, 0, 1].forEach(function (k) {
      var day = isoDate(ms + k * 86400000), doc = docs[day.slice(0, 4)];
      var vals = doc && own(doc, day) ? doc[day] : null;
      if (!vals) { return; }
      var d0 = parseMoment(day);
      vals.forEach(function (v, i) {
        if (finite(v)) { out.push({ start: d0 + i * 3 * 3600000, value: v, day: day }); }
      });
    });
    return out;
  }
  function launchesNear(ms, docs) {
    var out = { day: [], before: [], month: [] };
    var today = isoDate(ms), yday = isoDate(ms - 86400000);
    [[yday, out.before], [today, out.day]].forEach(function (p) {
      var doc = docs[p[0].slice(0, 4)];
      if (doc && own(doc.d, p[0])) {
        doc.d[p[0]].forEach(function (e) {
          var t = e[0] ? parseMoment(p[0] + 'T' + e[0]) : null;
          p[1].push({ date: p[0], time: e[0], precision: e[1], id: e[2], vehicle: e[3], flight: e[4], mission: e[5],
            category: e[6], outcome: e[7], site: e[8], hours: t === null ? null : (ms - t) / 3600000 });
        });
      }
    });
    var mdoc = docs[today.slice(0, 4)];
    if (mdoc && own(mdoc.m, today.slice(0, 7))) {
      mdoc.m[today.slice(0, 7)].forEach(function (e) {
        out.month.push({ date: today.slice(0, 7), time: null, precision: e[1], id: e[2], vehicle: e[3], flight: e[4],
          mission: e[5], category: e[6], outcome: e[7], site: e[8], hours: null });
      });
    }
    return out;
  }

  /* ---- weather tiles -------------------------------------------------------------------------------------------------- */
  var SIZES = { uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4 };
  function readTile(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'WXT1') { throw new Error('not a weather tile'); }
    var hl = dv.getUint32(4, true);
    var header = JSON.parse(new TextDecoder('utf-8').decode(bytes.subarray(8, 8 + hl)));
    return { header: header, dv: dv, offset: 8 + hl };
  }
  function tileValue(tile, field, cell, day) {
    var h = tile.header, off = tile.offset, n = h.n_cells * h.n_days;
    for (var i = 0; i < h.fields.length; i++) {
      var f = h.fields[i], size = SIZES[f.dtype];
      if (!size) { return null; }
      if (f.name === field) {
        var at = off + (cell * h.n_days + day) * size, raw;
        if (f.dtype === 'uint8') { raw = tile.dv.getUint8(at); }
        else if (f.dtype === 'int8') { raw = tile.dv.getInt8(at); }
        else if (f.dtype === 'uint16') { raw = tile.dv.getUint16(at, true); }
        else if (f.dtype === 'int16') { raw = tile.dv.getInt16(at, true); }
        else if (f.dtype === 'uint32') { raw = tile.dv.getUint32(at, true); }
        else { raw = tile.dv.getInt32(at, true); }
        if (raw === f.missing) { return null; }
        var v = raw * f.scale + f.offset;
        return finite(v) ? v : null;
      }
      off += n * size;
    }
    return null;
  }
  function weatherCell(lat, lon, deg) {
    var g = deg || 2;
    var clat = g * Math.ceil((lat - g / 2) / g), clon = g * Math.floor((lon + g / 2) / g);
    if (clon >= 180) { clon -= 360; }
    if (clat > 90) { clat = 90; }
    return [clat, clon];
  }
  function weatherAt(tile, lat, lon, ms) {
    var h = tile.header, c = weatherCell(lat, lon, h.grid_deg), idx = -1;
    for (var i = 0; i < h.cells.length; i++) {
      if (Math.abs(h.cells[i][0] - c[0]) < 1e-6 && Math.abs(h.cells[i][1] - c[1]) < 1e-6) { idx = i; break; }
    }
    if (idx < 0) { return null; }
    var day = Math.round((parseMoment(isoDate(ms)) - parseMoment(h.first_day)) / 86400000);
    if (day < 0 || day >= h.n_days) { return null; }
    var vals = {};
    h.fields.forEach(function (f) { vals[f.name] = { value: tileValue(tile, f.name, idx, day), unit: f.unit }; });
    return { cell: c, values: vals };
  }
  function gunzip(bytes, io) {
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (io && io.gunzip) { return io.gunzip(bytes); }
      if (typeof DecompressionStream === 'undefined') { return Promise.reject(new Error('no gzip support')); }
      var ds = new DecompressionStream('gzip');
      var stream = new Blob([bytes]).stream().pipeThrough(ds);
      return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    return Promise.resolve(bytes);
  }

  var WX_SETS = ['tiles', 'marine'];
  function weatherModel(wx, wxSets, blobs, heldMonth, lat, lon, ms, date, held) {
    if (!wx) { return { status: 'none', note: 'Daily weather by region is not yet available on this site.' }; }
    var month = date.slice(0, 7);
    if (!heldMonth) {
      return { status: 'not_yet_held', note: 'Daily weather for ' + month + ' is not yet held on this site; it is not zero, it is not loaded yet' +
        (held ? '. In this edition it is held for ' + held + '; more months are added with each update.' : '.') };
    }
    if (wxSets.length && blobs.some(function (b) { return !b; })) {
      return { status: 'unavailable', note: 'A weather tile for this place could not be loaded; weather is not available here.' };
    }
    var values = {}, cell = null, sets = [];
    for (var i = 0; i < wxSets.length; i++) {
      var v;
      try { v = weatherAt(readTile(blobs[i]), lat, lon, ms); } catch (e) {
        return { status: 'unavailable', note: 'A weather tile for this place could not be read; weather is not available here.' };
      }
      if (!v) { continue; }
      cell = v.cell; sets.push(wxSets[i].set);
      Object.keys(v.values).forEach(function (k) { values[k] = v.values[k]; });
    }
    if (!cell) {
      return { status: 'none', note: 'No weather cell is held for this place (the grid keeps land and coast cells, and sea cells for waves, from 1940).' };
    }
    var any = Object.keys(values).some(function (k) { return values[k].value !== null; });
    if (!any) { return { status: 'none', note: 'No weather value is held for this cell on ' + date + '.' }; }
    return { status: 'held', values: { cell: cell, values: values }, sets: sets, date: date };
  }

  /* ---- the dossier itself ---------------------------------------------------------------------------------------------- */
  function skyAround(Sky, ms, lat, lon) {
    return [-60, -30, 0, 30, 60].map(function (m) { return { minutes: m, sky: Sky.sky(ms + m * 60000, lat, lon) }; });
  }
  function bodyName(k) { return k.charAt(0).toUpperCase() + k.slice(1); }

  function envelope(model, meta) {
    var items = [], sky = model.sky.now, low = [];
    var bodies = [['Moon', model.sky.around.map(function (a) { return { minutes: a.minutes, pos: a.sky.moon }; })]];
    PLANETS.forEach(function (p) {
      bodies.push([bodyName(p), model.sky.around.map(function (a) { return { minutes: a.minutes, pos: a.sky.planets[p] }; })]);
    });
    bodies.forEach(function (b) {
      var now = b[1][2].pos;
      if (b[0] !== 'Moon' && !(now.mag <= 1.0)) { return; }
      var lowAt = b[1].filter(function (x) { return x.pos.alt_apparent >= 0 && x.pos.alt_apparent <= 20; });
      lowAt.sort(function (x, y) { return Math.abs(x.minutes) - Math.abs(y.minutes); });
      if (lowAt.length) { low.push({ name: b[0], at: lowAt[0] }); }
    });
    var dark = sky.sun.alt_apparent < -6 ? 'the Sun was ' + Math.round(-sky.sun.alt_apparent) + ' degrees below the horizon'
      : (sky.sun.alt_apparent < -0.833 ? 'in civil twilight' : 'in daylight');
    items.push({
      item: 'A bright planet or the Moon low in the sky (0 to 20 degrees up within an hour of the moment)',
      status: low.length ? 'present' : 'not seen',
      value: low.length ? low.map(function (l) {
        var x = l.at.pos, when = l.at.minutes === 0 ? 'at the moment' :
          (Math.abs(l.at.minutes) + ' minutes ' + (l.at.minutes < 0 ? 'before' : 'after') + ' the moment');
        return l.name + ', magnitude ' + x.mag.toFixed(1) + ', ' + x.alt_apparent.toFixed(1) +
          ' degrees up at azimuth ' + Math.round(x.az) + ' (' + compass(x.az) + ') ' + when;
      }).join('; ') + '; ' + dark : 'no planet of magnitude 1 or brighter and not the Moon; ' + dark,
      source: { text: 'computed on this page (Meeus methods)' }
    });
    var L = model.events.launches;
    if (L.status === 'held') {
      /* a launch with no hour on the day before may lie inside the 24 hours or outside them: it is kept, flagged as time
         uncertain, never dropped */
      var near = [], hourless = [];
      L.day.concat(L.before).forEach(function (e) {
        if (e.hours === null) { (e.date === isoDate(model.ms) ? near : hourless).push(e); }
        else if (e.hours >= 0 && e.hours <= 24) { near.push(e); }
      });
      var shown = near.map(function (e) {
        return e.id + ' ' + e.vehicle + (e.time ? ' at ' + e.time + ' UTC on ' + e.date : ' on ' + e.date + ', hour not given') +
          (e.site ? ', site ' + e.site : '');
      });
      if (L.withheld) { shown.push(L.withheld + ' launch records of these two days not shown here (see the source)'); }
      /* launches known only to the month, withheld ones of the month, or a day before the held dates: the day is not
         fully known, so absence is never claimed */
      var unsure = hourless.map(function (e) {
        return e.id + ' ' + e.vehicle + ' on ' + e.date + ', hour not given, so it may or may not lie within the 24 hours ' +
          '(time uncertain)' + (e.site ? ', site ' + e.site : '');
      });
      if (L.month.length) { unsure.push(L.month.length + ' launch' + (L.month.length > 1 ? 'es' : '') + ' in this month, day not known'); }
      if (L.withheldMonth) { unsure.push(L.withheldMonth + ' launch records of this month, day not known, not shown here'); }
      if (L.beforeUnknown) { unsure.push('launch dates before ' + meta.launch.dates[0] + ' are not held, so the day before is not covered'); }
      items.push({ item: 'A launch in the 24 hours before the moment (or that UTC day when the hour is not given; one the day before with no hour is flagged as time uncertain)',
        status: shown.length ? 'present' : (unsure.length ? 'uncertain' : 'not seen'),
        value: shown.concat(unsure).length ? shown.concat(unsure).join('; ') +
          (unsure.length && !shown.length ? '; launch dates for this period are not fully known' : '')
          : 'no launch listed for these days in the loaded list',
        source: { row: meta.launch.source } });
    } else {
      items.push({ item: 'A launch that day', status: 'no data', value: L.note, source: { row: meta.launch.source } });
    }
    var R = model.events.reentries;
    items.push({ item: 'A re-entry that day or the day before (counts only; the catalogue gives no time or ground point)',
      status: R.status !== 'held' ? 'no data' : (R.day + (R.before || 0) > 0 ? 'present' : (R.before === null ? 'no data' : 'not seen')),
      value: R.status !== 'held' ? R.note : R.day + ' re-entered on ' + R.date + ', ' +
        (R.before === null ? 'the day before not available' : R.before + ' the day before'),
      source: { row: meta.reentry.source } });
    var K = model.events.kp;
    items.push({ item: 'The geomagnetic index Kp near the moment (for an aurora)',
      status: K.status === 'held' ? 'present' : 'no data',
      value: K.status === 'held' ? 'Kp reached ' + K.max.toFixed(1) + ' within 6 hours of the moment (the scale runs from 0 to 9). ' +
        'How far toward the equator an aurora reached depends on the geomagnetic latitude of the place, which this site does not compute.'
        : K.note,
      source: { row: meta.kp.source } });
    var W = model.weather;
    if (W.status === 'held') {
      var cl = W.values.values.cloud ? W.values.values.cloud.value : null;
      var pr = W.values.values.precip ? W.values.values.precip.value : null;
      var hs = W.values.values.wave_hs ? W.values.values.wave_hs.value : null;
      var bits = [];
      if (cl !== null) { bits.push('cloud cover ' + Math.round(cl) + ' percent'); }
      if (pr !== null) { bits.push('precipitation ' + pr.toFixed(1) + ' mm'); }
      if (hs !== null) { bits.push('wave height ' + hs.toFixed(1) + ' m'); }
      items.push({ item: 'The weather that day (context only; a regional daily average, not the local weather at the point or hour)',
        status: bits.length ? 'present' : 'no data',
        value: bits.length ? bits.join(', ') + ': UTC daily values for the 2 degree cell centred on ' + W.values.cell[0] + ', ' +
          W.values.cell[1] : 'no cloud, precipitation or wave value for the day', source: { row: meta.weather.source } });
    } else {
      items.push({ item: 'The weather that day', status: 'no data', value: W.note, source: { row: meta.weather.source } });
    }
    items.push({ item: 'A satellite pass or a fireball', status: 'no data',
      value: 'satellite passes and fireball lists are not yet held on this site', source: null });
    return items;
  }

  /* the held stations not listed (only federally run ones are), said as a count first; the reason in one line after it */
  var UNLISTED_WHY = 'Their records come from archives whose terms are not known, so they are linked, not listed; only ' +
    'stations run by US federal agencies are listed.';
  function decadeText(y) { return finite(y) ? (y < 0 ? yearText(y) + ' decade' : 'the ' + Math.floor(y / 10) * 10 + 's') : 'that decade'; }
  function unlistedLine(unl, watch, year) {
    var nets = watch.filter(function (n) { return n.unlisted; }).map(function (n) { return n.net.title + ' ' + n.unlisted; });
    return unl + ' more held station' + (unl === 1 ? '' : 's') + ' (' + nets.join(', ') + ') ' + (unl === 1 ? 'was' : 'were') +
      ' operating at some time in ' + decadeText(year) + ' in the 1 degree squares reaching within the radius. ' + UNLISTED_WHY;
  }

  function gaps(model, meta) {
    var g = [];
    var y = model.year;
    if (model.place.unavailable) {
      g.push('The place lookup could not be loaded, so the country of the point is not known and country and regional sources are missing; the source list is not complete.');
    } else if (model.place.countries.length === 0) {
      g.push('No airfield lies within about 3 degrees of the point, so no country was found; only world-wide and regional sources are listed.');
    }
    if (model.events.launches.status !== 'held') { g.push(model.events.launches.note); }
    if (model.events.reentries.status !== 'held') { g.push(model.events.reentries.note); }
    if (model.events.kp.status !== 'held') { g.push(model.events.kp.note); }
    if (model.weather.status !== 'held') { g.push(model.weather.note); }
    var op = 0, und = 0, unl = 0;
    model.watch.forEach(function (n) { op += n.operating.length; und += n.undated.length; unl += n.unlisted; });
    if (model.missing.tiles) {
      g.push(model.missing.tiles + ' station files could not be loaded, so the station list is not available in full.');
    } else if (op === 0) {
      g.push('No listed station with stated years was operating within ' + model.radius + ' km in ' + y + '.' +
        (unl ? ' ' + unlistedLine(unl, model.watch, y) : ''));
    } else if (unl) { g.push(unlistedLine(unl, model.watch, y)); }
    if (model.withheldStations) {
      g.push(model.withheldStations + ' station entries in the map squares searched are not shown (their list entries did not pass the checks of this site).');
    }
    model.watch.forEach(function (n) {
      if (!n.net.dated && n.undated.length) {
        g.push(n.net.title + ': its list gives no operating years, so whether its ' + n.undated.length +
          ' nearby entries existed in ' + y + ' is not known.');
      }
    });
    var why = {};
    (meta.linked_only || []).forEach(function (l) { (why[l.reason] = why[l.reason] || []).push(l.title); });
    Object.keys(why).sort().forEach(function (r) {
      g.push('Stations not on this page (' + r + '): ' + why[r].join('; ') + '.');
    });
    if (model.missing.regions) {
      g.push(model.missing.regions + ' registry region files could not be loaded, so the source list is not available in full.');
    } else if (model.place.unavailable) {
      g.push('Whether a registry source covers ' + y + ' for this region is not known without the place lookup.');
    } else if (model.sources.counts.covers === 0) { g.push('No registry source with stated years covers ' + y + ' for this region.'); }
    if (meta.rows_without_place) {
      g.push(meta.rows_without_place + ' registry rows state no place and ' + meta.unplaced_rows +
        ' name only places this page cannot put on the map (seas, cities and historical regions), so they are listed for no ' +
        'point; find them by searching the registry.');
    }
    if (y < 1875 || y > 2100) { g.push('The sky computation is checked only near 1952, 1980 and 1997; for ' + y + ' it is less certain.'); }
    g.push('Satellite passes, fireballs and meteor showers are not yet held.');
    return g;
  }

  /* io: { json(path) -> Promise of an object or null, bin(path) -> Promise of a Uint8Array or null, sky: the sky module } */
  function dossier(state, io) {
    var lat = state.lat, lon = state.lon, km = state.radius || 100;
    if (!finite(lat) || !finite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { return Promise.reject(new Error('place')); }
    var ms = parseMoment(state.time);
    if (ms === null) { return Promise.reject(new Error('time')); }
    var date = isoDate(ms), year = new Date(ms).getUTCFullYear();
    var model = { ms: ms, time: isoMinute(ms), date: date, year: year, lat: lat, lon: lon, radius: km };
    var meta, grid;
    return Promise.all([io.json('meta.json'), io.json('grid.json')]).then(function (r) {
      meta = r[0]; grid = r[1];
      if (!meta) { throw new Error('meta'); }
      model.meta = meta;
      var now = io.sky.sky(ms, lat, lon);
      model.sky = { now: now, around: skyAround(io.sky, ms, lat, lon) };
      model.place = grid ? placeOf(lat, lon, grid) : { countries: [], continent: null, ring: null, unavailable: true };
      model.keys = regionKeys(lat, lon, model.place, meta);
      var tiles = tilesFor(lat, lon, km).filter(function (t) { return meta.station_tiles.indexOf(t) >= 0; });
      var years = {};
      [ms - 86400000, ms, ms + 86400000].forEach(function (t) { years[isoDate(t).slice(0, 4)] = true; });
      var ys = Object.keys(years);
      function yearDocs(kind, list) {
        return Promise.all(ys.map(function (y) {
          return list.indexOf(+y) >= 0 ? io.json(kind + '/' + y + '.json') : Promise.resolve(null);
        })).then(function (docs) { var o = {}; ys.forEach(function (y, i) { o[y] = docs[i]; }); return o; });
      }
      /* the weather: the land and coast tile and the sea tile of the cell's 10 degree square and decade, each loaded only
         when the month is held for that set (a month not yet held is never read as zero) */
      var wx = meta.weather && meta.weather.product, wxSets = [], wxHeldMonth = false;
      if (wx) {
        var c = weatherCell(lat, lon, wx.grid_deg), t0 = tileName(Math.floor(c[0] / 10) * 10, Math.floor(c[1] / 10) * 10);
        var dec = String(Math.floor(year / 10) * 10);
        WX_SETS.forEach(function (s) {
          var st = wx.sets[s];
          if (!st || (st.months_complete || []).indexOf(date.slice(0, 7)) < 0) { return; }
          wxHeldMonth = true;
          if (own(st.tiles, dec) && st.tiles[dec].indexOf(t0) >= 0) { wxSets.push({ set: s, path: 'wx/' + s + '/' + dec + '/' + t0 + '.bin.gz' }); }
        });
      }
      return Promise.all([
        Promise.all(model.keys.map(function (k) { return io.json('reg/' + meta.regions[k].file); })),
        Promise.all(tiles.map(function (t) { return io.json('st/' + t + '.json'); })),
        yearDocs('launch', meta.launch.years), yearDocs('reentry', meta.reentry.years), yearDocs('kp', meta.kp.years),
        Promise.all(wxSets.map(function (w) {
          return Promise.resolve(io.bin(w.path)).then(function (b) { return b ? gunzip(b, io) : null; }, function () { return null; });
        }))
      ]).then(function (p) {
        /* a list counts as checked only when its file loaded; a file that did not load is data not available, never zero */
        model.missing = { regions: p[0].filter(function (d) { return !d; }).length,
          tiles: p[1].filter(function (d) { return !d; }).length };
        model.sources = sourcesFor(year, p[0], meta, date, lat, lon);
        model.watch = stationsNear(lat, lon, km, year, p[1], meta);
        model.withheldStations = p[1].reduce(function (a, d) { return a + (d && finite(d.withheld) ? d.withheld : 0); }, 0);
        var yd = isoDate(ms - 86400000);
        function covered(dates) { return dates && dates[0] && dates[0] <= date && date <= dates[1]; }
        function loaded(docs, list) {
          return [date, yd].every(function (d) { return list.indexOf(+d.slice(0, 4)) < 0 || !!docs[d.slice(0, 4)]; });
        }
        var ld = meta.launch.dates;
        if (!covered(ld)) {
          model.events = { launches: { status: 'none', day: [], before: [], month: [],
            note: 'Launches are held from ' + (ld && ld[0]) + ' to ' + (ld && ld[1]) + ' (GCAT); not available for this date.' } };
        } else if (!loaded(p[2], meta.launch.years)) {
          model.events = { launches: { status: 'unavailable', day: [], before: [], month: [],
            note: 'The launch list for this date could not be loaded; launches are not available here.' } };
        } else {
          var L = launchesNear(ms, p[2]); L.status = 'held';
          var wd = p[2][date.slice(0, 4)].w || {}, wb = (p[2][yd.slice(0, 4)] || {}).w || {};
          if (yd < ld[0]) { L.before = []; L.beforeUnknown = true; }
          L.withheld = (wd[date] || 0) + (wb[yd] || 0);
          L.withheldMonth = wd[date.slice(0, 7)] || 0;
          model.events = { launches: L };
        }
        var rdates = meta.reentry.dates;
        if (!covered(rdates)) {
          model.events.reentries = { status: 'none', note: 'Re-entry counts are held from ' + (rdates && rdates[0]) + ' to ' +
            (rdates && rdates[1]) + '; not available for this date.' };
        } else if (!loaded(p[3], meta.reentry.years)) {
          model.events.reentries = { status: 'unavailable', note: 'The re-entry counts for this date could not be loaded; not available here.' };
        } else {
          var rd = p[3][date.slice(0, 4)], rb = p[3][yd.slice(0, 4)];
          model.events.reentries = { status: 'held', date: date, day: own(rd, date) ? rd[date] : 0,
            before: yd < rdates[0] ? null : (own(rb, yd) ? rb[yd] : 0) };
        }
        var kpFailed = ys.some(function (y) { return meta.kp.years.indexOf(+y) >= 0 && !p[4][y]; });
        var kp = kpNear(ms, p[4]).filter(function (k) { return Math.abs(k.start + 5400000 - ms) <= 6 * 3600000 + 5400000; });
        if (kp.length) {
          var mx = Math.max.apply(null, kp.map(function (k) { return k.value; }));
          var dayVals = p[4][date.slice(0, 4)] && own(p[4][date.slice(0, 4)], date) ? p[4][date.slice(0, 4)][date] : null;
          model.events.kp = { status: 'held', near: kp, max: mx, day: dayVals };
        } else if (kpFailed) {
          model.events.kp = { status: 'unavailable', note: 'The geomagnetic index file for this date could not be loaded; Kp is not available here.' };
        } else {
          model.events.kp = { status: 'none', note: 'The geomagnetic index Kp is not yet held for ' + date +
            (meta.kp.held ? '; in this edition it is held only for ' + meta.kp.held + ', around the studies' : '') +
            '. More days are added with each update.' };
        }
        model.weather = weatherModel(wx, wxSets, p[5], wxHeldMonth, lat, lon, ms, date, meta.weather && meta.weather.held);
        model.envelope = envelope(model, meta);
        model.gaps = gaps(model, meta);
        return model;
      });
    });
  }

  var api = { fill: fill, linkValues: linkValues, parseMoment: parseMoment, isoDate: isoDate, yearText: yearText,
    spanText: spanText, licenceText: licenceText, unlistedLine: unlistedLine, distanceKm: distanceKm, tilesFor: tilesFor, tileName: tileName, placeOf: placeOf,
    regionKeys: regionKeys, sourcesFor: sourcesFor, stationsNear: stationsNear,
    readTile: readTile, weatherAt: weatherAt, weatherCell: weatherCell, compass: compass, dossier: dossier };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.MagDossier = api;

  /* ---- the page ---------------------------------------------------------------------------------------------------------- */
  var app = typeof document !== 'undefined' ? document.getElementById('dossier-app') : null;
  if (!app || !root.fetch || !root.MagSky) { return; }
  var DATA = app.getAttribute('data-src') || 'data/dossier/';
  var cache = {};
  var GROUP_MOST = 50;   /* rows shown at first in one group of the source list */
  var FETCH_OPTS = { credentials: 'omit', redirect: 'error' };
  var SAFE_PATH = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:json|bin\.gz)$/;
  var io = {
    sky: root.MagSky,
    /* only files under this site's dossier directory, sent without credentials, never followed through a redirect */
    json: function (p) {
      if (!own(cache, p)) {
        cache[p] = !SAFE_PATH.test(p) ? Promise.resolve(null) : root.fetch(DATA + p, FETCH_OPTS).then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      }
      return cache[p];
    },
    bin: function (p) {
      if (!SAFE_PATH.test(p)) { return Promise.resolve(null); }
      return root.fetch(DATA + p, FETCH_OPTS).then(function (r) {
        return r.ok ? r.arrayBuffer().then(function (b) { return new Uint8Array(b); }) : null;
      }).catch(function () { return null; });
    }
  };
  function $(id) { return document.getElementById(id); }
  var els = { place: $('d-place'), lat: $('d-lat'), lon: $('d-lon'), date: $('d-date'), time: $('d-time'), radius: $('d-radius'),
    go: $('d-go'), form: $('d-form'), map: $('d-map'), mark: $('d-mark'), status: $('d-status'), out: $('d-out'), sky: $('d-sky'),
    events: $('d-events'), weather: $('d-weather'), watch: $('d-watch'), sources: $('d-sources'), envelope: $('d-envelope'),
    gaps: $('d-gaps'), summary: $('d-summary'), summaryWhat: $('d-summary-what'), summaryList: $('d-summary-list') };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }
  function add(parent, child) { parent.appendChild(child); return child; }
  function link(href, text) {
    var a = el('a', null, text);
    var h = String(href || '');
    if (safeUrl(h)) { a.href = h; a.rel = 'noopener noreferrer'; }
    else if (/^registry\.html#row-[0-9a-f]{16}$/.test(h) || /^case-[a-z0-9-]+\.html$/.test(h)) { a.href = h; }
    else { return el('span', null, text); }
    return a;
  }
  function rowLink(id, text) { return link('registry.html#row-' + id, text); }
  function clear(n) { while (n.firstChild) { n.removeChild(n.firstChild); } }
  function fmtN(n) { return Number(n).toLocaleString('en-GB'); }
  function sourceLine(parent, row, extra) {
    var p = add(parent, el('p', 'd-src'));
    p.appendChild(document.createTextNode('Source: '));
    if (row) {
      p.appendChild(rowLink(row.id, row.title));
      p.appendChild(document.createTextNode('; licence ' + licenceText(row.licence_verdict, row.licence_label) + '.'));
    } else {
      p.appendChild(document.createTextNode('not held.'));
    }
    if (extra) { p.appendChild(document.createTextNode(' ' + extra)); }
    return p;
  }
  /* a table's scroll box is a named region a keyboard can reach, as on the plates built with the site */
  function table(parent, head, rows, caption, name) {
    var wrap = add(parent, el('div', 'table-wrap'));
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', caption || name || head.join(', '));
    wrap.setAttribute('tabindex', '0');
    var t = add(wrap, el('table', 'd-table'));
    if (caption) { add(t, el('caption', null, caption)); }
    var tr = add(add(t, el('thead')), el('tr'));
    head.forEach(function (h) { var th = add(tr, el('th', null, h)); th.scope = 'col'; });
    var tb = add(t, el('tbody'));
    rows.forEach(function (r) {
      var row = add(tb, el('tr'));
      r.forEach(function (c) {
        var td = add(row, el('td'));
        if (c && c.nodeType) { td.appendChild(c); } else { td.textContent = c === null || c === undefined ? '' : String(c); }
      });
    });
    return t;
  }
  function more(parent, summary, open) {
    var d = add(parent, el('details', 'd-more'));
    add(d, el('summary', null, summary));
    if (open) { d.open = true; }
    return d;
  }
  function deg(x, d) { return finite(x) ? x.toFixed(d === undefined ? 1 : d) : ''; }
  function placeText(lat, lon) {
    return deg(Math.abs(lat), 4) + (lat < 0 ? ' S, ' : ' N, ') + deg(Math.abs(lon), 4) + (lon < 0 ? ' W' : ' E');
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
    if (text) { n.textContent = text; }
    return n;
  }
  /* the sky disc: zenith at the centre, horizon at the rim, north at the top and east on the left, as seen looking up (the
     convention of the study plates). Labels are laid out so none overlaps another, a body or a direction letter, or leaves
     the drawing; bodies drawn very close together share one label. */
  var LABEL_CHAR = 5.9;
  function mergeClose(points, near) {
    var groups = [];
    points.slice().sort(function (a, b) { return a.rank - b.rank; }).forEach(function (pt) {
      for (var g = 0; g < groups.length; g++) {
        if (groups[g].some(function (q) { return Math.sqrt(Math.pow(pt.x - q.x, 2) + Math.pow(pt.y - q.y, 2)) < near; })) {
          groups[g].push(pt); return;
        }
      }
      groups.push([pt]);
    });
    return groups;
  }
  function placeLabels(groups, box, avoid) {
    var taken = avoid.slice(), dots = [], out = [];
    groups.forEach(function (g) { g.forEach(function (q) { dots.push({ q: q, r: [q.x - q.r - 1, q.y - q.r - 1, q.x + q.r + 1, q.y + q.r + 1] }); }); });
    function hit(a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; }
    var DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [0.8, -0.8], [0.8, 0.8], [-0.8, -0.8], [-0.8, 0.8]];
    groups.forEach(function (g) {
      var lead = g[0], text = g.map(function (q) { return q.name; }).join(', ');
      var w = LABEL_CHAR * text.length, best = null;
      var others = dots.filter(function (d) { return g.indexOf(d.q) < 0; }).map(function (d) { return d.r; });
      [3, 12, 22].some(function (gap) {
        var rr = lead.r + gap;
        DIRS.some(function (dv) {
          var ax = lead.x + dv[0] * rr, ay = lead.y + dv[1] * rr;
          var anchor = dv[0] > 0.1 ? 'start' : (dv[0] < -0.1 ? 'end' : 'middle');
          var x0 = anchor === 'start' ? ax : (anchor === 'end' ? ax - w : ax - w / 2);
          var base = dv[1] === 0 ? ay + 4 : (dv[1] < 0 ? ay : ay + 9);
          var rect = [x0, base - 9, x0 + w, base + 2];
          var inside = rect[0] >= box[0] && rect[2] <= box[2] && rect[1] >= box[1] && rect[3] <= box[3];
          var hits = taken.concat(others).filter(function (t) { return hit(rect, t); }).length;
          var score = [inside ? 0 : 1, hits, gap];
          if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] ||
              (score[1] === best.score[1] && score[2] < best.score[2])))) {
            best = { score: score, x: ax, y: base, anchor: anchor, rect: rect, far: gap > 5 };
          }
          return inside && !hits;
        });
        return best && best.score[0] === 0 && best.score[1] === 0;
      });
      taken.push(best.rect);
      var leader = null;
      if (best.far) {
        leader = [lead.x, lead.y, Math.min(Math.max(lead.x, best.rect[0]), best.rect[2]), Math.min(Math.max(lead.y, best.rect[1]), best.rect[3])];
      }
      out.push({ text: text, x: best.x, y: best.y, anchor: best.anchor, leader: leader });
    });
    return out;
  }
  function skyDisc(parent, sky) {
    var fig = add(parent, el('figure', 'chart sky d-sky'));
    var C = 110, R = 95, box = [-40, -8, 260, 228];
    var dark = sky.sun.alt_apparent < -6;
    var s = svgEl('svg', { viewBox: box[0] + ' ' + box[1] + ' ' + (box[2] - box[0]) + ' ' + (box[3] - box[1]), role: 'img',
      'aria-labelledby': 'd-sky-t d-sky-d' });
    fig.appendChild(s);
    s.appendChild(svgEl('title', { id: 'd-sky-t' }, 'The sky above the horizon at the moment'));
    var desc = svgEl('desc', { id: 'd-sky-d' });
    s.appendChild(desc);
    s.appendChild(svgEl('circle', { cx: C, cy: C, r: R, 'class': 'sky-rim' }));
    [30, 60].forEach(function (a) { s.appendChild(svgEl('circle', { cx: C, cy: C, r: R * (90 - a) / 90, 'class': 'sky-ring' })); });
    var avoid = [];
    [['N', C, C - R - 6], ['E', C - R - 10, C + 4], ['S', C, C + R + 14], ['W', C + R + 10, C + 4]].forEach(function (d) {
      s.appendChild(svgEl('text', { x: d[1], y: d[2], 'class': 'sky-dir', 'text-anchor': 'middle' }, d[0]));
      avoid.push([d[1] - 6, d[2] - 11, d[1] + 6, d[2] + 2]);
    });
    var pts = [], said = [];
    function put(name, b, cls, r, rank) {
      if (!b || !(b.alt_apparent > 0)) { return; }
      var rr = R * (90 - b.alt_apparent) / 90, x = C - rr * Math.sin(rad(b.az)), y = C - rr * Math.cos(rad(b.az));
      s.appendChild(svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r, 'class': cls }));
      pts.push({ x: x, y: y, r: r, name: name, rank: rank });
      said.push(name + ' ' + b.alt_apparent.toFixed(1) + ' degrees up, azimuth ' + Math.round(b.az) + ' (' + compass(b.az) + ')');
    }
    put('Sun', sky.sun, 'sky-sun', 5, 0);
    put('Moon', sky.moon, 'sky-moon', 4, 1);
    PLANETS.forEach(function (p, k) { put(bodyName(p), sky.planets[p], 'sky-planet', 2.5, 2 + k * 0.01); });
    /* stars only when the sky is dark (the Sun more than 6 degrees below the horizon) */
    if (dark) { sky.stars.forEach(function (st) { if (st.mag <= 1.0) { put(bodyName(st.name), st, 'sky-body', 1.2, 3 + st.mag / 10); } }); }
    placeLabels(mergeClose(pts, 7), box, avoid).forEach(function (l) {
      if (l.leader) { s.appendChild(svgEl('line', { x1: l.leader[0].toFixed(1), y1: l.leader[1].toFixed(1), x2: l.leader[2].toFixed(1), y2: l.leader[3].toFixed(1), 'class': 'sky-leader' })); }
      s.appendChild(svgEl('text', { x: l.x.toFixed(1), y: l.y.toFixed(1), 'class': 'sky-name', 'text-anchor': l.anchor }, l.text));
    });
    desc.textContent = said.length ? said.join('; ') + '.' : 'No body of the list above the horizon.';
    add(fig, el('figcaption', null, 'Bodies above the horizon at the moment, apparent positions; zenith at the centre, rings at 30 and 60 degrees up. ' +
      'North at the top and east on the left, as seen looking up.' + (dark ? '' : ' Stars are drawn only when the Sun is more than 6 degrees below the horizon.')));
  }

  function drawSky(m) {
    var box = els.sky, sky = m.sky.now;
    clear(box);
    var tw = sky.twilight;
    add(box, el('p', null, 'At ' + m.time.replace('T', ' ').replace('Z', ' UTC') + ' (' + dayText(m.ms) + ') at ' +
      placeText(m.lat, m.lon) + ': ' + tw.state + '; the Sun ' + deg(Math.abs(sky.sun.alt_apparent)) + ' degrees ' +
      (sky.sun.alt_apparent >= 0 ? 'above' : 'below') + ' the horizon. Moon: ' + sky.moon.phase_text + '.'));
    skyDisc(box, sky);
    var rows = [['Sun', sky.sun], ['Moon', sky.moon]];
    PLANETS.forEach(function (p) { rows.push([bodyName(p), sky.planets[p]]); });
    table(box, ['Body', 'Altitude, degrees', 'Azimuth, degrees', 'Magnitude', 'Above the horizon'], rows.map(function (r) {
      return [r[0], deg(r[1].alt_apparent), deg(r[1].az, 0) + ' ' + compass(r[1].az), deg(r[1].mag), r[1].alt_apparent > 0 ? 'yes' : 'no'];
    }), 'Apparent altitude (with standard refraction) and azimuth from north through east');
    var ev = tw.events, trow = [];
    [['sunrise_sunset', 'Sunrise and sunset'], ['civil', 'Civil dawn and dusk'], ['nautical', 'Nautical dawn and dusk'],
      ['astronomical', 'Astronomical dawn and dusk']].forEach(function (k) {
      var e = ev[k[0]];
      trow.push([k[1], e.rise ? hhmm(e.rise) + ' UTC' : (e.all_day === 'above' ? 'all day above' : 'none'),
        e.set ? hhmm(e.set) + ' UTC' : (e.all_day === 'below' ? 'all day below' : 'none')]);
    });
    table(box, ['The Sun', 'Morning', 'Evening'], trow, 'The local solar day at this longitude');
    var stars = sky.stars.filter(function (s) { return s.alt_apparent > 0; });
    var d = more(box, stars.length + ' of the 16 brightest stars above the horizon');
    table(d, ['Star', 'Altitude', 'Azimuth', 'Magnitude'], stars.map(function (s) {
      return [bodyName(s.name), deg(s.alt_apparent), deg(s.az, 0) + ' ' + compass(s.az), deg(s.mag)];
    }), 'The brightest stars above the horizon');
    add(box, el('p', 'd-src', 'Source: computed in your browser from published methods (Meeus, Astronomical Algorithms, 1998; Delta T after Espenak and Meeus, 2006); within 0.05 degree of a modern ephemeris on the study dates.'));
  }

  function drawEvents(m) {
    var box = els.events, meta = m.meta, L = m.events.launches;
    clear(box);
    add(box, el('h3', null, 'Launches'));
    if (L.status !== 'held') { add(box, el('p', 'empty', L.note)); }
    else {
      var list = L.before.concat(L.day);
      if (!list.length && !L.month.length && !L.withheld && !L.withheldMonth && !L.beforeUnknown) { add(box, el('p', 'empty', 'No launch is listed on ' + isoDate(m.ms - 86400000) + ' or ' + m.date + '.')); }
      if (L.withheld || L.withheldMonth) {
        add(box, el('p', 'note', (L.withheld + L.withheldMonth) + ' launch records of these days or this month are not shown here; see the source.'));
      }
      if (list.length) {
        table(box, ['Date', 'Time, UTC', 'Launch', 'Vehicle', 'Mission', 'Category', 'Outcome', 'Site'], list.map(function (e) {
          return [e.date, e.time || 'not given', e.id, e.vehicle, e.mission || e.flight || '', e.category || '', e.outcome || '', e.site || ''];
        }), 'Launches the day before and the day of the moment (UTC days)');
      }
      if (L.month.length) {
        var dm = more(box, L.month.length + (L.month.length === 1 ? ' launch' : ' launches') + ' dated only to the month');
        table(dm, ['Month', 'Launch', 'Vehicle', 'Site'], L.month.map(function (e) { return [e.date, e.id, e.vehicle, e.site || '']; }),
          'Launches dated only to the month');
      }
      add(box, el('p', 'note', 'Outcome and site are GCAT abbreviations; the catalogue held here gives no site coordinates.'));
    }
    sourceLine(box, meta.launch.source);
    add(box, el('h3', null, 'Re-entries'));
    var R = m.events.reentries;
    add(box, el('p', R.status === 'held' ? null : 'empty', R.status === 'held' ? 'Catalogued objects that re-entered: ' + R.day + ' on ' + R.date +
      ', ' + (R.before === null ? 'the day before not available' : R.before + ' the day before') + '. The catalogue gives the day only: no time and no ground point.' : R.note));
    sourceLine(box, meta.reentry.source, 'Counts derived from the catalogue; its records are not copied.');
    add(box, el('h3', null, 'Geomagnetic index Kp'));
    var K = m.events.kp;
    if (K.status === 'held') {
      table(box, ['3 hours from, UTC', 'Kp'], K.near.map(function (k) { return [isoMinute(k.start).replace('T', ' ').replace('Z', ''), k.value.toFixed(2)]; }),
        'Kp in the 3 hour intervals within 6 hours of the moment');
      add(box, el('p', null, 'Highest Kp near the moment: ' + K.max.toFixed(2) + '. Kp is one index for the whole planet; this site does not compute the geomagnetic latitude of the place.'));
    } else {
      add(box, el('p', 'empty', K.note));
    }
    sourceLine(box, meta.kp.source);
  }

  var WX_NAMES = { cloud: 'Cloud cover, day mean', precip: 'Precipitation, day total',
    wind_speed: 'Wind at 10 m, speed of the day mean wind (a lower bound of the mean speed)',
    wind_dir: 'Wind at 10 m, blowing from (degrees from north)', temp: 'Air temperature at 2 m, day mean',
    wave_hs: 'Wave height (significant, wind waves and swell), day mean', wave_period: 'Wave period (mean), day mean' };
  var WX_ORDER = ['cloud', 'precip', 'wind_speed', 'wind_dir', 'temp', 'wave_hs', 'wave_period'];
  var WX_UNITS = { 'Cel': 'degrees C', '%': 'percent', 'degree': 'degrees', 'mm': 'mm', 'm/s': 'm/s', 'm': 'm', 's': 's' };
  var WX_WHAT = 'These are regional daily averages from the ERA5 reanalysis: each value is the mean over a 2 degree ' +
    'square (about 220 km north to south) and a whole UTC day. They are not the local weather at a point or at an hour, ' +
    'and not observations; they are least certain before about 1950.';
  function wxCredit(wp) {
    var y = wp && wp.years ? ' (' + (wp.years[0] === wp.years[1] ? wp.years[0] : wp.years[0] + ' to ' + wp.years[1]) + ')' : '';
    return 'Contains modified Copernicus Climate Change Service information' + y + '. Data: ERA5 daily statistics ' +
      '(Hersbach and others), Copernicus Climate Change Service, averaged here to a 2 degree grid; licence CC BY 4.0' +
      (wp && wp.doi ? ', DOI ' + wp.doi : '') + '. Neither the European Commission nor ECMWF is responsible for any use ' +
      'that may be made of the Copernicus information or data it contains.';
  }

  function drawWeather(m) {
    var box = els.weather, W = m.weather, wp = m.meta.weather && m.meta.weather.product;
    clear(box);
    if (W.status !== 'held') { add(box, el('p', 'empty', W.note)); }
    else {
      var rows = [], vals = W.values.values;
      WX_ORDER.forEach(function (k) {
        if (!own(vals, k)) { return; }
        var v = vals[k], u = WX_UNITS[v.unit] || '';
        rows.push([WX_NAMES[k], v.value === null ? 'no value for this day' :
          (k === 'cloud' || k === 'wind_dir' ? String(Math.round(v.value)) : v.value.toFixed(1)) + (u ? ' ' + u : '')]);
      });
      table(box, ['Field', 'Regional daily value'], rows, 'UTC day ' + W.date + ', the 2 degree cell centred on ' +
        W.values.cell[0] + ', ' + W.values.cell[1]);
      add(box, el('p', 'note', WX_WHAT));
    }
    if (wp) { add(box, el('p', 'd-src', wxCredit(wp))); }
    sourceLine(box, m.meta.weather.source);
  }

  function drawWatch(m) {
    var box = els.watch;
    clear(box);
    var total = 0, unl = 0;
    m.watch.forEach(function (n) { total += n.operating.length; unl += n.unlisted; });
    var listed = total + ' listed station' + (total === 1 ? '' : 's') + ' with stated years ' +
      (total === 1 ? 'was' : 'were') + ' operating in ' + m.year + ' within ' + m.radius + ' km';
    var missing = m.missing.tiles ? ' ' + m.missing.tiles + ' station files could not be loaded, so this list is not complete.' : '';
    if (unl) {
      var nets = m.watch.filter(function (n) { return n.unlisted; });
      add(box, el('p', null, 'About ' + (total + unl) + ' held stations were operating near this point: ' + unl + ' in the 1 degree ' +
        'squares reaching within ' + m.radius + ' km at some time in ' + decadeText(m.year) + ' (' +
        nets.map(function (n) { return n.net.title + ' ' + n.unlisted; }).join(', ') + '), and ' + listed + '.' + missing));
      var why = add(box, el('p', null, UNLISTED_WHY + ' The archives: '));
      nets.forEach(function (n, k) {
        if (k) { why.appendChild(document.createTextNode(k === nets.length - 1 ? ' and ' : ', ')); }
        why.appendChild(n.net.row_id ? rowLink(n.net.row_id, n.net.title) : document.createTextNode(n.net.title));
      });
      why.appendChild(document.createTextNode('.'));
    } else {
      add(box, el('p', null, listed + '.' + missing));
    }
    m.watch.forEach(function (n) {
      if (!n.operating.length && !n.undated.length) { return; }
      var h = add(box, el('h3'));
      h.appendChild(n.net.row_id ? rowLink(n.net.row_id, n.net.title) : document.createTextNode(n.net.title));
      add(box, el('p', 'd-src', 'Licence ' + licenceText(n.net.licence_verdict, n.net.licence_label) + '. ' +
        (n.net.dated ? n.operating.length + ' operating in ' + m.year + (n.closed ? ', ' + n.closed + ' others nearby outside their years' : '') + '.'
          : 'The list gives no operating years: ' + n.undated.length + ' nearby, status in ' + m.year + ' not known.') +
        (n.net.federal_only ? ' Only the stations run by US federal agencies (the National Weather Service, the FAA and the US military) are listed; the others are linked through the source.' : '')));
      var list = n.operating.length ? n.operating : n.undated;
      var target = list.length > 12 ? more(box, 'List the ' + list.length + ' stations') : box;
      table(target, ['Name', 'Identifier', 'Distance, km', 'Years', 'Measures'], list.map(function (s) {
        return [s.name, s.id, s.km.toFixed(0), finite(s.first) ? s.first + ' to ' + s.last : 'not given',
          s.measures.join(', ') + (s.type ? ' (' + s.type.replace(/_/g, ' ') + ')' : '')];
      }), 'Stations of ' + n.net.title);
    });
  }

  function drawSources(m) {
    var box = els.sources, S = m.sources, meta = m.meta;
    clear(box);
    var names = m.place.countries.map(function (c) { return (meta.country_names[c] || c) + ' (' + c + ')'; });
    add(box, el('p', null, 'Region of the point: ' + (m.place.unavailable ? 'place lookup not available' :
      (names.length ? names.join(', ') : 'no country found')) +
      (m.place.ring ? ', from the nearest airfields about ' + m.place.ring + (m.place.ring === 1 ? ' degree away' : ' degrees away') : '') +
      '; with ' + m.keys.filter(function (k) { return k.indexOf('r-') === 0; }).map(function (k) { return k.slice(2); }).join(', ') +
      ' and world-wide sources. ' + S.counts.covers + ' sources state years covering ' + m.year + '; ' + S.linked +
      ' have a tested link to their own record for this date or place.'));
    add(box, el('p', 'd-src', 'Country from the airfields of the OurAirports list in the same 1 degree square (or the nearest ones).'));
    function group(parent, groups) {
      groups.forEach(function (g) {
        add(parent, el('h3', null, g.kind.charAt(0).toUpperCase() + g.kind.slice(1) + ' (' + g.rows.length + ')'));
        var ul = add(parent, el('ul', 'd-list'));
        /* a long group shows its first rows (those with a tested link come first) and the rest on request, so a region
           with thousands of sources stays quick to open */
        var first = g.rows.length > GROUP_MOST + 10 ? g.rows.slice(0, GROUP_MOST) : g.rows;
        if (first.length < g.rows.length) {
          var wrap = add(parent, el('p', 'more-wrap'));
          var btn = add(wrap, el('button', null, 'Show the other ' + fmtN(g.rows.length - first.length) + ' sources'));
          btn.type = 'button';
          btn.addEventListener('click', function () {
            g.rows.slice(first.length).forEach(item);
            if (wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
          });
        }
        first.forEach(item);
        function item(e) {
          var li = add(ul, el('li'));
          li.appendChild(rowLink(e.id, e.title));
          /* every place the row states, the one this point matched in bold, so the row reads as filed where it says */
          var line = add(li, el('div', 'deed-line'));
          line.appendChild(document.createTextNode(spanText(e.start, e.end) + '; ' + ((e.places.length || e.via.length) > 1 ? 'places ' : 'place ')));
          var shown = e.places.length ? e.places : e.via;
          shown.forEach(function (pl, k) {
            if (k) { line.appendChild(document.createTextNode(', ')); }
            if (e.via.indexOf(pl) >= 0 || (e.region && e.region === pl)) { add(line, el('strong', 'd-place-match', pl)); }
            else { line.appendChild(document.createTextNode(pl)); }
          });
          e.via.forEach(function (v) {
            if (shown.indexOf(v) < 0) { line.appendChild(document.createTextNode(' (matched as ')); add(line, el('strong', 'd-place-match', v)); line.appendChild(document.createTextNode(')')); }
          });
          line.appendChild(document.createTextNode('; access ' + (e.access || 'unknown') + '; licence ' + licenceText(e.verdict, e.licence)));
          e.links.forEach(function (l) {
            var q = add(li, el('div', 'deed-terms'));
            q.appendChild(link(l.url, 'Open: ' + l.label));
            q.appendChild(document.createTextNode(' (tested link, filled for ' + m.date + ')'));
          });
          if (!e.links.length) {
            var sp = link(e.url, 'Source page');
            if (sp.setAttribute && sp.tagName === 'A') { sp.setAttribute('aria-label', 'Source page: ' + e.title); }
            add(li, el('div', 'deed-terms')).appendChild(sp);
          }
          e.stations.forEach(function (st) {
            add(li, el('div', 'deed-terms', 'A record link (' + st.label + ') needs a station: ' + st.note));
          });
        }
      });
    }
    if (m.missing.regions) { add(box, el('p', 'empty', m.missing.regions + ' region files could not be loaded; this list is not complete.')); }
    /* no absence while a region file or the place lookup failed: the list is only incomplete then */
    if (S.counts.covers) { group(box, S.covers); } else if (!m.missing.regions && !m.place.unavailable) { add(box, el('p', 'empty', 'No source here states years covering ' + m.year + '.')); }
    if (S.counts.partial) { group(more(box, S.counts.partial + ' sources state only a start or an end consistent with ' + m.year), S.partial); }
    if (S.counts.undated) { group(more(box, S.counts.undated + ' sources for the region state no years'), S.undated); }
  }

  function drawEnvelope(m) {
    var box = els.envelope;
    clear(box);
    add(box, el('p', null, 'Known-cause candidates present in the held records near the moment: what was in the sky or in the records that a later test could weigh. Each line gives what the records hold and where from.'));
    add(box, el('p', 'caution', 'No verdict is computed for any account in this version: this is context only, and no candidate here is tested against any account. A line marked not found in the held records means only that the records held here, for the span stated, do not show it.'));
    var ul = add(box, el('ul', 'd-check'));
    m.envelope.forEach(function (it) {
      var li = add(ul, el('li'));
      var stn = add(li, el('span', 'd-state', it.status === 'present' ? 'in the held records' : (it.status === 'not seen' ? 'not found in the held records' :
        (it.status === 'uncertain' ? 'not fully known' : 'not held'))));
      stn.setAttribute('data-s', it.status === 'present' ? 'present' : (it.status === 'not seen' ? 'absent' : 'none'));
      li.appendChild(document.createTextNode(' '));
      add(li, el('strong', null, it.item));
      add(li, el('div', null, it.value));
      if (it.source && it.source.row) { sourceLine(li, it.source.row); }
      else if (it.source && it.source.text) { add(li, el('p', 'd-src', 'Source: ' + it.source.text + '.')); }
    });
  }

  function drawGaps(m) {
    var box = els.gaps;
    clear(box);
    var ul = add(box, el('ul'));
    m.gaps.forEach(function (g) { add(ul, el('li', null, g)); });
  }

  function readState() {
    var lat = parseFloat(els.lat.value), lon = parseFloat(els.lon.value), r = parseInt(els.radius.value, 10);
    var d = els.date.value, t = els.time.value || '00:00';
    return { lat: lat, lon: lon, time: d + 'T' + t.slice(0, 5), radius: [25, 50, 100, 200].indexOf(r) >= 0 ? r : 100 };
  }
  function setMark(lat, lon) {
    if (!els.mark || !finite(lat) || !finite(lon)) { return; }
    els.mark.setAttribute('cx', (lon + 180).toFixed(2));
    els.mark.setAttribute('cy', (90 - lat).toFixed(2));
    els.mark.setAttribute('visibility', 'visible');
  }
  function setInputs(lat, lon, time) {
    if (finite(lat)) { els.lat.value = String(Math.round(lat * 10000) / 10000); }
    if (finite(lon)) { els.lon.value = String(Math.round(lon * 10000) / 10000); }
    if (time) {
      var m = /^(\d{4}-\d\d-\d\d)T(\d\d:\d\d)/.exec(time);
      if (m) { els.date.value = m[1]; els.time.value = m[2]; }
    }
    setMark(parseFloat(els.lat.value), parseFloat(els.lon.value));
  }
  /* the dossier at a glance: the place and moment, and for each section whether its records were computed, held, not
     held or could not be loaded, each a link to its section */
  function drawSummary(m) {
    if (!els.summaryList) { return; }
    clear(els.summaryList);
    els.summaryWhat.textContent = placeText(m.lat, m.lon) + ', ' + m.time.replace('T', ' ').replace('Z', ' UTC') + ' (' + dayText(m.ms) + '); stations within ' + m.radius + ' km.';
    function state(st) { return st === 'held' ? 'held' : (st === 'unavailable' ? 'could not load' : 'not held'); }
    function cls(st) { return st === 'held' ? 'held' : (st === 'unavailable' ? 'failed' : 'none'); }
    var E = m.events, op = 0;
    m.watch.forEach(function (n) { op += n.operating.length + n.undated.length; });
    var items = [
      ['h-sky', 'The sky', 'computed', 'computed'],
      ['h-events', 'Launches', state(E.launches.status), cls(E.launches.status)],
      ['h-events', 'Re-entries', state(E.reentries.status), cls(E.reentries.status)],
      ['h-events', 'Geomagnetic index Kp', state(E.kp.status), cls(E.kp.status)],
      ['h-weather', 'Weather', state(m.weather.status), cls(m.weather.status)],
      ['h-watch', 'Stations operating', m.missing.tiles ? 'could not load in full' : (op ? fmtN(op) + ' listed' : 'none listed'), m.missing.tiles ? 'failed' : (op ? 'held' : 'none')],
      ['h-sources', 'Sources for the region and year', m.missing.regions ? 'could not load in full' : fmtN(m.sources.counts.covers + m.sources.counts.partial + m.sources.counts.undated) + ' listed', m.missing.regions ? 'failed' : 'held'],
      ['h-envelope', 'Known-cause candidates (context only)', m.envelope.filter(function (x) { return x.status === 'present'; }).length + ' of ' + m.envelope.length + ' in the held records', 'none'],
      ['h-gaps', 'Gaps', fmtN(m.gaps.length) + ' stated', 'none']
    ];
    items.forEach(function (it) {
      var li = add(els.summaryList, el('li'));
      var a = add(li, el('a', null, it[1]));
      a.href = '#' + it[0];
      var st = add(li, el('span', 'd-state', it[2]));
      st.setAttribute('data-s', it[3]);
    });
  }
  /* after a run, focus the summary and bring it into view (no animation when the reader asks for reduced motion), so on
     a phone the result is seen at once */
  function reveal() {
    var still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var target = els.summary || els.status;
    if (typeof target.focus === 'function') {
      try { target.focus({ preventScroll: true }); } catch (e) { /* an old browser: focus without options */ target.focus(); }
    }
    if (target.scrollIntoView) {
      try { target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); } catch (e) { target.scrollIntoView(true); }
    }
  }
  /* one check for the form and the address alike: each field in range, each fault named beside its field */
  function fieldError(input, msg) {
    if (!input) { return; }
    var box = $(input.id + '-err');
    if (msg) { input.setAttribute('aria-invalid', 'true'); } else if (input.removeAttribute) { input.removeAttribute('aria-invalid'); }
    if (box) { box.textContent = msg || ''; box.hidden = !msg; }
  }
  function validate(st) {
    var bad = null;
    var latOk = finite(st.lat) && st.lat >= -90 && st.lat <= 90, lonOk = finite(st.lon) && st.lon >= -180 && st.lon <= 180;
    var ms = parseMoment(st.time), y = ms === null ? null : new Date(ms).getUTCFullYear();
    var dateOk = ms !== null && y >= 1000 && y <= 2100;
    var timeOk = !els.time.value || /^\d\d:\d\d(?::\d\d)?$/.test(els.time.value);
    fieldError(els.lat, latOk ? null : 'A latitude from -90 to 90.');
    fieldError(els.lon, lonOk ? null : 'A longitude from -180 to 180.');
    fieldError(els.date, dateOk ? null : 'A date from the year 1000 to 2100.');
    fieldError(els.time, timeOk ? null : 'A time as hours and minutes, UTC.');
    if (!latOk) { bad = els.lat; } else if (!lonOk) { bad = els.lon; } else if (!dateOk) { bad = els.date; } else if (!timeOk) { bad = els.time; }
    return bad;
  }
  var busy = 0;
  function retire() { if (els.out && !els.out.hidden) { els.out.className = 'stale'; els.out.setAttribute('aria-busy', 'true'); } }
  function run() {
    var n = ++busy;   /* counted first: an earlier dossier still on its way is never drawn over a newer request */
    var st = readState();
    var bad = validate(st);
    if (bad) {
      els.out.hidden = true;   /* a result for another place or moment is never left showing beside a refused request */
      els.status.textContent = 'The dossier was not opened: ' + ($(bad.id + '-err') ? $(bad.id + '-err').textContent : 'check the fields.');
      if (typeof bad.focus === 'function') { bad.focus(); }
      return;
    }
    setMark(st.lat, st.lon);
    retire();
    els.status.textContent = 'Gathering the dossier.';
    dossier(st, io).then(function (m) {
      if (n !== busy) { return; }
      drawSky(m); drawEvents(m); drawWeather(m); drawWatch(m); drawSources(m); drawEnvelope(m); drawGaps(m); drawSummary(m);
      els.out.className = ''; if (els.out.removeAttribute) { els.out.removeAttribute('aria-busy'); }
      els.out.hidden = false;
      els.status.textContent = 'Dossier for ' + placeText(st.lat, st.lon) + ' at ' + m.time.replace('T', ' ').replace('Z', ' UTC') + '.';
      try { root.history.replaceState(null, '', '#lat=' + st.lat + '&lon=' + st.lon + '&t=' + m.time + '&r=' + st.radius); } catch (e) { /* not allowed */ }
      lastHash = root.location.hash || '';
      reveal();
    }).catch(function () {
      if (n === busy) {
        els.out.hidden = true;
        els.status.textContent = 'The dossier could not be put together from the files of this site.';
      }
    });
  }
  if (els.form) {
    els.form.addEventListener('submit', function (e) { if (e && e.preventDefault) { e.preventDefault(); } run(); });
  } else {
    els.go.addEventListener('click', run);
  }
  els.place.addEventListener('change', function () {
    var o = els.place.options[els.place.selectedIndex];
    if (!o || !o.value) { return; }
    setInputs(parseFloat(o.getAttribute('data-lat')), parseFloat(o.getAttribute('data-lon')), o.getAttribute('data-time'));
  });
  Array.prototype.forEach.call(document.querySelectorAll('button.d-case'), function (b) {
    b.addEventListener('click', function () {
      setInputs(parseFloat(b.getAttribute('data-lat')), parseFloat(b.getAttribute('data-lon')), b.getAttribute('data-time'));
      run();
    });
  });
  if (els.map) {
    els.map.addEventListener('click', function (ev) {
      var r = els.map.getBoundingClientRect();
      if (!r.width || !r.height) { return; }
      var lon = (ev.clientX - r.left) / r.width * 360 - 180, lat = 90 - (ev.clientY - r.top) / r.height * 180;
      setInputs(Math.max(-90, Math.min(90, lat)), Math.max(-180, Math.min(180, lon)), null);
    });
  }
  /* the address carries the place and moment; a changed address (typed, or Back) runs the dossier again */
  var lastHash = null;
  function fromHash() {
    var hs = root.location.hash || '';
    var h = /^#lat=(-?\d{1,2}(?:\.\d{1,6})?)&lon=(-?\d{1,3}(?:\.\d{1,6})?)&t=(\d{4}-\d\d-\d\dT\d\d:\d\dZ)(?:&r=(\d{1,4}))?$/.exec(hs);
    if (!h) { return false; }
    setInputs(Number(h[1]), Number(h[2]), h[3]);
    if (h[4] && [25, 50, 100, 200].indexOf(+h[4]) >= 0) { els.radius.value = h[4]; }
    lastHash = hs;
    run();
    return true;
  }
  if (root.addEventListener) {
    root.addEventListener('hashchange', function () {
      if ((root.location.hash || '') !== lastHash) { fromHash(); }
    });
  }
  if (!fromHash()) {
    /* no moment in the address: the first worked example is filled in (not run), never today's date, for which little is held */
    var first = document.querySelectorAll('button.d-case')[0];
    if (first) {
      setInputs(parseFloat(first.getAttribute('data-lat')), parseFloat(first.getAttribute('data-lon')), first.getAttribute('data-time'));
    }
    els.status.textContent = 'Choose a place and a moment, then open the dossier' +
      (first ? ' (the first worked example is filled in).' : '.');
  }
})(this);
