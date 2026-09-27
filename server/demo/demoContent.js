// Contenido de la biblioteca demo: tags, medias, álbumes, plantillas y reglas. Todas las fechas son relativas al
// momento del seed (daysAgo), así la demo siempre parece reciente. Cada funcionalidad nueva de la app debe tener
// aquí algo que la muestre (ver .claude/CLAUDE.md, "Modo demo").

// Tamaños de las imágenes generadas.
const SIZES = {
    "3:2": [1800, 1200],
    "4:3": [1600, 1200],
    "16:9": [1920, 1080],
    "2:3": [1200, 1800],
    "1:1": [1500, 1500],
    wide: [2400, 1000],
    "4k": [3840, 2160],
};

const image = (scene, palette, size = "3:2") => ({ kind: "image", scene, palette, width: SIZES[size][0], height: SIZES[size][1] });
const gif = (scene, palette, width, height) => ({ kind: "gif", scene, palette, width, height });
// Barrido de cámara sobre una escena más grande que el encuadre (horizontal o vertical según la escena).
const pan = (scene, palette, [width, height], frame, duration) => ({ kind: "video", scene, palette, width, height, video: { source: "pan", width: frame[0], height: frame[1], duration } });
const generative = (source, [width, height], duration) => ({ kind: "video", width, height, video: { source, width, height, duration } });

const TAGS = [
    { name: "Landscape", color: "#6b8e23" },
    { name: "Mountains", color: "#3b6e8f" },
    { name: "Sea", color: "#1f7a99" },
    { name: "Sunset", color: "#d9733a" },
    { name: "Night", color: "#3a3f7a" },
    { name: "City", color: "#7b4fa0" },
    { name: "Travel", color: "#b8862b" },
    { name: "Desert", color: "#c7773a" },
    { name: "Forest", color: "#2f6b45" },
    { name: "Aurora", color: "#1c9c86" },
    { name: "Abstract", color: "#c2477a" },
    { name: "Minimal", color: "#6b6b6b" },
    { name: "Wallpaper", color: "#5a5fc9" },
    { name: "Panorama", color: "#2a8c9e" },
    { name: "Motion", color: "#c43d3d" },
    { name: "4K", color: "#3d4a5c" },
    { name: "Lofoten trip", color: "#2e5c9a" },
    { name: "Tokyo nights", color: "#a3326b" },
    { name: "Atacama trip", color: "#a8582a" },
    { name: "Studio Nord", color: "#262626", type: "copyright" },
    { name: "Lena Ortiz Photo", color: "#7a4a1f", type: "copyright" },
    // Sin color: usan el estilo por defecto.
    { name: "Reference" },
    // Sin usar: aparecen en el vocabulario del panel como tags pendientes.
    { name: "Inspiration" },
    { name: "To print", color: "#8a8a8a" },
    // La añade la regla "Review restored media" al restaurar algo de la papelera.
    { name: "Restored", color: "#4a8a4a" },
];

const LENA = "Lena Ortiz";
const KENJI = "Kenji Mori";
const AMARA = "Amara Okafor";
const TOMAS = "Tomás Rivera";
const NORD = "Studio Nord";
const IRIS = "Iris Vale";

