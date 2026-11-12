# Avalanche Risk Atlas: Whistler

An interactive avalanche risk heat map and route assessment tool, using Whistler, Blackcomb, the Spearhead Range and Wedgemount as the example area.

**Educational model only.** It is not a substitute for the [Avalanche Canada forecast](https://avalanche.ca/forecasts), AST training or field observations. Do not make go/no-go decisions from this map.

## Features

- Risk heat map (0 to 100 index) on a 30 m grid, coloured with the Avalanche Canada danger scale
- ATES terrain class view (Simple, Challenging, Complex, Extreme)
- Live conditions: loads the current Avalanche Canada forecast and Open-Meteo weather on page load, with manual entry as a fallback
- Existing routes: Spearhead Traverse, Musical Bumps to Russet Hut, Wedgemount Lake and Wedge Mountain
- New routes: draw on the map or upload a GPX file
- Route assessment: overall score, distance by risk class, elevation and risk profile, crux sections
- Ideal safest route: A* search with a slider that trades shortest against safest

## Running it

The whole app is one file, `index.html`. Open it in a browser or serve it with GitHub Pages. Live data needs the page to be served from a normal web host or opened as a local file.

## Model

Each cell combines terrain (release areas, runout exposure, terrain traps), conditions (danger rating, avalanche problems, new snow, wind loading, warming) and consequence. The full formula and assumptions are in the Method tab of the app.

## Data sources

- Elevation: USGS 3D Elevation Program, 1 arc-second DEM tile n51w123 (public domain)
- Forecast: Avalanche Canada public forecast API
- Weather: Open-Meteo forecast API
- Wedgemount track: Peakbagger GPS track recorded by Seán Caulfield
- Spearhead waypoints: public GPS waypoint set; route lines between them are approximate

## Limitations

- No forest cover data. Treeline effects come from elevation bands only.
- The ski area is not modelled as controlled terrain.
- Spearhead and Musical Bumps lines are approximate.
- 30 m cells miss small features such as rolls, cornice edges and short gullies.

## Rebuilding the data

The `build/` folder holds the scripts that produced the embedded terrain and route data:

1. `terrain.py <dem.tif> <out_dir>` computes slope, aspect, release areas, runout, terrain traps, ATES class and hillshade.
2. `routes.py <terrain.npz> <gpx_dir> <terrain.json> <out.json>` builds the existing routes.
3. `assemble.py template.html terrain.json routes.json index.html` embeds the data into the page.

Requires Python 3 with numpy, scipy and rasterio.
