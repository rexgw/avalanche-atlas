"""Assemble index.html for a site.
Usage: python3 -I assemble_site.py <site> <template.html> <terrain.json> <routes.json> <runs.json or -> <three.bundle.js> <out.html>
Reads build/data/<site>/weather_60d.json (+ weather_era5.json), history.json and backtest/params.json + summary.json."""
import sys, json, os
site, tpl, terr, routes, runs, three, out = sys.argv[1:8]
here = os.path.dirname(os.path.abspath(__file__))
dd = os.path.join(here, "data", site)
t = open(tpl).read()
js = open(three).read(); assert "</script" not in js.lower()
w = json.load(open(os.path.join(dd, "weather_60d.json"))); h = w["hourly"]
keep = ["time", "temperature_2m", "precipitation", "rain", "snowfall", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "freezing_level_height", "cloud_cover", "shortwave_radiation"]
snap = {"elevation": w.get("elevation"), "utc_offset_seconds": w.get("utc_offset_seconds"), "timezone": w.get("timezone"), "hourly": {k: h[k] for k in keep if k in h}}
era = os.path.join(dd, "weather_era5.json")
if os.path.exists(era):
    e = json.load(open(era)); snap["era5"] = {"hourly": {"time": e["hourly"]["time"], "precipitation": e["hourly"]["precipitation"]}}
subs = [("/*__TERRAIN__*/null", open(terr).read()), ("/*__ROUTES__*/null", open(routes).read()),
        ("/*__WXSNAP__*/null", json.dumps(snap, separators=(",", ":"))),
        ("/*__HISTORY__*/null", json.dumps(json.load(open(os.path.join(dd, "history.json"))), separators=(",", ":")))]
if runs != "-": subs.append(("/*__RUNS__*/null", open(runs).read()))
for k, f in subs:
    assert t.count(k) == 1, k
    assert "</script" not in f.lower()
    t = t.replace(k, f)
model = open(os.path.join(here, "model.js")).read(); assert "</script" not in model.lower()
t = t.replace("/*__MODEL__*/", model, 1)
for key, fn in (("/*__PARAMS__*/null", "params.json"), ("/*__ACCURACY__*/null", "summary.json")):
    p = os.path.join(dd, "backtest", fn)
    if os.path.exists(p): t = t.replace(key, json.dumps(json.load(open(p)), separators=(",", ":")), 1)
t = t.replace("/*__THREE__*/", "/* three.js r187, MIT licence, https://threejs.org */\n" + js, 1)
open(out, "w").write(t)
print("wrote", out, round(len(t) / 1e6, 2), "MB")
