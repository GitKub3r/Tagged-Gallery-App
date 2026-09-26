import {
    faCropSimple,
    faEraser,
    faFolderPlus,
    faFont,
    faHandPointer,
    faHeart,
    faPen,
    faPhotoFilm,
    faPlus,
    faRotateLeft,
    faRulerCombined,
    faTag,
    faTags,
    faTrashCan,
    faUserPen,
    faWeightHanging,
} from "@fortawesome/free-solid-svg-icons";

// Tipos de nodo de las reglas. El servidor (server/utils/ruleGraph.js) es la autoridad: valida y ejecuta
// el workflow. Aquí están los textos, iconos, valores iniciales y las mismas comprobaciones para el editor.

export const RULE_CATEGORIES = [
    { key: "trigger", label: "Trigger", plural: "Triggers", description: "When the rule runs" },
    { key: "condition", label: "Condition", plural: "Conditions", description: "Check the media and branch" },
    { key: "action", label: "Action", plural: "Actions", description: "What happens to the media" },
];

export const RULE_OUTPUTS = { trigger: ["out"], condition: ["true", "false"], action: ["out"] };

export const SIZE_UNITS = ["KB", "MB", "GB"];

export const MEDIA_TYPE_OPTIONS = [
    { value: "image", label: "Images" },
    { value: "gif", label: "GIFs" },
    { value: "video", label: "Videos" },
];

const TEXT_OPERATORS = { is: "Is", contains: "Contains", empty: "Is empty" };
const TAG_MATCHES = { any: "Has any of", all: "Has all of", empty: "Has no tags" };
const SIZE_OPERATORS = { gt: "Larger than", lt: "Smaller than" };
const RESOLUTION_OPERATORS = { min: "At least", max: "At most", exact: "Exactly" };
const ORIENTATIONS = { landscape: "Landscape", portrait: "Portrait", square: "Square" };

export const RULE_OPTION_LABELS = { TEXT_OPERATORS, TAG_MATCHES, SIZE_OPERATORS, RESOLUTION_OPERATORS, ORIENTATIONS };

const textCondition = (label, subject, description) => ({
    category: "condition",
    label,
    description,
    defaultConfig: { operator: "is", value: "" },
    summarize: (config) => (config.operator === "empty" ? "Is empty" : `${TEXT_OPERATORS[config.operator]} “${config.value}”`),
    validate: (config) => (config.operator !== "empty" && !config.value.trim() ? `Type the ${subject} to compare` : null),
});

const tagsAction = (label, description) => ({
    category: "action",
    label,
    description,
    defaultConfig: { tags: [] },
    tags: (config) => config.tags,
    summarize: () => "",
    validate: (config) => (config.tags.length === 0 ? "Add at least one tag" : null),
});

const noConfig = (category, label, description, summary) => ({ category, label, description, defaultConfig: {}, summarize: () => summary, validate: () => null });

// icon: Font Awesome. tags(config): tags que el nodo pinta como chips. summarize(config, context): resumen breve.
// validate(config, context): lo que falta por configurar (null si está completo). context.albumsById: álbumes.
export const RULE_NODE_TYPES = {
    "trigger.mediaAdded": { ...noConfig("trigger", "Media added", "Runs when media are uploaded or added from Google Drive.", "Uploads and Google Drive"), icon: faPlus },
    "trigger.mediaEdited": { ...noConfig("trigger", "Media edited", "Runs when you change the name, author, tags or favourite of a media.", "Name, author, tags or favourite"), icon: faPen },
    "trigger.mediaRestored": { ...noConfig("trigger", "Media restored", "Runs when media come back from the trash.", "Back from the trash"), icon: faRotateLeft },
    "trigger.manual": { ...noConfig("trigger", "Manual run", "Runs only when you press Run rule. Every rule can also be run on the whole library.", "Only with Run rule"), icon: faHandPointer },

    "condition.tags": {
        category: "condition",
        label: "Tags",
        description: "Check the tags of the media.",
        icon: faTags,
        defaultConfig: { match: "any", tags: [] },
        tags: (config) => (config.match === "empty" ? [] : config.tags),
        summarize: (config) => TAG_MATCHES[config.match],
        validate: (config) => (config.match !== "empty" && config.tags.length === 0 ? "Add at least one tag" : null),
    },
    "condition.name": { ...textCondition("Media name", "media name", "Compare the name of the media."), icon: faFont },
    "condition.author": { ...textCondition("Author", "author", "Compare the author of the media."), icon: faUserPen },
    "condition.size": {
        category: "condition",
        label: "File size",
        description: "Compare the size of the original file.",
        icon: faWeightHanging,
        defaultConfig: { operator: "gt", value: "", unit: "MB" },
        summarize: (config) => `${SIZE_OPERATORS[config.operator]} ${config.value || "…"} ${config.unit}`,
        validate: (config) => (!(Number(config.value) > 0) ? "Enter a size" : null),
    },
    "condition.resolution": {
        category: "condition",
        label: "Resolution",
        description: "Compare the resolution. Portrait and landscape media both count, and media without a known resolution don't match.",
        icon: faRulerCombined,
        defaultConfig: { operator: "min", width: "", height: "" },
        summarize: (config) => `${RESOLUTION_OPERATORS[config.operator]} ${config.width || "…"} × ${config.height || "…"}`,
        validate: (config) => (!(Number(config.width) > 0) || !(Number(config.height) > 0) ? "Enter a width and a height" : null),
    },
    "condition.orientation": {
        category: "condition",
        label: "Orientation",
        description: "Check whether the media is landscape, portrait or square.",
        icon: faCropSimple,
        defaultConfig: { orientation: "landscape" },
        summarize: (config) => ORIENTATIONS[config.orientation],
        validate: () => null,
    },
    "condition.mediaType": {
        category: "condition",
        label: "Media type",
        description: "Check whether the media is an image, a GIF or a video.",
        icon: faPhotoFilm,
        defaultConfig: { types: ["image"] },
        summarize: (config) => MEDIA_TYPE_OPTIONS.filter((option) => config.types.includes(option.value)).map((option) => option.label).join(", "),
        validate: (config) => (config.types.length === 0 ? "Choose at least one media type" : null),
    },
    "condition.favourite": { ...noConfig("condition", "Favourite", "Check whether the media is in your favourites.", "Is in favourites"), icon: faHeart },
    "condition.trashed": { ...noConfig("condition", "Trash history", "Check whether the media was ever in the trash, even if it was restored.", "Was in the trash"), icon: faTrashCan },

    "action.addTags": { ...tagsAction("Add tags", "Add tags to the media. New tags use the default style."), icon: faTag },
    "action.removeTags": { ...tagsAction("Remove tags", "Remove tags from the media. The Google Drive tag stays."), icon: faEraser },
    "action.favourite": {
        category: "action",
        label: "Set favourite",
        description: "Add the media to your favourites or remove it from them.",
        icon: faHeart,
        defaultConfig: { value: true },
        summarize: (config) => (config.value ? "Add to favourites" : "Remove from favourites"),
        validate: () => null,
    },
    "action.addToAlbum": {
        category: "action",
        label: "Add to album",
        description: "Add the media to one of your albums.",
        icon: faFolderPlus,
        defaultConfig: { albumId: null },
        summarize: (config, context) => context.albumsById?.get(config.albumId)?.albumname || "",
        // Mientras no han cargado los álbumes no se marca como pendiente.
        validate: (config, context) => (!config.albumId || (context.albumsById && !context.albumsById.has(config.albumId)) ? "Choose an album" : null),
    },
};

