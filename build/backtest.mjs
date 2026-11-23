// Accuracy test for the Mount Temple model.
// Tunes the model on winters 2022-23, 2023-24, 2024-25 and tests it on 2025-26,
// against Parks Canada's daily danger ratings and problems, December to March only.
// Run: node build/backtest.mjs   (reads build/data/temple/backtest/season_*.json)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const M = require(path.join(here, 'model.js'));
const DIR = path.join(here, 'data', 'temple', 'backtest');
const TRAIN = ['2022', '2023', '2024'], TEST = ['2025'];
const RATING = { low: 1, moderate: 2, considerable: 3, high: 4, extreme: 5 };
const PMAP = { stormslab: 'storm', windslab: 'wind', persistentslab: 'persistent', deeppersistentslab: 'deep', wetloose: 'wet', wetslab: 'wet' };
const PROBS = ['storm', 'wind', 'persistent', 'deep', 'wet'];
const CORE = d => { const m = +d.slice(5, 7); return m === 12 || m <= 3; };   // Dec to Mar (user choice)

// ---------- load seasons ----------
function loadSeason(y) {
  const f = path.join(DIR, `season_${y}.json`);
  if (!fs.existsSync(f)) return null;
  const S = JSON.parse(fs.readFileSync(f, 'utf8'));
  const st = S.stations || {};
  const off = -7;  // Mountain Standard Time, same as the page
  const obs = M.stationDays(st['110'], st['108'], st['111'], st['109'], off);
  const j = M.mergeERA(S.weather, S.era5);
  const I = M.prepare(j, obs);
  const idx = {}; I.days.forEach((d, i) => idx[d.date] = i);
  const days = [];
  for (const f of S.forecasts) {
    if (!CORE(f.date) || !(f.date in idx)) continue;
    const off = { alp: RATING[f.alp], tl: RATING[f.tl], btl: RATING[f.btl] };
    const probs = new Set((f.problems || []).map(p => PMAP[p.type]).filter(Boolean));
    days.push({ date: f.date, i: idx[f.date], off, probs });
  }
  return { y, season: S.season, I, days, obsDays: I.obsDays, kcal: I.kcal, tbias: I.tbias, stationCounts: Object.fromEntries(Object.entries(st).map(([k, v]) => [k, v.length])) };
}

// ---------- run model for a season ----------
function run(S, P) {
  const R = M.simulate(S.I, P);
  return S.days.map(d => { const A = M.assess(S.I, R, d.i, P); return { ...d, mod: A.danger, mprobs: new Set(A.problems.map(p => p.type === 'wetloose' ? 'wet' : p.type)), wetFlag: Object.values(A.wet).some(Boolean) }; });
}

