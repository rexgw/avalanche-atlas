"""Build Mount Temple area routes from OpenStreetMap trails.

Usage: python3 -I routes_temple.py <terrain.npz> <osm_paths.json> <terrain.json> <out.json>
Each route follows the OSM trail network between named end points (Dijkstra, named trails preferred).
Gaps the network does not cover (e.g. the last scramble pitch to a summit) use a least-effort terrain path.
"""
import sys, json, heapq, math
import numpy as np

npz, osm_path, tjson, out = sys.argv[1:5]
d = np.load(npz); meta = json.load(open(tjson))["meta"]
z = d["elev"].astype(float); slope = d["slope"].astype(float)
H, W, RES = meta["H"], meta["W"], meta["res"]
to_grid = lambda lat, lon: ((lon - meta["lonW"]) * meta["mx"] / RES, (meta["latN"] - lat) * meta["my"] / RES)
to_ll = lambda x, y: (meta["latN"] - y * RES / meta["my"], meta["lonW"] + x * RES / meta["mx"])
def elev(lat, lon):
    x, y = to_grid(lat, lon); return z[min(H-1, max(0, int(y))), min(W-1, max(0, int(x)))]
def dist(a, b):
    return math.hypot((a[0]-b[0]) * 111195, (a[1]-b[1]) * 111195 * math.cos(math.radians(a[0])))

osm = json.load(open(osm_path))["elements"]
ways = [e for e in osm if e["type"] == "way" and "highway" in e.get("tags", {})]
peaks = {e["tags"].get("name"): (e["lat"], e["lon"]) for e in osm if e["type"] == "node" and e["tags"].get("natural") == "peak"}

# graph
key = lambda p: (round(p[0], 7), round(p[1], 7))
adj = {}
def add(a, b, w, name):
    adj.setdefault(a, []).append((b, w, name)); adj.setdefault(b, []).append((a, w, name))
for e in ways:
    g = [(p["lat"], p["lon"]) for p in e["geometry"]]; nm = e["tags"].get("name")
    for a, b in zip(g[:-1], g[1:]):
        add(key(a), key(b), dist(a, b), nm)
nodes = list(adj)

def nearest(p):
    return min(nodes, key=lambda n: dist(n, p))

def osm_path(a, b, prefer):
    s, t = nearest(a), nearest(b)
    D = {s: 0.0}; P = {}; pq = [(0.0, s)]
    while pq:
        dc, u = heapq.heappop(pq)
        if u == t: break
        if dc > D[u]: continue
        for v, w, nm in adj[u]:
            c = w * (1.0 if nm in prefer else 4.0)
            if dc + c < D.get(v, 1e18):
                D[v] = dc + c; P[v] = u; heapq.heappush(pq, (dc + c, v))
    if t not in D: return None
    path = [t]
    while path[-1] != s: path.append(P[path[-1]])
    return path[::-1]

NB = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
def travel_path(a, b, margin=40):
    ax, ay = map(int, to_grid(*a)); bx, by = map(int, to_grid(*b))
    x0, x1 = max(0, min(ax, bx)-margin), min(W-1, max(ax, bx)+margin)
    y0, y1 = max(0, min(ay, by)-margin), min(H-1, max(ay, by)+margin)
    D = {(ax, ay): 0.0}; P = {}; pq = [(0.0, ax, ay)]
    while pq:
        dc, x, y = heapq.heappop(pq)
        if (x, y) == (bx, by): break
        if dc > D.get((x, y), 1e18): continue
        for dx, dy in NB:
            nx, ny = x+dx, y+dy
            if not (x0 <= nx <= x1 and y0 <= ny <= y1): continue
            s = slope[ny, nx]
            if s > 45 and (nx, ny) != (bx, by): continue
            step = RES * (1.4142 if dx and dy else 1.0); dz = z[ny, nx] - z[y, x]
            c = dc + step * (1 + max(0, s-22)/8.0) + max(0, dz)*7 + max(0, -dz)*0.5
            if c < D.get((nx, ny), 1e18):
                D[(nx, ny)] = c; P[(nx, ny)] = (x, y); heapq.heappush(pq, (c, nx, ny))
    path = [(bx, by)]
    while path[-1] != (ax, ay): path.append(P[path[-1]])
    return [to_ll(x+0.5, y+0.5) for x, y in path[::-1]]

