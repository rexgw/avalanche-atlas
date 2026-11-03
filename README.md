# Strobilus Atlas

An educational pinecone atlas and generator. The home screen is a world map with twenty regions. Pick one to see
photos of its cones, facts about the cones and the region, and a 3D model generated in the browser. You can turn the
model with the mouse and download it as an STL for 3D printing.

## Run it

Open `index.html` in a browser. It needs an internet connection the first time to load three.js and the fonts.
If your browser blocks local images from `file://`, serve the folder instead:

    python3 -m http.server 8000      # then open http://localhost:8000

## What is in the folder

| Path | What it does |
|---|---|
| `index.html` | The built app: one page with the engine, data and map inlined |
| `img/` | 20 photos (1200x900 WebP) and their 400x300 thumbnails |
| `src/page.html` | Layout, styles, map, panel, viewer and download logic |
| `src/engine.js` | The cone generator: species, size percentile, climate and age to a closed mesh in mm, plus the STL writer |
| `src/data.js` | Regions, cone types, facts, photo captions and credits |
| `src/worldmap.json` | Equal Earth map paths and the pin positions of the ten regions |
| `src/worldmap.mjs` | Script that made `worldmap.json` from Natural Earth (needs `d3-geo`, `topojson-client`, `world-atlas`) |
| `build.py` | Inlines `src/` into `index.html` |

## How a model is generated

1. **Size.** Cone length follows a normal distribution for the species: `L = mean + z * sd`, limited to P1-P99 and
   to the species' recorded range. Each new specimen draws z at random from a standard normal (Box-Muller, seeded by
   the specimen number), so most cones land near the mean and few at the extremes. The Size percentile slider shows
   the drawn value and stays adjustable. Width and scale count follow length,
   each with a small seeded spread (truncated at +/-2 sigma).
2. **Region climate.** Higher sites make slightly smaller cones. Damp air keeps open cones partly closed. In the
   Rockies a share of lodgepole cones stays sealed with resin (serotiny).
3. **Age.** Each species moves through conelet, growing, ripening, then either opening (pines, spruce, Douglas-fir,
   larch), opening slowly (sequoia) or breaking apart (true fir, cedar, bunya).
4. **Geometry.** Scales are placed on a golden-angle spiral (137.5 degrees). Each scale follows a curved centre line
   and is lofted from superellipse cross-sections: woody knobs for pines, thin scales for spruce, fir, cedar and larch,
   peltate shields for sequoia. Extras: Douglas-fir trident bracts, reflexed noble fir bracts, lodgepole prickles,
   bunya spines.
5. **Export.** Every part is a closed, outward-facing solid in millimetres with the base on z = 0. Slicers merge the
   overlaps. A 1 mm minimum wall is enforced on thin parts.

## Specimen traits (from the Blender modifier)

Each time a location is opened, the app grows a new specimen. It picks a random seed and draws 26 traits that mirror
the inputs of the "Pinecone Controls" Geometry Nodes modifier in `pinecone_nodes_3.blend`: Divergence Angle;
Widest At, Roundness and Core Thickness; Density Bias, Tilt Bottom/Top, Attach Evenness and Stalk Width/Thickness;
Closed/Open Knob Size and Knob Height; Scale Style, Style Variation and Tip Bend; Base Zone and Transition; Arch
Bottom/Top and Arch Variation; Size and Open Variation, Asymmetry, Sun Side and Jitter.

Each trait comes from a truncated normal inside a natural range for the species (`TRAIT_DEFS` in `src/engine.js`).
About 1 cone in 50 gets a Lucas-sequence divergence angle (about 99.5 degrees) instead of the golden angle, as in
real cones. Traits are not user controls. The app remembers which trait sets it has shown in this browser and never
repeats one. Size is drawn at random too (see step 1), and both size percentile and age stay as user controls; humidity and elevation come from the region.

## Early life (conelet to full size)

Young cones follow each species' own growth schedule (`YOUNG` in `src/engine.js`). The schedules are based on the
research summarised in `docs/Young pinecone morphology by species.md`:

- **Growth:** cone length follows a per-species curve. Douglas fir, noble fir, spruce and larch reach full size within
  weeks. The two-year pines spend year one as a small closed egg. Stone pine stays tiny for two years, and giant
  sequoia is nearly full size four months after pollination.
