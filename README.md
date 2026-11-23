# Avalanche Risk Atlas: Mount Temple

An interactive avalanche risk heat map and route assessment tool for Mount Temple and the Lake Louise area in Banff National Park. Risk is driven by the last 60 days of weather, pulled live each time the page opens.

**Educational model only.** It is not a substitute for the [Parks Canada avalanche forecast](https://avalanche.ca/forecasts) for Banff, Yoho and Kootenay, AST training or field observations. Do not make go/no-go decisions from this map.

## Features

- 3D terrain map (rotate, tilt, zoom) with the risk heat map or ATES terrain class draped over it
- Date picker: any date back to 1950; risk uses the 60 days of weather before it
- Live data, pulled by the reader's browser for the selected date:
  - Open-Meteo weather (forecast models, archived forecast models from 2022, ERA5 before that), with precipitation averaged against ERA5
  - Parks Canada weather stations via Avalanche Canada (from 2024): snow depth at Bosworth Lower and Stanley, ridgetop wind and temperature at Bosworth Upper (Whymper as backup), used to correct the snow model
  - Parks Canada avalanche forecast for Banff, Yoho and Kootenay (archive from 2023); when no rating was issued the danger is modelled and marked as modelled
  - Avalanche Canada Mountain Information Network reports within 20 km
- Daily snow and wind-loading model for each elevation band and aspect, with a chart and a band by aspect loading table
- No manual entry: all conditions come from the sources above
- Existing routes from OpenStreetMap, summer and winter, all scored in current winter conditions: Mount Temple SW Ridge, Larch Valley and Sentinel Pass, Sentinel Pass to Paradise Valley, Eiffel Lake, Wenkchemna Pass, Paradise Valley and Giant Steps, Moraine Lake Road, Little Temple, Plain of Six Glaciers, Lake Agnes and Big Beehive, Fairview Mountain
- Ideal safest route: A* search with a slider from shortest to safest, between any two points or as a safer line for any existing route
- New routes: draw on the map or upload a GPX file
- Avalanche history near Temple with sources
- Tactile 3D print (STL) with risk textures and raised routes

## Running it

The app is one file, `index.html`, served by GitHub Pages. All APIs it calls allow browser requests. If today's weather pull fails it falls back to the snapshot saved in the page.

In a check of 13 days from winters 2023 to 2025, the modelled danger matched the official Parks Canada rating in 13 of 39 band ratings and was within one level in 33. The official rating is used whenever one exists.

## Data sources

- Elevation: USGS 3D Elevation Program, 1 arc-second DEM tile n52w117 (public domain)
- Weather: Open-Meteo forecast, historical forecast and ERA5 archive APIs (CC BY 4.0)
- Stations: Parks Canada, via the Avalanche Canada weather API
- Field reports: Avalanche Canada Mountain Information Network
- Forecast: Avalanche Canada public forecast API (Parks Canada forecast for Banff, Yoho and Kootenay)
- Trails and peaks: © OpenStreetMap contributors (ODbL), via the Overpass API
- 3D rendering: three.js (MIT licence)

## Rebuilding

1. Run the **Fetch Mount Temple data** workflow from the Actions tab. It downloads the DEM, OSM trails and a weather snapshot into `build/data/temple/` and commits them.
2. `python3 -I build/terrain_temple.py build/data/temple/dem.tif <out>` builds slope, aspect, release areas, runout, terrain traps, ATES and hillshade.
3. `python3 -I build/routes_temple.py <out>/terrain.npz build/data/temple/osm_paths.json <out>/terrain.json <out>/routes.json` builds the routes from OSM.
4. `python3 -I build/assemble_temple.py build/template.html <out>/terrain.json <out>/routes.json build/data/temple/weather_60d.json build/data/temple/history.json build/three.bundle.js index.html`

Requires Python 3 with numpy, scipy and rasterio. The earlier Whistler version and its scripts are in `build/whistler/`.
