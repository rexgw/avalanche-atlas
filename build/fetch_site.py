"""Fetch source data for a site build (SITE=temple or SITE=whistler). Runs in GitHub Actions (needs open internet).

Writes to build/data/<SITE>/:
  dem.tif           USGS 1 arc-second DEM cropped to the study area (public domain)
  osm_paths.json    OpenStreetMap trails and roads in the study area (ODbL, via Overpass)
  weather_60d.json  Open-Meteo hourly weather, 61 past days + 2 forecast days (snapshot fallback)
  avcan_point.json  Avalanche Canada forecast product for the site point
  avcan_stations.json, station_<id>.json  Avalanche Canada weather stations near the area
"""
import json, os, sys, time, urllib.request, urllib.parse, math, traceback

SITES = {
    "temple":   dict(bbox=(-116.30, 51.30, -116.12, 51.43), pt=(51.3506, -116.2067), tile="n52w117",
                     cop="Copernicus_DSM_COG_10_N51_00_W117_00_DEM"),
    "whistler": dict(bbox=(-123.000, 50.000, -122.760, 50.185), pt=(50.0640, -122.9560), tile="n51w123",
                     cop="Copernicus_DSM_COG_10_N50_00_W123_00_DEM"),
}
SITE = os.environ.get("SITE", "temple")
OUT = os.path.join(os.path.dirname(__file__), "data", SITE)
os.makedirs(OUT, exist_ok=True)
W, S, E, N = SITES[SITE]["bbox"]                 # study area
LAT, LON = SITES[SITE]["pt"]                     # weather and forecast point
UA = {"User-Agent": "avalanche-atlas build (github.com/rexgw/avalanche-atlas)"}
log = []

def get(url, data=None, timeout=120):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def step(name, fn):
    try:
        fn(); log.append(f"OK   {name}")
    except Exception as e:
        log.append(f"FAIL {name}: {e!r}"); traceback.print_exc()

def dem():
    import rasterio
    from rasterio.windows import from_bounds
    t, c = SITES[SITE]["tile"], SITES[SITE]["cop"]
    srcs = [f"https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/{t}/USGS_1_{t}.tif",
            f"https://copernicus-dem-30m.s3.amazonaws.com/{c}/{c}.tif"]
    for u in srcs:
        try:
            raw = get(u, timeout=600); open("/tmp/tile.tif", "wb").write(raw); src_url = u; break
        except Exception as e:
            log.append(f"     dem source failed {u}: {e!r}")
    else:
        raise RuntimeError("no DEM source reachable")
    with rasterio.open("/tmp/tile.tif") as src:
        from rasterio.windows import Window
        win = from_bounds(W - 0.02, S - 0.015, E + 0.02, N + 0.015, src.transform).round_offsets().round_lengths()
        # Clip to the tile: a window starting outside the tile is read from the tile edge, while its transform
        # keeps the requested origin, which shifts the data (this shifted Whistler by ~0.018 deg).
        win = win.intersection(Window(0, 0, src.width, src.height))
        z = src.read(1, window=win); prof = src.profile.copy()
        prof.update(width=z.shape[1], height=z.shape[0], transform=src.window_transform(win), compress="deflate", tiled=False)
        prof.pop("blockxsize", None); prof.pop("blockysize", None)
    with rasterio.open(os.path.join(OUT, "dem.tif"), "w", **prof) as dst:
        dst.write(z, 1)
    json.dump({"source": src_url}, open(os.path.join(OUT, "dem_source.json"), "w"))

def osm():
    q = f"""[out:json][timeout:120];
(way["highway"~"path|footway|track|bridleway|steps|unclassified|tertiary|service"]({S},{W},{N},{E});
 node["natural"="peak"]({S},{W},{N},{E});
 node["tourism"~"alpine_hut|wilderness_hut|viewpoint"]({S},{W},{N},{E});
 way["natural"="water"]({S},{W},{N},{E}););
out geom tags;"""
    raw = None
    for attempt in range(3):
        for ep in ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
                   "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]:
            try:
                raw = get(ep, data=urllib.parse.urlencode({"data": q}).encode(), timeout=300); break
            except Exception as e:
                log.append(f"     overpass failed {ep}: {e!r}")
        if raw: break
        time.sleep(30)
    if not raw:
        raise RuntimeError("overpass unreachable")
    open(os.path.join(OUT, "osm_paths.json"), "wb").write(raw)

