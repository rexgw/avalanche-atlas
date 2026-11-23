"""Build Whistler and Blackcomb hiking and backcountry routes from OpenStreetMap trails.

Usage: python3 -I routes_whistler.py <terrain.npz> <osm_paths.json> <terrain.json> <out.json>
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


def whole(name, prefer_extra=()):
    pts = named_pts(name)
    best = max(((a, b) for a in pts[::max(1, len(pts)//60)] for b in pts[::max(1, len(pts)//60)]), key=lambda ab: dist(*ab))
    a, b = best
    if elev(*a) > elev(*b): a, b = b, a    # start at the low end
    return [a, b]
def end_near(name, p):  return min([q for q in named_pts(name)], key=lambda q: dist(q, p))
def end_far(name, p):   return max([q for q in named_pts(name)], key=lambda q: dist(q, p))

R = []
def route(id_, name, wps, prefer, season, note, kind="osm"):
    pts = build(wps, set(prefer)) if kind == "osm" else [[round(a, 5), round(b, 5)] for a, b in sum((travel_path(p, q)[(1 if i else 0):] for i, (p, q) in enumerate(zip(wps[:-1], wps[1:]))), [])]
    R.append({"id": id_, "name": name, "kind": kind, "season": season, "note": note, "pts": pts})

wm = summit("Whistler Mountain", 300)
route("highnote", "High Note Trail", whole("High Note Trail"), ["High Note Trail", "Half Note Trail"], "summer",
      "Whistler Peak area along the High Note Trail above Cheakamus Lake. OSM trail line.")
mb0 = end_near("Musical Bumps Trail", wm)
route("bumps", "Musical Bumps to Russet Lake", [mb0, end_far("Russet Lake Trail", mb0)],
      ["Musical Bumps Trail", "Singing Pass Trail", "Russet Lake Trail"], "summer",
      "Over Piccolo, Flute and Oboe to Singing Pass and Russet Lake (Kees and Claire Hut). In winter this is a common ski touring line. OSM trail line.")
route("wedge", "Wedgemount Lake & Wedge Mountain", [low_end("Wedgemount Lake Trail"), summit("Wedge Mountain", 300)],
      ["Wedgemount Lake Trail", "Wedgemont Glacier Approach", "North East Arete Route"], "summer",
      "Steep trail to Wedgemount Lake and the hut, then the glacier approach and NE arete to Wedge Mountain (2903 m). OSM lines; the last part to the summit may use a least-effort terrain path.")
route("overlord", "Overlord Trail", whole("Overlord Trail"), ["Overlord Trail"], "summer",
      "Blackcomb alpine trail toward the Overlord Glacier viewpoint. OSM trail line.")
route("cheakamus", "Cheakamus Lake Trail", whole("Cheakamus Lake Trail"), ["Cheakamus Lake Trail"], "summer",
      "Valley-bottom forest trail to Cheakamus Lake, below the slide paths of Whistler's south side. OSM trail line.")
sp = [summit(n, 300) for n in ("Blackcomb Peak", "Decker Mountain", "Tremor Mountain", "Shudder Mountain", "The Ripsaw", "Mount Iago", "Mount Fitzsimmons")]
route("spearhead", "Spearhead Traverse", sp + [end_far("Russet Lake Trail", mb0), mb0], [], "winter",
      "Approximate: peaks of the Spearhead and Fitzsimmons ranges joined by a least-effort terrain path, then Russet Lake and the Musical Bumps. Some waypoints are summits, so gain and steepest slope run high; the real ski line uses cols and glaciers.", kind="approx")

for r in R:
    p = r["pts"]; L = sum(dist(a, b) for a, b in zip(p[:-1], p[1:]))
    zs = [elev(*q) for q in p]
    print(f'{r["name"]:40s} {len(p):5d} pts {L/1000:6.2f} km  {min(zs):.0f}-{max(zs):.0f} m')
names = ["Whistler Mountain", "Blackcomb Peak", "Wedge Mountain", "Mount Fitzsimmons", "Overlord Mountain", "Decker Mountain", "Tremor Mountain",
         "Shudder Mountain", "Mount Iago", "The Spearhead", "Phalanx Mountain", "Piccolo Summit", "Flute Summit", "Oboe Summit", "Russet Ridge",
         "Mount Weart", "Mount Cook", "Fissile Peak", "Whirlwind Peak", "Couloir Ridge", "Little Whistler"]
landmarks = [{"name": n, "lat": peaks[n][0], "lon": peaks[n][1]} for n in names if n in peaks]
landmarks += [{"name": "Whistler Village", "lat": 50.1163, "lon": -122.9574}, {"name": "Wedgemount Hut", "lat": 50.1580, "lon": -122.8040}]
hut = [e for e in osm if e["type"] == "node" and e["tags"].get("name") == "Wedgemount Hut"]
if hut: landmarks[-1].update(lat=hut[0]["lat"], lon=hut[0]["lon"])
json.dump({"routes": R, "landmarks": landmarks}, open(out, "w"))