// ---------- metrics ----------
function metrics(rows) {
  const bands = ['alp', 'tl', 'btl'];
  const out = { n_days: rows.length, bands: {}, all: null, problems: {}, wet: null };
  const tot = { n: 0, exact: 0, within1: 0, abs: 0, bias: 0, conf: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]), pairs: [] };
  for (const b of bands) {
    const m = { n: 0, exact: 0, within1: 0, abs: 0, bias: 0, conf: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]) };
    for (const r of rows) {
      const o = r.off[b], p = r.mod[b]; if (!o || !p) continue;
      for (const t of [m, tot]) { t.n++; if (o === p) t.exact++; if (Math.abs(o - p) <= 1) t.within1++; t.abs += Math.abs(o - p); t.bias += p - o; t.conf[o - 1][p - 1]++; }
      tot.pairs.push([o, p]);
    }
    out.bands[b] = fin(m);
  }
  out.all = fin(tot); out.all.kappa_quadratic = kappa(tot.pairs);
  for (const k of PROBS) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of rows) { const a = r.probs.has(k), b = r.mprobs.has(k); if (a && b) tp++; else if (!a && b) fp++; else if (a && !b) fn++; else tn++; }
    out.problems[k] = { parks_listed_days: tp + fn, model_listed_days: tp + fp, both: tp,
      hit_rate: tp + fn ? +(tp / (tp + fn)).toFixed(3) : null, false_alarm_rate: tp + fp ? +(fp / (tp + fp)).toFixed(3) : null,
      f1: tp ? +(2 * tp / (2 * tp + fp + fn)).toFixed(3) : 0 };
  }
  let wt = 0, wf = 0, wm = 0;
  for (const r of rows) { const a = r.probs.has('wet'), b = r.wetFlag; if (a && b) wt++; else if (b) wf++; else if (a) wm++; }
  out.wet = { parks_wet_days: wt + wm, model_warming_flag_days: wt + wf, both: wt };
  return out;
}
function fin(m) { return { n: m.n, exact: m.n ? +(m.exact / m.n).toFixed(3) : null, within1: m.n ? +(m.within1 / m.n).toFixed(3) : null, mae: m.n ? +(m.abs / m.n).toFixed(3) : null, bias: m.n ? +(m.bias / m.n).toFixed(3) : null, confusion_official_rows_model_cols: m.conf }; }
function kappa(pairs) {
  if (!pairs.length) return null;
  const K = 5, O = Array.from({ length: K }, () => Array(K).fill(0)); pairs.forEach(([a, b]) => O[a - 1][b - 1]++);
  const n = pairs.length, ra = O.map(r => r.reduce((x, y) => x + y, 0)), cb = O[0].map((_, j) => O.reduce((x, r) => x + r[j], 0));
  let num = 0, den = 0;
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const w = (i - j) ** 2 / (K - 1) ** 2; num += w * O[i][j]; den += w * ra[i] * cb[j] / n; }
  return den ? +(1 - num / den).toFixed(3) : null;
}
function objective(m) {
  const f1 = ['storm', 'wind', 'persistent', 'deep'].map(k => m.problems[k].f1).reduce((a, b) => a + b, 0) / 4;
  return m.all.mae + 0.3 * (1 - f1) + 0.1 * (1 - m.problems.wet.f1);   // wet term: checks the warming rule (user choice J)
}

// ---------- benchmark: most common Parks Canada rating per band and month in the training winters ----------
function climatology(trainRows) {
  const c = {};
  for (const r of trainRows) for (const b of ['alp', 'tl', 'btl']) { const o = r.off[b]; if (!o) continue; const k = b + r.date.slice(5, 7); (c[k] = c[k] || [0, 0, 0, 0, 0, 0])[o]++; }
  const mode = k => { const a = c[k]; if (!a) return 2; let best = 1; for (let v = 1; v <= 5; v++) if (a[v] > a[best]) best = v; return best; };
  // benchmark problems: listed if Parks Canada listed it on more than half the training days that month
  const pc = {};
  for (const r of trainRows) { const m = r.date.slice(5, 7); pc[m] = pc[m] || { n: 0 }; pc[m].n++; for (const p of r.probs) pc[m][p] = (pc[m][p] || 0) + 1; }
  return rows => rows.map(r => ({ ...r, mod: { alp: mode('alp' + r.date.slice(5, 7)), tl: mode('tl' + r.date.slice(5, 7)), btl: mode('btl' + r.date.slice(5, 7)) },
    mprobs: new Set(PROBS.filter(p => (pc[r.date.slice(5, 7)]?.[p] || 0) > (pc[r.date.slice(5, 7)]?.n || 1) / 2)), wetFlag: false }));
}

