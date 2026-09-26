// Reglas: cada regla es un workflow de nodos conectados (como en n8n), guardado como JSON { nodes, edges }.
// - Disparadores (trigger.*): cuándo se ejecuta la regla. Tienen una salida "out".
// - Condiciones (condition.*): comprueban un dato de la media. Tienen una entrada y las salidas "true" y "false".
// - Acciones (action.*): cambian la media. Tienen una entrada y una salida "out" para encadenar más nodos.
// Este módulo es puro (sin base de datos): sanea el grafo que envía el cliente, detecta lo que falta por
// configurar y evalúa condiciones y acciones sobre una copia en memoria de la media.
// El cliente replica los tipos y las comprobaciones en client/src/utils/ruleGraph.js para pintar el editor.
const { isDriveTagName } = require("./driveTag");

const MAX_NODES = 60;
const MAX_EDGES = 120;
const MAX_RULE_TAGS = 50;
const MAX_RULE_VALUES = 50;
const MAX_MEDIA_TAGS = 50;
const MAX_POSITION = 100000;
const MAX_DIMENSION = 100000;
const MAX_SIZE_VALUE = 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

const SIZE_UNITS = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
const MEDIA_TYPES = ["image", "gif", "video"];

// Evento que dispara cada tipo de disparador. "manual" solo se ejecuta con "Run" desde el editor.
const TRIGGER_EVENTS = {
    "trigger.mediaAdded": "added",
    "trigger.mediaEdited": "edited",
    "trigger.mediaRestored": "restored",
    "trigger.manual": "manual",
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

// Lista sin vacíos ni repetidos (sin distinguir mayúsculas), con un máximo de elementos y de caracteres.
const sanitizeTextList = (value, maxItems, maxLength) => {
    const items = [];
    const seen = new Set();
    for (const rawItem of Array.isArray(value) ? value : []) {
        const item = String(rawItem ?? "").trim().slice(0, maxLength);
        if (item && !seen.has(normalizeKey(item)) && items.length < maxItems) {
            seen.add(normalizeKey(item));
            items.push(item);
        }
    }
    return items;
};

const sanitizeTagList = (value) => sanitizeTextList(value, MAX_RULE_TAGS, 100);

const pickOption = (value, options, fallback) => (options.includes(value) ? value : fallback);

const toPositiveInteger = (value, max) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= max ? number : null;
};

const toPositiveNumber = (value, max) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && number <= max ? Math.round(number * 100) / 100 : null;
};

// Nombre de media o autor comparado con varios valores: se cumple si coincide cualquiera de ellos.
// Admite el formato anterior, con un solo "value".
const textCondition = (maxLength, label) => ({
    category: "condition",
    sanitize: (config) => ({
        operator: pickOption(config.operator, ["is", "contains", "empty"], "is"),
        values: sanitizeTextList(Array.isArray(config.values) ? config.values : [config.value], MAX_RULE_VALUES, maxLength),
    }),
    validate: (config) => (config.operator !== "empty" && config.values.length === 0 ? `Add at least one ${label}` : null),
});

const matchesText = (config, value) => {
    const current = normalizeKey(value);
    if (config.operator === "empty") return !current;
    return config.values.some((expected) => (config.operator === "contains" ? current.includes(normalizeKey(expected)) : current === normalizeKey(expected)));
};

const tagListAction = {
    category: "action",
    sanitize: (config) => ({ tags: sanitizeTagList(config.tags) }),
    validate: (config) => (config.tags.length === 0 ? "Add at least one tag" : null),
};

const noConfig = (category) => ({ category, sanitize: () => ({}), validate: () => null });

// Resolución sin importar la orientación: se comparan el lado largo y el corto.
const getSides = (width, height) => [Math.max(width, height), Math.min(width, height)];

