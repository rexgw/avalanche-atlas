# Avalanche Risk Atlas: Mount Temple

An interactive avalanche risk heat map and route assessment tool for Mount Temple and the Lake Louise area in Banff National Park. Risk is driven by the last 60 days of weather, pulled live each time the page opens.

**Educational model only.** It is not a substitute for the [Parks Canada avalanche forecast](https://avalanche.ca/forecasts) for Banff, Yoho and Kootenay, AST training or field observations. Do not make go/no-go decisions from this map.

## Features

- 3D terrain map (rotate, tilt, zoom) with the risk heat map or ATES terrain class draped over it
- Last 60 days of weather: hourly Open-Meteo data for Mount Temple (61 past days plus 2 forecast days), with precipitation averaged against ERA5 reanalysis, run through a daily snow and wind-loading model for each elevation band and aspect
- Chart of new snow, modelled snow depth by band and loading days, plus a band by aspect loading table
- Live Parks Canada danger ratings when issued; when no rating is issued (early or late season) the danger is modelled from the 60-day weather and marked as modelled
- Existing routes from OpenStreetMap, summer and winter, all scored in current winter conditions: Mount Temple SW Ridge, Larch Valley and Sentinel Pass, Sentinel Pass to Paradise Valley, Eiffel Lake, Wenkchemna Pass, Paradise Valley and Giant Steps, Moraine Lake Road, Little Temple, Plain of Six Glaciers, Lake Agnes and Big Beehive, Fairview Mountain
- Ideal safest route: A* search with a slider from shortest to safest, between any two points or as a safer line for any existing route
- New routes: draw on the map or upload a GPX file
- Avalanche history near Temple with sources
- Tactile 3D print (STL) with risk textures and raised routes

## Running it

The app is one file, `index.html`, served by GitHub Pages. Live data loads when the page is served from a normal web host or opened as a local file. If the live pull fails, it falls back to the weather snapshot saved in the page.

## Data sources

- Elevation: USGS 3D Elevation Program, 1 arc-second DEM tile n52w117 (public domain)
- Weather: Open-Meteo forecast API with past days, and ERA5 reanalysis via the Open-Meteo archive API (CC BY 4.0)
- Forecast: Avalanche Canada public forecast API (Parks Canada forecast for Banff, Yoho and Kootenay)
- Trails and peaks: © OpenStreetMap contributors (ODbL), via the Overpass API
- 3D rendering: three.js (MIT licence)

## Rebuilding

1. Run the **Fetch Mount Temple data** workflow from the Actions tab. It downloads the DEM, OSM trails and a weather snapshot into `build/data/temple/` and commits them.
2. `python3 -I build/terrain_temple.py build/data/temple/dem.tif <out>` builds slope, aspect, release areas, runout, terrain traps, ATES and hillshade.
3. `python3 -I build/routes_temple.py <out>/terrain.npz build/data/temple/osm_paths.json <out>/terrain.json <out>/routes.json` builds the routes from OSM.
4. `python3 -I build/assemble_temple.py build/template.html <out>/terrain.json <out>/routes.json build/data/temple/weather_60d.json build/data/temple/history.json build/three.bundle.js index.html`

Requires Python 3 with numpy, scipy and rasterio. The earlier Whistler version and its scripts are in `build/whistler/`.
