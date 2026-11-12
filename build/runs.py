"""Build ski runs, lifts and designated uphill routes from OpenStreetMap data.

Usage: python3 -I runs.py <terrain.json> <skimap_dir> <routes_in.json> <routes_out.json> <runs_out.json>

skimap_dir holds z12 tiles of OpenSkiMap-derived OSM features (downhill runs, lifts,
ski touring ways), copied from github.com/kcluit/monkeysnow (frontend/public/skimap/12).
Data (c) OpenStreetMap contributors, ODbL.
"""
import sys, json, glob, gzip, base64, heapq, re
import numpy as np

tjson, skdir, rin, rout, runsout = sys.argv[1:6]
T = json.load(open(tjson)); M = T["meta"]
W, H, RES = M["W"], M["H"], M["res"]
def dec(k, dt):
    return np.frombuffer(gzip.decompress(base64.b64decode(T[k])), dtype=dt).reshape(H, W).astype(float)
z = dec("elev", "<i2"); slope = dec("slope", "u1")

def to_grid(lat, lon):
    return ((lon - M["lonW"]) * M["mx"] / RES, (M["latN"] - lat) * M["my"] / RES)
def to_ll(x, y):
    return (M["latN"] - y * RES / M["my"], M["lonW"] + x * RES / M["mx"])
def zat(x, y):
    return z[min(H - 1, max(0, int(y))), min(W - 1, max(0, int(x)))]

feats = {}
for f in sorted(glob.glob(f"{skdir}/*.json")):
    for o in json.load(open(f)):
        feats[o["id"]] = o
inside = lambda o: all(M["latN"] - H * RES / M["my"] <= p[0] <= M["latN"] and M["lonW"] <= p[1] <= M["lonW"] + W * RES / M["mx"] for p in o["coords"])
feats = {k: o for k, o in feats.items() if inside(o)}

# Whistler vs Blackcomb: split along Fitzsimmons Creek
A, B = to_grid(50.1180, -122.9560), to_grid(50.0640, -122.8720)
def mountain(pts):
    x = np.mean([p[0] for p in pts]); y = np.mean([p[1] for p in pts])
    s = (B[0] - A[0]) * (y - A[1]) - (B[1] - A[1]) * (x - A[0])
    return "Blackcomb" if s < 0 else "Whistler"

def chain(parts, tol=2.0):
    """Greedily join segments whose ends meet (within tol cells)."""
    parts = [list(p) for p in parts if len(p) >= 2]
    out = []
    while parts:
        cur = parts.pop(0); grown = True
        while grown:
            grown = False
            for i, p in enumerate(parts):
                d = lambda a, b: np.hypot(a[0] - b[0], a[1] - b[1])
                if d(cur[-1], p[0]) < tol: cur += p[1:]
                elif d(cur[-1], p[-1]) < tol: cur += p[::-1][1:]
                elif d(cur[0], p[-1]) < tol: cur = p + cur[1:]
                elif d(cur[0], p[0]) < tol: cur = p[::-1] + cur[1:]
                else: continue
                parts.pop(i); grown = True; break
        out.append(cur)
    return out

def downhill(p):
    return p if zat(*p[0]) >= zat(*p[-1]) else p[::-1]

def q(p):  # quantise grid coords to 0.1 cell
    return [v for xy in p for v in (round(xy[0] * 10), round(xy[1] * 10))]

DIFF = {"novice": 0, "easy": 0, "intermediate": 1, "advanced": 2, "expert": 3, "freeride": 4, None: 5}
groups = {}
areas = []
for o in feats.values():
    if o["kind"] != "downhill": continue
    g = [to_grid(a, b) for a, b in o["coords"]]
    names = [n.strip() for n in (o.get("name") or "").split(",") if n.strip()] or [""]
    if o.get("area"):
        areas.append((names[0], o.get("difficulty"), g)); continue
    for n in names:
        key = n if n else "_" + o["id"]
        G_ = groups.setdefault(key, {"name": n or "Unnamed run", "diff": [], "parts": []})
        G_["parts"].append(g); G_["diff"].append(o.get("difficulty"))

def pick_diff(ds):
    ds = [d for d in ds if d]
    if not ds: return 5
    return max(DIFF[d] for d in ds if d in DIFF) if any(d in DIFF for d in ds) else 5

runs = []
for key, G_ in groups.items():
    parts = [downhill(p) for p in chain(G_["parts"])]
    parts.sort(key=lambda p: -zat(*p[0]))
    allp = [xy for p in parts for xy in p]
    runs.append({"n": G_["name"], "d": pick_diff(G_["diff"]), "m": mountain(allp), "a": 0, "p": [q(p) for p in parts]})
line_names = {r["n"].lower() for r in runs}
for n, d, g in areas:
    if n and n.lower() in line_names: continue
    runs.append({"n": n or "Unnamed area", "d": DIFF.get(d, 5), "m": mountain(g), "a": 1, "p": [q(g)]})
runs.sort(key=lambda r: (r["m"], r["n"]))