// trash: días que le quedan en la papelera (0 = se borra hoy); daysAgo debe ser mayor que los días que lleva en ella.
// wasTrashed: estuvo en la papelera y se restauró.
const MEDIA = [
    // Viaje a Lofoten: una ráfaga de subidas hace diez meses.
    { key: "lofoten-reine", asset: image("mountains", "dawn"), name: "Reine at dawn", author: LENA, tags: ["Landscape", "Mountains", "Lofoten trip", "Lena Ortiz Photo"], daysAgo: 318, favourite: true },
    { key: "lofoten-hamnoy", asset: image("mountains", "alpine"), name: "Hamnøy bridge", author: LENA, tags: ["Landscape", "Mountains", "Lofoten trip"], daysAgo: 318 },
    { key: "lofoten-fjord", asset: image("mountains", "fjord", "wide"), name: "Fjord mirror", author: LENA, tags: ["Landscape", "Mountains", "Panorama", "Lofoten trip", "Lena Ortiz Photo"], daysAgo: 317, favourite: true },
    { key: "lofoten-kvalvika", asset: image("mountains", "dusk", "2:3"), name: "Kvalvika ridge", author: LENA, tags: ["Landscape", "Mountains", "Lofoten trip"], daysAgo: 317 },
    { key: "lofoten-sunset-1", asset: image("sea", "sunset"), name: "Lofoten sunset", author: LENA, tags: ["Landscape", "Sea", "Sunset", "Lofoten trip", "Lena Ortiz Photo"], daysAgo: 316, favourite: true },
    { key: "lofoten-midnight", asset: image("sea", "golden", "wide"), name: "Midnight sun", author: LENA, tags: ["Sea", "Sunset", "Panorama", "Lofoten trip"], daysAgo: 316 },
    { key: "lofoten-beach", asset: image("sea", "pastel"), name: "Arctic beach", author: LENA, tags: ["Sea", "Landscape", "Lofoten trip"], daysAgo: 315 },
    { key: "lofoten-reinebringen", asset: image("mountains", "alpine", "4k"), name: "Reinebringen view", author: LENA, tags: ["Landscape", "Mountains", "4K", "Lofoten trip", "Lena Ortiz Photo"], daysAgo: 315 },
    { key: "lofoten-snow", asset: image("mountains", "snow"), name: "Snow ridge", author: LENA, tags: ["Landscape", "Mountains", "Lofoten trip"], daysAgo: 314, trash: 26 },
    { key: "lofoten-cabins", asset: image("mountains", "bluehour"), name: "Blue hour cabins", author: LENA, tags: ["Landscape", "Mountains", "Night", "Lofoten trip"], daysAgo: 314, wasTrashed: true },
    { key: "lofoten-sunset-2", asset: image("sea", "sunset", "2:3"), name: "Lofoten sunset", author: LENA, tags: ["Sea", "Sunset", "Lofoten trip"], daysAgo: 313 },
    { key: "lofoten-ridge", asset: pan("mountains", "fjord", [2560, 720], [1280, 720], 8), name: "Lofoten ridge", author: LENA, tags: ["Mountains", "Motion", "Lofoten trip"], daysAgo: 312 },

    // Serie de costa: la misma media name repetida a lo largo del año.
    { key: "coast-1", asset: image("sea", "overcast"), name: "Coastline study", author: LENA, tags: ["Sea", "Minimal"], daysAgo: 282 },
    { key: "coast-2", asset: image("sea", "pastel"), name: "Coastline study", author: LENA, tags: ["Sea", "Minimal"], daysAgo: 241 },
    { key: "coast-3", asset: image("sea", "golden", "4:3"), name: "Coastline study", author: LENA, tags: ["Sea", "Sunset", "Lena Ortiz Photo"], daysAgo: 203, favourite: true },
    { key: "coast-4", asset: image("sea", "night"), name: "Coastline study", author: LENA, tags: ["Sea", "Night"], daysAgo: 151 },
    { key: "coast-5", asset: image("sea", "overcast", "1:1"), name: "Coastline study", author: LENA, tags: ["Sea", "Minimal"], daysAgo: 97 },
    { key: "coast-tide", asset: image("sea", "pastel", "2:3"), name: "Low tide", author: LENA, tags: ["Sea", "Wallpaper", "Minimal"], daysAgo: 61 },
    { key: "coast-glitter", asset: gif("sea", "sunset", 480, 320), name: "Sea glitter", author: LENA, tags: ["Sea", "Motion", "Minimal"], daysAgo: 58 },
    { key: "coast-glass", asset: image("sea", "golden", "wide"), name: "Sea glass", author: LENA, tags: ["Sea", "Panorama", "Sunset"], daysAgo: 23 },
    { key: "coast-tide-video", asset: pan("sea", "golden", [720, 1800], [720, 1280], 6), name: "Portrait tide", author: LENA, tags: ["Sea", "Motion"], daysAgo: 19 },
    { key: "coast-haze", asset: image("sea", "overcast"), name: "Harbour haze", author: LENA, tags: ["Sea"], daysAgo: 36, trash: 2 },

    // Tokio de noche.
    { key: "tokyo-shinjuku", asset: image("city", "neon"), name: "Shinjuku rain", author: KENJI, tags: ["City", "Night", "Tokyo nights", "Travel"], daysAgo: 160 },
    { key: "tokyo-alley", asset: image("city", "neon", "2:3"), name: "Neon alley", author: KENJI, tags: ["City", "Night", "Tokyo nights"], daysAgo: 160 },
    { key: "tokyo-shibuya", asset: image("city", "blue"), name: "Shibuya crossing", author: KENJI, tags: ["City", "Night", "Tokyo nights", "Travel"], daysAgo: 159, favourite: true },
    { key: "tokyo-skyline", asset: image("city", "amber", "wide"), name: "Tokyo skyline", author: KENJI, tags: ["City", "Night", "Panorama", "Tokyo nights"], daysAgo: 159 },
    { key: "tokyo-train", asset: image("city", "blue"), name: "Night train", author: KENJI, tags: ["City", "Night", "Tokyo nights"], daysAgo: 158, trash: 29 },
    { key: "tokyo-rooftop", asset: image("city", "neon", "4k"), name: "Rooftop view", author: KENJI, tags: ["City", "Night", "4K", "Tokyo nights"], daysAgo: 158, favourite: true },
    { key: "tokyo-ramen", asset: image("city", "amber", "4:3"), name: "Late ramen", author: KENJI, tags: ["City", "Night", "Tokyo nights", "Travel"], daysAgo: 157, trash: 5 },
    { key: "tokyo-harbour", asset: image("city", "blue", "wide"), name: "Harbour lights", author: KENJI, tags: ["City", "Night", "Panorama", "Tokyo nights"], daysAgo: 156 },
    { key: "tokyo-tower", asset: image("city", "amber", "2:3"), name: "Tower at night", author: KENJI, tags: ["City", "Night", "Tokyo nights"], daysAgo: 155 },
    { key: "tokyo-bluehour", asset: image("city", "blue"), name: "Blue hour Tokyo", author: KENJI, tags: ["City", "Tokyo nights", "Travel"], daysAgo: 155 },
    { key: "tokyo-drift", asset: pan("city", "neon", [2560, 720], [1280, 720], 8), name: "Tokyo night drift", author: KENJI, tags: ["City", "Night", "Motion", "Tokyo nights"], daysAgo: 154 },

    // Atacama.
    { key: "atacama-luna", asset: image("desert", "sunset"), name: "Valle de la Luna", author: AMARA, tags: ["Desert", "Landscape", "Travel", "Atacama trip"], daysAgo: 96, favourite: true },
    { key: "atacama-salt", asset: image("desert", "noon", "wide"), name: "Salt flats", author: AMARA, tags: ["Desert", "Landscape", "Panorama", "Atacama trip"], daysAgo: 96 },
    { key: "atacama-crest", asset: image("desert", "red", "2:3"), name: "Dune crest", author: AMARA, tags: ["Desert", "Atacama trip"], daysAgo: 95 },
    { key: "atacama-noon", asset: image("desert", "noon"), name: "Desert noon", author: AMARA, tags: ["Desert", "Landscape", "Atacama trip"], daysAgo: 95, trash: 5 },
    { key: "atacama-canyon", asset: image("desert", "red", "wide"), name: "Red canyon", author: AMARA, tags: ["Desert", "Landscape", "Panorama", "Atacama trip"], daysAgo: 94 },
    { key: "atacama-stars", asset: image("desert", "night"), name: "Stargazing camp", author: AMARA, tags: ["Desert", "Night", "Travel", "Atacama trip"], daysAgo: 93 },
    { key: "atacama-golden", asset: image("desert", "sunset", "4k"), name: "Golden dunes", author: AMARA, tags: ["Desert", "Sunset", "4K", "Atacama trip"], daysAgo: 92, favourite: true },
    { key: "atacama-sunset", asset: image("desert", "sunset"), name: "Atacama sunset", author: AMARA, tags: ["Desert", "Sunset", "Atacama trip"], daysAgo: 91 },
    { key: "atacama-wind", asset: image("desert", "noon", "1:1"), name: "Wind lines", author: AMARA, tags: ["Desert", "Minimal", "Atacama trip"], daysAgo: 90 },

    // Auroras.
    { key: "aurora-lake", asset: image("aurora", "green"), name: "Aurora over the lake", author: TOMAS, tags: ["Aurora", "Night", "Landscape"], daysAgo: 70, favourite: true },
    { key: "aurora-veil", asset: image("aurora", "violet", "2:3"), name: "Green veil", author: TOMAS, tags: ["Aurora", "Night"], daysAgo: 70, wasTrashed: true },
    { key: "aurora-arctic", asset: image("aurora", "teal", "wide"), name: "Arctic night", author: TOMAS, tags: ["Aurora", "Night", "Panorama"], daysAgo: 69, trash: 20 },
    { key: "aurora-dance", asset: gif("aurora", "green", 480, 320), name: "Aurora dance", author: TOMAS, tags: ["Aurora", "Night", "Motion"], daysAgo: 44 },
    { key: "aurora-corona", asset: image("aurora", "violet", "1:1"), name: "Aurora corona", author: TOMAS, tags: ["Aurora", "Night"], daysAgo: 45 },
    { key: "aurora-north-1", asset: image("aurora", "green"), name: "Northern lights", author: TOMAS, tags: ["Aurora", "Night", "Landscape"], daysAgo: 44 },
    { key: "aurora-north-2", asset: image("aurora", "teal"), name: "Northern lights", author: TOMAS, tags: ["Aurora", "Night"], daysAgo: 12 },

    // Bosques.
    { key: "forest-misty", asset: image("forest", "mist"), name: "Misty pines", author: TOMAS, tags: ["Forest", "Landscape", "Minimal"], daysAgo: 250, favourite: true },
    { key: "forest-edge", asset: image("forest", "deep"), name: "Forest edge", author: TOMAS, tags: ["Forest", "Landscape"], daysAgo: 248 },
    { key: "forest-fog", asset: image("forest", "mist", "2:3"), name: "Morning fog", author: TOMAS, tags: ["Forest", "Minimal"], daysAgo: 131 },
    { key: "forest-deep", asset: image("forest", "deep", "4:3"), name: "Deep forest", author: TOMAS, tags: ["Forest"], daysAgo: 129 },
    { key: "forest-silhouettes", asset: image("forest", "dawn", "wide"), name: "Pine silhouettes", author: TOMAS, tags: ["Forest", "Landscape", "Panorama"], daysAgo: 34 },
    { key: "forest-quiet", asset: image("forest", "mist"), name: "Quiet woods", author: TOMAS, tags: ["Forest"], daysAgo: 33, trash: 9 },
    { key: "forest-hush", asset: image("forest", "dawn", "4k"), name: "Forest hush", author: TOMAS, tags: ["Forest", "Landscape", "4K"], daysAgo: 3 },

    // Studio Nord: composiciones con tag de copyright.
    { key: "nord-1", asset: image("abstract", "bauhaus", "1:1"), name: "Composition No. 1", author: NORD, tags: ["Abstract", "Minimal", "Studio Nord"], daysAgo: 201, favourite: true },
    { key: "nord-2", asset: image("abstract", "nord", "1:1"), name: "Composition No. 2", author: NORD, tags: ["Abstract", "Minimal", "Studio Nord"], daysAgo: 171 },
    { key: "nord-rotating", asset: gif("abstract", "bauhaus", 400, 400), name: "Rotating forms", author: NORD, tags: ["Abstract", "Motion", "Studio Nord"], daysAgo: 140 },
    { key: "nord-3", asset: image("abstract", "night", "1:1"), name: "Composition No. 3", author: NORD, tags: ["Abstract", "Minimal", "Studio Nord"], daysAgo: 141 },
    { key: "nord-4", asset: image("abstract", "mono", "1:1"), name: "Composition No. 4", author: NORD, tags: ["Abstract", "Minimal", "Studio Nord"], daysAgo: 111 },
    { key: "nord-5", asset: image("abstract", "bauhaus", "2:3"), name: "Composition No. 5", author: NORD, tags: ["Abstract", "Minimal", "Wallpaper", "Studio Nord"], daysAgo: 81 },
    { key: "nord-6", asset: image("abstract", "nord", "1:1"), name: "Composition No. 6", author: NORD, tags: ["Abstract", "Minimal", "Studio Nord"], daysAgo: 51, trash: 13 },
    { key: "nord-7", asset: image("abstract", "night", "2:3"), name: "Composition No. 7", author: NORD, tags: ["Abstract", "Wallpaper", "Studio Nord"], daysAgo: 26 },
    { key: "nord-grid", asset: image("abstract", "bauhaus"), name: "Bauhaus grid", author: NORD, tags: ["Abstract", "Studio Nord"], daysAgo: 11, favourite: true },
    { key: "nord-field", asset: image("abstract", "mono", "2:3"), name: "Colour field", author: NORD, tags: ["Abstract", "Minimal", "Wallpaper", "Studio Nord"], daysAgo: 2 },

    // Fondos, bokeh y vídeos generativos.
    { key: "iris-soft-1", asset: image("blobs", "pastel", "2:3"), name: "Soft gradient", author: IRIS, tags: ["Wallpaper", "Abstract"], daysAgo: 188, favourite: true },
    { key: "iris-soft-2", asset: image("blobs", "sea", "2:3"), name: "Soft gradient", author: IRIS, tags: ["Wallpaper", "Abstract"], daysAgo: 120 },
    { key: "iris-bokeh", asset: image("bokeh", "warm"), name: "Bokeh lights", author: IRIS, tags: ["Night", "Abstract"], daysAgo: 87 },
    { key: "iris-bloom", asset: image("blobs", "dusk", "1:1"), name: "Night bloom", author: IRIS, tags: ["Abstract", "Night"], daysAgo: 64 },
    { key: "iris-pastel", asset: image("blobs", "pastel", "2:3"), name: "Pastel haze", author: IRIS, tags: ["Wallpaper"], daysAgo: 40, trash: 30 },
    { key: "iris-drift", asset: pan("blobs", "dusk", [2560, 720], [1280, 720], 8), name: "Colour drift", author: IRIS, tags: ["Abstract", "Motion"], daysAgo: 38, favourite: true },
    { key: "iris-city-bokeh", asset: image("bokeh", "city"), name: "City bokeh", author: IRIS, tags: ["City", "Night"], daysAgo: 29, trash: 14 },
    { key: "iris-life", asset: generative("life", [1080, 1080], 6), name: "Game of life", author: IRIS, tags: ["Abstract", "Motion"], daysAgo: 17 },
    { key: "iris-ember", asset: image("blobs", "ember", "2:3"), name: "Ember", author: IRIS, tags: ["Wallpaper", "Abstract"], daysAgo: 8 },

    // Subidas recientes sin ordenar: sin autor y, algunas, sin nombre o sin tags (el panel las cuenta como pendientes).
    { key: "misc-1", asset: image("sea", "night"), name: null, author: null, tags: [], daysAgo: 34, trash: 1 },
    { key: "misc-2", asset: image("forest", "deep"), name: "IMG_2041", author: null, tags: ["Reference"], daysAgo: 4 },
    { key: "misc-3", asset: image("abstract", "mono", "1:1"), name: null, author: null, tags: ["Reference"], daysAgo: 4 },
    { key: "misc-4", asset: image("mountains", "snow"), name: "Screenshot reference", author: null, tags: [], daysAgo: 35, trash: 0 },
    { key: "misc-5", asset: image("city", "amber", "16:9"), name: null, author: null, tags: [], daysAgo: 1 },
    { key: "misc-6", asset: image("bokeh", "city"), name: "Untitled", author: null, tags: [], daysAgo: 0 },
    { key: "misc-7", asset: image("desert", "red", "4:3"), name: null, author: null, tags: ["Reference"], daysAgo: 0 },
];