// ---------- tuning: seeded random search ----------
const RANGES = {
  stormCm: [20, 45], windCm: [10, 35], decay: [0.1, 0.35], windMin: [10, 30],
  shWind: [2, 15], shTmin: [-12, -5], nsfTmin: [-18, -8], grad: [6, 20], basalDays: [3, 14],
  pMin: [15, 50], pMax: [60, 150], life: [30, 90],
  wPers: [0.1, 1.2], wDeep: [0.1, 1.2], c2: [0.05, 1.0], c3: [0.3, 1.0], c4: [0.6, 1.6], c5: [1.0, 2.5],
  supMin: [0, 60], supSpan: [20, 200], probStorm: [0.3, 1.0], probWind: [0.2, 0.8], probPers: [0.2, 0.8], probDeep: [0.2, 0.8],
  meltT: [-2, 5], meltSpan: [3, 12], probWet: [0.3, 1.5]
};
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function sample(r, base) {
  const P = { ...base };
  for (const [k, [a, b]] of Object.entries(RANGES)) P[k] = a + (b - a) * r();
  P.basalDays = Math.round(P.basalDays);
  const cs = [P.c2, P.c3, P.c4, P.c5].sort((x, y) => x - y); [P.c2, P.c3, P.c4, P.c5] = cs;
  if (P.pMax < P.pMin + 20) P.pMax = P.pMin + 20;
  return P;
}
function perturb(r, P0, scale) {
  const P = { ...P0 };
  for (const [k, [a, b]] of Object.entries(RANGES)) P[k] = Math.min(b, Math.max(a, P0[k] + (r() - 0.5) * scale * (b - a)));
  P.basalDays = Math.round(P.basalDays);
  const cs = [P.c2, P.c3, P.c4, P.c5].sort((x, y) => x - y); [P.c2, P.c3, P.c4, P.c5] = cs;
  if (P.pMax < P.pMin + 20) P.pMax = P.pMin + 20;
  return P;
}

// ---------- main ----------
const seasons = {};
for (const y of [...TRAIN, ...TEST]) { const S = loadSeason(y); if (S) seasons[y] = S; }
const train = TRAIN.filter(y => seasons[y]).map(y => seasons[y]), test = TEST.filter(y => seasons[y]).map(y => seasons[y]);
if (!train.length || !test.length) { console.error('Missing season files'); process.exit(1); }
const runAll = (list, P) => list.flatMap(S => run(S, P));

const P0 = { ...M.DEFAULT_PARAMS };
const N1 = +(process.env.ITER || 600), N2 = +(process.env.REFINE || 400);
const SEEDS = (process.env.SEEDS || '1,2,3,4,5,6,7,8').split(',').map(Number);
// Several independent tuning runs. The kept run is the one with the best score on the TUNING winters only;
// the test winter is never used to choose. The spread of test results across runs is reported too.
function tune(seed) {
  const r = rng(seed);
  let best = { P: P0, score: objective(metrics(runAll(train, P0))) };
  for (let k = 0; k < N1; k++) { const P = sample(r, P0); const s = objective(metrics(runAll(train, P))); if (s < best.score) best = { P, score: s }; }
  for (let k = 0; k < N2; k++) { const P = perturb(r, best.P, k < N2 / 2 ? 0.3 : 0.1); const s = objective(metrics(runAll(train, P))); if (s < best.score) best = { P, score: s }; }
  return { seed, ...best };
}
const runsAll = SEEDS.map(tune);
const best = runsAll.reduce((a, b) => b.score < a.score ? b : a);
const round = P => Object.fromEntries(Object.entries(P).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]));
const tuned = round(best.P);

