import { createRequire } from 'module';
import * as d3 from 'd3-geo';
import fs from 'fs';
const require = createRequire(import.meta.url);
const topojson = require('topojson-client');
const simp = require('topojson-simplify');
const REG = JSON.parse(process.argv[2]);
const W = 1000;
let land = JSON.parse(fs.readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
let countries = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-110m.json', 'utf8'));
const proj = d3.geoEqualEarth().rotate([-10, 0]);
proj.fitWidth(W, { type: 'Sphere' });
const path = d3.geoPath(proj).digits(1);
// crop: lat 80N .. 58S
const yTop = proj([10, 80])[1], yBot = proj([10, -58])[1];
const H = Math.round(yBot - yTop);
proj.translate([proj.translate()[0], proj.translate()[1] - yTop]);
const p2 = d3.geoPath(proj).digits(1);
const landFC = topojson.feature(land, land.objects.land);
// drop Antarctica
landFC.features = landFC.features.map(f => f);
const ant = g => d3.geoBounds(g)[1][1] < -60;
const geoms = landFC.features[0] ? landFC.features : [landFC];
const landPath = p2({ type: 'FeatureCollection', features: topojson.feature(land, land.objects.land).features.filter(f => !ant(f)) });
const borders = p2(topojson.mesh(countries, countries.objects.countries, (a, b) => a !== b));
const sphere = p2({ type: 'Sphere' });
const grat = p2(d3.geoGraticule().step([30, 30])());
const sites = {};
for (const [k, [lat, lon]] of Object.entries(REG)) { const q = proj([lon, lat]); sites[k] = [+q[0].toFixed(1), +q[1].toFixed(1)]; }
const out = { w: W, h: H, sphere, land: landPath, borders, grat, sites };
fs.writeFileSync('/home/claude/atlas/worldmap.json', JSON.stringify(out));
console.log('H', H, 'bytes', JSON.stringify(out).length, 'land', landPath.length, 'borders', borders.length);
console.log(JSON.stringify(sites));