def named_pts(name):
    return [(p["lat"], p["lon"]) for e in ways if e["tags"].get("name") == name for p in e["geometry"]]
def low_end(name):  return min(named_pts(name), key=lambda p: elev(*p))
def high_end(name): return max(named_pts(name), key=lambda p: elev(*p))
def summit(name, r=250):
    lat, lon = peaks[name]; x, y = to_grid(lat, lon); k = int(r / RES)
    xa, xb, ya, yb = max(0, int(x)-k), min(W, int(x)+k+1), max(0, int(y)-k), min(H, int(y)+k+1)
    j, i = np.unravel_index(np.argmax(z[ya:yb, xa:xb]), (yb-ya, xb-xa))
    return to_ll(xa+i+0.5, ya+j+0.5)

def build(wps, prefer, gap_m=120):
    pts = []
    for a, b in zip(wps[:-1], wps[1:]):
        seg = None
        if dist(nearest(a), a) < gap_m and dist(nearest(b), b) < gap_m:
            seg = osm_path(a, b, prefer)
        if seg is None:
            na, nb = nearest(a), nearest(b)
            # on-network part to the nearest node, then terrain path for the gap
            part = []
            if dist(na, a) < gap_m and dist(nb, b) >= gap_m:
                # walk the network toward b as far as it gets closest, then terrain
                cand = min((n for n in nodes if any(nm in prefer for _, _, nm in adj[n])), key=lambda n: dist(n, b))
                part = osm_path(a, cand, prefer) or [a]
                part = part + travel_path(part[-1], b)[1:]
            else:
                part = travel_path(a, b)
            seg = part
        pts += seg if not pts else seg[1:]
    return [[round(a, 5), round(b, 5)] for a, b in pts]

# trailheads
moraine = low_end("Larch Valley Trail")   # Larch Valley trailhead at Moraine Lake
pv_th   = low_end("Paradise Valley Trail")
ll_shore = nearest((51.4169, -116.2178))   # Lake Louise shoreline at the Chateau
mlr_bot = low_end("Moraine Lake Road")

R = []
def route(id_, name, wps, prefer, season, note):
    pts = build(wps, set(prefer))
    R.append({"id": id_, "name": name, "kind": "osm", "season": season, "note": note, "pts": pts})

sp_pass = max(named_pts("Sentinel Pass Trail"), key=lambda p: elev(*p))
route("temple-sw", "Mount Temple, SW Ridge scramble", [moraine, sp_pass, summit("Mount Temple")],
      ["Larch Valley Trail", "Sentinel Pass Trail", "Mount Temple Route", "Mount Temple, South West Ridge Route"],
      "summer", "Standard scramble: Moraine Lake, Larch Valley, Sentinel Pass, then the SW ridge. Parks Canada treats it as a summer climb once snow has melted off the peak. Here it is scored in current winter conditions. OSM trail lines; the last pitch to the summit uses a least-effort terrain path where OSM has no line.")
route("sentinel", "Larch Valley & Sentinel Pass", [moraine, sp_pass], ["Larch Valley Trail", "Sentinel Pass Trail"], "summer",
      "Moraine Lake to Sentinel Pass (2611 m) through Larch Valley. OSM trail line.")
route("sentinel-pv", "Sentinel Pass to Paradise Valley", [moraine, sp_pass, pv_th],
      ["Larch Valley Trail", "Sentinel Pass Trail", "Paradise Valley Trail"], "summer",
      "Classic traverse over Sentinel Pass and down into Paradise Valley. OSM trail line.")
