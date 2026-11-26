/* The Magonia Cadastre: the registry browser. Reads the static index under data/ from this site only, filters and
   searches in the page, and draws one full row at registry.html#row-<id>. Nothing is stored, nothing is sent. */
(function () {
  'use strict';
  var app = document.getElementById('registry-app');
  if (!app || !window.fetch) { return; }
  var DATA = app.getAttribute('data-src') || 'data/';
  var PAGE = 50;
  var MOST = 1000;   /* the list never holds more than this many rows at once: past it, a search or a filter narrows it */
  var meta = null;
  var rows = [];
  var hay = [];
  var tkey = [];   /* each row's title, folded: the default order and the title matches of a search */
  var matches = [];
  var shown = PAGE;
  var loading = true;
  var failed = false;
  var buckets = {};
  var timer = null;
  var rank = [];   /* each row's tier rank, as a number */
  /* the default order is fixed when the site is built (the cornerstone holdings, then tier B by kind, then C, then A) and
     the index files come in it, so a row's place in the index is its place in the default order */
  var last = null; /* the last search: a longer search filters its matches only */
  var back = { hash: '', y: 0, shown: PAGE, id: null };   /* the list a row was opened from, restored on the way back */
  var FETCHES = 4; /* index files read at once */

  function $(id) { return document.getElementById(id); }
  var els = {
    q: $('f-q'), reset: $('f-reset'), order: $('f-order'), hint: $('f-hint'), status: $('reg-status'), list: $('reg-results'), more: $('reg-more'),
    browse: $('browse'), view: $('reg-row'), title: $('reg-title'), intro: $('reg-intro'), viewBody: $('reg-row-body'),
    back: $('reg-back'), chips: $('f-chips'), count: $('f-count'), filters: $('f-more'), opening: $('reg-opening')
  };
  function attr(n, k, v) { if (n && n.setAttribute) { n.setAttribute(k, String(v)); } }
  /* facet: [select id, vocabulary name, column in an index row, is a list] */
  var FACETS = [
    ['f-tier', 'tier', 2, false], ['f-kind', 'kind', 3, false], ['f-topic', 'topics', 4, true],
    ['f-access', 'access_status', 9, false], ['f-licence', 'licence_verdict', 10, false],
    ['f-language', 'language', 8, false], ['f-place', 'places', 7, true]
  ];

  var regionNames = null;
  var langNames = null;
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    langNames = new Intl.DisplayNames(['en'], { type: 'language' });
  } catch (e) { regionNames = null; langNames = null; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }
  function fmt(n) { return Number(n).toLocaleString('en-GB'); }
  function norm(s) {
    s = String(s || '').toLowerCase();
    /* accents folded on the query and the indexed text alike: Vallee finds the accented name */
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* older browsers */ }
    return s;
  }
  function placeName(p) {
    if (p === 'global') { return 'Global'; }
    if (/^[A-Z]{2}$/.test(p) && regionNames) {
      try { var n = regionNames.of(p); if (n && n !== p) { return n + ' (' + p + ')'; } } catch (e) { /* unknown */ }
    }
    return p;
  }
  function langName(l) {
    if (l && langNames) {
      try { var n = langNames.of(l); if (n && n !== l) { return n + ' (' + l + ')'; } } catch (e) { /* unknown */ }
    }
    return l;
  }
  /* the source groups in words, the letter kept (it is the row's tier field) */
  var GROUPS = { B: 'Core sources of accounts (B)', C: 'The long tail (C)', A: 'Context datasets (A)' };
  function label(facet, v) {
    if (facet === 'places') { return placeName(v); }
    if (facet === 'language') { return langName(v); }
    if (facet === 'tier') { return GROUPS[v] || 'Tier ' + v; }
    if (facet === 'topics') { return String(v); }   /* a topic is shown exactly as written in the vocabulary */
    return String(v).replace(/_/g, ' ');
  }
  var FACET_NAMES = { tier: 'Source group', kind: 'Kind', topics: 'Topic code', access_status: 'Access',
    licence_verdict: 'Licence verdict', language: 'Language', places: 'Place' };
  /* a date as the rest of the site writes it: 27 October 2026 */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dayText(iso) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso);
    return m && +m[2] >= 1 && +m[2] <= 12 ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : iso;
  }
  function V(facet, i) { return (i === null || i === undefined || i < 0) ? null : meta.vocab[facet][i]; }
  /* Era labels: a year before year 1 is written N BC/BCE; a span crossing year 1 adds AD/CE to its later end. */
  function yearText(y) { return y < 0 ? (-y) + ' BC/BCE' : String(y); }
  function years(r) {
    var a = r[5], b = r[6];
    if (a === null && b === null) { return ''; }
    if (a !== null && b !== null) {
      return a === b ? yearText(a) : yearText(a) + ' to ' + (a < 0 && b > 0 ? b + ' AD/CE' : yearText(b));
    }
    if (a === null && b === 'present') { return 'start not stated, to present'; }
    return a !== null ? 'from ' + yearText(a) : 'to ' + yearText(b);
  }
  /* an address from a row is linked only when it parses as http or https, names no user or password, and holds no
     control character, space or backslash; it is linked exactly as the row gives it */
  function safeUrl(u) {
    if (typeof u !== 'string' || !/^https?:\/\/[^\s\\\u0000-\u001f\u007f]+$/i.test(u)) { return null; }
    if (typeof URL !== 'function') { return /^https?:\/\/[^\/?#@]+(?:[\/?#]|$)/i.test(u) ? u : null; }   /* no parser: no user part */
    try {
      var p = new URL(u);
      if ((p.protocol !== 'http:' && p.protocol !== 'https:') || p.username || p.password || !p.hostname) { return null; }
    } catch (e) { return null; }
    return u;
  }

  function fillSelects() {
    FACETS.forEach(function (f) {
      var sel = $(f[0]);
      if (!sel) { return; }
      var vocab = meta.vocab[f[1]] || [];
      var counts = meta.counts[f[1]] || {};
      var opts = vocab.map(function (v, i) { return { i: i, text: label(f[1], v), n: counts[v] || 0 }; });
      if (['tier', 'access_status', 'licence_verdict', 'kind'].indexOf(f[1]) < 0) {
        opts.sort(function (a, b) { return a.text.localeCompare(b.text, 'en'); });
      }
      opts.forEach(function (o) {
        var opt = el('option', null, o.text + ' (' + fmt(o.n) + ')');
        opt.value = String(o.i);
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () { shown = PAGE; run(); });
    });
  }

  function haystack(r) {
    var parts = [r[0], r[1], V('kind', r[3]), langName(V('language', r[8]))];
    r[4].forEach(function (t) { var v = String(V('topics', t)); parts.push(v, v.replace(/_/g, ' ')); });
    r[7].forEach(function (p) { var v = V('places', p); parts.push(v, placeName(v)); });
    return norm(parts.join(' '));
  }

  /* the source group order of the Order by control: tier B, then C, then A; by title within a group */
  var TIER_RANK = { B: 0, C: 1, A: 2 };
  function tierRank(r) { var t = V('tier', r[2]); return TIER_RANK[t] === undefined ? 3 : TIER_RANK[t]; }
  function byTitle(i, j) { return tkey[i] < tkey[j] ? -1 : (tkey[i] > tkey[j] ? 1 : (rows[i][0] < rows[j][0] ? -1 : 1)); }
  function byDefault(i, j) { return i - j; }   /* the index order is the default order */
  function isPin(i) { return meta && i < (meta.pins || 0); }
  function checked(i) { return typeof rows[i][12] === 'string' ? rows[i][12] : ''; }
  /* with a search: a row whose title holds the words ranks above one that holds them only in its topics or places */
  function score(i, words, phrase) {
    var s = 0, t = tkey[i];
    if (rows[i][0] === phrase) { return 1000; }
    for (var w = 0; w < words.length; w++) { if (t.indexOf(words[w]) >= 0) { s += 2; } }
    if (phrase && t.indexOf(phrase) >= 0) { s += 1; }
    return s;
  }
  function sortMatches(c) {
    var how = els.order ? els.order.value || 'relevance' : 'relevance';
    if (how === 'title') { matches.sort(byTitle); return; }
    if (how === 'tier') { matches.sort(function (i, j) { return (rank[i] - rank[j]) || byTitle(i, j); }); return; }
    if (how === 'checked') {
      matches.sort(function (i, j) { var a = checked(i), b = checked(j); return a < b ? 1 : (a > b ? -1 : byDefault(i, j)); });
      return;
    }
    if (how === 'relevance' && c.words.length) {
      var phrase = c.words.join(' '), sc = {};
      matches.forEach(function (i) { sc[i] = score(i, c.words, phrase); });
      matches.sort(function (i, j) { return (sc[j] - sc[i]) || byDefault(i, j); });
      return;
    }
    matches.sort(byDefault);
  }

  /* the search, the filters and the order live in the address (#q=...&tier=B&order=title), so a filtered list can be
     shared; facet values are written as words, never as positions in the vocabulary */
  var ORDERS = ['relevance', 'title', 'tier', 'checked'];
  function stateText(c) {
    var parts = [];
    if (els.q.value.trim()) { parts.push('q=' + encodeURIComponent(els.q.value.trim())); }
    FACETS.forEach(function (x) {
      var want = c.facets[x[0]];
      if (want !== undefined) { parts.push(x[0].slice(2) + '=' + encodeURIComponent(V(x[1], want))); }
    });
    if (els.order && els.order.value && els.order.value !== 'relevance') { parts.push('order=' + els.order.value); }
    return parts.join('&');
  }
  function writeState(c) {
    if (!window.history || !window.history.replaceState) { return; }
    if (/^#row-/.test(window.location.hash)) { return; }
    var t = stateText(c);
    back.hash = t;
    var now = window.location.hash.replace(/^#/, '');
    if (t === now || (!t && (now === '' || now === 'browse'))) { return; }
    try { window.history.replaceState(null, '', t ? '#' + t : window.location.pathname + window.location.search); } catch (e) { /* file pages */ }
  }
  function readState(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (h.indexOf('=') < 0) { return false; }
    var got = {};
    h.split('&').forEach(function (kv) {
      var k = kv.indexOf('=');
      if (k < 1) { return; }
      try { got[kv.slice(0, k)] = decodeURIComponent(kv.slice(k + 1).replace(/\+/g, ' ')); } catch (e) { /* a bad escape */ }
    });
    els.q.value = typeof got.q === 'string' ? got.q.slice(0, 200) : '';
    FACETS.forEach(function (x) {
      var sel = $(x[0]);
      if (!sel) { return; }
      var v = got[x[0].slice(2)];
      var i = typeof v === 'string' ? (meta.vocab[x[1]] || []).indexOf(v) : -1;
      sel.value = i >= 0 ? String(i) : '';
    });
    if (els.order) { els.order.value = ORDERS.indexOf(got.order) >= 0 ? got.order : 'relevance'; }
    /* a filter in use behind the More filters fold opens the fold, so the reader sees what narrows the list */
    if (els.filters && FACETS.some(function (x) { return x[1] !== 'tier' && $(x[0]) && $(x[0]).value !== ''; })) { els.filters.open = true; }
    return true;
  }

  function current() {
    var f = {};
    FACETS.forEach(function (x) { var s = $(x[0]); if (s && s.value !== '') { f[x[0]] = Number(s.value); } });
    return { facets: f, words: norm(els.q.value).split(/\s+/).filter(Boolean) };
  }

  /* a search that only adds to the last one (more letters, more words, the same filters, the whole index read) can only
     narrow it, so only the last matches are read again */
  function narrows(c) {
    if (!last || loading || last.n !== rows.length || last.f !== JSON.stringify(c.facets)) { return false; }
    return last.words.every(function (w) { return c.words.some(function (x) { return x.indexOf(w) >= 0; }); });
  }
  function run() {
    if (!meta) { return; }
    var c = current();
    var pool = narrows(c) ? matches.slice() : null;
    var n = pool ? pool.length : rows.length;
    matches = [];
    for (var p = 0; p < n; p++) {
      var i = pool ? pool[p] : p;
      var r = rows[i], ok = true;
      for (var k = 0; k < FACETS.length && ok; k++) {
        var x = FACETS[k], want = c.facets[x[0]];
        if (want === undefined) { continue; }
        ok = x[3] ? r[x[2]].indexOf(want) >= 0 : r[x[2]] === want;
      }
      for (var w = 0; w < c.words.length && ok; w++) { ok = hay[i].indexOf(c.words[w]) >= 0; }
      if (ok) { matches.push(i); }
    }
    last = { words: c.words, f: JSON.stringify(c.facets), n: rows.length };
    sortMatches(c);
    writeState(c);
    render();
  }

  function verdictNode(verdict, lab) {
    var n = el('span', 'verdict', 'Licence ' + verdict + (lab ? ': ' + lab : ''));
    attr(n, 'data-v', verdict);
    return n;
  }
  function topicChips(parent, codes) {
    codes.forEach(function (t, k) {
      if (k) { parent.appendChild(document.createTextNode(' ')); }
      var c = el('span', 'topic', t);
      attr(c, 'title', 'topic code');
      parent.appendChild(c);
    });
  }
  function card(r, i) {
    var li = el('li', 'deed');
    var head = el('div', 'deed-head');
    head.appendChild(el('span', 'rid', r[0]));
    var t = V('tier', r[2]);
    head.appendChild(el('span', null, (isPin(i) ? 'Cornerstone \u00b7 ' : '') + (GROUPS[t] || 'Tier ' + t) + ' \u00b7 ' + (V('kind', r[3]) || '')));
    li.appendChild(head);
    var h = el('h3', 'deed-title');
    var a = el('a', null, r[1]);
    a.href = '#row-' + r[0];
    h.appendChild(a);
    li.appendChild(h);
    var line = [];
    var y = years(r);
    if (y) { line.push(y); }
    if (r[7].length) { line.push(r[7].map(function (p) { return placeName(V('places', p)); }).join(', ')); }
    if (r[8] >= 0) { line.push(langName(V('language', r[8]))); }
    if (line.length) { li.appendChild(el('p', 'deed-line', line.join(' \u00b7 '))); }
    if (r[4].length) {
      var tp = el('p', 'deed-topics');
      tp.appendChild(el('span', 'tc-label', r[4].length === 1 ? 'topic code' : 'topic codes'));
      topicChips(tp, r[4].map(function (x) { return String(V('topics', x)); }));
      li.appendChild(tp);
    }
    var terms = el('p', 'deed-terms');
    var verdict = V('licence_verdict', r[10]) || 'unknown';
    /* a licence name is shown beside an open verdict only: beside unknown or restricted it would read as a contradiction */
    var lab = verdict === 'open' ? V('licence_label', r[11]) : null;
    terms.appendChild(verdictNode(verdict, lab));
    terms.appendChild(el('span', null, 'Access ' + (V('access_status', r[9]) || 'unknown')));
    li.appendChild(terms);
    return li;
  }

  /* the filters in use, each a button that takes it off; their count on the More filters fold */
  function drawChips(c) {
    if (!els.chips) { return; }
    while (els.chips.firstChild) { els.chips.removeChild(els.chips.firstChild); }
    var n = 0, folded = 0;
    FACETS.forEach(function (x) {
      var want = c.facets[x[0]];
      if (want === undefined) { return; }
      n += 1;
      if (x[1] !== 'tier') { folded += 1; }
      var text = FACET_NAMES[x[1]] + ': ' + label(x[1], V(x[1], want));
      var b = el('button', 'chip', text);
      b.type = 'button';
      attr(b, 'aria-label', 'Remove the filter ' + text);
      b.addEventListener('click', function () {
        var s = $(x[0]);
        if (s) { s.value = ''; }
        shown = PAGE;
        run();
        if (els.q && els.q.focus) { els.q.focus(); }
      });
      els.chips.appendChild(b);
    });
    els.chips.hidden = n === 0;
    if (els.count) { els.count.textContent = folded ? ' (' + folded + ' in use)' : ''; }
  }

  function render() {
    var list = els.list;
    while (list.firstChild) { list.removeChild(list.firstChild); }
    var n = Math.min(shown, matches.length, MOST);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) { frag.appendChild(card(rows[matches[i]], matches[i])); }
    list.appendChild(frag);
    els.more.hidden = n >= Math.min(matches.length, MOST);
    var msg;
    if (failed) {
      msg = gone ? GONE : 'The registry could not be loaded here. Every row is in the Downloads, as JSON and CSV.';
    } else if (matches.length === 0) {
      msg = loading ? 'Loading the registry: ' + fmt(rows.length) + ' of ' + fmt(meta.row_count) + ' rows so far, none matching yet.'
        : 'No row matches. Try fewer words or clear a filter.';
    } else {
      var c = current();
      var all = c.words.length === 0 && Object.keys(c.facets).length === 0;
      if (els.opening) { els.opening.hidden = !(all && (!els.order || els.order.value === 'relevance' || !els.order.value)); }
      msg = 'Showing ' + fmt(n) + ' of ' + fmt(matches.length) + (all ? ' rows' : (matches.length === 1 ? ' matching row' : ' matching rows')) +
        (loading ? ' (still loading: ' + fmt(rows.length) + ' of ' + fmt(meta.row_count) + ' read)' : (all ? '' : ', of ' + fmt(meta.row_count) + ' in all')) + '.' +
        (n === MOST && matches.length > MOST ? ' The list stops at ' + fmt(MOST) + ' rows: search or filter to reach the rest.' : '');
    }
    els.status.textContent = msg;
    if (meta) { drawChips(current()); }
  }

  /* only files under this site's data directory, sent without credentials, never followed through a redirect; a missing
     snapshot file means a newer snapshot replaced this one while the page was open */
  var GONE = 'This page holds an older snapshot of the registry, now replaced. Reload the page to read the current one.';
  var gone = false;
  function getJSON(path) {
    if (!/^(?:[a-z0-9]+\/)*[a-z0-9-]+\.json$/.test(path)) { return Promise.reject(new Error('bad path')); }
    return fetch(DATA + path, { credentials: 'omit', redirect: 'error' }).then(function (res) {
      if (res.status === 404 && path !== 'meta.json') { gone = true; }
      if (!res.ok) { throw new Error('status ' + res.status); }
      return res.json();
    });
  }

  /* the first index file (small, and holding the first rows of the default order) is read alone, so the list is drawn
     soonest; then the rest a few at a time, taken in their order, the list drawn again at most every few tenths of a second
     and once all are read */
  function loadShards() {
    var files = meta.shards, got = new Array(files.length), next = 0, taken = 0, drawn = 0, busy = 0;
    function take() {
      var before = taken;
      while (taken < files.length && got[taken]) {
        var part = got[taken];
        got[taken] = true;
        for (var i = 0; i < part.length; i++) {
          rows.push(part[i]); hay.push(haystack(part[i])); tkey.push(norm(part[i][1])); rank.push(tierRank(part[i]));
        }
        taken += 1;
      }
      if (taken === before && files.length) { return; }
      if (taken >= files.length) {
        loading = false; run();
        if (/^#row-[0-9a-f]{16}$/.test(window.location.hash)) { route(); }
        return;
      }
      var now = Date.now();
      if (!drawn || now - drawn > 400) { drawn = now; run(); }
    }
    function more() { while (!failed && busy < FETCHES && next < files.length) { one(); } }
    function one() {
      var k = next++;
      busy += 1;
      getJSON(files[k].file).then(function (part) {
        busy -= 1;
        if (failed) { return; }
        if (!Array.isArray(part)) { throw new Error('bad index file'); }
        got[k] = part; take(); more();
      }).catch(function () { failed = true; loading = false; render(); });
    }
    if (!files.length) { take(); return; }
    one();
  }

  function field(dl, labelText, node) {
    var wrap = el('div', 'deed-field');
    var dd = el('dd');
    dd.appendChild(node);
    wrap.appendChild(el('dt', null, labelText));
    wrap.appendChild(dd);
    dl.appendChild(wrap);
  }

  /* the reason codes of an ungettable source, in words */
  var REASONS = { not_collected: 'not collected, by policy', licence_refused: 'licence refused (its terms refuse reuse)',
    offline: 'offline (the source is gone)', paywall: 'behind a paywall' };

  function valueNode(key, v, row) {
    if (key === 'licence_label' && v && row && row.licence_verdict !== 'open') {
      return el('span', null, 'the source names ' + v + ' for part of its content');
    }
    if (key === 'access_reason' && typeof v === 'string' && REASONS[v]) { return el('span', null, REASONS[v]); }
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
      return el('span', 'empty', 'not stated');
    }
    if (key === 'url' || key === 'licence_evidence_url') {
      var u = safeUrl(v);
      if (u) { var a = el('a', null, u); a.href = u; a.rel = 'noopener noreferrer'; return a; }
    }
    if (key === 'id') { return el('span', 'rid', v); }
    if (key === 'licence_verdict') { var vn = el('span', 'verdict', v); attr(vn, 'data-v', v); return vn; }
    if (key === 'tier') { return el('span', null, GROUPS[v] || v); }
    if (key === 'places') { return el('span', null, v.map(placeName).join(', ')); }
    if (key === 'language') { return el('span', null, langName(v)); }
    if (key === 'time_end' && typeof v === 'number' && v > 0 && row && typeof row.time_start === 'number' && row.time_start < 0) {
      return el('span', null, v + ' AD/CE');      /* a span crossing year 1: the later end carries AD/CE, as in the list line */
    }
    if ((key === 'time_start' || key === 'time_end') && typeof v === 'number') { return el('span', null, yearText(v)); }
    if (key === 'verified_on' && typeof v === 'string') { return el('span', null, dayText(v)); }
    if (key === 'topics') { var sp = el('span'); topicChips(sp, v.map(String)); return sp; }
    if (Array.isArray(v)) { return el('span', null, v.join(', ')); }
    return el('span', null, v);
  }

  /* what a reader checks first: the source's address, where and when it reaches, how to get at it, on what terms, and
     when the row was last read against it; then every other field, then the field names */
  var LEAD = ['url', 'places', 'years', 'access_status', 'licence', 'verified_on'];
  function drawRow(id, r, failed) {
    var body = els.viewBody;
    while (body.firstChild) { body.removeChild(body.firstChild); }
    if (els.title) { els.title.className = 'row-title'; }
    if (!r && failed) {   // the file could not be read: say so, never that the row does not exist
      if (els.title) { els.title.textContent = 'Row ' + id; }
      body.appendChild(el('p', null, gone ? GONE : 'This row could not be loaded just now. Reload the page to try again.'));
      return;
    }
    if (!r) {
      if (els.title) { els.title.textContent = 'No such row'; }
      body.appendChild(el('p', null, 'No row has the identifier ' + id + ' in this snapshot.'));
      return;
    }
    if (els.title) { els.title.textContent = r.title; }
    var labels = {};
    meta.fields.forEach(function (f) { labels[f[0]] = f[1]; });
    var lead = el('div', 'row-lead');
    var ldl = el('dl');
    LEAD.forEach(function (k) {
      if (k === 'years') {
        field(ldl, 'Years', el('span', r.time_start === null && r.time_end === null ? 'empty' : null,
          years([0, 0, 0, 0, 0, r.time_start === undefined ? null : r.time_start, r.time_end === undefined ? null : r.time_end]) || 'not stated'));
      } else if (k === 'licence') {
        var box = el('span');
        box.appendChild(valueNode('licence_verdict', r.licence_verdict, r));
        if (r.licence_verdict === 'open' && r.licence_label) { box.appendChild(document.createTextNode(': ' + r.licence_label)); }
        /* the verdict is a dated reading of the source's own terms, never a grant: said beside it, with the terms linked */
        var ln = el('span', 'lic-note', 'A dated reading of the terms the source states, made on the checked date; it grants nothing. ');
        var la = el('a', null, 'Terms of use');
        la.href = 'terms.html#licence-readings';
        ln.appendChild(la);
        box.appendChild(ln);
        field(ldl, labels.licence_verdict || 'Licence verdict', box);
      } else {
        field(ldl, labels[k] || k, valueNode(k, r[k], r));
      }
    });
    lead.appendChild(ldl);
    body.appendChild(lead);
    var art = el('article', 'deed deed-full');
    attr(art, 'aria-label', 'Every field of the row');
    var dl = el('dl');
    var skip = { title: 1, url: 1, places: 1, time_start: 1, time_end: 1, access_status: 1, licence_verdict: 1, verified_on: 1 };
    if (r.licence_verdict === 'open') { skip.licence_label = 1; }
    meta.fields.forEach(function (f) {
      if (skip[f[0]]) { return; }
      if (f[0] === 'access_reason' && r.access_status !== 'ungettable') { return; }   /* a reason is given for ungettable only */
      field(dl, f[1], valueNode(f[0], r[f[0]], r));
    });
    art.appendChild(dl);
    body.appendChild(art);
    var names = el('details', 'fieldnames');
    names.appendChild(el('summary', null, 'Field names in the downloads'));
    var nl = el('dl');
    meta.fields.forEach(function (f) { field(nl, f[1], el('span', 'key', f[0])); });
    names.appendChild(nl);
    body.appendChild(names);
    var p = el('p', 'note');
    var a = el('a', null, 'What each field means');
    a.href = 'read-a-row.html#fields';
    p.appendChild(a);
    body.appendChild(p);
    document.title = r.title + ' \u00b7 The Magonia Cadastre';
  }

  var routeGen = 0;   /* each change of address counts one; a row file that arrives after the address moved on is not drawn */
  function showRow(id) {
    var gen = routeGen;
    els.browse.hidden = true;
    if (els.intro) { els.intro.hidden = true; }
    els.view.hidden = false;
    if (els.back) { els.back.href = back.hash ? '#' + back.hash : '#browse'; }
    if (els.title) { els.title.textContent = 'Row ' + id; }
    while (els.viewBody.firstChild) { els.viewBody.removeChild(els.viewBody.firstChild); }   /* the old row goes at once */
    var b = id.slice(0, meta.bucket_prefix);
    var indexed = rows.some(function (r) { return r[0] === id; });
    /* a row the index lists but its bucket lacks is a failed load, never an absence */
    /* while the index is still loading (or failed to), a row missing from its bucket is not yet known absent: it reads as
       not loaded, and the view is drawn again once the whole index is read */
    var unsure = !indexed && (loading || failed);
    function focusTitle() { if (els.title && els.title.focus) { els.title.focus(); } }
    var done = function (obj) {
      if (gen !== routeGen) { return; }
      var r = obj ? obj[id] : null; drawRow(id, r, !r && (indexed || unsure)); focusTitle();
    };
    if (buckets[b]) { done(buckets[b]); return; }
    if (meta.buckets.indexOf(b) < 0) { done(null); return; }
    getJSON(meta.rows_dir + b + '.json').then(function (obj) {
      /* a bucket is an object of rows keyed by their own id; anything else is a failed load, never an absence */
      var ok = obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every(function (k) {
        return obj[k] && typeof obj[k] === 'object' && obj[k].id === k;
      });
      if (!ok) { throw new Error('bad bucket'); }
      buckets[b] = obj; done(obj);
    })
      .catch(function () { if (gen !== routeGen) { return; } drawRow(id, null, true); focusTitle(); });
  }

  /* back on the list: the rows shown before, the scroll position, and the row's own link focused */
  function restore() {
    var id = back.id;
    back.id = null;
    if (!id) { return; }
    if (window.scrollTo) { try { window.scrollTo(0, back.y); } catch (e) { /* not a browser */ } }
    var items = els.list.children || [];
    for (var k = 0; k < items.length; k++) {
      var a = items[k].querySelector ? items[k].querySelector('a') : null;
      if (a && a.getAttribute && a.getAttribute('href') === '#row-' + id) {
        try { a.focus({ preventScroll: true }); } catch (e) { a.focus(); }
        break;
      }
    }
  }

  var baseTitle = document.title;
  var inRow = false;
  function route() {
    routeGen += 1;
    if (!meta) { return; }
    var m = /^#row-([0-9a-f]{16})$/.exec(window.location.hash);
    if (m) { inRow = true; showRow(m[1]); return; }
    var returning = inRow;
    inRow = false;
    els.view.hidden = true;
    els.browse.hidden = false;
    if (els.intro) { els.intro.hidden = false; }
    if (els.title) { els.title.textContent = 'The registry'; els.title.className = ''; }
    document.title = baseTitle;
    if (readState(window.location.hash)) { shown = returning ? back.shown : PAGE; run(); if (returning) { restore(); } return; }
    if (returning) { if (window.location.hash === '#browse') { shown = back.shown; render(); } restore(); return; }
    if (window.location.hash === '#browse') { els.q.focus(); }
  }

  els.q.addEventListener('input', function () {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () { shown = PAGE; run(); }, 120);
  });
  els.more.addEventListener('click', function () {
    var first = Math.min(shown, matches.length);
    shown += PAGE;
    render();
    var next = els.list.children[first];
    if (next) { var a = next.querySelector('a'); if (a) { a.focus(); } }
  });
  if (els.order) { els.order.addEventListener('change', function () { shown = PAGE; run(); }); }
  if (els.hint) {
    els.hint.addEventListener('click', function (e) {
      var sel = $('f-tier'), b = meta ? meta.vocab.tier.indexOf('B') : -1;
      if (!sel || b < 0) { return; }
      if (e && e.preventDefault) { e.preventDefault(); }
      sel.value = String(b);
      shown = PAGE;
      run();
    });
  }
  els.reset.addEventListener('click', function () {
    els.q.value = '';
    if (els.order) { els.order.value = 'relevance'; }
    FACETS.forEach(function (x) { var s = $(x[0]); if (s) { s.value = ''; } });
    shown = PAGE;
    run();
    els.q.focus();
  });
  window.addEventListener('hashchange', route);
  /* opening a row from the list remembers where the reader was */
  els.list.addEventListener('click', function (e) {
    var t = e && e.target;
    while (t && t !== els.list && !(t.tagName === 'A' && t.getAttribute && /^#row-/.test(t.getAttribute('href') || ''))) { t = t.parentNode; }
    if (!t || t === els.list) { return; }
    back.id = (t.getAttribute('href') || '').slice(5);
    back.y = window.pageYOffset || 0;
    back.shown = shown;
  });

  getJSON('meta.json').then(function (m) {
    meta = m;
    fillSelects();
    if (els.hint && meta.vocab.tier.indexOf('B') >= 0) { els.hint.hidden = false; }
    route();
    loadShards();
  }).catch(function () { failed = true; loading = false; els.status.textContent = 'The registry could not be loaded here. Every row is in the Downloads, as JSON and CSV.'; });
}());
