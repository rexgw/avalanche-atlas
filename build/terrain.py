"""Build terrain layers for the Whistler avalanche risk app.

Usage: python3 -I terrain.py <dem.tif> <out_dir>

Outputs (all on a local metric grid, row 0 = north):
  elev (int16 m), slope (deg), aspect (0-255 = 0-360 deg, downslope facing),
  pra (0-255 release-area membership), runout (0-255 exposure),
  trap (0-255 terrain-trap index), crest (0-255 proximity to ridge crest),
  ates (0-4), hillshade (0-255)
"""
import sys, json, gzip, base64
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from scipy import ndimage

dem_path, out_dir = sys.argv[1], sys.argv[2]

# Study area: Whistler, Blackcomb, Spearhead Range, Wedgemount
LON_W, LON_E = -123.000, -122.760
LAT_S, LAT_N = 50.000, 50.185
RES = 30.0  # metres

LAT0 = (LAT_S + LAT_N) / 2
MX = 111320.0 * np.cos(np.radians(LAT0))  # m per deg lon
MY = 110574.0 + 1110.0 * np.sin(np.radians(LAT0)) ** 2  # m per deg lat (approx)

W = int(round((LON_E - LON_W) * MX / RES))
H = int(round((LAT_N - LAT_S) * MY / RES))

with rasterio.open(dem_path) as src:
    win = from_bounds(LON_W - 0.01, LAT_S - 0.005, LON_E + 0.01, LAT_N + 0.01, src.transform)
    win = win.round_offsets().round_lengths()
    z0 = src.read(1, window=win).astype(np.float64)
    tr = src.window_transform(win)
    nod = src.nodata

z0[z0 == nod] = np.nan
if np.isnan(z0).any():
    z0[np.isnan(z0)] = np.nanmin(z0)

# Sample geographic DEM onto metric grid (bilinear)
xs = (np.arange(W) + 0.5) * RES
ys = (np.arange(H) + 0.5) * RES
lon = LON_W + xs / MX
lat = LAT_N - ys / MY
LON, LAT = np.meshgrid(lon, lat)
col = (LON - tr.c) / tr.a - 0.5
row = (LAT - tr.f) / tr.e - 0.5
z = ndimage.map_coordinates(z0, [row, col], order=1, mode="nearest")
z = ndimage.gaussian_filter(z, 0.6)  # light smoothing of 1" noise

# ---------- slope / aspect ----------
dzdy, dzdx = np.gradient(z, RES)  # dzdy: +row = south
gx = dzdx            # east-positive
gy = -dzdy           # north-positive
slope = np.degrees(np.arctan(np.hypot(gx, gy)))
# aspect = direction the slope faces (downslope), degrees clockwise from north
aspect = (np.degrees(np.arctan2(-gx, -gy)) + 360) % 360

# ---------- curvature / ruggedness ----------
lap = ndimage.laplace(ndimage.gaussian_filter(z, 2.0)) / RES**2  # +ve concave (gully)
tpi = z - ndimage.uniform_filter(z, size=11)                     # ~330 m TPI
# ruggedness: std of slope in 5x5
sl_mean = ndimage.uniform_filter(slope, 5)
sl_sq = ndimage.uniform_filter(slope**2, 5)
rugged = np.sqrt(np.clip(sl_sq - sl_mean**2, 0, None))

# ---------- elevation bands (Avalanche Canada style, Sea-to-Sky approximation) ----------
BTL_TOP, TL_TOP = 1500.0, 1900.0
# Forest proxy: no canopy data available, so release potential is damped below
# treeline (forest anchors snow). Values documented in the app.
forest_factor = np.where(z < BTL_TOP, 0.45, np.where(z < TL_TOP, 0.8, 1.0))

# ---------- potential release areas (fuzzy, after Veitinger et al. 2016) ----------
def bell(x, a, b, c):
    return 1.0 / (1.0 + np.abs((x - c) / a) ** (2 * b))

slope_m = bell(slope, 11.0, 4.0, 40.0)           # peaks ~40 deg, ~0.5 at 29 and 51
slope_m[slope < 25] *= np.clip((slope[slope < 25] - 20) / 5, 0, 1)
rug_m = np.clip(1.0 - (rugged - 6.0) / 10.0, 0.2, 1.0)  # very rough = anchored / cliffs
pra = slope_m * rug_m * forest_factor
pra = ndimage.median_filter(pra, 3)
# remove tiny isolated release cells (< ~4 cells)
lab, n = ndimage.label(pra > 0.35)
sizes = ndimage.sum(np.ones_like(pra), lab, index=np.arange(1, n + 1))
small = np.isin(lab, np.where(sizes < 4)[0] + 1)
pra[small] *= 0.5

# ---------- runout (energy-line / alpha-angle propagation) ----------
ALPHA = np.radians(24.0)  # typical runout travel angle
TANA = np.tan(ALPHA)
TANB = np.tan(np.radians(28.0))  # forest friction proxy below treeline
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
DIST = [RES * np.hypot(a, b) for a, b in NB]