- **Shape:** a young cone tapers or rounds into its stalk instead of sitting on a ring of full-size basal scales. A
  short peduncle shows, cedar and lodgepole start slimmer, and pine apophyses start as a small umbo.
- **Receptive cones:** for the first few weeks the scales are parted and the cone is coloured (red Douglas fir and
  spruce, pink larch, purple noble fir, grey sequoia).
- **Bracts:** Douglas fir starts with large trident bracts, larch with curled-back pink bracts, and giant sequoia with
  hair-like bristles on each scale.

Every early-life effect fades to exactly zero before the Ripening stage. From Ripening onward, cones are
bit-for-bit identical to those from the previous version.

## Identify a cone from a photo

The **Identify** tab takes a photo of a pinecone. You can choose a file, drag it in or paste it. An image analysis model looks at
the photo and compares it with the 13 cone types, using a short list of identifying features for each:

- Trident bracts for Douglas-fir.
- Peltate shields for giant sequoia.
- Hooked scale tips for chir pine.
- A rose-like shape for larch.
- And so on for the rest.

It returns a likelihood for every type, plus "none of these". The page normalises the likelihoods to 100% and shows:

- the best match, with a confidence level;
- the visible features it noted, and the evidence for the top three types;
- a ranked bar for all 13 types and "none of these". Each bar opens that cone in the atlas.

A photo of something that is not a cone is reported as such.

Inside Claude this uses the artifact `sample` capability with images (`capabilities: {sample: {images: true},
downloads: true}`), on the viewer's own account. On any other website it uses a relay you host: a free Cloudflare
Worker (`relay/worker.js`) that holds your Anthropic API key and calls Claude Haiku 5.5. Set its address in
`window.STROBILUS_ID_ENDPOINT` near the bottom of the page. Setup, costs and presenting tips are in
`docs/identify-relay.md`. With neither available, the tab shows a note instead. Photos that cannot be read directly,
such as HEIC, are redrawn as JPEG when the browser can decode them, and the relay path shrinks photos to about
1 megapixel before sending.

**Clear result** (top right of the results) removes the previous identification and its 3D model but keeps the photos
and notes, ready to identify again. **Start over** also removes the photos and resets the notes.

### Identification method

