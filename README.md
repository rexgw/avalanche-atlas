# Avalanche Risk Atlas: Whistler and Blackcomb

An interactive avalanche risk heat map and route assessment tool for Whistler, Blackcomb, the Spearhead Range and Wedgemount. Risk is driven by the weather since 1 October of the season, pulled live each time the page opens.

**Educational model only.** It is not a substitute for the [Avalanche Canada forecast](https://avalanche.ca/forecasts) (Sea-to-Sky), AST training or field observations. Do not make go/no-go decisions from this map. Inside the ski area boundary, ski patrol does avalanche control; scores show slopes as if uncontrolled.

## Features

- 3D terrain map with the risk heat map or ATES terrain class draped over it
- Date picker: any date back to 1950; risk uses the weather from 1 October of that season
- Live data, pulled by the reader's browser for the selected date: Open-Meteo weather (forecast models, archived forecast models from 2022, ERA5 before that, precipitation averaged with ERA5), the Avalanche Canada forecast for the date (archive from 2022) and Mountain Information Network reports within 20 km
- No station correction: there is no public weather station on the mountain, only highway stations in the valley. One overall snowfall multiplier is tuned against Avalanche Canada's ratings instead
- Snowpack model run from 1 October with buried weak-layer tracking
- Routes: 654 ski and snowboard runs and 36 lifts (OpenStreetMap via OpenSkiMap), designated uphill routes, and hiking and backcountry routes (High Note, Musical Bumps to Russet Lake, Wedgemount Lake and Wedge Mountain, Overlord Trail, Cheakamus Lake, an approximate Spearhead Traverse)
- Trip timing (Munter pace, start time), exposure minutes and hourly warming; safest-route search; draw or upload GPX routes; tactile 3D print

## Accuracy test

`build/backtest.mjs` (run by the **Accuracy test** workflow) scores the model against Avalanche Canada's daily ratings at Whistler, December to March, tuning on 2022-23 to 2024-25 and testing on 2025-26. Results: `build/data/whistler/backtest/report.json`.

On the 2025-26 test winter the model matched Avalanche Canada exactly on 58% of band ratings and was within one level on 93%, average error 0.496 levels, against a benchmark (the most common rating for that band and month) of 41%, 88% and 0.711. **At Whistler the model beats the benchmark.** It catches storm slab days well but none of the wind slab or persistent slab days, and only about 1 in 5 wet avalanche days. The test winter was scored once.

## Data sources

- Elevation: USGS 3D Elevation Program, 1 arc-second DEM tile n51w123 (public domain)
- Weather: Open-Meteo forecast, historical forecast and ERA5 archive APIs (CC BY 4.0)
- Forecast: Avalanche Canada public forecast API (Sea-to-Sky region)
- Field reports: Avalanche Canada Mountain Information Network
- Trails, runs, lifts and peaks: © OpenStreetMap contributors (ODbL), via the Overpass API and OpenSkiMap tiles
- 3D rendering: three.js (MIT licence)

## Rebuilding

1. Run **Fetch Whistler data** from the Actions tab (DEM, OSM trails, weather snapshot, accuracy-test data into `build/data/whistler/`).
2. `python3 -I build/whistler/terrain.py build/data/whistler/dem.tif <out>`
3. `python3 -I build/routes_whistler.py <out>/terrain.npz build/data/whistler/osm_paths.json <out>/terrain.json <out>/routes_osm.json`
4. `python3 -I build/whistler/runs.py <out>/terrain.json build/whistler/skimap <out>/routes_osm.json <out>/routes.json <out>/runs.json`
5. `SITE=whistler node build/backtest.mjs`
6. `python3 -I build/assemble_site.py whistler build/template.html <out>/terrain.json <out>/routes.json <out>/runs.json build/three.bundle.js index.html`

## Mount Temple (archived)

The Mount Temple version (Banff National Park) is archived: its page template and build scripts are in `build/temple/`, its data and accuracy test in `build/data/temple/`. Rebuild it with `build/temple/terrain_temple.py`, `build/temple/routes_temple.py` and `python3 -I build/assemble_site.py temple build/temple/template.html ...` (no runs file: pass `-`).