E = np.full(z.shape, -1e9)     # energy-line elevation
S = np.zeros(z.shape)          # carried source strength
src_mask = pra > 0.45
E[src_mask] = z[src_mask]
S[src_mask] = pra[src_mask]

order = np.argsort(-z, axis=None)
Hh, Ww = z.shape
zf, Ef, Sf = z.ravel(), E.ravel(), S.ravel()
for idx in order:
    e = Ef[idx]
    if e < -1e8:
        continue
    r, c = divmod(idx, Ww)
    zc = zf[idx]
    if e - zc < 0:
        continue
    # find downslope neighbours; keep those close to steepest descent (persistence)
    drops = []
    for k, (dr, dc) in enumerate(NB):
        rr, cc = r + dr, c + dc
        if 0 <= rr < Hh and 0 <= cc < Ww:
            g = (zc - zf[rr * Ww + cc]) / DIST[k]
            if g > 0:
                drops.append((g, rr * Ww + cc, DIST[k]))
    if not drops:
        continue
    gmax = max(d[0] for d in drops)
    for g, j, d in drops:
        if g < 0.6 * gmax:
            continue
        ne = e - (TANA if zc >= BTL_TOP else TANB) * d
        if ne > zf[j] and ne > Ef[j]:
            Ef[j] = ne
            Sf[j] = max(Sf[j], Sf[idx] * 0.995)
        elif ne > zf[j]:
            Sf[j] = max(Sf[j], Sf[idx] * 0.995)

head = np.clip((E - z) / 120.0, 0, 1)   # energy height above ground, 120 m -> full
runout = np.where(E > z, S * (0.35 + 0.65 * head), 0.0)
runout = np.clip(ndimage.gaussian_filter(runout, 0.7), 0, 1)

# ---------- terrain traps ----------
gully = np.clip(lap / 0.004, 0, 1) * (slope > 15)
cliff = ndimage.maximum_filter((slope > 50).astype(float), size=3)
# flat/depression below steep slopes (deposits pile deep)
steep_above = ndimage.maximum_filter((slope > 35).astype(float), size=7)
transition = steep_above * (slope < 18) * (runout > 0.2)
trap = np.clip(np.maximum.reduce([gully, cliff * 0.9, transition * 0.7]), 0, 1)
trap = ndimage.gaussian_filter(trap, 0.6)

# ---------- ridge-crest proximity (for wind loading) ----------
zmax = ndimage.maximum_filter(z, size=11)  # ~330 m window
crest = np.clip(1.0 - (zmax - z) / 150.0, 0, 1)

# ---------- ATES-style classification (simplified AutoATES approach) ----------
# 0 non-avalanche, 1 simple, 2 challenging, 3 complex, 4 extreme
ates = np.ones(z.shape, dtype=np.uint8)
ates[(slope < 12) & (runout < 0.05)] = 0
ates[(slope >= 25) | (runout >= 0.25)] = 2
ates[(slope >= 35) & (pra >= 0.5) | (runout >= 0.6)] = 3
ates[((slope >= 45) & (pra >= 0.3)) | (cliff > 0) & (slope >= 40)] = 4
ates = ndimage.median_filter(ates, 3)

# ---------- hillshade ----------
az, alt = np.radians(315), np.radians(40)
sr = np.radians(slope)
ar = np.radians(aspect)
hs = np.sin(alt) * np.cos(sr) + np.cos(alt) * np.sin(sr) * np.cos(az - ar)
hs = np.clip(hs, 0, 1)

def u8(a):
    return np.clip(np.round(a), 0, 255).astype(np.uint8)

layers = {
    "elev": np.round(z).astype(np.int16),
    "slope": u8(slope),
    "aspect": u8(aspect / 360.0 * 256.0 % 256),
    "pra": u8(pra * 255),
    "runout": u8(runout * 255),
    "trap": u8(trap * 255),
    "crest": u8(crest * 255),
    "ates": ates.astype(np.uint8),
    "hill": u8(hs * 255),
}

meta = dict(W=W, H=H, res=RES, lonW=LON_W, latN=LAT_N, mx=MX, my=MY,
            btlTop=BTL_TOP, tlTop=TL_TOP, alphaDeg=24.0,
            source="USGS 3DEP 1 arc-second DEM tile n51w123 (public domain)")
blob = {"meta": meta}
for k, a in layers.items():
    raw = a.tobytes()
    blob[k] = base64.b64encode(gzip.compress(raw, 9)).decode()

with open(f"{out_dir}/terrain.json", "w") as f:
    json.dump(blob, f)
np.savez_compressed(f"{out_dir}/terrain.npz", **layers)

print("grid", W, H, "cells", W * H)
print("elev", z.min(), z.max())
for k in ["pra", "runout", "trap"]:
    print(k, "mean", float(layers[k].mean()) / 255, ">0.5", float((layers[k] > 127).mean()))
print("ates share", {i: round(float((ates == i).mean()), 3) for i in range(5)})
print("json MB", round(sum(len(v) for k, v in blob.items() if k != "meta") / 1e6, 2))