// Medias en orden; cover es la portada. Las que están en la papelera se ocultan pero conservan su hueco.
const ALBUMS = [
    { name: "Lofoten", daysAgo: 312, cover: "lofoten-reine", media: MEDIA.filter((item) => item.key.startsWith("lofoten-")).map((item) => item.key) },
    { name: "Tokyo after dark", daysAgo: 154, cover: "tokyo-shibuya", media: MEDIA.filter((item) => item.key.startsWith("tokyo-")).map((item) => item.key) },
    { name: "Atacama", daysAgo: 90, cover: "atacama-luna", media: MEDIA.filter((item) => item.key.startsWith("atacama-")).map((item) => item.key) },
    { name: "Studio Nord", daysAgo: 200, cover: "nord-grid", media: MEDIA.filter((item) => item.key.startsWith("nord-")).map((item) => item.key) },
    { name: "Wallpapers", daysAgo: 180, cover: "iris-soft-1", media: ["iris-soft-1", "iris-soft-2", "iris-pastel", "coast-tide", "nord-5", "nord-7", "nord-field", "iris-ember"] },
    { name: "Portfolio", daysAgo: 60, cover: "lofoten-fjord", media: ["lofoten-fjord", "lofoten-reine", "coast-3", "tokyo-rooftop", "atacama-golden", "aurora-lake", "forest-misty", "nord-1", "iris-drift", "lofoten-snow"] },
    // Vacío: enseña el estado de un álbum sin medias.
    { name: "To print", daysAgo: 20, cover: null, media: [] },
];