def weather():
    hv = "temperature_2m,precipitation,rain,snowfall,snow_depth,wind_speed_10m,wind_direction_10m,wind_gusts_10m,freezing_level_height,shortwave_radiation,relative_humidity_2m"
    u = ("https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode({
        "latitude": LAT, "longitude": LON, "hourly": hv, "past_days": 61, "forecast_days": 2,
        "timezone": "America/Edmonton", "models": "best_match"}))
    open(os.path.join(OUT, "weather_60d.json"), "wb").write(get(u))
    # ERA5 for the same window, used to check the forecast-model archive
    import datetime as dt
    end = dt.date.today() - dt.timedelta(days=6); start = dt.date.today() - dt.timedelta(days=61)
    u2 = ("https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode({
        "latitude": LAT, "longitude": LON, "start_date": start.isoformat(), "end_date": end.isoformat(),
        "hourly": "temperature_2m,precipitation,snowfall,wind_speed_10m,wind_direction_10m", "timezone": "America/Edmonton"}))
    open(os.path.join(OUT, "weather_era5.json"), "wb").write(get(u2))

def avcan():
    for u in [f"https://api.avalanche.ca/forecasts/en/products/point?lat={LAT}&long={LON}",
              f"https://avcan-services-api.prod.avalanche.ca/forecasts/en/products/point?lat={LAT}&long={LON}"]:
        try:
            open(os.path.join(OUT, "avcan_point.json"), "wb").write(get(u)); return
        except Exception as e:
            log.append(f"     avcan point failed {u}: {e!r}")
    raise RuntimeError("avcan point unreachable")

def stations():
    st = json.loads(get("https://weather.prod.avalanche.ca/stations"))
    json.dump(st, open(os.path.join(OUT, "avcan_stations.json"), "w"))
    items = st if isinstance(st, list) else st.get("data", st.get("stations", []))
    near = []
    for s in items:
        try:
            la = float(s.get("latitude") or s.get("lat")); lo = float(s.get("longitude") or s.get("lng") or s.get("lon"))
        except Exception:
            continue
        d = math.hypot((la - LAT) * 111, (lo - LON) * 70)
        if d < 25: near.append((d, s))
    near.sort(key=lambda t: t[0])
    import datetime as dt
    fr = (dt.datetime.utcnow() - dt.timedelta(days=61)).strftime("%Y-%m-%dT00:00:00Z")
    to = dt.datetime.utcnow().strftime("%Y-%m-%dT%H:00:00Z")
    for d, s in near[:4]:
        sid = s.get("stationId") or s.get("id")
        base = f"https://weather.prod.avalanche.ca/stations/{sid}/measurements"
        tries = [base + "?" + urllib.parse.urlencode({"fromDate": fr[:10], "toDate": to[:10]}),
                 base + "?" + urllib.parse.urlencode({"fromDate": fr[:19], "toDate": to[:19]})]
        # also week by week, in case long ranges are refused
        import datetime as dt2
        t0 = dt2.date.today() - dt2.timedelta(days=61)
        chunks = []
        for t in tries:
            try:
                m = get(t); open(os.path.join(OUT, f"station_{sid}.json"), "wb").write(m)
                log.append(f"     station {sid} {s.get('name')} {d:.1f} km ok"); break
            except Exception as e:
                log.append(f"     station {sid} try failed {t[-60:]}: {e!r}")
        else:
            for k in range(0, 63, 7):
                a = t0 + dt2.timedelta(days=k); b = min(dt2.date.today(), a + dt2.timedelta(days=7))
                try:
                    chunks.append(json.loads(get(base + "?" + urllib.parse.urlencode({"fromDate": a.isoformat(), "toDate": b.isoformat()}))))
                except Exception as e:
                    log.append(f"     station {sid} chunk {a} failed: {e!r}")
            if chunks:
                json.dump(chunks, open(os.path.join(OUT, f"station_{sid}.json"), "w"))
                log.append(f"     station {sid} {s.get('name')} {d:.1f} km ok in {len(chunks)} chunks")

only = sys.argv[1:] or ["dem", "osm", "weather", "avcan point", "stations"]
for name, fn in [("dem", dem), ("osm", osm), ("weather", weather), ("avcan point", avcan), ("stations", stations)]:
    if name not in only: continue
    step(name, fn)
open(os.path.join(OUT, "fetch_log.txt"), "a").write("\n".join(log) + "\n")
print("\n".join(log))
