# Avalanche Risk Atlas: Whistler

An interactive avalanche risk heat map and route assessment tool, using Whistler, Blackcomb, the Spearhead Range and Wedgemount as the example area.

**Educational model only.** It is not a substitute for the [Avalanche Canada forecast](https://avalanche.ca/forecasts), AST training or field observations. Do not make go/no-go decisions from this map.

## Features

- 3D terrain map that can be rotated, tilted and zoomed, with the risk heat map draped over it
- Risk heat map (0 to 100 index) on a 30 m grid, coloured with the Avalanche Canada danger scale
- ATES terrain class view (Simple, Challenging, Complex, Extreme)
- Live conditions: loads the current Avalanche Canada forecast and Open-Meteo weather on page load, with manual entry as a fallback
- Existing routes: Spearhead Traverse, Musical Bumps to Russet Hut, Wedgemount Lake and Wedge Mountain
- Ski and snowboard runs on Whistler and Blackcomb with lifts, searchable and scored for avalanche risk
- Designated uphill routes: Singing Pass Trail, and the Blackcomb Bench Climb with the South Route
- New routes: tap points on the 3D map or upload a GPX file
- Tactile 3D print: download an STL where routes are raised ridges and each risk class has its own sharp-edged pattern (smooth, ribs, studs, pyramids, spikes) that stands apart from the terrain, so the model can be read by touch. A legend strip on the south edge has one patch per risk class, marked with one to five raised dots, and a sample route ridge. Preview print shows the exact model, lit and rotatable, before downloading
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
- Ski runs, lifts and uphill routes: © OpenStreetMap contributors (ODbL), via OpenSkiMap tiles from the monkeysnow project
- 3D rendering: three.js (MIT licence)
- Spearhead waypoints: public GPS waypoint set; route lines between them are approximate

## Limitations

- No forest cover data. Treeline effects come from elevation bands only.
- The ski area is not modelled as controlled terrain. Ski runs are scored as if uncontrolled, so open runs carry much less real risk than their score.
- About 900 m of the Blackcomb uphill route has no OpenStreetMap trace and is filled with a least-effort terrain path. The North Route, Oboe Traverse and East Col are not included yet.
- Spearhead and Musical Bumps lines are approximate.
- 30 m cells miss small features such as rolls, cornice edges and short gullies.

## Rebuilding the data

The `build/` folder holds the scripts that produced the embedded data:

1. `terrain.py <dem.tif> <out_dir>` computes slope, aspect, release areas, runout, terrain traps, ATES class and hillshade.
2. `routes.py <terrain.npz> <gpx_dir> <terrain.json> <out.json>` builds the backcountry routes.
3. `runs.py <terrain.json> data/skimap <routes.json> <routes_out.json> <runs.json>` builds the ski runs, lifts and uphill routes from the OpenStreetMap tiles in `data/skimap`.
4. `three.bundle.js` is a minified three.js build made from `three-entry.js` with esbuild.
5. `assemble.py template.html terrain.json routes_out.json runs.json three.bundle.js index.html` embeds everything into the page.

Requires Python 3 with numpy, scipy and rasterio.