const TEMPLATES = [
    { name: "Lofoten trip", displayname: "Lofoten", author: LENA, tags: ["Landscape", "Mountains", "Lofoten trip", "Lena Ortiz Photo"], daysAgo: 319 },
    { name: "Studio Nord release", displayname: "Composition", author: NORD, tags: ["Abstract", "Minimal", "Studio Nord"], markFavourite: true, daysAgo: 202 },
    { name: "Tokyo nights", displayname: "", author: KENJI, tags: ["City", "Night", "Tokyo nights", "Travel"], daysAgo: 161 },
    { name: "Phone wallpaper", displayname: "", author: "", tags: ["Wallpaper", "Minimal"], daysAgo: 100 },
    { name: "Quick reference", displayname: "", author: "", tags: ["Reference"], daysAgo: 15 },
];

// Nodos de un workflow. Los álbumes se indican por nombre ({ album }) y el seed los traduce a su id.
const node = (id, type, x, y, config = {}) => ({ id, type, position: { x, y }, config });
const edge = (source, target, sourceHandle = "out") => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });

const RULES = [
    {
        name: "Tag motion media",
        isActive: true,
        daysAgo: 300,
        applied: { count: 11, daysAgo: 17 },
        graph: {
            nodes: [node("added", "trigger.mediaAdded", 0, 0), node("type", "condition.mediaType", 340, 0, { types: ["video", "gif"] }), node("motion", "action.addTags", 680, -60, { tags: ["Motion"] })],
            edges: [edge("added", "type"), edge("type", "motion", "true")],
        },
    },
    {
        name: "Mark 4K media",
        isActive: true,
        daysAgo: 250,
        applied: { count: 5, daysAgo: 3 },
        graph: {
            nodes: [
                node("added", "trigger.mediaAdded", 0, -80),
                node("edited", "trigger.mediaEdited", 0, 80),
                node("resolution", "condition.resolution", 340, 0, { operator: "min", width: 3840, height: 2160 }),
                node("tag", "action.addTags", 680, -60, { tags: ["4K"] }),
            ],
            edges: [edge("added", "resolution"), edge("edited", "resolution"), edge("resolution", "tag", "true")],
        },
    },
    {
        name: "Studio Nord releases",
        isActive: true,
        daysAgo: 200,
        applied: { count: 11, daysAgo: 2 },
        graph: {
            nodes: [
                node("added", "trigger.mediaAdded", 0, -80),
                node("edited", "trigger.mediaEdited", 0, 80),
                node("author", "condition.author", 340, 0, { operator: "is", values: [NORD] }),
                node("copyright", "action.addTags", 680, -60, { tags: ["Studio Nord"] }),
                node("album", "action.addToAlbum", 1020, -60, { album: "Studio Nord" }),
            ],
            edges: [edge("added", "author"), edge("edited", "author"), edge("author", "copyright", "true"), edge("copyright", "album")],
        },
    },
    {
        name: "Portrait wallpapers",
        isActive: true,
        daysAgo: 150,
        applied: { count: 8, daysAgo: 8 },
        graph: {
            nodes: [
                node("added", "trigger.mediaAdded", 0, 0),
                node("portrait", "condition.orientation", 340, 0, { orientation: "portrait" }),
                node("style", "condition.tags", 680, -60, { match: "any", tags: ["Abstract", "Minimal", "Wallpaper"] }),
                node("tag", "action.addTags", 1020, -120, { tags: ["Wallpaper"] }),
                node("album", "action.addToAlbum", 1360, -120, { album: "Wallpapers" }),
            ],
            edges: [edge("added", "portrait"), edge("portrait", "style", "true"), edge("style", "tag", "true"), edge("tag", "album")],
        },
    },
    {
        name: "Review restored media",
        isActive: true,
        daysAgo: 90,
        applied: { count: 2, daysAgo: 65 },
        graph: {
            nodes: [node("restored", "trigger.mediaRestored", 0, 0), node("trashed", "condition.trashed", 340, 0), node("tag", "action.addTags", 680, -60, { tags: ["Restored"] })],
            edges: [edge("restored", "trashed"), edge("trashed", "tag", "true")],
        },
    },
    {
        name: "Favourite Lofoten sunsets",
        isActive: false,
        daysAgo: 60,
        applied: null,
        graph: {
            nodes: [node("manual", "trigger.manual", 0, 0), node("sunsets", "condition.tags", 340, 0, { match: "all", tags: ["Lofoten trip", "Sunset"] }), node("favourite", "action.favourite", 680, -60, { value: true })],
            edges: [edge("manual", "sunsets"), edge("sunsets", "favourite", "true")],
        },
    },
    // Activa pero sin álbum de destino (como si se hubiera borrado): aparece en pausa hasta que se elija otro.
    {
        name: "Send favourites to print",
        isActive: true,
        daysAgo: 30,
        applied: { count: 6, daysAgo: 25 },
        graph: {
            nodes: [node("edited", "trigger.mediaEdited", 0, 0), node("favourite", "condition.favourite", 340, 0), node("album", "action.addToAlbum", 680, -60, { album: null })],
            edges: [edge("edited", "favourite"), edge("favourite", "album", "true")],
        },
    },
];

module.exports = { TAGS, MEDIA, ALBUMS, TEMPLATES, RULES };