lifts = []
for o in feats.values():
    if o["kind"] != "lift": continue
    g = [to_grid(a, b) for a, b in o["coords"]]
    lifts.append({"n": (o.get("name") or "Lift").split(",")[0].strip(), "t": o.get("liftType", ""), "p": q(g)})

# ---------- designated uphill routes ----------
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
def travel_path(a, b, margin=40):
    ax, ay = int(a[0]), int(a[1]); bx, by = int(b[0]), int(b[1])
    x0, x1 = max(0, min(ax, bx) - margin), min(W - 1, max(ax, bx) + margin)
    y0, y1 = max(0, min(ay, by) - margin), min(H - 1, max(ay, by) + margin)
    dist = {(ax, ay): 0.0}; prev = {}; pq = [(0.0, ax, ay)]
    while pq:
        dc, x, y = heapq.heappop(pq)
        if (x, y) == (bx, by): break
        if dc > dist.get((x, y), 1e18): continue
        for dx, dy in NB:
            nx, ny = x + dx, y + dy
            if not (x0 <= nx <= x1 and y0 <= ny <= y1): continue
            s = slope[ny, nx]
            if s > 40 and (nx, ny) != (bx, by): continue
            step = RES * (1.4142 if dx and dy else 1.0)
            dzv = z[ny, nx] - z[y, x]
            nd = dc + step * (1 + max(0, s - 22) / 8.0) + max(0, dzv) * 7 + max(0, -dzv) * 0.5
            if nd < dist.get((nx, ny), 1e18):
                dist[(nx, ny)] = nd; prev[(nx, ny)] = (x, y); heapq.heappush(pq, (nd, nx, ny))
    path = [(bx, by)]
    while path[-1] != (ax, ay): path.append(prev[path[-1]])
    return [(x + 0.5, y + 0.5) for x, y in path[::-1]]

def uphill_route(names, start_ll, max_gap_cells=2.0):
    segs = [[to_grid(a, b) for a, b in o["coords"]] for o in feats.values()
            if o["kind"] in ("skitour", "downhill") and any(n in (o.get("name") or "") for n in names)
            and not o.get("area")]
    # order segments by walking from the start point to the nearest unused end
    cur = to_grid(*start_ll); pts = [cur]; filled = 0
    while segs:
        best = min(((min(np.hypot(s[0][0] - cur[0], s[0][1] - cur[1]), np.hypot(s[-1][0] - cur[0], s[-1][1] - cur[1])), i) for i, s in enumerate(segs)))
        s = segs.pop(best[1])
        if np.hypot(s[-1][0] - cur[0], s[-1][1] - cur[1]) < np.hypot(s[0][0] - cur[0], s[0][1] - cur[1]): s = s[::-1]
        if best[0] > max_gap_cells:
            gap = travel_path(cur, s[0]); filled += len(gap) * RES; pts += gap[1:]
        pts += s[1:] if np.hypot(s[0][0] - pts[-1][0], s[0][1] - pts[-1][1]) < 0.3 else s
        cur = pts[-1]
    return [list(to_ll(x, y)) for x, y in pts[1:]], filled

R = json.load(open(rin))
sp, f1 = uphill_route(["Singing Pass Trail"], (50.1132, -122.9522))
bc, f2 = uphill_route(["Blackcomb Bench Climb", "South Ascent Route"], (50.1102, -122.9443))
print("Singing Pass gap-filled m:", f1, "Blackcomb gap-filled m:", f2)
R["routes"] = [r for r in R["routes"] if r.get("group") != "uphill"]
R["routes"] += [
    {"id": "singing", "name": "Singing Pass Trail", "kind": "osm", "group": "uphill",
     "note": "Designated uphill route on Whistler, from the valley to the Garibaldi Park boundary near Russet Lake. The only snowshoe access to the park from Whistler. OpenStreetMap trace.",
     "pts": [[round(a, 5), round(b, 5)] for a, b in sp]},
    {"id": "southroute", "name": "Blackcomb Bench Climb and South Route", "kind": "osm", "group": "uphill",
     "note": "Designated uphill routes on Blackcomb: Bench Climb from Base II, then the South Route to the park boundary. The South Route is time-restricted (5:00 to 9:30 a.m.). Snowshoes are allowed on the Bench Climb but not the South Route. OpenStreetMap trace" + (f"; about {round(f2, -1):.0f} m of missing trace filled with a least-effort terrain path." if f2 else "."),
     "pts": [[round(a, 5), round(b, 5)] for a, b in bc]},
]
json.dump(R, open(rout, "w"))
json.dump({"runs": runs, "lifts": lifts,
           "credit": "Runs and lifts (c) OpenStreetMap contributors (ODbL), via OpenSkiMap"}, open(runsout, "w"), separators=(",", ":"))
print(len(runs), "runs", sum(1 for r in runs if r["a"]), "areas", len(lifts), "lifts")
print({m: sum(1 for r in runs if r["m"] == m) for m in ("Whistler", "Blackcomb")})