const NODE_TYPES = {
    "trigger.mediaAdded": noConfig("trigger"),
    "trigger.mediaEdited": noConfig("trigger"),
    "trigger.mediaRestored": noConfig("trigger"),
    "trigger.manual": noConfig("trigger"),

    "condition.tags": {
        category: "condition",
        sanitize: (config) => ({ match: pickOption(config.match, ["any", "all", "empty"], "any"), tags: sanitizeTagList(config.tags) }),
        validate: (config) => (config.match !== "empty" && config.tags.length === 0 ? "Add at least one tag" : null),
        // "No tags" no cuenta la tag de sistema "Google Drive", que llevan todas las medias de Drive.
        evaluate: (config, media) => {
            if (config.match === "empty") return media.tags.every(isDriveTagName);
            const current = new Set(media.tags.map(normalizeKey));
            const check = (tag) => current.has(normalizeKey(tag));
            return config.match === "all" ? config.tags.every(check) : config.tags.some(check);
        },
    },
    "condition.name": { ...textCondition(255, "media name"), evaluate: (config, media) => matchesText(config, media.displayname) },
    "condition.author": { ...textCondition(100, "author"), evaluate: (config, media) => matchesText(config, media.author) },
    "condition.size": {
        category: "condition",
        sanitize: (config) => ({
            operator: pickOption(config.operator, ["gt", "lt"], "gt"),
            value: toPositiveNumber(config.value, MAX_SIZE_VALUE),
            unit: pickOption(config.unit, Object.keys(SIZE_UNITS), "MB"),
        }),
        validate: (config) => (config.value === null ? "Enter a size" : null),
        evaluate: (config, media) => {
            const bytes = config.value * SIZE_UNITS[config.unit];
            return config.operator === "gt" ? media.size > bytes : media.size < bytes;
        },
    },
    "condition.resolution": {
        category: "condition",
        sanitize: (config) => ({
            operator: pickOption(config.operator, ["min", "max", "exact"], "min"),
            width: toPositiveInteger(config.width, MAX_DIMENSION),
            height: toPositiveInteger(config.height, MAX_DIMENSION),
        }),
        validate: (config) => (config.width === null || config.height === null ? "Enter a width and a height" : null),
        // Una media sin resolución conocida no cumple la condición.
        evaluate: (config, media) => {
            if (!media.width || !media.height) return false;
            const [long, short] = getSides(media.width, media.height);
            const [expectedLong, expectedShort] = getSides(config.width, config.height);
            if (config.operator === "exact") return long === expectedLong && short === expectedShort;
            if (config.operator === "max") return long <= expectedLong && short <= expectedShort;
            return long >= expectedLong && short >= expectedShort;
        },
    },
    "condition.orientation": {
        category: "condition",
        sanitize: (config) => ({ orientation: pickOption(config.orientation, ["landscape", "portrait", "square"], "landscape") }),
        validate: () => null,
        evaluate: (config, media) => {
            if (!media.width || !media.height) return false;
            const orientation = media.width > media.height ? "landscape" : media.width < media.height ? "portrait" : "square";
            return orientation === config.orientation;
        },
    },
    "condition.mediaType": {
        category: "condition",
        sanitize: (config) => ({ types: MEDIA_TYPES.filter((type) => Array.isArray(config.types) && config.types.includes(type)) }),
        validate: (config) => (config.types.length === 0 ? "Choose at least one media type" : null),
        evaluate: (config, media) => config.types.includes(media.mediatype),
    },
    "condition.favourite": { ...noConfig("condition"), evaluate: (config, media) => media.is_favourite },
    "condition.trashed": { ...noConfig("condition"), evaluate: (config, media) => media.was_trashed },

    "action.addTags": {
        ...tagListAction,
        // La tag "Google Drive" es exclusiva de las medias de Drive y ya la llevan todas.
        apply: (config, media) => {
            const current = new Set(media.tags.map(normalizeKey));
            for (const tag of config.tags) {
                if (media.tags.length >= MAX_MEDIA_TAGS) break;
                if (!current.has(normalizeKey(tag)) && !isDriveTagName(tag)) {
                    media.tags.push(tag);
                    current.add(normalizeKey(tag));
                }
            }
        },
    },
    "action.removeTags": {
        ...tagListAction,
        apply: (config, media) => {
            const removed = new Set(config.tags.filter((tag) => !isDriveTagName(tag)).map(normalizeKey));
            media.tags = media.tags.filter((tag) => !removed.has(normalizeKey(tag)));
        },
    },
    "action.favourite": {
        category: "action",
        sanitize: (config) => ({ value: config.value !== false }),
        validate: () => null,
        apply: (config, media) => {
            media.is_favourite = config.value;
        },
    },
    "action.addToAlbum": {
        category: "action",
        sanitize: (config) => ({ albumId: toPositiveInteger(config.albumId, Number.MAX_SAFE_INTEGER) }),
        validate: (config, context) => (config.albumId === null || !context.albumIds.has(config.albumId) ? "Choose an album" : null),
        // Si el álbum se borró después de guardar la regla, la acción no hace nada.
        apply: (config, media, context) => {
            if (context.albumIds.has(config.albumId)) media.albumIds.add(config.albumId);
        },
    },
};

const OUTPUTS = { trigger: ["out"], condition: ["true", "false"], action: ["out"] };

const getCategory = (type) => NODE_TYPES[type]?.category;

const sanitizePosition = (position) => {
    const clamp = (value) => Math.max(-MAX_POSITION, Math.min(MAX_POSITION, Math.round(Number(value) * 10) / 10));
    return { x: Number.isFinite(Number(position?.x)) ? clamp(position.x) : 0, y: Number.isFinite(Number(position?.y)) ? clamp(position.y) : 0 };
};

const hasCycle = (nodes, edges) => {
    const targetsBySource = new Map(nodes.map((node) => [node.id, []]));
    edges.forEach((edge) => targetsBySource.get(edge.source).push(edge.target));
    const state = new Map();
    const visit = (nodeId) => {
        if (state.get(nodeId) === "done") return false;
        if (state.get(nodeId) === "visiting") return true;
        state.set(nodeId, "visiting");
        const cyclic = targetsBySource.get(nodeId).some(visit);
        state.set(nodeId, "done");
        return cyclic;
    };
    return nodes.some((node) => visit(node.id));
};