route("eiffel", "Eiffel Lake", [moraine, max(named_pts("Eiffel Lake Tr"), key=lambda p: dist(p, moraine))],
      ["Larch Valley Trail", "Eiffel Lake Tr"], "summer",
      "Moraine Lake to Eiffel Lake along the Valley of the Ten Peaks, crossing the runouts of Eiffel Peak and Mount Fay side paths. OSM trail line.")
route("wenk", "Wenkchemna Pass", [moraine, high_end("Wenkchemna Pass Route")],
      ["Larch Valley Trail", "Eiffel Lake Tr", "Wenkchemna Pass Route"], "summer", "Moraine Lake to Wenkchemna Pass (2600 m). OSM trail line.")
route("paradise", "Paradise Valley & Giant Steps", [pv_th, (51.3647, -116.2097)], ["Paradise Valley Trail"], "summer",
      "Paradise Valley trailhead to Lake Annette and the Giant Steps, below the north face of Mount Temple. OSM trail line.")
route("mlr", "Moraine Lake Road (winter approach)", [mlr_bot, moraine], ["Moraine Lake Road"], "winter",
      "The road is closed to cars in winter and used as a ski and snowshoe approach. It runs below slide paths on the east side of Mount Temple. OSM road line.")
route("little-temple", "Little Temple", [moraine, summit("Little Temple")], ["Little Temple Route", "Little Temple Alt Route", "Moraine Lake Road"], "summer",
      "Scramble to Little Temple (2588 m) from the Moraine Lake area. OSM route line.")
route("plain6", "Plain of Six Glaciers", [ll_shore, high_end("Plain of Six Glaciers Trail")], ["Plain of Six Glaciers Trail", "Lake Louise Highline Trail", "Lac Louise"], "summer",
      "Lake Louise to the Plain of Six Glaciers. Parks Canada rates this trail Complex in winter. OSM trail line.")
route("agnes", "Lake Agnes & Big Beehive", [ll_shore, summit("The Big Beehive", 150)], ["Lake Agnes Trail", "Big Beehive Trail"], "summer",
      "Lake Louise to Lake Agnes and the Big Beehive. OSM trail line.")
route("fairview", "Fairview Mountain", [ll_shore, summit("Fairview Mountain")], ["Saddleback Trail", "Fairview Mountain Trail", "Fairview Lookout"], "summer",
      "Lake Louise to Saddleback and the summit of Fairview Mountain (2744 m). OSM trail line.")

for r in R:
    p = r["pts"]; L = sum(dist(a, b) for a, b in zip(p[:-1], p[1:]))
    zs = [elev(*q) for q in p]
    print(f'{r["name"]:40s} {len(p):5d} pts {L/1000:6.2f} km  {min(zs):.0f}-{max(zs):.0f} m')

landmarks = [{"name": n, "lat": a, "lon": b} for n, (a, b) in peaks.items()
             if n in ("Mount Temple", "Eiffel Peak", "Pinnacle Mountain", "Fairview Mountain", "Haddo Peak", "Mount Aberdeen",
                      "Mount Lefroy", "Hungabee Mountain", "Deltaform Mountain", "Mount Babel", "Little Temple", "Sheol Mountain",
                      "The Big Beehive", "Panorama Ridge", "Mount Bowlen", "Wenkchemna Peak", "Saddle Mountain")]
landmarks += [{"name": "Moraine Lake", "lat": 51.3226, "lon": -116.1857}, {"name": "Lake Louise", "lat": 51.4168, "lon": -116.2312},
              {"name": "Sentinel Pass", "lat": sp_pass[0], "lon": sp_pass[1]}, {"name": "Lake Annette", "lat": 51.3725, "lon": -116.1997},
              {"name": "Larch Valley", "lat": 51.3420, "lon": -116.1985}]
json.dump({"routes": R, "landmarks": landmarks}, open(out, "w"))
