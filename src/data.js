/* Strobilus Atlas content: regions, cone types and photo credits. */
window.ATLAS_DATA = (function () {
  const PHOTOS = {
    douglas_1: { type: 'douglas', caption: 'A Douglas-fir cone, its three-pointed bracts poking out between the scales.', artist: 'Walter Siegmund', lic: 'CC BY 2.5', page: 'https://commons.wikimedia.org/wiki/File:Pseudotsuga_menziesii_28226.JPG' },
    noble_1: { type: 'noble', caption: 'Noble fir cones standing upright on the upper branches.', artist: 'Elrond', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Weibliche_Zapfen_der_Edeltanne_(Abies_procera)01.JPG' },
    lodgepole_1: { type: 'lodgepole', caption: 'A closed lodgepole pine cone among paired needles.', artist: 'Peter Stevens', lic: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_contorta_cone_Little_Si.jpg' },
    lodgepole_2: { type: 'lodgepole', caption: 'An open lodgepole cone. Each scale tip carries a small prickle.', artist: 'Aaron Liston', lic: 'CC BY 4.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_contorta_female_cone_(02).jpg' },
    sugar_1: { type: 'sugar', caption: 'Green, still-growing sugar pine cones hanging from the branch tips.', artist: 'Mitch from Costa Mesa, CA', lic: 'CC BY-SA 2.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_lambertiana_cones_Cucamonga_Peak.jpg' },
    sequoia_1: { type: 'sequoia', caption: 'A dried, opened giant sequoia cone with wrinkled shield-shaped scales.', artist: 'Krzysztof Ziarnek, Kenraiz', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Sequoiadendron_giganteum_kz12.jpg' },
    spruce_1: { type: 'spruce', caption: 'Norway spruce cones hanging below bright new spring shoots.', artist: 'MrPanyGoff', lic: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Norway_Spruce_cones_(Picea_abies).jpg' },
    scots_1: { type: 'scots', caption: 'An open Scots pine cone with grey-brown scale tips.', artist: 'Laurence Livermore', lic: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_sylvestris_open_cones.jpg' },
    stone_1: { type: 'stone', caption: 'A ripe stone pine cone, closed and glossy.', artist: 'S. Rae', lic: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_pinea_-_cone_-_Flickr_-_S._Rae_(2).jpg' },
    stone_2: { type: 'stone', caption: 'A weathered, opened stone pine cone on the needle litter.', artist: 'Zeynel Cebeci', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Cone,_Pinus_pinea_01.jpg' },
    cedar_1: { type: 'cedar', caption: 'Barrel-shaped cedar cones sitting upright on the branches.', artist: 'Zeynel Cebeci', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Cedrus_libani_-_L%C3%BCbnan_sediri_kozalaklar%C4%B1.jpg' },
    cedar_2: { type: 'cedar', caption: 'A young cedar cone, still pale green and beaded with resin.', artist: 'Jebulon', lic: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Cedrus_libani_fruit.jpg' },
    chir_1: { type: 'chir', caption: 'A chir pine cone above pine-covered slopes near Murree, Pakistan.', artist: 'Faisal Ismail', lic: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Pine_cone_at_Murree.JPG' },
    chir_2: { type: 'chir', caption: 'A weathered chir pine cone in Uttarakhand, India.', artist: 'Girishjoshi07', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_roxburghii_cone,_Banlekh,_Uttarakhand,_India.jpg' },
    larch_1: { type: 'larch', caption: 'Open Japanese larch cones. The rolled-back scales look like tiny roses.', artist: 'Pudelek', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Larix_kaempferi_cones_3.jpg' },
    larch_2: { type: 'larch', caption: 'Young larch cones among fresh tufts of needles.', artist: 'ColleenMartin', lic: 'CC BY 3.0', page: 'https://commons.wikimedia.org/wiki/File:Larix_kaempferi_cones_-_panoramio_(1).jpg' },
    merkusii_1: { type: 'merkusii', caption: 'Sumatran pines on the hills above Lake Toba, North Sumatra.', artist: 'Ken Marshall', lic: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Pinus_merkusii_on_Samosir_Island,_Lake_Toba,_Sumatra_IMG_3113.jpg' },
    merkusii_2: { type: 'merkusii', caption: 'A dry Sumatran pine cone, hung among Araucaria foliage.', artist: 'Amelia.angela2210', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Dried_Pinus_merkusii_cone_hanging_by_a_metal_hook_from_Araucaria_foliage.jpg' },
    bunya_1: { type: 'bunya', caption: 'A bunya cone: green woody scales, each ending in a curved brown spine.', artist: 'Dgies', lic: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Araucaria_bidwillii_single_cone.JPG' },
    bunya_2: { type: 'bunya', caption: 'A fallen bunya cone among twigs in the Bunya Mountains.', artist: 'JustThatNerdyNerd', lic: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Fallen_Bunya_cone_and_twigs,_Bunya_Mountains,_Queensland.jpg' }
  };

  // stats: length, shape, release, seeds
  const TYPES = {
    douglas: {
      group: 'Douglas-fir', genus: 'Pseudotsuga', region: 'pnw', photo: 'douglas_1',
      stats: ['5–11 cm', 'Egg-shaped, hanging', 'Opens on the tree', 'Winged'],
      facts: [
        'A three-pointed bract pokes out from under every scale. A Native American story says these are the back legs and tail of mice that hid in the cones during a forest fire.',
        'It is not a true fir. Botanists gave it its own genus, Pseudotsuga, meaning “false hemlock”.',
        'Cones ripen in a single season, open on the tree in autumn and fall whole once the seed is gone.',
        'One of the world’s most important timber trees. Coastal trees can grow taller than 90 m.'
      ]
    },
    noble: {
      group: 'True fir', genus: 'Abies', region: 'pnw', photo: 'noble_1',
      stats: ['11–22 cm', 'Cylinder, upright', 'Breaks apart on the tree', 'Winged'],
      facts: [
        'Fir cones stand upright on the top branches and never fall whole. When ripe they drop their scales one by one, leaving a bare spike on the twig.',
        'Long, papery bracts fold back over the scales and almost hide them.',
        'Because the cones come apart high in the crown, an intact noble fir cone on the ground is a rare find.',
        'Its stiff, evenly spaced branches make it a favourite Christmas tree.'
      ]
    },
    lodgepole: {
      group: 'Pine', genus: 'Pinus', region: 'rockies', photo: 'lodgepole_1',
      stats: ['2–6 cm', 'Egg-shaped, often lopsided', 'Opens, or waits for fire', 'Winged'],
      facts: [
        'Many cones are serotinous: resin glues the scales shut until the heat of a fire melts it, at roughly 45–60 °C.',
        'Sealed cones can hang on the branches for decades, storing seed for the next fire.',
        'Cones are often lopsided, with larger scales on the side facing away from the branch.',
        'The straight, slender trunks gave the tree its name: Plains peoples used them as lodge and tipi poles.'
      ]
    },
    sugar: {
      group: 'Pine', genus: 'Pinus', region: 'sierra', photo: 'sugar_1',
      stats: ['25–50 cm', 'Long cylinder, hanging', 'Opens on the tree', 'Large, winged'],
      facts: [
        'Sugar pine cones are the longest of any conifer, usually 25–50 cm.',
        'It is the tallest and most massive pine species, reaching 60–80 m.',
        'The name comes from sweet resin that seeps from wounds in the bark. John Muir said he preferred it to maple sugar.',
        'White pine blister rust, a fungus brought in from Europe, now threatens many stands.'
      ]
    },
    sequoia: {
      group: 'Sequoia', genus: 'Sequoiadendron', region: 'sierra', photo: 'sequoia_1',
      stats: ['4–7 cm', 'Egg-shaped, woody', 'Opens after fire or drying', 'Tiny, flat, winged'],
      facts: [
        'The largest trees on Earth grow from cones about the size of a hen’s egg.',
        'Cones can stay green and alive on the tree for up to 20 years.',
        'They open when heat from a fire dries them, or when squirrels and beetles chew through them.',
        'Each scale is a flat-topped shield on a short stalk, with a few tiny seeds tucked underneath.'
      ]
    },
    spruce: {
      group: 'Spruce', genus: 'Picea', region: 'taiga', photo: 'spruce_1',
      stats: ['9–17 cm', 'Long cylinder, hanging', 'Opens on the tree', 'Winged'],
      facts: [
        'Norway spruce has the longest cones of any spruce.',
        'Spruce cones always hang downward and fall whole after releasing their seed.',
        'The scales are thin and flexible, without the woody knobs of pine cones.',
        'Its light, resonant wood is the classic choice for violin and guitar tops.'
      ]
    },
    scots: {
      group: 'Pine', genus: 'Pinus', region: 'taiga', photo: 'scots_1',
      stats: ['3–7.5 cm', 'Pointed egg', 'Opens in dry weather', 'Winged'],
      facts: [
        'Scots pine has the widest natural range of any pine, from Scotland and Spain to eastern Siberia.',
        'Its cones open on dry days to let seed out and close again when the air is damp.',
        'The exposed tip of each scale, called the apophysis, is flat or only slightly raised.',
        'It is often called the national tree of Scotland.'
      ]
    },
    stone: {
      group: 'Pine', genus: 'Pinus', region: 'med', photo: 'stone_1',
      stats: ['8–15 cm', 'Broad and heavy', 'Opens on the tree', 'Large, edible'],
      facts: [
        'Its cones take three years to ripen, longer than those of any other pine.',
        'Each scale holds a large, nearly wingless seed: the pine nuts used in pesto.',
        'The cones are heavy and broad, often almost as wide as they are long.'
      ]
    },
    cedar: {
      group: 'Cedar', genus: 'Cedrus', region: 'lebanon', photo: 'cedar_1',
      stats: ['8–12 cm', 'Barrel, upright', 'Breaks apart on the tree', 'Winged'],
      facts: [
        'Cedar cones sit upright on the branches like small barrels.',
        'When ripe they fall apart on the tree, dropping scales and winged seeds and leaving the central spike behind.',
        'Young cones are pale green and often ooze fragrant resin.'
      ]
    },
    chir: {
      group: 'Pine', genus: 'Pinus', region: 'himalaya', photo: 'chir_1',
      stats: ['10–20 cm', 'Large egg, very woody', 'Opens on the tree', 'Winged'],
      facts: [
        'The thick, woody tips of the scales curve back like hooks.',
        'Its needles, 20–35 cm long, grow in bundles of three.',
        'It is named after William Roxburgh, a Scottish botanist who worked in India.'
      ]
    },
    larch: {
      group: 'Larch', genus: 'Larix', region: 'japan', photo: 'larch_1',
      stats: ['2–3.5 cm', 'Small rose, upright', 'Opens on the tree', 'Winged'],
      facts: [
        'The scale tips roll outward, so open cones look like tiny wooden roses.',
        'Old, empty cones often stay on the twigs for years.',
        'Larches are among the few conifers that drop all their needles every autumn.'
      ]
    },
    merkusii: {
      group: 'Pine', genus: 'Pinus', region: 'sumatra', photo: 'merkusii_2',
      stats: ['5–8 cm', 'Narrow egg', 'Opens on the tree', 'Winged'],
      facts: [
        'Sumatran pine is the only pine whose natural range reaches south of the equator.',
        'Its needles grow in pairs and the cones are slender and glossy brown.',
        'In Indonesia it is tapped for resin, which is processed into gum rosin and turpentine.'
      ]
    },
    bunya: {
      group: 'Araucaria family', genus: 'Araucaria', region: 'bunya', photo: 'bunya_1',
      stats: ['Up to about 30 cm', 'Huge green globe', 'Falls whole, then breaks apart', 'Large, edible nuts'],
      facts: [
        'Bunya cones are among the heaviest of any conifer, up to about 10 kg.',
        'They fall whole when ripe and break apart on the ground, so parks close areas under the trees in cone season.',
        'Inside are 30 to 100 large seeds, the bunya nuts, which are still eaten roasted or boiled.',
        'It is not a true pine. It belongs to the Araucaria family, like the monkey puzzle tree.'
      ]
    }
  };

  // label: which side of the pin its name sits on. model: climate fed into the generator.
  const REGIONS = [
    {
      id: 'pnw', name: 'Pacific Northwest', place: 'Cascade Range · USA and Canada', lat: 46.85, lon: -121.75, label: 'left',
      climate: ['Cool, wet maritime', 'Mild, rainy winters', 'Sea level to 2,000 m'],
      model: { humidity: 82, elevation: 900, exposure: 0.25, serotiny: 0 },
      types: ['douglas', 'noble'], photos: ['douglas_1', 'noble_1'],
      facts: [
        'Moist air from the Pacific drops heavy rain and snow on the western slopes, so conifers grow huge here.',
        'Douglas-fir dominates many lower forests. Noble fir grows higher up the mountain slopes.',
        'Douglas-fir is the state tree of Oregon.'
      ]
    },
    {
      id: 'rockies', name: 'Yellowstone and the Rockies', place: 'Wyoming, Montana and Idaho · USA', lat: 44.6, lon: -110.5, label: 'right',
      climate: ['Cold, dry continental', 'Long snowy winters', 'Mostly above 2,000 m'],
      model: { humidity: 55, elevation: 2400, exposure: 0.4, serotiny: 0.5 },
      types: ['lodgepole'], photos: ['lodgepole_1', 'lodgepole_2'],
      facts: [
        'Lodgepole pine makes up most of Yellowstone’s forests.',
        'The 1988 fires burned about a third of the park. Seed released from heat-opened cones restocked the burned slopes.',
        'Short summers and long winters at high elevation keep the trees small and slow-growing.'
      ]
    },
    {
      id: 'sierra', name: 'Sierra Nevada', place: 'California · USA', lat: 37.75, lon: -119.6, label: 'left',
      climate: ['Dry summers, snowy winters', 'Fire-adapted forest', '1,000 to 2,500 m'],
      model: { humidity: 50, elevation: 1800, exposure: 0.3, serotiny: 0 },
      types: ['sugar', 'sequoia'], photos: ['sugar_1', 'sequoia_1'],
      facts: [
        'Giant sequoias grow wild only here, in fewer than 80 groves on the western slopes, mostly between about 1,400 and 2,100 m.',
        'Nearly all of the year’s rain and snow falls between October and April.',
        'Low-intensity fire is part of the natural cycle. It clears the forest floor and helps cones release their seed.'
      ]
    },
    {
      id: 'taiga', name: 'Scandinavian taiga', place: 'Sweden, Norway and Finland', lat: 61.5, lon: 15.0, label: 'right',
      climate: ['Boreal', 'Long, cold winters', 'Sea level to 1,000 m'],
      model: { humidity: 78, elevation: 400, exposure: 0.3, serotiny: 0 },
      types: ['spruce', 'scots'], photos: ['spruce_1', 'scots_1'],
      facts: [
        'The boreal forest, or taiga, rings the far north of the globe and is Earth’s largest land biome.',
        'Norway spruce and Scots pine together make up most of the forests of Sweden and Finland.',
        'Old Tjikko, a Norway spruce in central Sweden, grows from a root system about 9,500 years old.'
      ]
    },
    {
      id: 'med', name: 'Mediterranean Basin', place: 'Italy, Spain, Portugal and Turkey', lat: 41.75, lon: 12.3, label: 'right',
      climate: ['Hot, dry summers', 'Mild, wet winters', 'Coasts and low hills'],
      model: { humidity: 65, elevation: 50, exposure: 0.4, serotiny: 0 },
      types: ['stone'], photos: ['stone_1', 'stone_2'],
      facts: [
        'Stone pines have been planted around the Mediterranean for thousands of years for their edible seeds.',
        'Their flat, umbrella-shaped crowns line the roads and parks of Rome.',
        'A 4-metre ancient Roman bronze pine cone, the Pigna, stands in a courtyard of the Vatican Museums.'
      ]
    },
    {
      id: 'lebanon', name: 'Mount Lebanon', place: 'Lebanon, Syria and southern Turkey', lat: 34.25, lon: 36.05, label: 'right',
      climate: ['Mediterranean mountain', 'Snowy winters', '1,300 to 3,000 m'],
      model: { humidity: 60, elevation: 1900, exposure: 0.5, serotiny: 0 },
      types: ['cedar'], photos: ['cedar_1', 'cedar_2'],
      facts: [
        'The cedar of Lebanon is the green tree on Lebanon’s flag.',
        'Ancient shipbuilders and temple builders prized its timber, and the Epic of Gilgamesh describes a great cedar forest.',
        'The Cedars of God grove in the Qadisha Valley is a UNESCO World Heritage Site.'
      ]
    },
    {
      id: 'himalaya', name: 'Himalayan foothills', place: 'Northern India, Nepal and Pakistan', lat: 30.1, lon: 79.3, label: 'right',
      climate: ['Monsoon summers', 'Dry, fire-prone spring', '500 to 2,300 m'],
      model: { humidity: 62, elevation: 1500, exposure: 0.35, serotiny: 0 },
      types: ['chir'], photos: ['chir_1', 'chir_2'],
      facts: [
        'Chir pine covers large areas of the lower Himalaya, roughly between 500 and 2,300 m.',
        'Most rain comes with the summer monsoon. The dry spring before it is fire season, and the tree’s thick bark helps it survive ground fires.',
        'Chir pine resin is tapped to make turpentine and rosin.'
      ]
    },
    {
      id: 'japan', name: 'Japanese Alps', place: 'Central Honshu · Japan', lat: 36.3, lon: 137.6, label: 'right',
      climate: ['Cool mountain', 'Heavy winter snow', '500 to 2,800 m'],
      model: { humidity: 75, elevation: 1500, exposure: 0.3, serotiny: 0 },
      types: ['larch'], photos: ['larch_1', 'larch_2'],
      facts: [
        'Japanese larch grows wild in the mountains of central Honshu and is one of the first trees to colonise the volcanic slopes of Mount Fuji.',
        'In autumn whole hillsides of larch turn gold before the needles fall.',
        'It has been planted widely for timber in Japan and Europe.'
      ]
    },
    {
      id: 'sumatra', name: 'Sumatran highlands', place: 'Lake Toba, North Sumatra · Indonesia', lat: 2.6, lon: 98.8, label: 'left',
      climate: ['Tropical highland', 'Rain all year', '800 to 2,000 m'],
      model: { humidity: 85, elevation: 1000, exposure: 0.3, serotiny: 0 },
      types: ['merkusii'], photos: ['merkusii_1', 'merkusii_2'],
      facts: [
        'Lake Toba fills the caldera of a supervolcano that erupted about 74,000 years ago. It is the largest volcanic lake on Earth.',
        'Sumatran pine forms natural stands on the dry ridges around the lake.',
        'It is one of the very few pines that grow wild in the tropics.'
      ]
    },
    {
      id: 'bunya', name: 'Bunya Mountains', place: 'South-east Queensland · Australia', lat: -26.85, lon: 151.6, label: 'left',
      climate: ['Subtropical highland', 'Summer rain', 'About 1,000 m'],
      model: { humidity: 70, elevation: 1000, exposure: 0.3, serotiny: 0 },
      types: ['bunya'], photos: ['bunya_1', 'bunya_2'],
      facts: [
        'The Bunya Mountains hold the largest remaining stand of bunya pines.',
        'In years of heavy crops, roughly every third year, Aboriginal peoples from across south-east Queensland gathered here for bunya festivals that lasted weeks.',
        'Araucarias are an ancient family of conifers that was widespread in the age of the dinosaurs.'
      ]
    },
    {
      id: 'alaska', name: 'Southeast Alaska', place: 'Tongass National Forest · USA', lat: 58.3, lon: -134.4, label: 'right',
      climate: ['Very wet, mild maritime', 'Cool summers', 'Sea level to 600 m'],
      model: { humidity: 90, elevation: 100, exposure: 0.5, serotiny: 0 },
      types: ['lodgepole'], photos: ['lodgepole_2', 'lodgepole_1'],
      facts: [
        'Here lodgepole pine grows as shore pine, a short, often twisted tree of peat bogs (muskegs) and rocky coasts.',
        'Unlike inland lodgepole, shore pine cones usually open when ripe instead of waiting for fire.',
        'The Tongass is the largest national forest in the United States.'
      ]
    },
    {
      id: 'newmexico', name: 'Southern Rockies', place: 'Sangre de Cristo Mountains, New Mexico · USA', lat: 35.85, lon: -105.8, label: 'right',
      climate: ['Dry, sunny continental', 'Summer monsoon storms', '2,000 to 3,300 m'],
      model: { humidity: 45, elevation: 2600, exposure: 0.45, serotiny: 0 },
      types: ['douglas'], photos: ['douglas_1'],
      facts: [
        'Douglas-fir here is the Rocky Mountain variety, smaller, bluer and hardier to cold and drought than the coastal form.',
        'It grows in a middle band on the mountains, between ponderosa pine below and spruce and fir above.',
        'Much of the year’s rain arrives with summer monsoon thunderstorms.'
      ]
    },
    {
      id: 'baja', name: 'Sierra San Pedro Mártir', place: 'Baja California · Mexico', lat: 30.98, lon: -115.47, label: 'left',
      climate: ['Mediterranean mountain', 'Winter snow, dry summers', '2,000 to 3,100 m'],
      model: { humidity: 45, elevation: 2600, exposure: 0.4, serotiny: 0.1 },
      types: ['sugar', 'lodgepole'], photos: ['sugar_1', 'lodgepole_2'],
      facts: [
        'This granite plateau holds the southernmost sugar pines and lodgepole pines in the world.',
        'Picacho del Diablo, at about 3,100 m, is the highest point on the Baja California peninsula.',
        'Mexico’s National Astronomical Observatory sits here for its dark, clear skies.'
      ]
    },
    {
      id: 'caledonia', name: 'Caledonian Forest', place: 'Cairngorms, Scottish Highlands · UK', lat: 57.15, lon: -3.7, label: 'left',
      climate: ['Cool oceanic', 'Wet, windy winters', '200 to 600 m'],
      model: { humidity: 82, elevation: 350, exposure: 0.5, serotiny: 0 },
      types: ['scots'], photos: ['scots_1'],
      facts: [
        'Native Scots pine woods once covered much more of the Highlands. Today only fragments remain, the largest around the Cairngorms.',
        'The Scottish crossbill, the only bird species found nowhere but the UK, uses its crossed bill to prise seeds out of pine cones.',
        'Red squirrels strip cones down to the core to reach the seeds, leaving the cores on the forest floor.'
      ]
    },
    {
      id: 'guadarrama', name: 'Sierra de Guadarrama', place: 'Central Spain', lat: 40.8, lon: -4.0, label: 'left',
      climate: ['Mediterranean mountain', 'Cold winters, hot dry summers', '1,000 to 2,400 m'],
      model: { humidity: 55, elevation: 1500, exposure: 0.45, serotiny: 0 },
      types: ['scots', 'stone'], photos: ['scots_1', 'stone_1'],
      facts: [
        'Scots pine here grows near the south-western edge of its huge range.',
        'The Valsaín pine forest, on the Segovia side of the range, has been managed for timber for centuries.',
        'Stone pines take over on the warmer, lower slopes and plains below the mountains.'
      ]
    },
    {
      id: 'bialowieza', name: 'Białowieża Forest', place: 'Poland and Belarus', lat: 52.7, lon: 23.85, label: 'right',
      climate: ['Cool continental', 'Cold, snowy winters', 'Lowland, about 150 m'],
      model: { humidity: 78, elevation: 160, exposure: 0.25, serotiny: 0 },
      types: ['spruce', 'scots'], photos: ['spruce_1', 'scots_1'],
      facts: [
        'One of the last large remnants of the ancient lowland forest that once covered much of Europe. It is a UNESCO World Heritage Site.',
        'It is home to Europe’s largest herd of free-roaming European bison.',
        'Norway spruce and Scots pine grow here alongside oak, hornbeam and lime.'
      ]
    },
    {
      id: 'taurus', name: 'Taurus Mountains', place: 'Southern Turkey', lat: 36.75, lon: 30.0, label: 'left',
      climate: ['Mediterranean mountain', 'Snowy winters', '1,300 to 2,100 m'],
      model: { humidity: 55, elevation: 1700, exposure: 0.5, serotiny: 0 },
      types: ['cedar'], photos: ['cedar_2', 'cedar_1'],
      facts: [
        'Most of the world’s cedar of Lebanon forest grows here, in Turkey’s Taurus Mountains.',
        'The trees grow on steep limestone slopes, mostly between about 1,300 and 2,000 m.',
        'Large replanting programmes have been expanding Turkey’s cedar forests.'
      ]
    },
    {
      id: 'baikal', name: 'Lake Baikal', place: 'Southern Siberia · Russia', lat: 52.3, lon: 105.0, label: 'right',
      climate: ['Extreme continental', 'Long, severe winters', '450 to 1,500 m'],
      model: { humidity: 65, elevation: 700, exposure: 0.35, serotiny: 0 },
      types: ['scots'], photos: ['scots_1'],
      facts: [
        'Scots pine forests cover the dry, sunny slopes around Lake Baikal, deep inside Siberia.',
        'Baikal is the world’s deepest lake, about 1,640 m, and holds roughly a fifth of the world’s unfrozen surface fresh water.',
        'Winter temperatures often fall below −25 °C, near the cold limit for the species.'
      ]
    },
    {
      id: 'philippines', name: 'Luzon and Mindoro', place: 'Philippines', lat: 15.3, lon: 120.1, label: 'right',
      climate: ['Tropical', 'Wet and dry seasons', 'Lowland to 1,000 m'],
      model: { humidity: 80, elevation: 500, exposure: 0.35, serotiny: 0 },
      types: ['merkusii'], photos: ['merkusii_2'],
      facts: [
        'Small native stands of Sumatran pine grow on Luzon’s Zambales Mountains and on Mindoro.',
        'They are cut off from the Sumatran populations by more than 2,000 km of sea.',
        'The more common pine of the Philippine highlands is Benguet pine, which gives Baguio its nickname, the City of Pines.'
      ]
    },
    {
      id: 'wettropics', name: 'Wet Tropics', place: 'Far north Queensland · Australia', lat: -16.6, lon: 145.3, label: 'left',
      climate: ['Tropical highland', 'Summer monsoon rain', 'About 800 to 1,200 m'],
      model: { humidity: 88, elevation: 1000, exposure: 0.3, serotiny: 0 },
      types: ['bunya'], photos: ['bunya_1'],
      facts: [
        'Two small, isolated bunya pine populations grow here, more than 1,000 km north of the main stands.',
        'The Wet Tropics of Queensland are a UNESCO World Heritage Site and hold some of the oldest surviving rainforest on Earth.',
        'Here bunyas grow in upland rainforest at around 1,000 m.'
      ]
    }
  ];
  return { PHOTOS, TYPES, REGIONS };
})();
