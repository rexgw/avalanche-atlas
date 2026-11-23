/* Mount Temple snowpack and danger model.
   Shared by the page (inlined into index.html) and the accuracy test (build/backtest.mjs),
   so the numbers in the test report come from the same code the page runs.

   Inputs: Open-Meteo hourly weather at Mount Temple (local time), optional ERA5 precipitation,
   optional Parks Canada station readings (daily). Output: one state per day from the first day
   of the weather record, plus an assessment (danger per band, problems, weak layers) for any day.

   Every threshold lives in PARAMS. DEFAULT_PARAMS are starting guesses; the accuracy test tunes
   them against Parks Canada ratings and writes the tuned set to build/data/temple/backtest/params.json. */
(function (root) {
  // Site settings. bandz: middle elevation of each band; zp: height at which model precipitation is taken as valid;
  // noStn: correction used when there are no station readings; ridgeZ: elevation of the ridgetop station.
  const SITES = {
    temple:   { bandz: { btl: 1850, tl: 2175, alp: 2700 }, zp: 2100, noStn: { kcal: 2.70, tbias: 3.19 }, ridgeZ: 2745 },
    // Whistler: bands from the earlier Whistler build (BTL < 1500 m, TL 1500-1900 m, ALP > 1900 m); no station correction
    // (user choice), so an overall snowfall multiplier (pScale) is tuned against the forecasts instead.
    whistler: { bandz: { btl: 1100, tl: 1700, alp: 2100 }, zp: 1500, noStn: { kcal: 1, tbias: 0 }, ridgeZ: null }
  };
  let SITE = SITES.temple;
  const BANDZ = {}; Object.assign(BANDZ, SITE.bandz);
  let ZP = SITE.zp;
  function setSite(id) { SITE = SITES[id]; Object.assign(BANDZ, SITE.bandz); ZP = SITE.zp; }
  const BANDS = ['btl', 'tl', 'alp'];
  const LAPSE = -0.0065;      // °C per m
  const DEFAULT_PARAMS = {
    // loading thresholds (a day reaches 1.0 at these)
    stormCm: 30, windCm: 20, rainMm: 10, decay: 0.2, windMin: 20, windSpan: 40,
    // weak layers
    // Weak-layer rules are FIXED (not tuned), to limit overfitting (user choice).
    // Sourced: shWind, shTmin (surface hoar: calm wind under 15 km/h, UBC ATSC 113; overnight air below about
    // -8 to -10 °C and wind under 2-3 m/s, Copernicus preprint egusphere-2026-935); grad (faceting above about
    // 10 °C per m, UBC ATSC 113). The rest are starting guesses with no source.
    clearCloud: 20,  // % cloud cover counted as a clear night (user choice)
    shWind: 10,      // km/h (2.8 m/s), sourced
    shTmin: -8,      // °C, sourced
    nsfTmin: -12,    // °C, guess
    grad: 10,        // °C per m, sourced (ground at 0 °C)
    basalDays: 7,    // guess
    basalMaxHS: 100, // cm, guess
    buryCm: 5,       // cm, guess
    surfLife: 10,    // days, guess
    pMin: 30, pMax: 100, // cm burial depth, guess
    life: 60,        // days, guess
    windLife: 10,    // days a wind slab stays a problem (tuned; storm snow fades with decay)
    // danger
    wPers: 0.45, wDeep: 0.35, c2: 0.25, c3: 0.6, c4: 1.0, c5: 1.6, supMin: 20, supSpan: 60,
    // problems
    probStorm: 0.6, probWind: 0.4, probPers: 0.5, probDeep: 0.5, probWet: 0.5,
    // warming on sunny slopes
    meltT: 1, meltSpan: 6
  };
  const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---- daily inputs, with station corrections ---- */
  function prepare(j, obs) {
    const h = j.hourly, zref = j.elevation || 3478;
    const O = (obs && obs.days) || {};
    const days = [], idx = {};
    for (let k = 0; k < h.time.length; k++) {
      const d = h.time[k].slice(0, 10);
      if (!(d in idx)) { idx[d] = days.length; days.push({ date: d, hrs: [] }); }
      days[idx[d]].hrs.push(k);
    }
    const pfOf = b => Math.max(0.35, 1 + 0.5 * (BANDZ[b] - ZP) / 1000);
    // 1. temperature bias against the ridgetop station (2745 m)
    let tb = 0, nb = 0;
    for (const D of days) {
      const o = O[D.date]; if (!o || o.ta == null) continue;
      if (!SITE.ridgeZ) break;
      const m = D.hrs.reduce((a, k) => a + (h.temperature_2m[k] ?? 0), 0) / D.hrs.length + LAPSE * (SITE.ridgeZ - zref);
      tb += o.ta - m; nb++;
    }
    // With no station readings, use the average correction measured in the tuning winters that had stations
    // (2023-24 and 2024-25: snowfall x2.70, temperature +3.19 °C). The 2025-26 test winter is left out of this average.
    const NO_STN = SITE.noStn;
    const tbias = nb >= 5 ? clamp(tb / nb, -6, 6) : NO_STN.tbias;
    // 2. snowfall scaling from treeline snow-depth gains (Bosworth Lower)
    const obsHN = (b, d) => {
      const key = b + 'HS', o = O[d], p = O[addDays(d, -1)];
      if (!o || o[key] == null || !p || p[key] == null) return null;
      return Math.max(0, o[key] - p[key]) * 1.15;
    };
    let so = 0, sm = 0;
    for (const D of days) {
      const ho = obsHN('tl', D.date); if (ho == null) continue; so += ho;
      for (const k of D.hrs) {
        const T = (h.temperature_2m[k] ?? 0) + tbias + LAPSE * (BANDZ.tl - zref);
        sm += Math.max(0, h.precipitation[k] || 0) * pfOf('tl') * clamp((2 - T) / 2, 0, 1);
      }
    }
    const stnSnow = sm > 5 && so > 2;
    const kcal = stnSnow ? clamp(so / sm, 0.4, 3) : NO_STN.kcal;
    const defaultCorr = !stnSnow || nb < 5;
    let obsDays = 0;
    for (const D of days) {
      let wsx = 0, wsy = 0, wsum = 0, n = 0, gust = 0, fl = 0, cn = 0, cnN = 0, wn = 0, sw = 0;
      for (const k of D.hrs) {
        const ws = h.wind_speed_10m[k] || 0, wd = h.wind_direction_10m[k] || 0;
        wsx += Math.sin(wd * Math.PI / 180) * ws; wsy += Math.cos(wd * Math.PI / 180) * ws; wsum += ws; n++;
        gust = Math.max(gust, h.wind_gusts_10m?.[k] || 0); fl += h.freezing_level_height?.[k] || 0;
        sw += h.shortwave_radiation?.[k] || 0;
        const hr = +h.time[k].slice(11, 13);
        if (hr <= 6) { cn += h.cloud_cover?.[k] ?? 100; wn += ws; cnN++; }
      }
      D.wind = wsum / Math.max(1, n); D.windDir = ((Math.atan2(wsx, wsy) * 180 / Math.PI) + 360) % 360;
      D.gust = gust; D.fl = fl / Math.max(1, n); D.solar = sw / 1000; // kWh/m2 per day
      D.cloudNight = cnN ? cn / cnN : 100; D.windNight = cnN ? wn / cnN : 99;
      const od = O[D.date];
      if (od && od.wind != null) { D.wind = od.wind; D.windDir = od.wdir; D.obsWind = true; }
      if (od && (od.tlHS != null || od.wind != null)) obsDays++;
      D.b = {};
      for (const b of BANDS) {
        const dT = LAPSE * (BANDZ[b] - zref) + tbias, pf = pfOf(b);
        let hn = 0, rain = 0, tmax = -99, tsum = 0, tnight = 99;
        for (const k of D.hrs) {
          const T = (h.temperature_2m[k] ?? 0) + dT, p = Math.max(0, h.precipitation[k] || 0) * pf;
          const fs = clamp((2 - T) / 2, 0, 1);
          hn += p * fs; rain += p * (1 - fs); tmax = Math.max(tmax, T); tsum += T;
          if (+h.time[k].slice(11, 13) <= 6) tnight = Math.min(tnight, T);
        }
        hn *= kcal;
        const ho = b === 'alp' ? null : obsHN(b, D.date); if (ho != null) hn = ho;
        D.b[b] = { hn, rain, tmax, tmean: tsum / Math.max(1, D.hrs.length), tnight: tnight === 99 ? tsum / Math.max(1, D.hrs.length) : tnight,
                   oHS: od && b !== 'alp' ? od[b + 'HS'] : null, oTL: od ? od.tlHS : null };
      }
    }
    return { days, zref, tbias, kcal, obsDays, h, defaultCorr };
  }

  /* ---- daily simulation per band ---- */
  function simulate(I, P) {
    const R = [];
    const st = {};
    for (const b of BANDS) st[b] = { HS: 0, SWE: 0, loose: 0, cold: 0, warm: 0, layers: [], hist: [] };
    I.days.forEach((D, i) => {
      const row = { b: {} };
      for (const b of BANDS) {
        const s = st[b], d0 = D.b[b];
        const d = P.pScale ? { ...d0, hn: d0.hn * P.pScale } : d0;   // tuned snowfall multiplier (Whistler)
        // night: surface layers form on existing snow
        if (s.HS > 10) {
          const surf = s.layers.find(L => !L.buried && L.type !== 'basal');
          const clear = D.cloudNight < P.clearCloud;
          const snowedLast3 = s.hist.slice(-3).reduce((a, x) => a + x.hn, 0);
          let type = null;
          if (clear && D.windNight < P.shWind && d.tnight < P.shTmin && d.hn < 1) type = 'sh';
          else if (clear && d.tnight < P.nsfTmin && snowedLast3 < 10) type = 'nsf';
          if (type) {
            if (surf && surf.type !== 'crust') { surf.str = Math.min(3, surf.str + 1); if (type === 'sh') surf.type = 'sh'; }
            else if (!surf) s.layers.push({ type, day: i, date: D.date, depth: 0, buried: false, str: 1, asp: [1, 1, 1, 1, 1, 1, 1, 1] });
          }
          // crusts: rain on snow, or melt on sunny slopes. One surface crust at a time: further melt days
          // strengthen it (and rain widens it to all aspects) until new snow buries it.
          const melt = d.rain > 2 ? 'rain' : (d.tmax > P.meltT && D.solar > 2) ? 'sun' : null;
          if (melt) {
            const sc = s.layers.find(L => !L.buried && L.type === 'crust');
            if (sc) { sc.str = Math.min(3, sc.str + 1); if (melt === 'rain') sc.asp = [1, 1, 1, 1, 1, 1, 1, 1]; }
            else s.layers.push({ type: 'crust', day: i, date: D.date, depth: 0, buried: false, str: 1,
                                 asp: melt === 'rain' ? [1, 1, 1, 1, 1, 1, 1, 1] : [0, 0, 1, 1, 1, 1, 1, 0] });
          }
          // basal facets: strong gradient through a thin pack (ground at 0 °C)
          const grad = (0 - d.tmean) / (Math.max(5, s.HS) / 100);
          if (grad > P.grad && s.HS < P.basalMaxHS) s.cold++;
          if (s.cold >= P.basalDays && !s.layers.some(L => L.type === 'basal'))
            s.layers.push({ type: 'basal', day: i, date: D.date, depth: s.HS, buried: true, str: 1, asp: [1, 1, 1, 1, 1, 1, 1, 1] });
        }
        // snowpack depth and water equivalent
        const melt = Math.max(0, 3 * Math.max(0, d.tmean) + 1 * Math.max(0, d.tmax - 1));
        s.SWE = Math.max(0, s.SWE + d.hn - melt + (s.HS > 0 ? Math.min(d.rain, s.SWE * 0.1) : 0));
        const prevHS = s.HS;
        s.HS = s.SWE <= 0 ? 0 : Math.min(s.SWE, Math.max(s.SWE / 3, s.HS * 0.97 + d.hn - melt / 3));
        if (d.oHS != null) { s.HS = d.oHS; s.SWE = Math.max(s.SWE, d.oHS * 2.5); }
        if (b === 'alp' && d.oTL != null && s.HS < d.oTL) { s.HS = d.oTL; s.SWE = Math.max(s.SWE, d.oTL * 2.5); }
        // burial and settlement of layers
        const ratio = prevHS > 0 ? s.HS / Math.max(prevHS + d.hn, 1) : 1;
        for (const L of s.layers) {
          if (L.type === 'basal') { L.depth = s.HS; continue; }
          L.depth = Math.max(0, (L.depth + d.hn) * Math.min(1, ratio + 0.02));
          if (!L.buried && L.depth >= P.buryCm) L.buried = true;
        }
        // warm spells heal layers; snow-free ground removes everything
        s.warm = d.tmean > 0 ? s.warm + 1 : 0;
        s.layers = s.layers.filter(L => {
          if (s.HS < 5) return false;
          const age = i - L.day;
          if (!L.buried) return age <= P.surfLife && !(D.wind > 40 && L.type === 'sh');
          if (L.type === 'basal') return s.HS < 250 || age < P.life * 2;
          if (s.warm >= 3 && L.type !== 'crust') return false;
          return age <= P.life;
        });
        // loading
        s.loose = s.loose * 0.6 + d.hn;
        s.hist.push({ hn: d.hn });
        const hn72 = s.hist.slice(-3).reduce((a, x) => a + x.hn, 0);
        const bf = b === 'btl' ? 0.2 : b === 'tl' ? 0.6 : 1;
        const transport = Math.min(40, s.loose) * clamp((D.wind - P.windMin) / P.windSpan, 0, 1) * bf;
        const down = (D.windDir + 180) % 360;
        const asp = [];
        for (let k = 0; k < 8; k++) {
          const az = k * 45, align = Math.max(0, Math.cos((az - down) * Math.PI / 180));
          const solar = Math.max(0, Math.cos((az - 180) * Math.PI / 180));
          const storm = hn72 / P.stormCm;
          const wind = transport * align * 1.6 / P.windCm;
          const wet = s.HS > 30 ? Math.max(d.rain / P.rainMm, d.tmax > P.meltT ? (d.tmax - P.meltT) / P.meltSpan * (0.4 + 0.6 * solar) : 0) : 0;
          asp.push({ storm, wind, wet, I: Math.max(storm, wind, wet) });
        }
        row.b[b] = { hn: d.hn, rain: d.rain, tmax: d.tmax, tmean: d.tmean, HS: s.HS, asp, transport,
                     layers: s.layers.filter(L => L.buried).map(L => ({ type: L.type, date: L.date, day: L.day, depth: L.depth, str: L.str, asp: L.asp })) };
      }
      R.push(row);
    });
    return R;
  }

  /* ---- assessment for one day ---- */
  const TYPEW = { sh: 1, nsf: 0.8, crust: 0.6, basal: 1 };
  function assess(I, R, i, P) {
    const out = { L: {}, main: {}, trig: {}, sup: {}, pers: {}, deep: {}, danger: {}, layers: {}, wet: {} };
    for (const b of BANDS) {
      out.L[b] = [0, 0, 0, 0, 0, 0, 0, 0]; out.main[b] = ['', '', '', '', '', '', '', ''];
      // storm snow and wet loading fade with decay; wind slabs last up to windLife days
      for (let j = Math.max(0, i - 20); j <= i; j++) {
        const w = Math.max(0, 1 - P.decay * (i - j)), ww = Math.max(0, 1 - (i - j) / Math.max(1, P.windLife));
        R[j].b[b].asp.forEach((A, k) => {
          const cand = [[A.storm * w, 'storm snow'], [A.wind * ww, 'wind slab'], [A.wet * w, 'wet']];
          for (const [v, lab] of cand) if (v > out.L[b][k]) { out.L[b][k] = v; out.main[b][k] = lab; }
        });
      }
      const r = R[i].b[b], hs = r.HS;
      out.sup[b] = clamp((hs - P.supMin) / P.supSpan, 0, 1);
      let pers = 0, deep = 0;
      for (const L of r.layers) {
        const age = i - L.day, wt = TYPEW[L.type] * Math.min(1, 0.6 + 0.2 * L.str);
        if (L.type === 'basal') { if (hs > P.pMin) deep = Math.max(deep, wt * clamp(1 - age / (P.life * 2), 0.3, 1)); continue; }
        const fade = Math.max(0, 1 - age / P.life);
        if (L.depth >= P.pMin && L.depth <= P.pMax) pers = Math.max(pers, wt * fade);
        else if (L.depth > P.pMax) deep = Math.max(deep, wt * fade * 0.8);
      }
      out.pers[b] = pers; out.deep[b] = deep; out.layers[b] = r.layers;
      const Hh = Math.max(...out.L[b]) * Math.max(0.15, out.sup[b]) + (P.wPers * pers + P.wDeep * deep) * out.sup[b];
      out.danger[b] = hs < 15 ? 1 : Hh < P.c2 ? 1 : Hh < P.c3 ? 2 : Hh < P.c4 ? 3 : Hh < P.c5 ? 4 : 5;
      out.wet[b] = out.L[b].some((v, k) => out.main[b][k] === 'wet' && v >= P.probWet);
    }
    // problems
    const probs = [];
    const anyB = f => ({ alp: f('alp') ? 1 : 0, tl: f('tl') ? 1 : 0, btl: f('btl') ? 1 : 0 });
    const has = o => o.alp || o.tl || o.btl;
    const stormB = anyB(b => Math.max(...R[i].b[b].asp.map(a => a.storm)) >= P.probStorm && out.sup[b] > 0.1);
    if (has(stormB)) probs.push({ type: 'storm', bands: stormB, asp: [1, 1, 1, 1, 1, 1, 1, 1], like: 2, size: 1.5 });
    const windAsp = [0, 0, 0, 0, 0, 0, 0, 0], windB = { alp: 0, tl: 0, btl: 0 };
    for (const b of BANDS) out.L[b].forEach((v, k) => { if (out.main[b][k] === 'wind slab' && v >= P.probWind && R[i].b[b].HS > 10) { windAsp[k] = 1; windB[b] = 1; } });
    if (windAsp.some(x => x)) probs.push({ type: 'wind', bands: windB, asp: windAsp, like: 2, size: 1.5 });
    const persB = anyB(b => out.pers[b] >= P.probPers && out.sup[b] > 0.1);
    if (has(persB)) probs.push({ type: 'persistent', bands: persB, asp: [1, 1, 1, 1, 1, 1, 1, 1], like: 2, size: 2 });
    const deepB = anyB(b => out.deep[b] >= P.probDeep && out.sup[b] > 0.1);
    if (has(deepB)) probs.push({ type: 'deep', bands: deepB, asp: [1, 1, 1, 1, 1, 1, 1, 1], like: 1, size: 3 });
    const wetB = anyB(b => out.wet[b]);
    if (has(wetB)) probs.push({ type: 'wetloose', bands: wetB, asp: [0, 0, 1, 1, 1, 1, 1, 0], like: 2, size: 1.5 });
    out.problems = probs;
    return out;
  }

  /* ---- hourly warming factor for a point (time-of-day effect on sunny slopes) ---- */
  function warming(I, hourIdx, z, aspectDeg, P) {
    const h = I.h; if (hourIdx < 0 || hourIdx >= h.time.length) return 1;
    const T = (h.temperature_2m[hourIdx] ?? 0) + I.tbias + LAPSE * (z - I.zref);
    const sw = h.shortwave_radiation?.[hourIdx] ?? 0;
    const solar = Math.max(0, Math.cos((aspectDeg - 180) * Math.PI / 180));
    if (T <= 0 || sw < 100) return 1;
    return 1 + 0.8 * clamp(T / 5, 0, 1) * clamp(sw / 600, 0, 1) * solar;
  }

  /* ---- Parks Canada station readings (Avalanche Canada weather API) to daily values ----
     tl = Bosworth Lower (snow depth), btl = Stanley (snow depth), ridge = Bosworth Upper, ridge2 = Whymper (wind, temperature).
     utcOffsetH: hours to add to UTC for local time (Mountain Standard Time = -7). */
  function stationDays(tl, btl, ridge, ridge2, utcOffsetH) {
    const ymd = ms => new Date(ms).toISOString().slice(0, 10);
    const by = {};
    const day = t => ymd(Date.parse(t) + utcOffsetH * 3600e3);
    const put = (arr, f) => (arr || []).forEach(x => { const d = day(x.measurementDateTime); (by[d] = by[d] || {}); f(by[d], x); });
    const okHS = v => v != null && v >= 0 && v < 600;
    put(tl, (o, x) => { if (okHS(x.snowHeight)) (o.tlHS = o.tlHS || []).push(x.snowHeight); });
    put(btl, (o, x) => { if (okHS(x.snowHeight)) (o.btlHS = o.btlHS || []).push(x.snowHeight); });
    const rid = (ridge && ridge.length) ? ridge : ridge2;
    put(rid, (o, x) => { if (x.windSpeedAvg != null) (o.w = o.w || []).push([x.windSpeedAvg, x.windDirAvg || 0]); if (x.airTempAvg != null) (o.ta = o.ta || []).push(x.airTempAvg); });
    const med = a => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    const out = {};
    for (const [d, o] of Object.entries(by)) {
      const r = {};
      if (o.tlHS && o.tlHS.length >= 6) r.tlHS = med(o.tlHS);
      if (o.btlHS && o.btlHS.length >= 6) r.btlHS = med(o.btlHS);
      if (o.w && o.w.length >= 6) { let sx = 0, sy = 0, s = 0; o.w.forEach(([v, a]) => { sx += Math.sin(a * Math.PI / 180) * v; sy += Math.cos(a * Math.PI / 180) * v; s += v; }); r.wind = s / o.w.length; r.wdir = ((Math.atan2(sx, sy) * 180 / Math.PI) + 360) % 360; }
      if (o.ta && o.ta.length >= 6) r.ta = o.ta.reduce((a, b) => a + b, 0) / o.ta.length;
      out[d] = r;
    }
    const n = (tl || []).length + (btl || []).length + (ridge || []).length + (ridge2 || []).length;
    return { days: out, count: n, ridgeName: (ridge && ridge.length) ? 'Bosworth Upper' : 'Whymper' };
  }

  /* ---- average model precipitation with ERA5 where both exist ---- */
  function mergeERA(j, e) {
    j.era = 0; if (!e || !e.hourly || j.eraOnly) return j;
    const m = {}; e.hourly.time.forEach((t, k) => m[t] = e.hourly.precipitation[k]);
    j.hourly.precipitation = j.hourly.precipitation.map((p, k) => { const q = m[j.hourly.time[k]]; if (q == null) return p; j.era++; return ((p || 0) + q) / 2; });
    return j;
  }

  const API = { BANDZ, BANDS, SITES, setSite, DEFAULT_PARAMS, prepare, simulate, assess, warming, addDays, stationDays, mergeERA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.TempleModel = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
