"""Build existing routes. Usage: python3 -I routes.py <terrain.npz> <gpx_dir> <terrain.json> <out.json>"""
import sys, json, re, heapq
import numpy as np

npz, gpx_dir, tjson, out = sys.argv[1:5]
d = np.load(npz)
meta = json.load(open(tjson))["meta"]
z = d["elev"].astype(float); slope = d["slope"].astype(float)
H, W, RES = meta["H"], meta["W"], meta["res"]

def to_grid(lat, lon):
    return ((lon - meta["lonW"]) * meta["mx"] / RES, (meta["latN"] - lat) * meta["my"] / RES)

def to_ll(x, y):
    return (meta["latN"] - y * RES / meta["my"], meta["lonW"] + x * RES / meta["mx"])

def snap_peak(lat, lon, radius_m=500):
    x, y = to_grid(lat, lon); r = int(radius_m / RES)
    x0, x1 = max(0, int(x) - r), min(W, int(x) + r + 1)
    y0, y1 = max(0, int(y) - r), min(H, int(y) + r + 1)
    sub = z[y0:y1, x0:x1]
    j, i = np.unravel_index(np.argmax(sub), sub.shape)
    return to_ll(x0 + i + 0.5, y0 + j + 0.5), float(sub[j, i])

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def travel_path(a, b, margin=60):
    """Least-effort path ignoring avalanche hazard (how people actually move)."""
    ax, ay = map(int, to_grid(*a)); bx, by = map(int, to_grid(*b))
    x0, x1 = max(0, min(ax, bx) - margin), min(W - 1, max(ax, bx) + margin)
    y0, y1 = max(0, min(ay, by) - margin), min(H - 1, max(ay, by) + margin)
    dist = {(ax, ay): 0.0}; prev = {}
    pq = [(0.0, ax, ay)]
    while pq:
        dc, x, y = heapq.heappop(pq)
        if (x, y) == (bx, by): break
        if dc > dist.get((x, y), 1e18): continue
        for dx, dy in NB:
            nx, ny = x + dx, y + dy
            if not (x0 <= nx <= x1 and y0 <= ny <= y1): continue
            s = slope[ny, nx]
            if s > 45 and (nx, ny) != (bx, by): continue
            step = RES * (1.4142 if dx and dy else 1.0)
            dzv = z[ny, nx] - z[y, x]
            cost = step * (1 + max(0, s - 22) / 8.0) + max(0, dzv) * 7 + max(0, -dzv) * 0.5
            nd = dc + cost
            if nd < dist.get((nx, ny), 1e18):
                dist[(nx, ny)] = nd; prev[(nx, ny)] = (x, y)
                heapq.heappush(pq, (nd, nx, ny))
    path = [(bx, by)]
    while path[-1] != (ax, ay):
        path.append(prev[path[-1]])
    path.reverse()
    return [to_ll(x + 0.5, y + 0.5) for x, y in path]

def smooth(pts, k=3):
    if len(pts) < 2 * k + 1: return pts
    a = np.array(pts); o = a.copy()
    for i in range(k, len(a) - k):
        o[i] = a[i - k:i + k + 1].mean(0)
    return [tuple(p) for p in o]

def build(wps):
    pts = []
    for a, b in zip(wps[:-1], wps[1:]):
        seg = travel_path(a, b)
        pts += seg if not pts else seg[1:]
    return smooth(pts)

def gpx_wpts(path):
    s = open(path).read()
    return {n: (float(a), float(b)) for a, b, n in re.findall(r'<wpt lat="([-\d.]+)" lon="([-\d.]+)".*?<name>([^<]*)</name>', s, re.S)}

