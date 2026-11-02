/* Strobilus Atlas cone engine.
 * species + size percentile + region climate + age  ->  closed triangle mesh in millimetres (+ binary STL).
 * Every scale, bract and spine is its own closed, outward-facing solid; slicers union the overlaps. */
(function (root) {
  'use strict';

  // ---------------- helpers ----------------
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const DEG = Math.PI / 180;
  const GOLDEN = 137.50776 * DEG;
  const TMAX = 0.9;            // scales run up the axis to here; the axis tip sits just above
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const add3 = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // standard normal truncated to +/- lim
  function truncNormal(rand, lim) {
    for (let k = 0; k < 32; k++) {
      const u = 1 - rand(), v = rand();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      if (Math.abs(z) <= lim) return z;
    }
    return 0;
  }
  // inverse standard normal CDF (Acklam)
  function invNorm(p) {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const normPdf = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);

  // ---------------- species ----------------
  // len: cone length in cm (mature, closed). ar: closed width / length. theta: scale angle from the axis (deg) at
  // [base, middle, tip] closed (c) and open (o). arch: uniform bend toward the axis (deg). curl: extra bend at the
  // scale tip (deg, negative = rolled outward). kind: pine (woody knob), scale (thin scale), shield (peltate).
  const SPECIES = {
    douglas: {
      name: 'Douglas-fir', latin: 'Pseudotsuga menziesii', kind: 'scale',
      len: { mean: 7.5, sd: 1.1, min: 5, max: 11 }, ar: { mean: 0.40, min: 0.33, max: 0.48 },
      scales: { mean: 80, min: 60, max: 110 },
      env: { widest: 0.38, round: 0.6, base: 0.2 }, core: 0.24,
      theta: { c: [62, 32, 14], o: [84, 70, 44] }, arch: { c: 8, o: 18 }, curl: { c: 0, o: 0 },
      scale: { kW: 1.5, stalk: 0.42, tv: 0.04, td: 0.04, cup: 0.06, tip: 'round',
        bract: { type: 'trident', from: 0.7, ext: 0.36, w: 0.28, t: 0.04, side: 0.5, sideAng: 30, sideW: 0.17 } },
      mature: 6, ageMax: 24, opens: 'yes', asym: 0.03, defAge: 6.4,
      col: { young: [0.38, 0.50, 0.26], stalk: [0.50, 0.33, 0.19], knob: [0.64, 0.45, 0.27], bract: [0.80, 0.68, 0.46] }
    },
    noble: {
      name: 'Noble fir', latin: 'Abies procera', kind: 'scale',
      len: { mean: 15, sd: 2, min: 11, max: 22 }, ar: { mean: 0.42, min: 0.36, max: 0.5 },
      scales: { mean: 120, min: 95, max: 160 },
      env: { widest: 0.48, round: 0.32, base: 0.24 }, core: 0.2,
      theta: { c: [74, 52, 28], o: [74, 52, 28] }, arch: { c: 6, o: 6 }, curl: { c: 0, o: 0 },
      scale: { kW: 1.45, stalk: 0.45, tv: 0.04, td: 0.04, cup: 0.04, tip: 'round',
        bract: { type: 'reflexed', from: 0.6, ext: 0.56, w: 0.9, t: 0.035, reflex: 150 } },
      mature: 5, ageMax: 15, opens: 'no', disintegrates: true, disWindow: 2.5, disMax: 1, disMode: 'top',
      disLabel: 'Breaking apart on the branch', spentLabel: 'Bare central spike',
      col: { young: [0.33, 0.40, 0.27], stalk: [0.44, 0.30, 0.18], knob: [0.54, 0.38, 0.23], bract: [0.50, 0.50, 0.32] }
    },
    lodgepole: {
      name: 'Lodgepole pine', latin: 'Pinus contorta', kind: 'pine',
      len: { mean: 4.2, sd: 0.8, min: 2.5, max: 6.5 }, ar: { mean: 0.62, min: 0.5, max: 0.74 },
      scales: { mean: 72, min: 50, max: 98 },
      env: { widest: 0.32, round: 0.8, base: 0.18 }, core: 0.28,
      theta: { c: [74, 42, 18], o: [98, 90, 66] }, arch: { c: 5, o: 14 }, curl: { c: 0, o: 0 },
      knob: { kW: 1.45, rk: 0.85, stalk: 0.42, Hk: 0.36, keel: 0.07, umbo: 0.07, prickle: 0.13, kp: [0.5, 0.34], tipW: [0.14, 0.45], tv: 0.05, td: 0.05 },
      mature: 24, ageMax: 60, opens: 'yes', serotinous: true, asym: 0.3, style: { mean: 0.3, sd: 0.15, min: 0, max: 0.6 },
      col: { young: [0.36, 0.48, 0.24], stalk: [0.30, 0.18, 0.10], knob: [0.64, 0.46, 0.28] }
    },
    sugar: {
      name: 'Sugar pine', latin: 'Pinus lambertiana', kind: 'pine',
      len: { mean: 34, sd: 6, min: 24, max: 50 }, ar: { mean: 0.25, min: 0.2, max: 0.31 },
      scales: { mean: 210, min: 150, max: 290 },
      env: { widest: 0.42, round: 0.45, base: 0.22 }, core: 0.3,
      theta: { c: [62, 32, 14], o: [92, 84, 58] }, arch: { c: 5, o: 16 }, curl: { c: 0, o: 0 },
      knob: { kW: 1.5, rk: 0.7, stalk: 0.8, Hk: 0.14, keel: 0.03, umbo: 0.04, prickle: 0, kp: [0.4, 0.35], tipW: [0.5, 0.6], tv: 0.045, td: 0.045 },
      mature: 24, ageMax: 54, opens: 'yes', asym: 0.04, style: { mean: 0.12, sd: 0.08, min: 0, max: 0.3 },
      col: { young: [0.38, 0.50, 0.24], stalk: [0.42, 0.27, 0.15], knob: [0.70, 0.54, 0.34] }
    },
    sequoia: {
      name: 'Giant sequoia', latin: 'Sequoiadendron giganteum', kind: 'shield',
      len: { mean: 5.6, sd: 0.65, min: 4, max: 7.5 }, ar: { mean: 0.7, min: 0.6, max: 0.8 },
      scales: { mean: 36, min: 25, max: 50 },
      env: { widest: 0.45, round: 0.6, base: 0.3 }, core: 0.3,
      theta: { c: [112, 92, 62], o: [118, 96, 58] }, arch: { c: 0, o: 4 }, curl: { c: 0, o: 0 },
      shield: { kW: 1.42, stalk: 0.24, depth: 0.3, aspect: 0.82 },
      mature: 20, ageMax: 72, opens: 'slow', greenWhenRipe: true, asym: 0.04,
      col: { young: [0.36, 0.50, 0.22], stalk: [0.42, 0.27, 0.15], knob: [0.56, 0.38, 0.22] }
    },
    spruce: {
      name: 'Norway spruce', latin: 'Picea abies', kind: 'scale',
      len: { mean: 12.5, sd: 1.8, min: 9, max: 17 }, ar: { mean: 0.30, min: 0.25, max: 0.36 },
      scales: { mean: 150, min: 110, max: 200 },
      env: { widest: 0.42, round: 0.5, base: 0.2 }, core: 0.28,
      theta: { c: [60, 30, 14], o: [80, 64, 40] }, arch: { c: 8, o: 22 }, curl: { c: 0, o: 0 },
      scale: { kW: 1.55, stalk: 0.45, tv: 0.035, td: 0.035, cup: 0.08, tip: 'point' },
      mature: 6, ageMax: 24, opens: 'yes', asym: 0.03, style: { mean: 0.6, sd: 0.22, min: 0.15, max: 1 },
      col: { young: [0.42, 0.46, 0.24], stalk: [0.50, 0.32, 0.18], knob: [0.62, 0.42, 0.25] }
    },
    scots: {
      name: 'Scots pine', latin: 'Pinus sylvestris', kind: 'pine',
      len: { mean: 5, sd: 0.8, min: 3, max: 7.5 }, ar: { mean: 0.5, min: 0.42, max: 0.6 },
      scales: { mean: 70, min: 50, max: 100 },
      env: { widest: 0.34, round: 0.75, base: 0.18 }, core: 0.27,
      theta: { c: [72, 40, 18], o: [98, 90, 62] }, arch: { c: 5, o: 14 }, curl: { c: 0, o: 0 },
      knob: { kW: 1.45, rk: 0.8, stalk: 0.45, Hk: 0.24, keel: 0.06, umbo: 0.06, prickle: 0, kp: [0.5, 0.34], tipW: [0.18, 0.5], tv: 0.05, td: 0.05 },
      mature: 20, ageMax: 54, opens: 'yes', asym: 0.06, style: { mean: 0.35, sd: 0.25, min: 0, max: 1 },
      col: { young: [0.36, 0.48, 0.24], stalk: [0.36, 0.24, 0.14], knob: [0.62, 0.52, 0.38] }
    },
    stone: {
      name: 'Stone pine', latin: 'Pinus pinea', kind: 'pine',
      len: { mean: 11, sd: 1.3, min: 8, max: 15 }, ar: { mean: 0.76, min: 0.66, max: 0.86 },
      scales: { mean: 105, min: 80, max: 135 },
      env: { widest: 0.42, round: 0.6, base: 0.2 }, core: 0.3,
      theta: { c: [80, 50, 24], o: [100, 94, 70] }, arch: { c: 4, o: 10 }, curl: { c: 0, o: 0 },
      knob: { kW: 1.4, rk: 0.85, stalk: 0.55, Hk: 0.38, keel: 0.05, umbo: 0.09, prickle: 0, kp: [0.5, 0.42], tipW: [0.2, 0.5], tv: 0.07, td: 0.07 },
      mature: 36, ageMax: 72, opens: 'yes', asym: 0.04, style: { mean: 0.2, sd: 0.12, min: 0, max: 0.45 },
      col: { young: [0.34, 0.46, 0.22], stalk: [0.40, 0.24, 0.12], knob: [0.56, 0.35, 0.18] }
    },
    cedar: {
      name: 'Cedar of Lebanon', latin: 'Cedrus libani', kind: 'scale',
      len: { mean: 10, sd: 0.8, min: 8, max: 12 }, ar: { mean: 0.58, min: 0.5, max: 0.66 },
      scales: { mean: 190, min: 150, max: 240 },
      env: { widest: 0.5, round: 0.45, top: 0.22, base: 0.1 }, core: 0.2,
      theta: { c: [84, 76, 56], o: [84, 76, 56] }, arch: { c: 8, o: 8 }, curl: { c: 35, o: 35 },
      scale: { kW: 1.6, stalk: 0.55, tv: 0.03, td: 0.03, cup: 0, tip: 'round' },
      mature: 18, ageMax: 30, opens: 'no', disintegrates: true, disWindow: 4, disMax: 1, disMode: 'top',
      disLabel: 'Breaking apart on the branch', spentLabel: 'Bare central spike',
      col: { young: [0.56, 0.63, 0.43], stalk: [0.52, 0.38, 0.25], knob: [0.66, 0.53, 0.38] }
    },
    chir: {
      name: 'Chir pine', latin: 'Pinus roxburghii', kind: 'pine',
      len: { mean: 14, sd: 2, min: 10, max: 20 }, ar: { mean: 0.55, min: 0.47, max: 0.64 },
      scales: { mean: 115, min: 85, max: 150 },
      env: { widest: 0.36, round: 0.7, base: 0.16 }, core: 0.28,
      theta: { c: [72, 42, 18], o: [104, 98, 70] }, arch: { c: 4, o: 8 }, curl: { c: -4, o: -35 },
      knob: { kW: 1.4, rk: 0.95, stalk: 0.42, Hk: 0.42, keel: 0.06, umbo: 0.06, prickle: 0, kp: [0.55, 0.42], tipW: [0.15, 0.45], tv: 0.06, td: 0.06 },
      mature: 24, ageMax: 60, opens: 'yes', asym: 0.05, style: { mean: 0.75, sd: 0.12, min: 0.5, max: 1 },
      col: { young: [0.36, 0.48, 0.24], stalk: [0.34, 0.23, 0.14], knob: [0.58, 0.46, 0.33] }
    },
    larch: {
      name: 'Japanese larch', latin: 'Larix kaempferi', kind: 'scale',
      len: { mean: 2.8, sd: 0.35, min: 2, max: 3.5 }, ar: { mean: 0.78, min: 0.68, max: 0.88 },
      scales: { mean: 42, min: 30, max: 56 },
      env: { widest: 0.4, round: 0.55, base: 0.25 }, core: 0.3,
      theta: { c: [72, 46, 24], o: [96, 84, 60] }, arch: { c: 4, o: 0 }, curl: { c: -20, o: -85 },
      scale: { kW: 1.5, stalk: 0.5, tv: 0.045, td: 0.045, cup: 0.04, tip: 'round' },
      mature: 5, ageMax: 24, opens: 'yes', asym: 0.03,
      col: { young: [0.45, 0.50, 0.30], stalk: [0.50, 0.34, 0.20], knob: [0.62, 0.46, 0.30] }
    },
    merkusii: {
      name: 'Sumatran pine', latin: 'Pinus merkusii', kind: 'pine',
      len: { mean: 6.5, sd: 0.75, min: 4.8, max: 8.5 }, ar: { mean: 0.44, min: 0.38, max: 0.52 },
      scales: { mean: 80, min: 60, max: 105 },
      env: { widest: 0.32, round: 0.75, base: 0.15 }, core: 0.27,
      theta: { c: [70, 38, 16], o: [98, 92, 64] }, arch: { c: 5, o: 14 }, curl: { c: 0, o: 0 },
      knob: { kW: 1.45, rk: 0.8, stalk: 0.45, Hk: 0.24, keel: 0.07, umbo: 0.05, prickle: 0, kp: [0.5, 0.34], tipW: [0.16, 0.48], tv: 0.05, td: 0.05 },
      mature: 24, ageMax: 54, opens: 'yes', asym: 0.04,
      col: { young: [0.36, 0.48, 0.24], stalk: [0.40, 0.26, 0.14], knob: [0.62, 0.42, 0.24] }
    },
    bunya: {
      name: 'Bunya pine', latin: 'Araucaria bidwillii', kind: 'pine',
      len: { mean: 25, sd: 2.5, min: 18, max: 32 }, ar: { mean: 0.85, min: 0.76, max: 0.93 },
      scales: { mean: 110, min: 85, max: 140 },
      env: { widest: 0.42, round: 0.5, base: 0.1 }, core: 0.32,
      theta: { c: [80, 50, 24], o: [80, 50, 24] }, arch: { c: 4, o: 4 }, curl: { c: 0, o: 0 },
      knob: { kW: 1.42, rk: 0.85, stalk: 0.55, Hk: 0.24, keel: 0.04, umbo: 0, prickle: 0, kp: [0.45, 0.42], tipW: [0.3, 0.45], tv: 0.06, td: 0.06,
        spine: { len: 0.62, r: 0.065, bend: -85, tilt: 26 } },
      mature: 20, ageMax: 32, opens: 'no', disintegrates: true, hookMax: 10, style: { mean: 0.55, sd: 0.12, min: 0.35, max: 0.8 }, disWindow: 6, disMax: 0.55, disMode: 'random', greenWhenRipe: true,
      disLabel: 'Fallen, breaking apart', spentLabel: 'Broken open on the ground',
      col: { young: [0.28, 0.44, 0.20], stalk: [0.25, 0.39, 0.18], knob: [0.30, 0.47, 0.22], spine: [0.46, 0.28, 0.15] }
    }
  };
  for (const k in SPECIES) SPECIES[k].key = k;

  // ---------------- early life (conelet -> full size) ----------------
  // g: cone length as a fraction of mature length, keyed by age as a fraction of `mature` (reaches 1 by 0.85 at the
  // latest, so ripening, mature and old cones are untouched). Shape youth follows growth: y = (1 - g) / (1 - g0).
  // base/round/widest: closed envelope at y = 1 (a small base value = rounded or tapered base, no flat ring of full-size
  // basal scales). ar: width/length factor. core: core radius at the base (tapers into the stalk). ped/pedR: peduncle
  // length (cone lengths) and radius factor. hk: pine apophysis height factor (conelets have only a small umbo).
  // bract: bract length factor (bracts dominate receptive Douglas-fir cones). ybract: bract shown only on young cones
  // (larch). bristle: sequoia's hair-like scale-tip bract. bEnd: age (fraction of mature) by which bract effects end.
  // rec/recEnd: receptive cones hold their scales apart for pollen (deg, fraction of mature). recCol/recColEnd: colour
  // of the receptive cone and when it has faded into the species' green.
  const YOUNG = {
    douglas: { note: 'Receptive cones stand upright, red or green, and are mostly trident bracts; they tip over to hang within weeks.', g: [[0, 0.4], [0.35, 0.75], [0.62, 1]], base: 0.03, round: 0.75, widest: 0.42, ar: 0.85, core: 0.45, ped: 0.11, pedR: 0.75, bract: 2.0, bEnd: 0.55, rec: 16, recEnd: 0.1, recCol: [0.58, 0.2, 0.24], recColEnd: 0.35 },
    noble: { note: 'Young cones sit upright on the twig, green to purple under green bracts, and are full size by mid-August.', g: [[0, 0.25], [0.55, 1]], base: 0.05, round: 0.6, widest: 0.48, ar: 0.9, core: 0.5, ped: 0.06, pedR: 0.8, bract: 1.25, bEnd: 0.55, rec: 0, recEnd: 0.1, recCol: [0.4, 0.24, 0.42], recColEnd: 0.6 },
    lodgepole: { note: 'The first-year conelet is a small stalkless egg; it swells to full size in its second summer.', g: [[0, 0.12], [0.5, 0.25], [0.75, 1]], base: 0.03, round: 0.85, widest: 0.42, ar: 0.78, core: 0.45, ped: 0.05, pedR: 0.7, hk: 0.2, rec: 14, recEnd: 0.04, recCol: [0.56, 0.24, 0.3], recColEnd: 0.15 },
    sugar: { note: 'Young cones are slim and tapered on a short stalk; the stalk and cone lengthen through year two.', g: [[0, 0.11], [0.5, 0.22], [0.8, 1]], base: 0.04, round: 0.65, widest: 0.45, ar: 0.85, core: 0.5, ped: 0.14, pedR: 0.6, hk: 0.3, rec: 12, recEnd: 0.04, recCol: [0.5, 0.32, 0.38], recColEnd: 0.12 },
    sequoia: { note: 'The new conelet is grain-sized, pearly grey and bristly, and is almost full size within four months.', g: [[0, 0.1], [0.2, 0.75], [0.6, 0.86], [0.8, 1]], base: 0.05, round: 0.7, widest: 0.5, ar: 0.8, core: 0.5, ped: 0.2, pedR: 0.5, bristle: 0.55, bEnd: 0.75, rec: 0, recEnd: 0.1, recCol: [0.6, 0.62, 0.58], recColEnd: 0.15 },
    spruce: { note: 'Receptive cones stand upright and red with their scales parted, then close and turn down to hang.', g: [[0, 0.3], [0.4, 1]], base: 0.03, round: 0.7, widest: 0.45, ar: 0.95, core: 0.45, ped: 0.05, pedR: 0.7, rec: 22, recEnd: 0.12, recCol: [0.64, 0.16, 0.2], recColEnd: 0.3 },
    scots: { note: 'The receptive cone is a reddish-purple egg about 6 to 10 mm long, nodding on a short stalk by winter.', g: [[0, 0.16], [0.55, 0.26], [0.8, 1]], base: 0.04, round: 0.8, widest: 0.45, ar: 0.9, core: 0.45, ped: 0.1, pedR: 0.65, hk: 0.25, rec: 14, recEnd: 0.04, recCol: [0.55, 0.22, 0.3], recColEnd: 0.12 },
    stone: { note: 'Cones stay pea to walnut size for two years, then do nearly all their growing in the third spring.', g: [[0, 0.06], [0.33, 0.12], [0.62, 0.24], [0.74, 1]], base: 0.06, round: 0.6, widest: 0.45, ar: 0.95, core: 0.5, ped: 0.08, pedR: 0.75, hk: 0.25, rec: 12, recEnd: 0.03, recCol: [0.56, 0.44, 0.26], recColEnd: 0.1 },
    cedar: { note: 'Young cones are slim, upright barrels, pale green with purplish scale edges; they fatten late.', g: [[0, 0.1], [0.5, 0.25], [0.85, 1]], base: 0.05, round: 0.6, widest: 0.5, ar: 0.8, core: 0.5, ped: 0.03, pedR: 0.8, rec: 10, recEnd: 0.05, recCol: [0.56, 0.5, 0.52], recColEnd: 0.5 },
    chir: { note: 'The conelet is small and smooth; the hooked, swollen scale tips only form in the second year.', g: [[0, 0.1], [0.5, 0.2], [0.8, 1]], base: 0.04, round: 0.8, widest: 0.42, ar: 0.85, core: 0.45, ped: 0.08, pedR: 0.7, hk: 0.2, rec: 12, recEnd: 0.04, recCol: [0.5, 0.3, 0.32], recColEnd: 0.12 },
    larch: { note: 'At pollination the cone is a pink rosette of curled-back bracts, which the green scales soon outgrow.', g: [[0, 0.35], [0.65, 1]], base: 0.05, round: 0.6, widest: 0.45, ar: 0.85, core: 0.5, ped: 0.14, pedR: 0.6, ybract: { type: 'reflexed', from: 0.55, ext: 0.55, w: 0.75, t: 0.04, reflex: 110 }, bEnd: 0.55, rec: 18, recEnd: 0.12, recCol: [0.7, 0.38, 0.5], recColEnd: 0.35 },
    merkusii: { note: 'Young cones are narrow, with a rounded base on a short stalk and smooth, spineless scales.', g: [[0, 0.12], [0.5, 0.25], [0.8, 1]], base: 0.03, round: 0.8, widest: 0.42, ar: 0.85, core: 0.45, ped: 0.15, pedR: 0.6, hk: 0.25, rec: 12, recEnd: 0.04, recCol: [0.5, 0.3, 0.3], recColEnd: 0.12 },
    bunya: { note: 'Young cones sit upright at the branch tips as rounded green eggs, already armed with spines.', g: [[0, 0.08], [0.5, 0.3], [0.8, 1]], base: 0.05, round: 0.6, widest: 0.45, ar: 0.95, core: 0.55, ped: 0.05, pedR: 0.8, rec: 0, recEnd: 0.1 }
  };
  for (const k in YOUNG) SPECIES[k].young = YOUNG[k];
  // growth in length; exactly 1 once the last key is passed
  function growth(Y, a, M) {
    const x = a / M, G = Y.g;
    if (x >= G[G.length - 1][0]) return 1;
    for (let i = 1; i < G.length; i++) if (x < G[i][0]) return lerp(G[i - 1][1], G[i][1], smooth(G[i - 1][0], G[i][0], x));
    return 1;
  }
  // species as it looks at shape-youth y (identity at y = 0, so later stages are bit-for-bit unchanged)
  function youthSpecies(sp, y) {
    if (!(y > 0)) return sp;
    const Y = sp.young, x = Object.assign({}, sp);
    x.env = Object.assign({}, sp.env, { base: lerp(sp.env.base, Y.base, y), round: lerp(sp.env.round, Y.round, y), widest: lerp(sp.env.widest, Y.widest, y) });
    x.coreTaper = { y, b0: Y.core, tw: 0.3 };
    x.envTaper = { y, tw: Y.tw || 0.32 };
    // basal scales of a conelet lie close along the stalk instead of standing out
    const c = sp.theta.c;
    if (c[0] < 90) x.theta = Object.assign({}, sp.theta, { c: [lerp(c[0], Math.min(c[0], c[1] + 8), y), c[1], c[2]] });
    if (sp.knob && Y.hk != null) x.knob = Object.assign({}, sp.knob, { Hk: sp.knob.Hk * lerp(1, Y.hk, y) });
    return x;
  }

  const DETAIL = {
    draft: { K: 10, stalk: 3, knob: 7, core: 18 },
    standard: { K: 14, stalk: 4, knob: 10, core: 28 },
    fine: { K: 20, stalk: 6, knob: 15, core: 40 }
  };

  // ---------------- life stages ----------------
  function stages(sp) {
    const M = sp.mature, A = sp.ageMax;
    const s = [
      { key: 'conelet', label: 'Conelet', from: 0, to: 0.5 * M },
      { key: 'growing', label: 'Growing', from: 0.5 * M, to: 0.85 * M },
      { key: 'ripening', label: 'Ripening', from: 0.85 * M, to: M }
    ];
    if (sp.disintegrates) {
      s.push({ key: 'mature', label: sp.key === 'bunya' ? 'Falls' : 'Shatters', from: M, to: M + sp.disWindow });
      s.push({ key: 'spent', label: sp.key === 'bunya' ? 'Broken' : 'Spike', from: M + sp.disWindow, to: A });
    } else {
      const ripeEnd = sp.opens === 'slow' ? M + 12 : M + 6;
      s.push({ key: 'mature', label: sp.opens === 'slow' ? 'Ripe' : 'Open', from: M, to: ripeEnd });
      s.push({ key: 'weathered', label: sp.opens === 'slow' ? 'Drying' : 'Weathered', from: ripeEnd, to: A });
    }
    return s;
  }
  function defaultAge(sp) {
    if (sp.defAge != null) return sp.defAge;
    if (sp.disintegrates) return sp.mature;
    if (sp.opens === 'slow') return sp.mature + 2;
    return sp.mature + 3;
  }

  // ---------------- specimen traits (from the Blender "Pinecone Controls" modifier) ----------------
  // Every specimen draws each trait once, from a truncated normal inside the natural range for its species.
  const tn = (r, mean, sd, min, max) => clamp(mean + sd * truncNormal(r, 2.2), min, max);
  const tipObj = sp => sp.knob || sp.scale || sp.shield;
  const opensOf = sp => sp.opens !== 'no';
  const archRef = sp => Math.max(opensOf(sp) ? sp.arch.o : sp.arch.c, 2);
  const STYLE_DEFAULT = { pine: { mean: 0.22, sd: 0.14, min: 0, max: 0.55 }, scale: { mean: 0.2, sd: 0.1, min: 0, max: 0.35 }, shield: { mean: 0.5, sd: 0.12, min: 0.3, max: 0.7 } };
  const styleRange = sp => sp.style || STYLE_DEFAULT[sp.kind];
  const styleWord = (sp, v) => sp.kind === 'pine' ? (v < 0.3 ? 'flat apophysis' : v < 0.65 ? 'raised apophysis' : 'hooked apophysis')
    : sp.kind === 'scale' ? (v < 0.35 ? 'rounded tips' : v < 0.7 ? 'tapered tips' : 'pointed tips') : (v < 0.45 ? 'shallow shields' : v < 0.6 ? 'medium shields' : 'deep shields');
  const rel = (m, sdF, spanF) => ({ mean: m, sd: m * sdF, min: m * (1 - spanF), max: m * (1 + spanF) });
  // dist(sp) -> {mean, sd, min, max} in the units shown to people; applies(sp) -> false means fixed at the mean
  const TRAIT_DEFS = [
    { key: 'divergence', panel: 'Phyllotaxis', name: 'Divergence Angle', unit: '°', dp: 2, dist: () => ({ mean: 137.51, sd: 0.35, min: 136.6, max: 138.4 }) },
    { key: 'widestAt', panel: 'Shape', name: 'Widest At', dp: 2, dist: sp => ({ mean: sp.env.widest, sd: 0.025, min: sp.env.widest - 0.05, max: sp.env.widest + 0.05 }) },
    { key: 'roundness', panel: 'Shape', name: 'Roundness', dp: 2, dist: sp => rel(sp.env.round, 0.07, 0.14) },
    { key: 'core', panel: 'Shape', name: 'Core Thickness', dp: 3, dist: sp => rel(sp.core, 0.06, 0.12) },
    { key: 'densityBias', panel: 'Scales', name: 'Density Bias', dp: 2, dist: () => ({ mean: 1, sd: 0.07, min: 0.88, max: 1.15 }) },
    { key: 'tiltBottom', panel: 'Scales', name: 'Tilt Bottom', unit: '°', dp: 1, applies: opensOf, dist: sp => ({ mean: 90 - sp.theta.o[0], sd: 3.5, min: 83 - sp.theta.o[0], max: 97 - sp.theta.o[0] }) },
    { key: 'tiltTop', panel: 'Scales', name: 'Tilt Top', unit: '°', dp: 1, applies: opensOf, dist: sp => ({ mean: 90 - sp.theta.o[2], sd: 4, min: 81 - sp.theta.o[2], max: 99 - sp.theta.o[2] }) },
    { key: 'evenness', panel: 'Scales', name: 'Attach Evenness', dp: 2, dist: () => ({ mean: 0.72, sd: 0.1, min: 0.5, max: 0.95 }) },
    { key: 'stalkWidth', panel: 'Scales', name: 'Stalk Width', dp: 2, dist: sp => rel(tipObj(sp).stalk, 0.05, 0.1) },
    { key: 'stalkThickness', panel: 'Scales', name: 'Stalk Thickness', dp: 2, dist: () => ({ mean: 1, sd: 0.06, min: 0.88, max: 1.15 }) },
    { key: 'closedKnob', panel: 'Knobs', name: 'Closed Knob Size', dp: 2, dist: sp => rel(tipObj(sp).kW, 0.03, 0.06) },
    { key: 'openKnob', panel: 'Knobs', name: 'Open Knob Size', dp: 2, applies: opensOf, dist: () => ({ mean: 1, sd: 0.035, min: 0.92, max: 1.06 }) },
    { key: 'knobHeight', panel: 'Knobs', name: 'Knob Height', dp: 2, applies: sp => sp.kind === 'pine', dist: sp => sp.knob ? { mean: sp.knob.Hk, sd: sp.knob.Hk * 0.1, min: sp.knob.Hk * 0.78, max: sp.knob.Hk * 1.25 } : { mean: 0, sd: 0, min: 0, max: 0 } },
    { key: 'scaleStyle', panel: 'Scale Style', name: 'Scale Style', dp: 2, dist: styleRange, word: styleWord },
    { key: 'styleVariation', panel: 'Scale Style', name: 'Style Variation', dp: 2, dist: () => ({ mean: 0.1, sd: 0.06, min: 0, max: 0.25 }) },
    { key: 'tipBend', panel: 'Scale Style', name: 'Tip Bend', unit: '°', dp: 1, signed: true, dist: () => ({ mean: 0, sd: 4, min: -8, max: 8 }) },
    { key: 'baseZone', panel: 'Base & Transition', name: 'Base Zone', dp: 2, applies: opensOf, dist: () => ({ mean: 0.07, sd: 0.025, min: 0.03, max: 0.15 }) },
    { key: 'transition', panel: 'Base & Transition', name: 'Transition', dp: 2, applies: opensOf, dist: () => ({ mean: 0.18, sd: 0.04, min: 0.1, max: 0.3 }) },
    { key: 'archBottom', panel: 'Arch', name: 'Arch Bottom', unit: '°', dp: 1, dist: sp => rel(archRef(sp) * 0.6, 0.15, 0.3) },
    { key: 'archTop', panel: 'Arch', name: 'Arch Top', unit: '°', dp: 1, dist: sp => rel(archRef(sp) * 1.4, 0.15, 0.3) },
    { key: 'archVariation', panel: 'Arch', name: 'Arch Variation', dp: 2, dist: () => ({ mean: 0.1, sd: 0.04, min: 0.03, max: 0.2 }) },
    { key: 'sizeVariation', panel: 'Variation', name: 'Size Variation', dp: 3, dist: () => ({ mean: 0.06, sd: 0.015, min: 0.03, max: 0.1 }) },
    { key: 'openVariation', panel: 'Variation', name: 'Open Variation', unit: '°', dp: 1, applies: opensOf, dist: () => ({ mean: 4, sd: 1.5, min: 1.5, max: 8 }) },
    { key: 'asymmetry', panel: 'Variation', name: 'Asymmetry', dp: 3, dist: sp => rel(sp.asym || 0.03, 0.2, 0.4) },
    { key: 'sunSide', panel: 'Variation', name: 'Sun Side', unit: '°', dp: 0, uniform: true, dist: () => ({ mean: 180, sd: 0, min: 0, max: 360 }) },
    { key: 'jitter', panel: 'Variation', name: 'Jitter', dp: 3, dist: () => ({ mean: 0.03, sd: 0.02, min: 0, max: 0.08 }) }
  ];
  const LUCAS = 99.5, LUCAS_P = 0.02;   // about 1 cone in 50 follows the Lucas sequence instead of Fibonacci

  function randomTraits(sp, seed) {
    const r = rng(((seed | 0) * 2654435761 + 0x5bd1e995) >>> 0);
    const TR = {};
    for (const d of TRAIT_DEFS) {
      const g = d.dist(sp);
      let v = d.uniform ? g.min + (g.max - g.min) * r() : tn(r, g.mean, g.sd, g.min, g.max);
      if (d.applies && !d.applies(sp)) v = g.mean;
      TR[d.key] = v;
    }
    if (r() < LUCAS_P) TR.divergence = LUCAS + 0.25 * truncNormal(r, 2);
    return TR;
  }
  // rows for display: value, natural range and a short reading
  function traitRows(sp, TR) {
    return TRAIT_DEFS.filter(d => !d.applies || d.applies(sp)).map(d => {
      const g = d.dist(sp), v = TR[d.key];
      let note = '';
      if (d.key === 'divergence') note = v < 120 ? 'Lucas spiral, about 1 cone in 50' : Math.abs(v - 137.51) < 0.25 ? 'golden angle' : 'near the golden angle';
      else if (d.word) note = d.word(sp, v);
      return { key: d.key, panel: d.panel, name: d.name, unit: d.unit || '', dp: d.dp, signed: !!d.signed, value: v, min: g.min, max: g.max, mean: g.mean, note, outside: v < g.min - 1e-9 || v > g.max + 1e-9 };
    });
  }
  // every trait at the species' natural mean (golden-angle phyllotaxis)
  function meanTraits(sp) {
    const TR = {};
    for (const d of TRAIT_DEFS) TR[d.key] = d.dist(sp).mean;
    return TR;
  }
  function traitKey(TR) { return TRAIT_DEFS.map(d => TR[d.key].toFixed(3)).join('|'); }
  function deriveSpecies(sp, TR) {
    const x = Object.assign({}, sp);
    const rf = TR.roundness / sp.env.round;
    x.env = Object.assign({}, sp.env, { widest: TR.widestAt, round: TR.roundness, top: sp.env.top ? sp.env.top * rf : undefined });
    x.core = TR.core;
    if (opensOf(sp)) {
      const o0 = 90 - TR.tiltBottom, o2 = 90 - TR.tiltTop;
      x.theta = { c: sp.theta.c, o: [o0, sp.theta.o[1] + ((o0 - sp.theta.o[0]) + (o2 - sp.theta.o[2])) / 2, o2] };
    }
    x.curl = { c: sp.curl.c + 0.5 * TR.tipBend, o: sp.curl.o + TR.tipBend };
    if (sp.knob) x.knob = Object.assign({}, sp.knob, { kW: TR.closedKnob, stalk: TR.stalkWidth, Hk: TR.knobHeight, tv: sp.knob.tv * TR.stalkThickness, td: sp.knob.td * TR.stalkThickness });
    if (sp.scale) x.scale = Object.assign({}, sp.scale, { kW: TR.closedKnob, stalk: TR.stalkWidth, tv: sp.scale.tv * TR.stalkThickness, td: sp.scale.td * TR.stalkThickness });
    if (sp.shield) x.shield = Object.assign({}, sp.shield, { kW: TR.closedKnob, stalk: TR.stalkWidth * TR.stalkThickness });
    x.asym = TR.asymmetry;
    return x;
  }

  function computeTraits(p) {
    const sp = SPECIES[p.species] || SPECIES.douglas;
    const tr = p.traits || randomTraits(sp, p.seed | 0);
    const spX = deriveSpecies(sp, tr);
    const rh = clamp(p.humidity == null ? 60 : p.humidity, 10, 100);
    const elev = clamp(p.elevation == null ? 500 : p.elevation, 0, 4500);
    // Site: cones from high, short-season sites run a little smaller.
    const siteF = clamp(1 - 0.04 * (elev - 1000) / 1000, 0.9, 1.04);
    const mu = sp.len.mean * siteF, sd = sp.len.sd * siteF;
    const lo = sp.len.min * siteF, hi = sp.len.max * siteF;
    const pct = clamp(p.percentile == null ? 50 : p.percentile, 1, 99);
    const z = invNorm(pct / 100);
    const L = clamp(mu + z * sd, lo, hi);
    const r = rng((p.seed | 0) * 7919 + 101);
    let e1 = truncNormal(r, 2), e2 = truncNormal(r, 2);
    const uSero = r();
    if (p.typical) { e1 = 0; e2 = 0; }   // the species-mean cone: width and scale count sit at the species norm for its length
    // width and scale count follow length (correlated), each with a small truncated-normal spread
    const zAR = 0.5 * z + Math.sqrt(0.75) * e1;
    let AR = clamp(sp.ar.mean * (1 + 0.07 * zAR), sp.ar.min, sp.ar.max);
    const N = Math.round(clamp(sp.scales.mean * Math.pow(L / mu, 0.7) * (1 + 0.05 * e2), sp.scales.min, sp.scales.max));

    const M = sp.mature, a = clamp(p.ageMonths == null ? defaultAge(sp) : p.ageMonths, 0, sp.ageMax);
    const Yg = sp.young;
    const g = Yg ? growth(Yg, a, M) : (a < 0.5 * M ? lerp(0.08, 0.2, a / (0.5 * M)) : lerp(0.2, 1, smooth(0.5 * M, 0.85 * M, a)));
    // shape youth follows growth in length; bract youth, receptive spread and receptive colour follow the calendar
    const y = Yg ? clamp((1 - g) / (1 - Yg.g[0][1]), 0, 1) : 0;
    const yB = Yg && Yg.bEnd ? 1 - smooth(0, Yg.bEnd * M, a) : 0;
    const yRec = Yg && Yg.rec ? 1 - smooth(0.4 * Yg.recEnd * M, Yg.recEnd * M, a) : 0;
    const yCol = Yg && Yg.recCol ? 1 - smooth(0, Yg.recColEnd * M, a) : 0;
    const spY = youthSpecies(spX, y);
    const brown = sp.greenWhenRipe ? smooth(M + 2, M + 16, a) : smooth(0.8 * M, M, a);
    const weather = smooth(M + 5, M + 36, a);
    const hum = smooth(45, 92, rh);
    let open = 0, sealed = false, dis = 0;
    if (sp.opens === 'yes') open = smooth(M - 0.3, M + 1.5, a);
    else if (sp.opens === 'slow') open = 0.85 * smooth(M + 8, M + 36, a);
    if (sp.serotinous && uSero < (p.serotiny || 0)) { sealed = true; open = 0; }
    if (sp.disintegrates) dis = sp.disMax * smooth(M + 0.2, M + sp.disWindow, a);
    const oEff = open * (1 - 0.6 * hum);
    const asym = spX.asym + 0.15 * clamp(p.exposure || 0, 0, 1);

    if (y > 0) AR *= lerp(1, sp.young.ar, y);
    const segs = stages(sp);
    let stage = segs[segs.length - 1];
    for (const s of segs) if (a >= s.from && a < s.to) { stage = s; break; }
    let label;
    switch (stage.key) {
      case 'conelet': label = yRec > 0.5 ? 'Receptive, scales parted for pollen' : M > 9 ? 'Conelet, first season' : 'Young conelet'; break;
      case 'growing': label = 'Growing, green and closed'; break;
      case 'ripening': label = sp.greenWhenRipe ? 'Ripening, still green' : 'Ripening, turning brown'; break;
      case 'spent': label = sp.spentLabel; break;
      default:
        if (sp.disintegrates) label = dis < 0.04 ? (sp.key === 'bunya' ? 'Ripe, about to fall' : 'Ripe, about to break apart') : sp.disLabel;
        else if (sealed) label = 'Ripe, sealed shut with resin';
        else if (sp.opens === 'slow') label = open < 0.12 ? 'Ripe, still green and closed' : 'Drying out and opening';
        else if (open > 0.5 && oEff < 0.62 * open) label = stage.key === 'mature' ? 'Open, half-closed in damp air' : 'Weathered, half-closed in damp air';
        else label = stage.key === 'mature' ? 'Open, shedding seed' : 'Weathered, on the ground';
    }
    return {
      sp, spX, spY, tr, pct, z, mu, sd, lo, hi, L, AR, N, siteF, rh, elev,
      age: a, g, y, yB, yRec, yCol, brown, open, oEff, weather, hum, sealed, dis, asym,
      stage: stage.key, stageLabel: label, segs
    };
  }

  // ---------------- shape functions ----------------
  function envShape(sp, t) {
    if (t >= 1) return 0;
    t = Math.max(0, t);
    const w = sp.env.widest, b = sp.env.base;
    const s = t < w ? lerp(b, 0.5, t / w) : lerp(0.5, 1, (t - w) / (1 - w));
    let r = Math.pow(Math.max(0, Math.sin(Math.PI * s)), t < w ? sp.env.round : (sp.env.top || sp.env.round));
    const et = sp.envTaper;   // young cones narrow into the stalk: a rounded/tapered base, no ring of broad basal scales
    if (et) r *= lerp(1, 0.08 + 0.92 * Math.sqrt(smooth(0, et.tw, t)), et.y);
    return r;
  }
  function coreR(sp, Rmax, t) {
    t = clamp(t, 0, 1);
    let r = Rmax * sp.core * (0.5 + 0.5 * Math.sin(Math.PI * lerp(0.12, 0.88, t))) * (1 - 0.6 * smooth(0.72, 1, t));
    const ct = sp.coreTaper;
    if (ct) r *= lerp(1, lerp(ct.b0, 1, smooth(0, ct.tw, t)), ct.y);
    return r;
  }
  function interp3(v, t) {
    const mid = 0.45;
    return t < mid ? lerp(v[0], v[1], smooth(0, mid, t)) : lerp(v[1], v[2], smooth(mid, 1, t));
  }
  function closedLen(sp, Rmax, t) {
    const th = interp3(sp.theta.c, t) * DEG;
    const rc = coreR(sp, Rmax, t);
    const sinT = Math.max(0.35, Math.sin(th));
    const minL = 0.1 * Rmax;
    let Ls = Math.max(minL, (Rmax * envShape(sp, t) - 0.75 * rc) / sinT);
    for (let k = 0; k < 5; k++) {
      const zt = t + Ls * Math.cos(th);
      Ls = Math.max(minL, (Rmax * envShape(sp, lerp(t, zt, 0.7)) - 0.75 * rc) / sinT);
    }
    return Ls;
  }
  function frameFor(phi, th) {
    const rh = [Math.cos(phi), Math.sin(phi), 0];
    return {
      rh,
      u: [-Math.sin(phi), Math.cos(phi), 0],
      d0: [Math.sin(th) * rh[0], Math.sin(th) * rh[1], Math.cos(th)],
      n0: [Math.cos(th) * rh[0], Math.cos(th) * rh[1], -Math.sin(th)]
    };
  }
  // Centre-line of length L that bends by A (uniform, toward -n = adaxial) plus a tip curl Tc spread smoothly over
  // [sc, 1] (negative = rolled outward). Returns sampler(s) -> {c, d, n}; s > 1 continues straight.
  function makeCurve(P0, d0, n0, L, A, Tc, sc) {
    const M = 48;
    const phi = s => A * s + Tc * smooth(sc, 1, s);
    const dir = s => { const f = phi(s), c = Math.cos(f), q = Math.sin(f); return [c * d0[0] - q * n0[0], c * d0[1] - q * n0[1], c * d0[2] - q * n0[2]]; };
    const nrm = s => { const f = phi(s), c = Math.cos(f), q = Math.sin(f); return [q * d0[0] + c * n0[0], q * d0[1] + c * n0[1], q * d0[2] + c * n0[2]]; };
    const ps = [P0.slice()];
    let prev = dir(0);
    const h = L / M;
    for (let k = 1; k <= M; k++) {
      const cur = dir(k / M), mid = dir((k - 0.5) / M), q = ps[k - 1];
      ps.push([q[0] + h * (prev[0] + 4 * mid[0] + cur[0]) / 6, q[1] + h * (prev[1] + 4 * mid[1] + cur[1]) / 6, q[2] + h * (prev[2] + 4 * mid[2] + cur[2]) / 6]);
      prev = cur;
    }
    return function (s) {
      if (s >= 1) { const d = dir(1); return { c: add3(ps[M], d, (s - 1) * L), d, n: nrm(1) }; }
      s = Math.max(0, s);
      const f = s * M, i = Math.min(M - 1, Math.floor(f)), w = f - i, a = ps[i], b = ps[i + 1];
      return { c: [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)], d: dir(s), n: nrm(s) };
    };
  }
  function closedTips(sp, Rmax, tList) {
    const tips = [];
    for (let i = 0; i < tList.length; i++) {
      const t = tList[i];
      const th = interp3(sp.theta.c, t) * DEG;
      const Ls = closedLen(sp, Rmax, t);
      const rc = coreR(sp, Rmax, t);
      const f = frameFor(0, th);
      const A = sp.arch.c * DEG * lerp(0.6, 1.4, t);
      const e = makeCurve([0.75 * rc, 0, t], f.d0, f.n0, Ls, A, sp.curl.c * DEG, 0.55)(1).c;
      tips.push({ t, R: Math.hypot(e[0], e[1]), z: e[2], Ls });
    }
    return tips;
  }

  // ---------------- mesh accumulator ----------------
  function MeshAcc() { this.pos = []; this.col = []; this.idx = []; }
  MeshAcc.prototype.v = function (p, c) {
    this.pos.push(p[0], p[1], p[2]); this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  };
  // make a closed part face outward (positive signed volume)
  MeshAcc.prototype.orient = function (t0) {
    const P = this.pos, I = this.idx;
    let vol = 0;
    for (let k = t0; k < I.length; k += 3) {
      const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
      vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    if (vol < 0) for (let k = t0; k < I.length; k += 3) { const tmp = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = tmp; }
  };
  // rings of K points lofted into a tube, closed with a fan at each end
  MeshAcc.prototype.loft = function (rings, cols, startCenter, endCenter, startCol, endCol) {
    const t0 = this.idx.length, K = rings[0].length, base = this.pos.length / 3;
    for (let j = 0; j < rings.length; j++) {
      const cj = cols[j], per = Array.isArray(cj[0]);
      for (let k = 0; k < K; k++) this.v(rings[j][k], per ? cj[k] : cj);
    }
    for (let j = 0; j < rings.length - 1; j++) {
      const r0 = base + j * K, r1 = base + (j + 1) * K;
      for (let k = 0; k < K; k++) { const k1 = (k + 1) % K; this.idx.push(r0 + k, r0 + k1, r1 + k1, r0 + k, r1 + k1, r1 + k); }
    }
    const sc = this.v(startCenter, startCol), ec = this.v(endCenter, endCol);
    const last = base + (rings.length - 1) * K;
    for (let k = 0; k < K; k++) { const k1 = (k + 1) % K; this.idx.push(sc, base + k1, base + k); this.idx.push(ec, last + k, last + k1); }
    this.orient(t0);
  };

  // superellipse rings along a frame function
  function makeRings(frameAt, specs, K, colFn) {
    const rings = [], cols = [];
    for (const R of specs) {
      const F = frameAt(R.s), ring = [], rc = [];
      for (let k = 0; k < K; k++) {
        const psi = 2 * Math.PI * k / K, cu = Math.cos(psi), sn = Math.sin(psi);
        const U = Math.sign(cu) * Math.pow(Math.abs(cu), 2 / R.e);
        const V = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / R.e);
        const hw = R.w / 2 * U;
        const hn = (V > 0 ? R.hd(U) * V : R.hv * V) - (R.cup || 0) * U * U;
        ring.push([F.c[0] + hw * F.u[0] + hn * F.n[0], F.c[1] + hw * F.u[1] + hn * F.n[1], F.c[2] + hw * F.u[2] + hn * F.n[2]]);
        rc.push(colFn(R, V));
      }
      rings.push(ring); cols.push(rc);
    }
    return { rings, cols };
  }

  // ---------------- build ----------------
  function build(p) {
    const T = computeTraits(p);
    const sp = T.spY, TR = T.tr;
    const det = DETAIL[p.detail] || DETAIL.standard;
    const N = T.N, K = det.K;
    const sv = TR.sizeVariation;
    // attachment heights: Density Bias packs scales toward the base, Attach Evenness adds a small wobble
    const rt = rng((p.seed | 0) * 7907 + 3), tList = [];
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      tList.push(clamp(TMAX * Math.pow(u, TR.densityBias) + (1 - TR.evenness) * 0.5 * (TMAX / N) * truncNormal(rt, 2), 0.002, TMAX));
    }

    // 1) envelope radius so the closed cone has the target width/length ratio
    let Rmax = 0.5 * T.AR, tips = null, closedLenN = 1;
    for (let it = 0; it < 5; it++) {
      tips = closedTips(sp, Rmax, tList);
      let zTop = TMAX + 0.05, zBot = 0, Rm = 0;
      for (const q of tips) { zTop = Math.max(zTop, q.z); zBot = Math.min(zBot, q.z); Rm = Math.max(Rm, q.R); }
      closedLenN = zTop - zBot;
      Rmax *= T.AR / ((2 * Rm) / closedLenN);
    }
    tips = closedTips(sp, Rmax, tList);

    // 2) scale-tip width from the surface area each tip covers on the closed cone
    const kW = (sp.knob || sp.scale || sp.shield).kW;
    const W0 = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2);
      const dz = (tips[b].z - tips[a].z) / (b - a), dR = (tips[b].R - tips[a].R) / (b - a);
      W0[i] = kW * Math.sqrt(2 * Math.PI * Math.max(tips[i].R, 0.05 * Rmax) * Math.hypot(dz, dR));
    }

    // 3) colours for this age
    const grey = [0.58, 0.55, 0.50], pale = [0.74, 0.70, 0.62];
    const C = sp.col;
    const C0 = T.yCol > 0 ? mixc(C.young, sp.young.recCol, T.yCol) : C.young;
    const ageCol = (ripe, w) => mixc(mixc(C0, ripe, T.brown), w, 0.55 * T.weather);
    const cols = {
      stalk: ageCol(C.stalk, grey), knob: ageCol(C.knob, pale),
      bract: ageCol(C.bract || C.knob, pale), spine: C.spine ? mixc(C.spine, grey, 0.4 * T.weather) : ageCol(C.stalk, grey)
    };
    cols.core = cols.stalk.map(x => x * 0.85);

    // 4) per-scale random draws (truncated normals keep every scale inside a believable range)
    const rnd = rng((p.seed | 0) * 104729 + 7);
    const phi0 = rnd() * Math.PI * 2, asymDir = TR.sunSide * DEG, div = TR.divergence * DEG;
    const draws = [];
    for (let i = 0; i < N; i++) draws.push({ z: [truncNormal(rnd, 2), truncNormal(rnd, 2), truncNormal(rnd, 2), truncNormal(rnd, 2), truncNormal(rnd, 2)], uLoss: rnd(), uPr: rnd(), uDis: rnd(), zS: truncNormal(rnd, 2), zJ: truncNormal(rnd, 2) });

    // 5) scales in their current state
    const scales = [];
    for (let i = 0; i < N; i++) {
      const t = tList[i], D = draws[i], z = D.z;
      if (T.weather > 0 && !sp.disintegrates && t > 0.12 && D.uLoss < T.weather * (0.04 + 0.2 * smooth(0.75, 1, t))) continue;
      if (T.dis > 0) {
        const tn = t / TMAX;
        const score = sp.disMode === 'random' ? D.uDis : 0.8 * (1 - tn) + 0.2 * D.uDis + 0.02;
        if (score < T.dis * (sp.disMode === 'random' ? 1 : 1.05)) continue;
      }
      const phi = phi0 + i * div + 0.5 * TR.jitter * div * D.zJ;
      const ramp = smooth(TR.baseZone, TR.baseZone + TR.transition, t / TMAX);
      const thC = interp3(sp.theta.c, t), thO = interp3(sp.theta.o, t);
      let th = (thC + (thO - thC) * T.oEff * ramp + 10 * T.weather * ramp * T.oEff + z[2] * TR.openVariation * (0.35 + 0.65 * T.oEff * ramp)) * DEG;
      if (T.yRec > 0) th += sp.young.rec * T.yRec * smooth(0.05, 0.3, t / TMAX) * (1 - 0.4 * t / TMAX) * DEG;
      const aRef = archRef(T.sp);
      const archShape = lerp(TR.archBottom / aRef, TR.archTop / aRef, t);
      const arch = ((sp.arch.c + (sp.arch.o - sp.arch.c) * T.oEff * ramp + 18 * T.weather * ramp * T.oEff) * archShape + z[3] * TR.archVariation * 36) * DEG;
      const style = clamp(TR.scaleStyle + TR.styleVariation * D.zS, 0, 1);
      let hook = sp.kind === 'pine' ? -(sp.hookMax == null ? 32 : sp.hookMax) * smooth(0.55, 1, style) : 0;
      if (T.y > 0) hook *= 1 - T.y;
      const curl = (sp.curl.c + (sp.curl.o - sp.curl.c) * T.oEff * ramp + hook) * DEG * (1 + 0.5 * sv * z[1]);
      const side = Math.cos(phi - asymDir) * smooth(0.04, 0.35, t);
      const Ls = tips[i].Ls * (1 + sv * z[0]) * (1 + 0.18 * T.asym * side) * (1 - 0.08 * T.weather * T.oEff * smooth(0.7, 1, t));
      let W = W0[i] * (1 + sv * z[1]) * lerp(1, TR.openKnob, T.oEff * ramp);
      if (sp.kind === 'shield') W *= 1 - 0.22 * T.oEff;
      const twist = T.weather * T.oEff * 0.45 * z[4];
      scales.push({ i, t, phi, th, arch, curl, Ls, W, side, twist, D, style });
    }

    // 6) millimetres per model unit
    const rcAt = t => coreR(sp, Rmax, t);
    let estTop = TMAX + 0.05, estBot = 0;
    for (const s of scales) {
      const f = frameFor(s.phi, s.th);
      const e = makeCurve([0.75 * rcAt(s.t) * f.rh[0], 0.75 * rcAt(s.t) * f.rh[1], s.t], f.d0, f.n0, s.Ls, s.arch, s.curl, 0.55)(1).c;
      estTop = Math.max(estTop, e[2] + 0.3 * s.W); estBot = Math.min(estBot, e[2] - 0.3 * s.W);
    }
    const fit = p.printMode === 'fit';
    let S = fit ? clamp(p.fitHeight, 10, 1000) / (Math.max(estTop, 1) - Math.min(estBot, -0.06)) : (T.L * 10 * T.g) / closedLenN;
    const minWallN = clamp(p.minWall == null ? 1 : p.minWall, 0, 5) / S;

    // 7) geometry
    const acc = new MeshAcc();
    const ctx = { sp, T, K, det, rcAt, minWallN, cols, extras: [] };
    for (const s of scales) buildScale(acc, s, ctx);
    for (const x of ctx.extras) x(acc);
    let minZ = Infinity;
    for (let k = 2; k < acc.pos.length; k += 3) minZ = Math.min(minZ, acc.pos[k]);
    const ped = T.y > 0 ? lerp(0.06, sp.young.ped, T.y) : 0.06;
    const stemBottom = Math.min(-ped, minZ - 0.01);
    buildCore(acc, sp, Rmax, stemBottom, det.core, Math.max(K, 16), cols.core, minWallN, T.y > 0 ? lerp(1, sp.young.pedR, T.y) : 1);

    // 8) to millimetres, base on z = 0
    const P = new Float32Array(acc.pos.length);
    for (let k = 0; k < acc.pos.length; k += 3) { P[k] = acc.pos[k] * S; P[k + 1] = acc.pos[k + 1] * S; P[k + 2] = (acc.pos[k + 2] - stemBottom) * S; }
    let maxZ = 0, maxR = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let k = 0; k < P.length; k += 3) {
      maxZ = Math.max(maxZ, P[k + 2]); maxR = Math.max(maxR, Math.hypot(P[k], P[k + 1]));
      minX = Math.min(minX, P[k]); maxX = Math.max(maxX, P[k]); minY = Math.min(minY, P[k + 1]); maxY = Math.max(maxY, P[k + 1]);
    }
    if (fit && maxZ > 0) {
      const f = clamp(p.fitHeight, 10, 1000) / maxZ;
      for (let k = 0; k < P.length; k++) P[k] *= f;
      S *= f; maxZ *= f; maxR *= f; minX *= f; maxX *= f; minY *= f; maxY *= f;
    }
    const I = new Uint32Array(acc.idx);
    return {
      traits: T, positions: P, colors: new Float32Array(acc.col), indices: I,
      triangles: I.length / 3, scaleCount: scales.length,
      size: { height: maxZ, width: Math.max(maxX - minX, maxY - minY), radius: maxR, x: maxX - minX, y: maxY - minY },
      mmPerUnit: S
    };
  }

  function buildScale(acc, s, ctx) {
    const { sp, T, K, det, rcAt, minWallN, cols } = ctx;
    const f = frameFor(s.phi, s.th);
    const rc = rcAt(s.t);
    const P0 = [0.6 * rc * f.rh[0], 0.6 * rc * f.rh[1], s.t];
    const W = s.W, Ls = s.Ls;
    const young = 1 - T.brown * (sp.greenWhenRipe ? 0 : 1);
    const curve = makeCurve(P0, f.d0, f.n0, Ls, s.arch, s.curl, 0.55);
    const frameAt = sv => {
      const fr = curve(Math.min(sv, 1));
      let c = fr.c;
      if (sv > 1) c = add3(c, fr.d, (sv - 1) * Ls);
      const g = s.twist * sv * sv, cg = Math.cos(g), sg = Math.sin(g);
      return {
        c, d: fr.d,
        u: [cg * f.u[0] + sg * fr.n[0], cg * f.u[1] + sg * fr.n[1], cg * f.u[2] + sg * fr.n[2]],
        n: [-sg * f.u[0] + cg * fr.n[0], -sg * f.u[1] + cg * fr.n[1], -sg * f.u[2] + cg * fr.n[2]]
      };
    };
    const specs = [];

    if (sp.kind === 'pine') {
      const kn = sp.knob, tt = s.t;
      let Lk = Math.min(kn.rk * W * lerp(1, 0.72, smooth(0.6, 1, tt)), 0.65 * Ls);
      const kp = lerp(kn.kp[0], kn.kp[1], smooth(0.3, 0.75, tt));
      const tipW = lerp(kn.tipW[0], kn.tipW[1], smooth(0.3, 0.75, tt));
      const stalkW = Math.max(kn.stalk * W, 1.6 * minWallN);
      let tv = kn.tv * W * lerp(1, 1.5, young), td = kn.td * W * lerp(1, 1.5, young);
      if (tv + td < minWallN) { const m = minWallN / (tv + td); tv *= m; td *= m; }
      const Hk = kn.Hk * W * (0.75 + 0.5 * s.style) * (1 + 1.4 * T.asym * s.side) * (1 - 0.35 * T.weather) * lerp(1, 0.6, young);
      const apex = kp * Lk;
      const bulge = (a, U) => {
        if (a >= Lk) return 0;
        const gg = clamp(a > apex ? (Lk - a) / (Lk - apex) : a / apex, 0, 1);
        const lat = 1 - Math.pow(Math.abs(U), 1.7);
        const ridge = kn.keel * W * Math.exp(-Math.pow((a - apex) / (0.14 * Lk), 2)) * (1 - Math.pow(Math.abs(U), 3));
        const umbo = kn.umbo * W * Math.exp(-Math.pow((a - apex) / (0.12 * Lk), 2) - Math.pow(U / 0.22, 2));
        return Hk * Math.pow(gg, 0.75) * lat + ridge + umbo;
      };
      const widthAt = a => {
        if (a >= Lk) { const q = (Ls - a) / Math.max(1e-6, Ls - Lk); return stalkW * lerp(0.72, 1, q); }
        if (a >= apex) { const q = (Lk - a) / (Lk - apex); return lerp(stalkW, W, 1 - Math.pow(1 - q, 1.25)); }
        const q = a / apex; return Math.max(lerp(tipW * W, W, 1 - Math.pow(1 - q, 1.3)), 1.2 * minWallN);
      };
      const sK = 1 - Lk / Ls;
      const ss = [];
      for (let j = 0; j < det.stalk; j++) ss.push(sK * j / det.stalk);
      for (let j = 0; j <= det.knob; j++) ss.push(sK + (1 - sK) * j / det.knob);
      const sApex = 1 - apex / Ls;
      if (!ss.some(x => Math.abs(x - sApex) < 0.01)) { ss.push(sApex); ss.sort((a, b) => a - b); }
      for (const q of ss) {
        const a = (1 - q) * Ls;
        specs.push({ s: q, w: widthAt(a), hv: tv, hd: U => td + bulge(a, U), e: 2.6, k: a < Lk ? smooth(Lk, 0.45 * Lk, a) : 0 });
      }
      specs.push({ s: 1 + 0.03 * Lk / Ls, w: widthAt(0) * 0.62, hv: tv * 0.6, hd: () => td * 0.6, e: 2.6, k: 1 });
      if (kn.prickle > 0 && s.D.uPr > 0.9 * T.weather && T.brown > 0.3) {
        const h = td + bulge(apex, 0), len = kn.prickle * W, r = Math.max(0.045 * W, 0.55 * minWallN);
        ctx.extras.push(a2 => buildPrickle(a2, frameAt(sApex), h, len, r, cols.knob.map(x => x * 0.8)));
      }
      if (kn.spine && T.brown < 0.95) {
        const F = frameAt(1);
        const sp2 = kn.spine, tilt = sp2.tilt * DEG;
        const d0 = [Math.cos(tilt) * F.d[0] + Math.sin(tilt) * F.n[0], Math.cos(tilt) * F.d[1] + Math.sin(tilt) * F.n[1], Math.cos(tilt) * F.d[2] + Math.sin(tilt) * F.n[2]];
        const n0 = [-Math.sin(tilt) * F.d[0] + Math.cos(tilt) * F.n[0], -Math.sin(tilt) * F.d[1] + Math.cos(tilt) * F.n[1], -Math.sin(tilt) * F.d[2] + Math.cos(tilt) * F.n[2]];
        const base = add3(F.c, F.d, -0.12 * Lk);
        const len = sp2.len * W * (1 + 0.15 * s.D.z[0]) * lerp(1, 0.5, young), r = Math.max(sp2.r * W, 0.6 * minWallN);
        ctx.extras.push(a2 => buildHorn(a2, base, d0, n0, F.u, len, r, sp2.bend * DEG, cols.spine, K >= 14 ? 8 : 6));
      }
    } else if (sp.kind === 'scale') {
      const sc = sp.scale;
      const stalkW = Math.max(sc.stalk * W, 1.6 * minWallN);
      let tv = sc.tv * W, td = sc.td * W;
      if (tv + td < minWallN) { const m = minWallN / (tv + td); tv *= m; td *= m; }
      const rT = Math.min(0.5 * W, 0.45 * Ls);
      const nS = det.stalk + 2, nT = det.knob;
      const cup = sc.cup * W;
      for (let j = 0; j < nS; j++) {
        const q = j / nS, a = Ls - q * (Ls - rT);
        specs.push({ s: 1 - a / Ls, w: lerp(stalkW, W, Math.pow(q, 0.7)), hv: tv * lerp(1.5, 1, q), hd: () => td * lerp(1.5, 1, q), e: 2.4, k: 0.4 * q, cup: cup * q });
      }
      for (let j = 0; j <= nT; j++) {
        const q = 0.995 * j / nT, a = rT * (1 - q);
        let wq = Math.sqrt(Math.max(0, 1 - q * q));
        wq *= 1 - 0.55 * s.style * q;
        specs.push({ s: 1 - a / Ls, w: Math.max(W * wq, 1.2 * minWallN), hv: tv, hd: () => td, e: 2.4, k: 0.4 + 0.6 * q, cup });
      }
      let br = sc.bract;
      const Yb = sp.young;
      if (br && T.yB > 0 && Yb.bract) br = Object.assign({}, br, { ext: br.ext * lerp(1, Yb.bract, T.yB), w: br.w * lerp(1, 0.5 + 0.5 * Yb.bract, T.yB) });
      if (!br && T.yB > 0.03 && Yb.ybract) br = Object.assign({}, Yb.ybract, { ext: Yb.ybract.ext * T.yB, w: Yb.ybract.w * lerp(0.4, 1, T.yB), reflex: Yb.ybract.reflex * lerp(0.5, 1, T.yB) });
      if (br) { const b2 = br; ctx.extras.push(a2 => buildBract(a2, b2, frameAt, s, Ls, W, td, minWallN, cols.bract, K)); }
    } else { // shield: peltate scale on a short stalk
      const sh = sp.shield;
      const stalkW = Math.max(sh.stalk * W, 1.6 * minWallN);
      const D = Math.min(sh.depth * W * (0.85 + 0.3 * s.style), 0.6 * Ls), Wn = sh.aspect * W, hh0 = 0.45 * stalkW;
      const nS = det.stalk + 1;
      for (let j = 0; j < nS; j++) { const a = Ls - (Ls - D) * j / nS; specs.push({ s: 1 - a / Ls, w: stalkW, hv: hh0, hd: () => hh0, e: 2.2, k: 0 }); }
      const prof = [[1.0, 0, 2.2], [0.93, 0.35, 1.8], [0.84, 0.8, 1.4], [0.74, 1, 1.25], [0.45, 1, 1.25], [0.2, 0.97, 1.25], [0.08, 0.86, 1.3], [0.0, 0.6, 1.4]];
      for (const [fa, q, e] of prof) { const ww = lerp(stalkW, W, q), hh = lerp(hh0, Wn / 2, q); specs.push({ s: 1 - fa * D / Ls, w: ww, hv: hh, hd: () => hh, e, k: q }); }
      if (T.yB > 0.03 && sp.young.bristle) {
        const F = frameAt(1), len = sp.young.bristle * W * T.yB, r = Math.max(0.035 * W, 0.6 * minWallN);
        ctx.extras.push(a2 => buildHorn(a2, add3(F.c, F.d, -0.1 * D), F.d, F.n, F.u, len, r, 25 * DEG, cols.knob, K >= 14 ? 8 : 6));
      }
    }

    const { rings, cols: rcols } = makeRings(frameAt, specs, K, (R, V) => { const b = mixc(cols.stalk, cols.knob, R.k); return V < 0 ? b.map(x => x * 0.82) : b; });
    const first = specs[0], last = specs[specs.length - 1];
    const sc0 = frameAt(first.s).c;
    const Fe = frameAt(1);
    const back = sp.kind === 'shield' ? -0.05 * W : (Math.max(last.s, 1) - 1) * Ls + 0.02 * W;
    acc.loft(rings, rcols, sc0, add3(Fe.c, Fe.d, back), cols.stalk, mixc(cols.stalk, cols.knob, last.k));
  }

  // Bract lying on the outer face of its scale and running past the tip.
  // trident: Douglas-fir (long middle prong + two side prongs); reflexed: true fir (broad, folded back over the cone).
  function buildBract(acc, b, frameAt, s, Ls, W, td, minWallN, col, K) {
    const Fb = frameAt(b.from);
    const t = Math.max(b.t * W, minWallN);
    const P0 = add3(Fb.c, Fb.n, td * 0.9 + t * 0.5);
    const inner = (1 - b.from) * Ls, ext = b.ext * Ls, Lb = inner + ext, f0 = inner / Lb;
    const KB = Math.max(8, K - 4);
    const flat = (sv, w) => ({ s: sv, w: Math.max(w, 1.1 * minWallN), hv: t / 2, hd: () => t / 2, e: 3 });
    if (b.type === 'trident') {
      const curve = makeCurve(P0, Fb.d, Fb.n, Lb, s.arch * (1 - b.from), 10 * DEG, f0);
      const fr = sv => { const q = curve(sv); return { c: q.c, u: Fb.u, n: q.n }; };
      const w0 = b.w * W, specs = [];
      for (const sv of [0, 0.5 * f0, f0, f0 + 0.25 * (1 - f0), f0 + 0.55 * (1 - f0), f0 + 0.8 * (1 - f0), 0.97]) {
        const q = sv <= f0 ? 1 : 1 - (sv - f0) / (1 - f0);
        specs.push(flat(sv, w0 * (sv <= f0 ? lerp(0.7, 1, sv / f0) : lerp(0.18, 1, Math.pow(q, 0.8)))));
      }
      const { rings, cols } = makeRings(fr, specs, KB, () => col);
      acc.loft(rings, cols, curve(0).c, curve(1).c, col, col);
      // side prongs leave at the scale margin
      const Fm = curve(f0);
      for (const sgn of [-1, 1]) {
        const a = sgn * b.sideAng * DEG, ca = Math.cos(a), sa = Math.sin(a);
        const d0 = [ca * Fm.d[0] + sa * Fb.u[0], ca * Fm.d[1] + sa * Fb.u[1], ca * Fm.d[2] + sa * Fb.u[2]];
        const u0 = [ca * Fb.u[0] - sa * Fm.d[0], ca * Fb.u[1] - sa * Fm.d[1], ca * Fb.u[2] - sa * Fm.d[2]];
        const start = add3(Fm.c, Fm.d, -0.15 * w0);
        const L2 = b.side * ext;
        const c2 = makeCurve(start, d0, Fm.n, L2, 0, -6 * DEG, 0.2);
        const sw = b.sideW * W, sp2 = [];
        for (const sv of [0, 0.35, 0.7, 0.95]) sp2.push(flat(sv, sw * lerp(0.2, 1, 1 - sv)));
        const r2 = makeRings(q => { const z = c2(q); return { c: z.c, u: u0, n: z.n }; }, sp2, KB, () => col);
        acc.loft(r2.rings, r2.cols, c2(0).c, c2(1).c, col, col);
      }
    } else {
      const curve = makeCurve(P0, Fb.d, Fb.n, Lb, s.arch * (1 - b.from), -b.reflex * DEG, f0 + 0.05 * (1 - f0));
      const fr = sv => { const q = curve(sv); return { c: q.c, u: Fb.u, n: q.n }; };
      const w0 = b.w * W, specs = [];
      const ss = [0, 0.5 * f0, f0];
      for (let j = 1; j <= 7; j++) ss.push(f0 + (1 - f0) * (j / 7) * 0.985);
      for (const sv of ss) {
        let w;
        if (sv <= f0) w = w0 * lerp(0.55, 1, sv / f0);
        else { const q = (sv - f0) / (1 - f0); w = w0 * (q < 0.6 ? 1 - 0.15 * q : lerp(0.91, 0.1, (q - 0.6) / 0.4)); }
        specs.push(flat(sv, w));
      }
      const { rings, cols } = makeRings(fr, specs, KB, () => col);
      acc.loft(rings, cols, curve(0).c, curve(1).c, col, col);
    }
  }

  function buildPrickle(acc, F, h, len, r, col) {
    const top = add3(F.c, F.n, h);
    let dir = [F.n[0] + 0.3 * F.d[0], F.n[1] + 0.3 * F.d[1], F.n[2] + 0.3 * F.d[2]];
    const dl = Math.hypot(dir[0], dir[1], dir[2]); dir = dir.map(x => x / dl);
    const e1 = F.u;
    const e2 = [dir[1] * e1[2] - dir[2] * e1[1], dir[2] * e1[0] - dir[0] * e1[2], dir[0] * e1[1] - dir[1] * e1[0]];
    const base = add3(top, dir, -len * 0.4), tip = add3(top, dir, len * 0.6), mid = add3(top, dir, len * 0.15);
    const ring = [], ring2 = [];
    for (let k = 0; k < 6; k++) {
      const a = 2 * Math.PI * k / 6, ca = Math.cos(a), sa = Math.sin(a);
      ring.push([base[0] + r * (ca * e1[0] + sa * e2[0]), base[1] + r * (ca * e1[1] + sa * e2[1]), base[2] + r * (ca * e1[2] + sa * e2[2])]);
      ring2.push([mid[0] + 0.45 * r * (ca * e1[0] + sa * e2[0]), mid[1] + 0.45 * r * (ca * e1[1] + sa * e2[1]), mid[2] + 0.45 * r * (ca * e1[2] + sa * e2[2])]);
    }
    acc.loft([ring, ring2], [col, col], base, tip, col, col);
  }

  // tapered round spine following a curve (bunya appendage)
  function buildHorn(acc, base, d0, n0, u0, len, r, bend, col, M) {
    const curve = makeCurve(base, d0, n0, len, bend, 0, 0.5);
    const specs = [];
    for (const sv of [0, 0.25, 0.5, 0.72, 0.9]) specs.push({ s: sv, w: 2 * r * lerp(1, 0.18, sv), hv: r * lerp(1, 0.18, sv), hd: () => r * lerp(1, 0.18, sv), e: 2 });
    const { rings, cols } = makeRings(q => { const z = curve(q); return { c: z.c, u: u0, n: z.n }; }, specs, M, () => col);
    acc.loft(rings, cols, curve(0).c, curve(1).c, col, col);
  }

  function buildCore(acc, sp, Rmax, stemBottom, nC, K, col, minWallN, pedF) {
    // the stalk keeps the mature cone's thickness (a young cone tapers into it rather than the stalk shrinking)
    const r0 = sp.coreTaper ? coreR(Object.assign({}, sp, { coreTaper: null }), Rmax, 0) : coreR(sp, Rmax, 0);
    const rs = Math.max(0.62 * r0 * (pedF == null ? 1 : pedF), 1.5 * minWallN);
    const prof = [[stemBottom, rs], [stemBottom * 0.5, rs * 1.03], [-0.012, rs * 1.08]];
    const zTop = TMAX + 0.03;
    for (let j = 0; j <= nC; j++) { const t = zTop * j / nC; prof.push([t, Math.max(coreR(sp, Rmax, t), 0.5 * minWallN)]); }
    const rings = [], cols = [];
    for (const [z, r] of prof) {
      const ring = [];
      for (let k = 0; k < K; k++) { const a = 2 * Math.PI * k / K; ring.push([r * Math.cos(a), r * Math.sin(a), z]); }
      rings.push(ring); cols.push(col);
    }
    acc.loft(rings, cols, [0, 0, stemBottom], [0, 0, zTop + 0.8 * Math.max(coreR(sp, Rmax, zTop), 0.5 * minWallN)], col, col);
  }

  // ---------------- export ----------------
  function toSTL(mesh, title) {
    const P = mesh.positions, I = mesh.indices, n = I.length / 3;
    const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    const head = (title || 'Strobilus Atlas cone').slice(0, 79);
    for (let k = 0; k < head.length; k++) dv.setUint8(k, head.charCodeAt(k) & 0x7f);
    dv.setUint32(80, n, true);
    let o = 84;
    for (let t = 0; t < n; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
      for (const [q, off] of [[a, 12], [b, 24], [c, 36]]) { dv.setFloat32(o + off, P[q], true); dv.setFloat32(o + off + 4, P[q + 1], true); dv.setFloat32(o + off + 8, P[q + 2], true); }
      dv.setUint16(o + 48, 0, true);
      o += 50;
    }
    return buf;
  }

  // one-file ZIP (deflate when the browser has CompressionStream)
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  async function deflateRaw(u8) {
    if (typeof CompressionStream === 'undefined') return null;
    try { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; }
  }
  async function zipOne(filename, data) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const crc = crc32(u8), comp = await deflateRaw(u8);
    const useDef = comp && comp.length < u8.length, body = useDef ? comp : u8, method = useDef ? 8 : 0;
    const name = new TextEncoder().encode(filename), d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, body.length, true); lh.setUint32(22, u8.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true);
    ch.setUint32(24, u8.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, 0, true);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, 1, true); end.setUint16(10, 1, true);
    end.setUint32(12, 46 + name.length, true); end.setUint32(16, 30 + name.length + body.length, true);
    return new Blob([lh.buffer, name, body, ch.buffer, name, end.buffer], { type: 'application/zip' });
  }

  const api = { LUCAS, SPECIES, DETAIL, TRAIT_DEFS, stages, defaultAge, randomTraits, meanTraits, traitRows, traitKey, computeTraits, build, toSTL, zipOne, crc32, invNorm, normPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PineconeEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
