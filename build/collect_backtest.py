"""Collect data for the Mount Temple accuracy test. Runs in GitHub Actions.

For each winter (season start year Y = 2022..2025), writes build/data/temple/backtest/season_Y.json with:
  weather   Open-Meteo archived forecast models, hourly, 1 Oct Y to 31 Mar Y+1
  era5      ERA5 hourly precipitation, same period
  stations  Parks Canada stations via Avalanche Canada (Bosworth Lower 110, Stanley 108, Bosworth Upper 111, Whymper 109)
  forecasts Parks Canada daily forecasts for Mount Temple, 1 Dec Y to 31 Mar Y+1
"""
import json, os, sys, time, datetime as dt, urllib.request, urllib.parse

OUT = os.path.join(os.path.dirname(__file__), "data", "temple", "backtest")
os.makedirs(OUT, exist_ok=True)
LAT, LON = 51.3506, -116.2067
UA = {"User-Agent": "avalanche-atlas accuracy test (github.com/rexgw/avalanche-atlas)"}
HV = "temperature_2m,precipitation,rain,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m,freezing_level_height,cloud_cover,shortwave_radiation"
log = []

def get(url, timeout=120, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(5 * (k + 1))

def months(a, b):
    d = a
    while d <= b:
        e = min(b, (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1))
        yield d, e
        d = e + dt.timedelta(days=1)

def hourly(base, a, b, vars_):
    merged = None
    for s, e in months(a, b):
        j = get(f"{base}?latitude={LAT}&longitude={LON}&hourly={vars_}&start_date={s}&end_date={e}&timezone=America%2FEdmonton")
        if merged is None:
            merged = {k: j[k] for k in ("latitude", "longitude", "elevation", "utc_offset_seconds", "timezone") if k in j}
            merged["hourly"] = {k: [] for k in j["hourly"]}
        for k, v in j["hourly"].items(): merged["hourly"][k] += v
        time.sleep(1)
    return merged

def stations(a, b):
    out = {}
    for sid in (110, 108, 111, 109):
        rows = []
        t = dt.datetime.combine(a, dt.time()) + dt.timedelta(hours=7)
        end = dt.datetime.combine(b + dt.timedelta(days=1), dt.time()) + dt.timedelta(hours=7)
        while t < end:
            u = min(end, t + dt.timedelta(days=30))
            q = urllib.parse.urlencode({"fromDate": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "toDate": u.strftime("%Y-%m-%dT%H:%M:%SZ")})
            try:
                rows += get(f"https://weather.prod.avalanche.ca/stations/{sid}/measurements?{q}")
            except Exception as e:
                log.append(f"station {sid} {t:%Y-%m-%d} failed: {e!r}")
            t = u; time.sleep(0.5)
        out[str(sid)] = rows
    return out

def val(x):
    return x.get("value") if isinstance(x, dict) else x

def forecasts(a, b):
    out = []
    d = a
    while d <= b:
        try:
            j = get(f"https://api.avalanche.ca/forecasts/en/products/point?lat={LAT}&long={LON}&date={d}T19:00:00Z")
            rep = j.get("report") or {}
            dr = (rep.get("dangerRatings") or [{}])[0]
            rt = dr.get("ratings") or {}
            probs = []
            for p in rep.get("problems") or []:
                data = p.get("data") or p
                es = data.get("expectedSize") or {}
                probs.append({"type": val(p.get("type")),
                              "elevations": [val(e) for e in data.get("elevations") or []],
                              "aspects": [val(e) for e in data.get("aspects") or []],
                              "likelihood": val(data.get("likelihood")),
                              "size": [es.get("min"), es.get("max")]})
            out.append({"date": str(d), "issued": rep.get("dateIssued"),
                        "ratingsDate": (val(dr.get("date")) if isinstance(dr.get("date"), dict) else dr.get("date")),
                        "alp": val((rt.get("alp") or {}).get("rating")), "tl": val((rt.get("tln") or {}).get("rating")),
                        "btl": val((rt.get("btl") or {}).get("rating")), "problems": probs})
        except Exception as e:
            out.append({"date": str(d), "error": repr(e)})
        d += dt.timedelta(days=1); time.sleep(0.6)
    return out

years = [int(y) for y in (sys.argv[1:] or ["2022", "2023", "2024", "2025"])]
for Y in years:
    a, b = dt.date(Y, 10, 1), dt.date(Y + 1, 3, 31)
    rec = {"season": f"{Y}-{Y+1-2000:02d}", "start": str(a), "end": str(b)}
    rec["weather"] = hourly("https://historical-forecast-api.open-meteo.com/v1/forecast", a, b, HV)
    rec["era5"] = hourly("https://archive-api.open-meteo.com/v1/archive", a, b, "precipitation")
    rec["stations"] = stations(a, b)
    rec["forecasts"] = forecasts(dt.date(Y, 12, 1), b)
    n_ok = sum(1 for f in rec["forecasts"] if f.get("alp"))
    log.append(f"{rec['season']}: weather {len(rec['weather']['hourly']['time'])} h, era5 {len(rec['era5']['hourly']['time'])} h, "
               f"stations {[len(v) for v in rec['stations'].values()]}, forecasts {n_ok}/{len(rec['forecasts'])}")
    json.dump(rec, open(os.path.join(OUT, f"season_{Y}.json"), "w"), separators=(",", ":"))
    print(log[-1], flush=True)
open(os.path.join(OUT, "collect_log.txt"), "w").write("\n".join(log) + "\n")