const trainRows = runAll(train, tuned), testRows = runAll(test, tuned);
const clim = climatology(runAll(train, tuned));
const report = {
  generated: new Date().toISOString(),
  design: { compared_against: 'Parks Canada daily danger ratings and problems for Mount Temple (Banff, Yoho and Kootenay forecast)',
            months: 'December to March', tuned_on: train.map(S => S.season), tested_on: test.map(S => S.season),
            tuning: `${SEEDS.length} seeded random-search runs, each ${N1} samples + ${N2} refinements; objective = mean absolute rating error + 0.3 x (1 - mean F1 of storm, wind, persistent, deep problems) + 0.1 x (1 - wet problem F1) on the tuning winters; the run with the best tuning score is kept`,
            disclosure: 'The test winter (2025-26) was scored four times while the setup was adjusted: (1) original ranges: average error 0.655; (2) warming thresholds added to tuning: 0.597; (3) five range limits widened: 0.695; (4) duplicate-crust bug fixed in the model: 0.815 (this version is published). Each time the kept tuning run was the one with the best tuning-winter score, never the best test score. Because the test winter was looked at four times, it is not fully unseen.',
            note: 'Ratings are forecasts, not observed avalanches. Parks Canada days with no numeric rating (early season, spring, no rating) are skipped band by band.' },
  seasons: Object.values(seasons).map(S => ({ season: S.season, forecast_days: S.days.length, station_days: S.obsDays, snowfall_scale: +S.kcal.toFixed(2), temp_bias_c: +S.tbias.toFixed(2), station_rows: S.stationCounts })),
  test: { tuned_model: metrics(testRows), default_model: metrics(runAll(test, P0)), benchmark_climatology: metrics(clim(runAll(test, tuned))) },
  train: { tuned_model: metrics(trainRows), default_model: metrics(runAll(train, P0)) },
  per_season_tuned_params: Object.fromEntries(Object.values(seasons).map(S => { const m = metrics(run(S, tuned)); return [S.season, { role: TRAIN.includes(String(S.y)) ? 'tuning' : 'test', n: m.all.n, exact: m.all.exact, within1: m.all.within1, mae: m.all.mae, bias: m.all.bias, kappa: m.all.kappa_quadratic, wind_hit: m.problems.wind.hit_rate, persistent_hit: m.problems.persistent.hit_rate }]; })),
  per_season_benchmark: Object.fromEntries(Object.values(seasons).map(S => { const m = metrics(clim(run(S, tuned))); return [S.season, { exact: m.all.exact, within1: m.all.within1, mae: m.all.mae }]; })),
  params_at_range_edge: Object.entries(RANGES).filter(([k, [a, b]]) => Math.abs(tuned[k] - a) < 0.02 * (b - a) || Math.abs(tuned[k] - b) < 0.02 * (b - a)).map(([k]) => k),
  tuning_runs: runsAll.map(R => { const m = metrics(runAll(test, R.P)); return { seed: R.seed, tuning_score: +R.score.toFixed(4), kept: R === best, test_exact: m.all.exact, test_within1: m.all.within1, test_mae: m.all.mae, test_kappa: m.all.kappa_quadratic }; }),
  params_default: P0, params_tuned: tuned
};
fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 1));
fs.writeFileSync(path.join(DIR, 'params.json'), JSON.stringify(tuned, null, 1));
// short summary for the page
const T = report.test, pct = x => x == null ? '–' : Math.round(x * 100) + '%';
const summary = { tested_on: report.design.tested_on.join(', '), months: 'Dec–Mar', n_band_ratings: T.tuned_model.all.n,
  exact: T.tuned_model.all.exact, within1: T.tuned_model.all.within1, mae: T.tuned_model.all.mae, kappa: T.tuned_model.all.kappa_quadratic,
  bench_exact: T.benchmark_climatology.all.exact, bench_within1: T.benchmark_climatology.all.within1, bench_mae: T.benchmark_climatology.all.mae, bench_kappa: T.benchmark_climatology.all.kappa_quadratic,
  beats_benchmark: T.tuned_model.all.mae < T.benchmark_climatology.all.mae,
  problems: Object.fromEntries(PROBS.map(k => [k, { hit: T.tuned_model.problems[k].hit_rate, false_alarm: T.tuned_model.problems[k].false_alarm_rate, parks_days: T.tuned_model.problems[k].parks_listed_days }])),
  runs: report.tuning_runs.length, range_exact: [Math.min(...report.tuning_runs.map(x => x.test_exact)), Math.max(...report.tuning_runs.map(x => x.test_exact))],
  range_mae: [Math.min(...report.tuning_runs.map(x => x.test_mae)), Math.max(...report.tuning_runs.map(x => x.test_mae))],
  per_season: report.per_season_tuned_params, per_season_benchmark: report.per_season_benchmark,
  disclosure: 'Test winter scored four times while adjusting the setup (average error 0.60 to 0.82); this published version scored 0.82.' };
fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