The identification steps follow the [Fieldbook pine cone identification guide](https://www.fieldbook-app.com/blog/pine-cone-identification).
The analysis works through them in order:

1. Cone group: woody pine scales, papery hanging spruce, upright fir or cedar that breaks apart on the tree.
2. Length, never judged on size alone without a scale reference.
3. Scale tips: prickles, smooth, hooked, bracts or shields.
4. Shape and symmetry.
5. Needles per bundle: 2, 3 or 5 for pines, single for spruce and fir, tufts for larch and cedar.
6. Location, used as supporting evidence only.

Each atlas type's feature list includes its needle arrangement and native range. The guide's common look-alikes
(ponderosa, eastern white, longleaf, red, jack, Virginia, pinyon and knobcone pines) are scored as "none of these" and
named.

The tab takes up to three photos of the same cone (side view, tip end, needles), as the guide suggests. Three
optional fields fill in what a photo can miss: the needles on the tree, a measured length ("8 cm", "3 in") and where
the cone was found. A measured length sets the 3D model's size directly.

### 3D model from the photo

After identification, the analysis takes a second look at the photo for the best-matching type. It reads the cone's stage
(how green or brown it is, how open, how weathered, whether scales have been shed) and its length, if something in
the photo gives scale. It also reads up to ten visible shape traits, each as a position inside that trait's natural
range for the species: Widest At, Roundness, Knob Height, Scale Style, Tip Bend, Arch Top, Tilt Bottom/Top, Asymmetry
and Size Variation. The page then turns these into an ordinary atlas specimen:

- **Traits:** the readings become trait values. Traits a photo cannot show stay at the species mean.
- **Age:** chosen by searching the life stages for the age whose colour, openness, weathering and scale loss best
  match the photo.
- **Size percentile:** worked out from the measured length when there is a scale reference, otherwise the 50th.
- **Climate:** dry air, so the model opens as far as the photo shows.

The model appears in a rotating preview with **Open in 3D viewer**, **Save to compare** and **Download STL**. A
**Build as** menu rebuilds it as any other type. In the viewer it is labelled `· from photo`, and every main-page
feature works on it: age and size, Adjust by hand (with **Restore photo traits**), vs mean, Compare and STL download.

## Animate age

The **Animate age** button beside the Age slider plays the cone's life on a loop, about 6 seconds per lifetime:
receptive conelet, growth to full size, ripening, opening and weathering (or shattering), then back to 1 month and
round again until you press **Pause**. The slider, timeline marker and stage text move with it. The camera is framed
on the full-grown cone first, so the view holds still while the cone grows. Frames use draft detail and the model
returns to standard detail when the animation stops. Moving the slider or changing the cone type also stops it.

The Age slider starts at 1 month.

## Find a specimen again

The specimen number (for example **No. B1XGK8**) is the seed that drew its traits, written in base 36. The same number
on the same cone type always grows the same 26 traits.

- **Find a specimen by number**, below the trait list, regrows a number for the open cone type, with the same
  traits and the same drawn size. It accepts the code with or without "No." and in any case. Age stays at its
  current setting, since the number does not hold it.
- **Recent specimens** lists the last 10 specimens viewed in this browser, newest first, with cone type, region, size
  percentile and age. Clicking one brings it back exactly, including its region, size, age and print settings. Custom
  and photo specimens keep their edited or photo traits here, which a typed number cannot restore. The list is stored
  in `localStorage` (key `strobilus-atlas-recent-v1`); **Clear** empties it.

## Adjust traits by hand

The specimen card has two modes:

- **Random draw** (default): every specimen draws its traits at random, as described above.
- **Adjust by hand**: each of the 26 traits gets a slider. Each slider spans that species' natural range, with a tick at
  the species average. Divergence Angle also has a **Lucas spiral (rare)** switch. The model regrows as a slider moves,
  and changed values show in gold.

The other controls:

- **Set all to mean** puts every trait at the species average, with a golden-angle spiral. It works in either mode.
- **Restore drawn traits** returns to the specimen's original random draw.

An edited specimen is labelled `· custom`, and its STL file name ends in `-custom`. Custom specimens can be saved to
Compare and reopened with their edited values.

## Compare with the species mean

The **vs mean** button in the 3D viewer grows the species-mean cone next to the current specimen. The mean cone has
every trait at the species average and a golden-angle spiral. Its width and scale count sit at the species norm. It
shares the specimen's size percentile, age, region climate and seed, so only the traits differ.

- **Split** shows the two cones side by side through one shared camera, so they turn together, at the same scale.
- **Overlay** shows the mean as a translucent ghost over the specimen, so differences in outline stand out.
- A readout lists height, width, scale count and width-to-height ratio for both cones. It names the three traits
  furthest from the mean, as a share of each trait's natural range.
- Each trait row also shows its difference from the mean. Differences of a quarter of the range or more are
  highlighted.

## Compare specimens

Press **Save to compare** in the 3D viewer to keep a specimen, up to four, from any region or cone type. The
**Compare** tab in the header shows the saved cones side by side:

- **Views:** each slot has its own 3D view. With **Link views** on, turning one turns them all.
- **Scale:** **Same scale** draws every cone at the scale of the largest, on a shared 10 mm grid, so sizes compare
  directly. **Fill each** frames every cone on its own.
- **Table:** compares region, life stage, age, size percentile, length, print size, scale count, openness and every
  specimen trait. The largest value in each row is highlighted.
- **Per slot:** download the STL, reopen the exact specimen in the atlas, or remove it.

Saved cones are stored in this browser (`localStorage`, key `strobilus-atlas-compare-v1`) as the inputs that grow
them (species, region, seed, traits, percentile, age, print size). The engine is deterministic, so each one rebuilds
identically.

## Add a region or a cone type

1. Add the species to `SPECIES` in `src/engine.js` (copy the closest existing one and adjust size, shape and colours).
2. Add the cone type and region to `src/data.js`, with photos in `img/` and `img/thumb/`.
3. Add the region's coordinates to the list passed to `src/worldmap.mjs` and rerun it, or project the pin yourself.
4. Run `python3 build.py`.

## Credits

Photos are from Wikimedia Commons under the licences listed in `src/credits.json` and in the app's Credits panel,
cropped to 4:3 and resized. Map data: Natural Earth (public domain). 3D rendering: three.js (MIT).