// Normaliza el grafo recibido. Admite nodos sin terminar de configurar (se guardan como borrador),
// pero rechaza estructuras imposibles: tipos desconocidos, conexiones inválidas o ciclos.
const sanitizeGraph = (rawGraph) => {
    if (!rawGraph || typeof rawGraph !== "object" || !Array.isArray(rawGraph.nodes) || !Array.isArray(rawGraph.edges)) {
        return { error: "The workflow must have nodes and connections" };
    }
    if (rawGraph.nodes.length > MAX_NODES) return { error: `A rule can have at most ${MAX_NODES} nodes` };
    if (rawGraph.edges.length > MAX_EDGES) return { error: `A rule can have at most ${MAX_EDGES} connections` };

    const nodes = [];
    const nodesById = new Map();
    for (const rawNode of rawGraph.nodes) {
        if (!rawNode || !ID_PATTERN.test(String(rawNode.id)) || nodesById.has(rawNode.id)) return { error: "Each node needs a unique id" };
        const definition = NODE_TYPES[rawNode.type];
        if (!definition) return { error: "The workflow contains an unknown node" };
        const config = rawNode.config && typeof rawNode.config === "object" && !Array.isArray(rawNode.config) ? rawNode.config : {};
        const node = { id: rawNode.id, type: rawNode.type, position: sanitizePosition(rawNode.position), config: definition.sanitize(config) };
        nodes.push(node);
        nodesById.set(node.id, node);
    }

    const edges = [];
    const edgeKeys = new Set();
    const edgeIds = new Set();
    for (const rawEdge of rawGraph.edges) {
        const source = nodesById.get(rawEdge?.source);
        const target = nodesById.get(rawEdge?.target);
        const sourceHandle = rawEdge?.sourceHandle || "out";
        if (!source || !target || source.id === target.id) return { error: "The workflow contains an invalid connection" };
        if (!OUTPUTS[getCategory(source.type)].includes(sourceHandle) || getCategory(target.type) === "trigger") {
            return { error: "The workflow contains an invalid connection" };
        }
        const key = `${source.id}:${sourceHandle}:${target.id}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        let id = ID_PATTERN.test(String(rawEdge.id)) && !edgeIds.has(rawEdge.id) ? rawEdge.id : `edge-${edges.length + 1}`;
        while (edgeIds.has(id)) id = `${id}-1`.slice(-40);
        edgeIds.add(id);
        edges.push({ id, source: source.id, sourceHandle, target: target.id });
    }

    if (hasCycle(nodes, edges)) return { error: "Connections can't form a loop" };
    return { data: { nodes, edges } };
};

const getReachableNodeIds = (graph, startIds) => {
    const reachable = new Set();
    const queue = [...startIds];
    while (queue.length) {
        const nodeId = queue.shift();
        if (reachable.has(nodeId)) continue;
        reachable.add(nodeId);
        graph.edges.filter((edge) => edge.source === nodeId).forEach((edge) => queue.push(edge.target));
    }
    return reachable;
};

// Lo que impide activar o ejecutar la regla. context.albumIds: álbumes del usuario.
const getGraphIssues = (graph, context) => {
    const issues = [];
    const triggerIds = graph.nodes.filter((node) => getCategory(node.type) === "trigger").map((node) => node.id);
    if (triggerIds.length === 0) issues.push({ message: "Add a trigger" });

    const reachable = getReachableNodeIds(graph, triggerIds);
    if (!graph.nodes.some((node) => getCategory(node.type) === "action" && reachable.has(node.id))) {
        issues.push({ message: "Connect an action to a trigger" });
    }

    graph.nodes.forEach((node) => {
        const message = NODE_TYPES[node.type].validate(node.config, context);
        if (message) issues.push({ nodeId: node.id, message });
    });
    return issues;
};

// Ejecuta el workflow sobre la copia en memoria de una media (media.tags, media.is_favourite, media.albumIds...).
// Parte de los disparadores del evento (o de todos, con "manual") y recorre las conexiones: cada condición
// sigue su salida "true" o "false" y cada acción cambia la media y sigue su salida. Un nodo se ejecuta una vez.
const executeGraph = (graph, event, media, context) => {
    const startNodes = graph.nodes.filter((node) => {
        const triggerEvent = TRIGGER_EVENTS[node.type];
        return triggerEvent && (event === "manual" || triggerEvent === event);
    });
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const visited = new Set();

    const visit = (node, handle) => {
        graph.edges
            .filter((edge) => edge.source === node.id && edge.sourceHandle === handle)
            .forEach((edge) => run(nodesById.get(edge.target)));
    };

    const run = (node) => {
        if (!node || visited.has(node.id)) return;
        visited.add(node.id);
        const definition = NODE_TYPES[node.type];
        if (definition.category === "condition") {
            visit(node, definition.evaluate(node.config, media, context) ? "true" : "false");
        } else if (definition.category === "action") {
            definition.apply(node.config, media, context);
            visit(node, "out");
        }
    };

    startNodes.forEach((node) => {
        visited.add(node.id);
        visit(node, "out");
    });
};

module.exports = { NODE_TYPES, TRIGGER_EVENTS, sanitizeGraph, getGraphIssues, executeGraph };