def gpx_track(path):
    s = open(path).read()
    return [(float(a), float(b)) for a, b in re.findall(r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)"', s)]

wp = gpx_wpts(f"{gpx_dir}/gpx_1395.gpx")
whistler_pk, wz = snap_peak(50.0592, -122.9650, 300)
piccolo, pz = snap_peak(50.0465, -122.9488, 300)
oboe, oz = snap_peak(50.0345, -122.9080, 450)
print("Whistler Pk", whistler_pk, wz, "Piccolo", piccolo, pz, "Oboe", oboe, oz)

spearhead_order = ["BLACKCOMB", "DECKER_ACT", "PATTISON_PK", "TREMOR_PK", "SHUDDER_PK", "QUIVER_PK",
                   "RIPSAW_NPK", "RIPSAW_SPK", "COULOIRRDG", "IAGO_PK", "FITZSIM_PK", "BENVOLIO P",
                   "OVRLRD_GAP", "FISSILE_COL", "RUSSET_HUT", "SINGING_PAS"]
spear = [wp[n] for n in spearhead_order] + [oboe, wp["FLUTE_PK"], piccolo, whistler_pk]
bumps = [whistler_pk, piccolo, wp["FLUTE_PK"], oboe, wp["SINGING_PAS"], wp["RUSSET_HUT"]]

wedge = gpx_track(f"{gpx_dir}/gpx_pb_971240.gpx")

def thin(pts, every=1):
    return [[round(a, 5), round(b, 5)] for a, b in pts[::every]]

routes = [
    {"id": "spearhead", "name": "Spearhead Traverse", "kind": "approx",
     "note": "Approximate: landmark waypoints (Blackcomb, Decker, Tremor, Shudder, Ripsaw, Iago, Fitzsimmons, Overlord gap, Russet Hut, Singing Pass, Musical Bumps) joined by a least-effort terrain path. Some waypoints are summits, so gain and steepest slope run high; the real line uses cols and glaciers.",
     "pts": thin(build(spear))},
    {"id": "bumps", "name": "Musical Bumps to Russet Hut", "kind": "approx",
     "note": "Approximate: Whistler Peak, Piccolo, Flute, Oboe, Singing Pass, Russet Hut joined by a least-effort terrain path.",
     "pts": thin(build(bumps))},
    {"id": "wedge", "name": "Wedgemount Lake & Wedge Mountain", "kind": "gps",
     "note": "Real GPS track (Peakbagger, recorded by Sean Caulfield). Summer trail line; winter routes may differ.",
     "pts": thin(wedge)},
]
NAMES = {"BENVOLIO P": "Benvolio", "BLACKCOMB": "Blackcomb", "COULOIRRDG": "Couloir Ridge", "DECKER_ACT": "Decker",
         "FISSILE_COL": "Fissile Col", "FITZSIM_PK": "Fitzsimmons", "FLUTE_PK": "Flute", "IAGO_PK": "Iago",
         "OVERLORD_PK": "Overlord", "OVRLRD_GAP": "Overlord Gap", "PATTISON_PK": "Pattison", "QUIVER_PK": "Quiver",
         "RIPSAW_NPK": "Ripsaw N", "RIPSAW_SPK": "Ripsaw S", "RUSSET_HUT": "Russet Hut", "RUSSETLAKE": "Russet Lake",
         "SHUDDER_PK": "Shudder", "SINGING_PAS": "Singing Pass", "TREMOR_PK": "Tremor"}
landmarks = [{"name": NAMES.get(n, n.title()), "lat": a, "lon": b}
             for n, (a, b) in wp.items() if n not in ("WHISTLER_V", "OVRLRD_GAP", "RUSSETLAKE", "RIPSAW_SPK")]
landmarks += [{"name": "Whistler Peak", "lat": whistler_pk[0], "lon": whistler_pk[1]},
              {"name": "Piccolo", "lat": piccolo[0], "lon": piccolo[1]},
              {"name": "Oboe", "lat": oboe[0], "lon": oboe[1]},
              {"name": "Whistler Village", "lat": 50.1163, "lon": -122.9574},
              {"name": "Wedge Mountain", "lat": wedge and max(wedge, key=lambda p: z[int(to_grid(*p)[1]), int(to_grid(*p)[0])])[0],
               "lon": wedge and max(wedge, key=lambda p: z[int(to_grid(*p)[1]), int(to_grid(*p)[0])])[1]},
              {"name": "Wedgemount Lake", "lat": 50.16323, "lon": -122.81621}]
for r in routes:
    print(r["name"], len(r["pts"]))
json.dump({"routes": routes, "landmarks": landmarks}, open(out, "w"))
