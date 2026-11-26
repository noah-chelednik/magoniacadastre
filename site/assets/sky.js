/* The sky over a place at a moment, computed in the reader's browser. Methods after Jean Meeus, Astronomical Algorithms (1998); Delta T after Espenak and Meeus (2006). */

(function (root) {
  "use strict";

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var AU_KM = 149597870.7;

  function n360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function n180(x) { x = n360(x); return x > 180 ? x - 360 : x; }
  function sin(x) { return Math.sin(x * D2R); }
  function cos(x) { return Math.cos(x * D2R); }
  function asin(x) { return Math.asin(Math.max(-1, Math.min(1, x))) * R2D; }
  function atan2(y, x) { return Math.atan2(y, x) * R2D; }
  function poly(t, c) { var s = 0; for (var i = c.length - 1; i >= 0; i--) s = s * t + c[i]; return s; }
  function round(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }


  function toMs(date) {
    if (date instanceof Date) return date.getTime();
    if (typeof date === "number") return date;
    var ms = Date.parse(date);
    if (isNaN(ms)) throw new Error("unreadable time: " + date);
    return ms;
  }
  function jdUT(ms) { return ms / 86400000 + 2440587.5; }


  function deltaT(y) {
    var t;
    if (y < 1860) { t = (y - 1820) / 100; return -20 + 32 * t * t; }
    if (y < 1900) { t = y - 1860; return poly(t, [7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174]); }
    if (y < 1920) { t = y - 1900; return poly(t, [-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197]); }
    if (y < 1941) { t = y - 1920; return poly(t, [21.20, 0.84493, -0.076100, 0.0020936]); }
    if (y < 1961) { t = y - 1950; return poly(t, [29.07, 0.407, -1 / 233, 1 / 2547]); }
    if (y < 1986) { t = y - 1975; return poly(t, [45.45, 1.067, -1 / 260, -1 / 718]); }
    if (y < 2005) { t = y - 2000; return poly(t, [63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599]); }
    if (y < 2050) { t = y - 2000; return poly(t, [62.92, 0.32217, 0.005589]); }
    if (y < 2150) { t = (y - 1820) / 100; return -20 + 32 * t * t - 0.5628 * (2150 - y); }
    t = (y - 1820) / 100; return -20 + 32 * t * t;
  }


  function gmst(jd) {
    var T = (jd - 2451545.0) / 36525;
    return n360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
  }


  function nutation(T) {
    var om = 125.04452 - 1934.136261 * T, L = 280.4665 + 36000.7698 * T, Lm = 218.3165 + 481267.8813 * T;
    var dpsi = (-17.20 * sin(om) - 1.32 * sin(2 * L) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * om)) / 3600;
    var deps = (9.20 * cos(om) + 0.57 * cos(2 * L) + 0.10 * cos(2 * Lm) - 0.09 * cos(2 * om)) / 3600;
    var eps0 = 23.439291111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
    return { dpsi: dpsi, deps: deps, eps: eps0 + deps };
  }

  function eclToEq(lam, bet, eps) {
    var ra = atan2(sin(lam) * cos(eps) - Math.tan(bet * D2R) * sin(eps), cos(lam));
    var dec = asin(sin(bet) * cos(eps) + cos(bet) * sin(eps) * sin(lam));
    return { ra: n360(ra), dec: dec };
  }


  function sunGeo(T) {
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) +
      0.000289 * sin(3 * M);
    var lon = n360(L0 + C), v = M + C;
    var R = 1.000001018 * (1 - e * e) / (1 + e * cos(v));
    return { lon: lon, R: R, e: e, M: M };
  }



  var ELEMENTS = {
    mercury: { L: [252.250906, 149474.0722491, 0.00030397, 0.000000018], a: [0.387098310],
      e: [0.20563175, 0.000020406, -0.0000000284, -0.00000000017], i: [7.004986, 0.0018215, -0.00001809, 0.000000053],
      node: [48.330893, 1.1861890, 0.00017587, 0.000000211], peri: [77.456119, 1.5564775, 0.00029589, 0.000000056] },
    venus: { L: [181.979801, 58519.2130302, 0.00031060, 0.000000015], a: [0.723329820],
      e: [0.00677188, -0.000047766, 0.0000000975, 0.00000000044], i: [3.394662, 0.0010037, -0.00000088, -0.000000007],
      node: [76.679920, 0.9011190, 0.00040665, -0.000000080], peri: [131.563707, 1.4022188, -0.00107337, -0.000005315] },
    mars: { L: [355.433275, 19141.6964746, 0.00031097, 0.000000015], a: [1.523679342],
      e: [0.09340062, 0.000090483, -0.0000000806, -0.00000000035], i: [1.849726, -0.0006010, 0.00001276, -0.000000006],
      node: [49.558093, 0.7720923, 0.00001605, 0.000002325], peri: [336.060234, 1.8410331, 0.00013515, 0.000000318] },
    jupiter: { L: [34.351484, 3036.3027889, 0.00022374, 0.000000025], a: [5.202603191, 0.0000001913],
      e: [0.04849485, 0.000163244, -0.0000004719, -0.00000000197], i: [1.303270, -0.0054966, 0.00000465, -0.000000004],
      node: [100.464441, 1.0209550, 0.00040117, 0.000000569], peri: [14.331309, 1.6126668, 0.00103127, -0.000004569] },
    saturn: { L: [50.077471, 1223.5110141, 0.00051952, -0.000000003], a: [9.554909596, -0.0000021389],
      e: [0.05550862, -0.000346818, -0.0000006456, 0.00000000338], i: [2.488878, -0.0037363, -0.00001516, 0.000000089],
      node: [113.665524, 0.8770979, -0.00012067, -0.000002380], peri: [93.056787, 1.9637694, 0.00083757, 0.000004899] }
  };
  var PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn"];

  function meanAnomaly(name, T) {
    var el = ELEMENTS[name];
    return n360(poly(T, el.L) - poly(T, el.peri));
  }


  function planetHelio(name, T) {
    var el = ELEMENTS[name];
    var L = poly(T, el.L), a = poly(T, el.a), e = poly(T, el.e), inc = poly(T, el.i);
    var node = poly(T, el.node), peri = poly(T, el.peri);
    var M = n360(L - peri) * D2R, E = M;
    for (var k = 0; k < 30; k++) {
      var dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    var xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    var v = Math.atan2(yv, xv) * R2D, r = Math.sqrt(xv * xv + yv * yv);
    var u = v + peri - node;
    var x = r * (cos(node) * cos(u) - sin(node) * sin(u) * cos(inc));
    var y = r * (sin(node) * cos(u) + cos(node) * sin(u) * cos(inc));
    var z = r * sin(u) * sin(inc);
    var lon = atan2(y, x), lat = asin(z / r);
    if (name === "jupiter" || name === "saturn") {
      var Mj = meanAnomaly("jupiter", T), Ms = meanAnomaly("saturn", T);
      if (name === "jupiter") {
        lon += -0.332 * sin(2 * Mj - 5 * Ms - 67.6) - 0.056 * sin(2 * Mj - 2 * Ms + 21) +
          0.042 * sin(3 * Mj - 5 * Ms + 21) - 0.036 * sin(Mj - 2 * Ms) + 0.022 * cos(Mj - Ms) +
          0.023 * sin(2 * Mj - 3 * Ms + 52) - 0.016 * sin(Mj - 5 * Ms - 69);
      } else {
        lon += 0.812 * sin(2 * Mj - 5 * Ms - 67.6) - 0.229 * cos(2 * Mj - 4 * Ms - 2) +
          0.119 * sin(Mj - 2 * Ms - 3) + 0.046 * sin(2 * Mj - 6 * Ms - 69) + 0.014 * sin(Mj - 3 * Ms + 32);
        lat += -0.020 * cos(2 * Mj - 4 * Ms - 2) + 0.018 * sin(2 * Mj - 6 * Ms - 49);
      }
    }
    return { lon: n360(lon), lat: lat, r: r };
  }

  function rect(lon, lat, r) { return [r * cos(lat) * cos(lon), r * cos(lat) * sin(lon), r * sin(lat)]; }


  function planetGeo(name, T, nut, sun) {
    var earth = rect(sun.lon + 180, 0, sun.R);
    var tau = 0, p, d, dist;
    for (var k = 0; k < 3; k++) {
      var h = planetHelio(name, T - tau / 36525);
      p = rect(h.lon, h.lat, h.r);
      d = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
      dist = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
      tau = 0.0057755183 * dist;
      var helio = h;
    }
    var lam = atan2(d[1], d[0]), bet = asin(d[2] / dist);
    var kappa = 20.49552 / 3600;
    lam += -kappa * cos(sun.lon - lam) / cos(bet) + nut.dpsi;
    bet += -kappa * sin(bet) * sin(sun.lon - lam);
    return { lon: n360(lam), lat: bet, dist: dist, r: helio.r, hlon: helio.lon, hlat: helio.lat };
  }


  function planetMag(name, r, delta, R, T, geo) {
    var ci = (r * r + delta * delta - R * R) / (2 * r * delta);
    var i = Math.acos(Math.max(-1, Math.min(1, ci))) * R2D, l5 = 5 * Math.log10(r * delta);
    switch (name) {
      case "mercury": return -0.42 + l5 + 0.0380 * i - 0.000273 * i * i + 0.000002 * i * i * i;
      case "venus": return -4.40 + l5 + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
      case "mars": return -1.52 + l5 + 0.016 * i;
      case "jupiter": return -9.40 + l5 + 0.005 * i;
      case "saturn": {

        var inc = 28.075216 - 0.012998 * T + 0.000004 * T * T, om = 169.508470 + 1.394681 * T + 0.000412 * T * T;
        var lam = geo.lon, bet = geo.lat;
        var sB = sin(inc) * cos(bet) * sin(lam - om) - cos(inc) * sin(bet);
        var N = 113.6655 + 0.8771 * T, l2 = geo.hlon - 0.01759 / r, b2 = geo.hlat - 0.000764 * cos(geo.hlon - N) / r;
        var U1 = atan2(sin(inc) * sin(b2) + cos(inc) * cos(b2) * sin(l2 - om), cos(b2) * cos(l2 - om));
        var U2 = atan2(sin(inc) * sin(bet) + cos(inc) * cos(bet) * sin(lam - om), cos(bet) * cos(lam - om));
        var dU = Math.abs(n180(U1 - U2)), sb = Math.abs(sB);
        return -8.88 + l5 + 0.044 * dU - 2.60 * sb + 1.25 * sb * sb;
      }
    }
    return null;
  }



  var MOON_LR = [
    [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
    [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
    [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
    [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
    [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
    [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
    [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
    [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
    [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
    [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
    [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
    [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
    [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
    [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
    [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
    [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
    [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
    [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
    [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
    [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752]
  ];

  var MOON_B = [
    [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
    [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
    [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
    [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
    [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
    [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
    [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
    [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
    [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
    [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366],
    [2, 1, 0, 1, -351], [4, 0, 0, 1, 331], [2, -1, 1, 1, 315], [2, -2, 0, -1, 302],
    [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
    [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
    [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164],
    [4, 0, 1, -1, 132], [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107]
  ];


  function moonGeo(T) {
    var T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var Lp = n360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000);
    var D = n360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
    var M = n360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
    var Mp = n360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);
    var F = n360(93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000);
    var A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var sl = 0, sr = 0, sb = 0, k, t, arg, f;
    for (k = 0; k < MOON_LR.length; k++) {
      t = MOON_LR[k];
      arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      f = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
      sl += t[4] * f * sin(arg);
      sr += t[5] * f * cos(arg);
    }
    for (k = 0; k < MOON_B.length; k++) {
      t = MOON_B[k];
      arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      f = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
      sb += t[4] * f * sin(arg);
    }
    sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) -
      115 * sin(Lp + Mp);
    return { lon: n360(Lp + sl / 1e6), lat: sb / 1e6, dist: 385000.56 + sr / 1000 };
  }



  var STARS = [
    ["Sirius", [6, 45, 8.92], [-1, 16, 42, 58.0], -1.46, [-546.0, -1223.1]],
    ["Canopus", [6, 23, 57.11], [-1, 52, 41, 44.4], -0.74, [0, 0]],
    ["Arcturus", [14, 15, 39.67], [1, 19, 10, 56.7], -0.05, [-1093.4, -1999.4]],
    ["Vega", [18, 36, 56.34], [1, 38, 47, 1.3], 0.03, [0, 0]],
    ["Capella", [5, 16, 41.36], [1, 45, 59, 52.8], 0.08, [0, 0]],
    ["Rigel", [5, 14, 32.27], [-1, 8, 12, 5.9], 0.13, [0, 0]],
    ["Procyon", [7, 39, 18.12], [1, 5, 13, 30.0], 0.34, [-714.6, -1036.8]],
    ["Betelgeuse", [5, 55, 10.31], [1, 7, 24, 25.4], 0.50, [0, 0]],
    ["Altair", [19, 50, 47.00], [1, 8, 52, 6.0], 0.76, [536.2, 385.3]],
    ["Aldebaran", [4, 35, 55.24], [1, 16, 30, 33.5], 0.86, [0, 0]],
    ["Antares", [16, 29, 24.46], [-1, 26, 25, 55.2], 0.96, [0, 0]],
    ["Spica", [13, 25, 11.58], [-1, 11, 9, 40.8], 0.97, [0, 0]],
    ["Pollux", [7, 45, 18.95], [1, 28, 1, 34.3], 1.14, [0, 0]],
    ["Fomalhaut", [22, 57, 39.05], [-1, 29, 37, 20.1], 1.16, [329.0, -164.7]],
    ["Deneb", [20, 41, 25.9], [1, 45, 16, 49.0], 1.25, [0, 0]],
    ["Regulus", [10, 8, 22.31], [1, 11, 58, 2.0], 1.35, [0, 0]]
  ];


  function starApparent(s, T, nut, sun) {
    var ra0 = (s[1][0] + s[1][1] / 60 + s[1][2] / 3600) * 15;
    var de0 = s[2][0] * (s[2][1] + s[2][2] / 60 + s[2][3] / 3600);
    var yrs = T * 100;
    de0 += s[4][1] * yrs / 3.6e6;
    ra0 += s[4][0] * yrs / 3.6e6 / cos(de0);
    var t = T, zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) / 3600;
    var z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) / 3600;
    var th = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) / 3600;
    var A = cos(de0) * sin(ra0 + zeta);
    var B = cos(th) * cos(de0) * cos(ra0 + zeta) - sin(th) * sin(de0);
    var C = sin(th) * cos(de0) * cos(ra0 + zeta) + cos(th) * sin(de0);
    var ra = n360(atan2(A, B) + z), de = asin(C);
    var eps = nut.eps, tand = Math.tan(de * D2R);
    var dra = (cos(eps) + sin(eps) * sin(ra) * tand) * nut.dpsi - cos(ra) * tand * nut.deps;
    var dde = sin(eps) * cos(ra) * nut.dpsi + sin(ra) * nut.deps;
    var k = 20.49552 / 3600, L = sun.lon;
    dra += -k * (cos(ra) * cos(L) * cos(eps) + sin(ra) * sin(L)) / cos(de);
    dde += -k * (cos(L) * cos(eps) * (Math.tan(eps * D2R) * cos(de) - sin(ra) * sin(de)) + cos(ra) * sin(de) * sin(L));
    return { ra: n360(ra + dra), dec: de + dde };
  }



  function horizon(ra, dec, distAU, gast, lat, lon, h) {
    var H = n360(gast + lon - ra), d = dec;
    if (distAU) {
      var u = Math.atan(0.99664719 * Math.tan(lat * D2R)) * R2D;
      var rs = 0.99664719 * sin(u) + h / 6378140 * sin(lat), rc = cos(u) + h / 6378140 * cos(lat);
      var sp = sin(8.794 / 3600) / distAU;
      var dA = atan2(-rc * sp * sin(H), cos(dec) - rc * sp * cos(H));
      d = atan2((sin(dec) - rs * sp) * cos(dA), cos(dec) - rc * sp * cos(H));
      H = H - dA;
    }
    var alt = asin(sin(lat) * sin(d) + cos(lat) * cos(d) * cos(H));
    var az = n360(atan2(-cos(d) * sin(H), sin(d) * cos(lat) - cos(d) * sin(lat) * cos(H)));
    return { alt: alt, az: az };
  }


  function refraction(alt) {
    if (alt < -1.9) return 0;
    var r = 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * D2R) / 60;
    return Math.max(0, r);
  }


  function context(ms) {
    var jd = jdUT(ms), year = 2000 + (jd - 2451544.5) / 365.25;
    var dt = deltaT(year), jde = jd + dt / 86400, T = (jde - 2451545.0) / 36525;
    var nut = nutation(T);
    var gast = n360(gmst(jd) + nut.dpsi * cos(nut.eps));
    return { jd: jd, jde: jde, T: T, dt: dt, nut: nut, gast: gast };
  }

  function sunPosition(c, lat, lon, h) {
    var s = sunGeo(c.T);
    var om = 125.04 - 1934.136 * c.T;
    var lam = s.lon - 0.00569 - 0.00478 * sin(om);
    var eq = eclToEq(lam, 0, c.nut.eps + 0.00256 * cos(om));
    var hz = horizon(eq.ra, eq.dec, s.R, c.gast, lat, lon, h);
    return { sun: s, lam: lam, eq: eq, hz: hz };
  }

  function sunAltitude(ms, lat, lon, h) {
    return sunPosition(context(ms), lat, lon, h || 0).hz.alt;
  }


  var QUARTERS = [[0, "new moon"], [90, "first quarter"], [180, "full moon"], [270, "last quarter"]];
  var PHASE_NEAR_DEG = 6;
  function phaseName(elong) {
    for (var i = 0; i < QUARTERS.length; i++) {
      var d = Math.abs(n360(elong - QUARTERS[i][0] + 180) - 180);
      if (d <= PHASE_NEAR_DEG) { return QUARTERS[i][1]; }
    }
    return null;
  }
  function phaseText(elong, illum) {
    var pct = Math.round(illum * 100), name = phaseName(elong);
    return name ? name + ', ' + pct + ' percent lit' : pct + ' percent lit, ' + (elong < 180 ? 'waxing' : 'waning');
  }

  function sky(date, lat, lon, heightM) {
    var ms = toMs(date), h = heightM || 0;
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 360)) throw new Error("bad place");
    var c = context(ms), out = { time: new Date(ms).toISOString(), jd_ut: c.jd, delta_t_s: round(c.dt, 1),
      lat: lat, lon: lon, refraction_note: "alt is geometric; alt_apparent adds standard refraction" };
    function pack(hz, extra) {
      var o = { alt: round(hz.alt, 3), alt_apparent: round(hz.alt + refraction(hz.alt), 3), az: round(hz.az, 3) };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
      return o;
    }
    var sp = sunPosition(c, lat, lon, h), sun = sp.sun;
    out.sun = pack(sp.hz, { mag: -26.74, dist_au: round(sun.R, 6) });

    var m = moonGeo(c.T), mlam = n360(m.lon + c.nut.dpsi);
    var meq = eclToEq(mlam, m.lat, c.nut.eps);
    var mhz = horizon(meq.ra, meq.dec, m.dist / AU_KM, c.gast, lat, lon, h);
    var psi = Math.acos(cos(m.lat) * cos(mlam - sp.lam)) * R2D;
    var Rkm = sun.R * AU_KM;
    var iang = atan2(Rkm * sin(psi), m.dist - Rkm * cos(psi));
    var illum = (1 + cos(iang)) / 2, elong = n360(mlam - sp.lam);
    var ai = Math.abs(iang);
    out.moon = pack(mhz, { illumination: round(illum, 4), phase_deg: round(elong, 2), phase_angle: round(iang, 2),
      phase_name: phaseName(elong), waxing: elong < 180, phase_text: phaseText(elong, illum),
      mag: round(-12.73 + 0.026 * ai + 4e-9 * Math.pow(ai, 4), 2), dist_km: Math.round(m.dist) });

    out.planets = {};
    for (var k = 0; k < PLANETS.length; k++) {
      var name = PLANETS[k], g = planetGeo(name, c.T, c.nut, sun);
      var peq = eclToEq(g.lon, g.lat, c.nut.eps);
      var phz = horizon(peq.ra, peq.dec, g.dist, c.gast, lat, lon, h);
      out.planets[name] = pack(phz, { mag: round(planetMag(name, g.r, g.dist, sun.R, c.T, g), 2),
        dist_au: round(g.dist, 6) });
    }

    out.stars = [];
    for (k = 0; k < STARS.length; k++) {
      var st = starApparent(STARS[k], c.T, c.nut, sun);
      out.stars.push(pack(horizon(st.ra, st.dec, null, c.gast, lat, lon, h), { name: STARS[k][0], mag: STARS[k][3] }));
    }
    out.twilight = twilight(ms, lat, lon, h, out.sun.alt);
    return out;
  }


  var LEVELS = [["sunrise_sunset", -0.833], ["civil", -6], ["nautical", -12], ["astronomical", -18]];

  function state(alt) {
    if (alt >= -0.833) return "day";
    if (alt >= -6) return "civil twilight";
    if (alt >= -12) return "nautical twilight";
    if (alt >= -18) return "astronomical twilight";
    return "night";
  }


  function twilight(ms, lat, lon, h, altNow) {
    var offset = lon / 15 * 3600000, local = ms + offset;
    var day0 = Math.floor(local / 86400000) * 86400000 - offset, step = 600000, n = 144;
    var alts = [];
    for (var i = 0; i <= n; i++) alts.push(sunAltitude(day0 + i * step, lat, lon, h));
    var events = {};
    LEVELS.forEach(function (lv) {
      var key = lv[0], thr = lv[1], rise = null, set = null;
      for (var j = 0; j < n; j++) {
        var a = alts[j] - thr, b = alts[j + 1] - thr;
        if ((a < 0) === (b < 0)) continue;
        var lo = day0 + j * step, hi = lo + step, flo = a;
        for (var it = 0; it < 22; it++) {
          var mid = (lo + hi) / 2, fm = sunAltitude(mid, lat, lon, h) - thr;
          if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
        }
        var t = new Date(Math.round((lo + hi) / 2 / 1000) * 1000).toISOString();
        if (a < 0 && rise === null) rise = t;
        if (a >= 0 && set === null) set = t;
      }
      var always = rise === null && set === null ? (alts[0] >= thr ? "above" : "below") : null;
      events[key] = { rise: rise, set: set, all_day: always };
    });
    return { state: state(altNow), local_day_start_utc: new Date(day0).toISOString(), events: events,
      note: "rise is the morning crossing (sunrise, or dawn for the twilight levels), set the evening one" };
  }

  var api = { sky: sky, twilight: function (date, lat, lon, h) {
    var ms = toMs(date); return twilight(ms, lat, lon, h || 0, sunAltitude(ms, lat, lon, h || 0)); },
    refraction: refraction, deltaT: deltaT, moonGeo: moonGeo, sunGeo: sunGeo, planetHelio: planetHelio, phaseText: phaseText,
    STARS: STARS.map(function (s) { return s[0]; }), version: "site_sky 0.1" };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MagSky = api;
})(this);
