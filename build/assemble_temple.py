"""Assemble index.html for Mount Temple.
Usage: python3 -I assemble_temple.py template.html terrain.json routes.json weather_60d.json history.json three.bundle.js out.html"""
import sys, json
tpl, terr, routes, wx, hist, three, out = sys.argv[1:8]
t = open(tpl).read()
js = open(three).read()
assert "</script" not in js.lower()
w = json.load(open(wx)); h = w["hourly"]
keep = ["time", "temperature_2m", "precipitation", "rain", "snowfall", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "freezing_level_height"]
snap = {"elevation": w.get("elevation"), "utc_offset_seconds": w.get("utc_offset_seconds"), "timezone": w.get("timezone"),
        "hourly": {k: h[k] for k in keep if k in h}}
import os
era = os.path.join(os.path.dirname(wx), "weather_era5.json")
if os.path.exists(era):
    e = json.load(open(era)); snap["era5"] = {"hourly": {"time": e["hourly"]["time"], "precipitation": e["hourly"]["precipitation"]}}
for k, f in (("/*__TERRAIN__*/null", open(terr).read()), ("/*__ROUTES__*/null", open(routes).read()),
             ("/*__WXSNAP__*/null", json.dumps(snap, separators=(",", ":"))), ("/*__HISTORY__*/null", json.dumps(json.load(open(hist)), separators=(",", ":")))):
    assert t.count(k) == 1, k
    assert "</script" not in f.lower()
    t = t.replace(k, f)
t = t.replace("/*__THREE__*/", "/* three.js r187, MIT licence, https://threejs.org */\n" + js, 1)
open(out, "w").write(t)
print("wrote", out, round(len(t) / 1e6, 2), "MB")