export const getNodeDefinition = (type) => RULE_NODE_TYPES[type];

// Sin crypto.randomUUID: no existe fuera de HTTPS (p. ej. al abrir la app desde el móvil por la IP de la red local).
export const createRuleId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// --- Conversión entre el formato de la API y el de React Flow ---

const roundPosition = (value) => Math.round(Number(value) * 10) / 10;

export const toFlowNodes = (graph) =>
    graph.nodes
        .filter((node) => RULE_NODE_TYPES[node.type])
        .map((node) => ({ id: node.id, type: "rule", position: node.position, data: { type: node.type, config: { ...RULE_NODE_TYPES[node.type].defaultConfig, ...node.config } } }));

export const toFlowEdges = (graph) =>
    graph.edges.map((edge) => ({ id: edge.id, source: edge.source, sourceHandle: edge.sourceHandle, target: edge.target, targetHandle: "in", type: "rule" }));

export const toApiGraph = (nodes, edges) => ({
    nodes: nodes.map((node) => ({ id: node.id, type: node.data.type, position: { x: roundPosition(node.position.x), y: roundPosition(node.position.y) }, config: node.data.config })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, sourceHandle: edge.sourceHandle || "out", target: edge.target })),
});

// --- Comprobaciones (las mismas que hace el servidor) ---

const getCategory = (node) => RULE_NODE_TYPES[node.data.type]?.category;

export const getReachableNodeIds = (nodes, edges) => {
    const reachable = new Set();
    const queue = nodes.filter((node) => getCategory(node) === "trigger").map((node) => node.id);
    while (queue.length) {
        const nodeId = queue.shift();
        if (reachable.has(nodeId)) continue;
        reachable.add(nodeId);
        edges.filter((edge) => edge.source === nodeId).forEach((edge) => queue.push(edge.target));
    }
    return reachable;
};

export const getNodeIssue = (node, context) => RULE_NODE_TYPES[node.data.type]?.validate(node.data.config, context) || null;

// Lo que impide activar o ejecutar la regla: [{ nodeId?, message }].
export const getRuleIssues = (nodes, edges, context) => {
    const issues = [];
    if (!nodes.some((node) => getCategory(node) === "trigger")) issues.push({ message: "Add a trigger" });
    const reachable = getReachableNodeIds(nodes, edges);
    if (!nodes.some((node) => getCategory(node) === "action" && reachable.has(node.id))) issues.push({ message: "Connect an action to a trigger" });
    nodes.forEach((node) => {
        const message = getNodeIssue(node, context);
        if (message) issues.push({ nodeId: node.id, message });
    });
    return issues;
};

// Una conexión válida no entra en un disparador, no se repite y no forma un bucle.
export const isValidRuleConnection = (connection, nodes, edges) => {
    const { source, target, sourceHandle } = connection;
    const targetNode = nodes.find((node) => node.id === target);
    if (!targetNode || source === target || getCategory(targetNode) === "trigger") return false;
    if (edges.some((edge) => edge.source === source && edge.target === target && (edge.sourceHandle || "out") === (sourceHandle || "out"))) return false;

    const visited = new Set();
    const stack = [target];
    while (stack.length) {
        const nodeId = stack.pop();
        if (nodeId === source) return false;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        edges.filter((edge) => edge.source === nodeId).forEach((edge) => stack.push(edge.target));
    }
    return true;
};

// Resumen para el listado: disparadores y número de condiciones y acciones.
export const describeRuleGraph = (graph) => {
    const types = graph.nodes.map((node) => node.type).filter((type) => RULE_NODE_TYPES[type]);
    const count = (category) => types.filter((type) => RULE_NODE_TYPES[type].category === category).length;
    return {
        triggers: [...new Set(types.filter((type) => RULE_NODE_TYPES[type].category === "trigger"))].map((type) => RULE_NODE_TYPES[type]),
        conditionCount: count("condition"),
        actionCount: count("action"),
    };
};
