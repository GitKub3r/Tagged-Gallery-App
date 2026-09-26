import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Background, BackgroundVariant, MarkerType, Panel, ReactFlow, SelectionMode, addEdge, useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";
import {
    faArrowLeft,
    faArrowRotateLeft,
    faArrowRotateRight,
    faCircleCheck,
    faCopy,
    faExpand,
    faFloppyDisk,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faObjectGroup,
    faPen,
    faPlay,
    faPlus,
    faSpinner,
    faTrash,
    faTriangleExclamation,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { IconButton } from "../../../components/icon-button/IconButton";
import { MediaFormModal } from "../../../components/media-form-modal/MediaFormModal";
import { ResultsLoadingIndicator } from "../../../components/results-loading-indicator/ResultsLoadingIndicator";
import { Switch } from "../../../components/switch/Switch";
import { useAlbums } from "../../../hooks/useAlbums";
import { useMetadata } from "../../../hooks/useMetadata";
import { useRunRule, useUpdateRule } from "../../../hooks/useRules";
import {
    RULE_NODE_TYPES,
    createRuleId,
    getReachableNodeIds,
    getRuleIssues,
    isValidRuleConnection,
    toApiGraph,
    toFlowEdges,
    toFlowNodes,
} from "../../../utils/ruleGraph";
import { NodeConfigModal } from "./NodeConfigModal";
import { NodePalette, RULE_NODE_DRAG_TYPE } from "./NodePalette";
import { MODIFIER_KEY, isEditableTarget } from "./keyboardShortcuts";
import { copyToRuleClipboard, hasRuleClipboard, takeRuleClipboard } from "./ruleClipboard";
import { RuleEdge } from "./RuleEdge";
import { RuleEditorContext } from "./ruleEditorContext";
import { RuleNameModal } from "./RuleNameModal";
import { RuleNode } from "./RuleNode";

const NODE_TYPES = { rule: RuleNode };
const EDGE_TYPES = { rule: RuleEdge };
const EDGE_DEFAULTS = { type: "rule", markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } };
// Ancho de RuleNode (w-64) y separación horizontal al encadenar un nodo nuevo tras el seleccionado.
const NODE_WIDTH = 256;
const NODE_GAP = 96;

// Tamaño aproximado de un nodo para no colocar uno nuevo encima de otro.
const NODE_BOX = { width: NODE_WIDTH, height: 120 };
const overlapsNode = (position, nodes) =>
    nodes.some((node) => {
        const width = node.measured?.width ?? NODE_BOX.width;
        const height = node.measured?.height ?? NODE_BOX.height;
        return position.x < node.position.x + width && position.x + NODE_BOX.width > node.position.x && position.y < node.position.y + height && position.y + NODE_BOX.height > node.position.y;
    });
// Baja la posición hasta encontrar un hueco libre.
const findFreePosition = (position, nodes) => {
    let candidate = position;
    for (let attempt = 0; attempt < 30 && overlapsNode(candidate, nodes); attempt += 1) candidate = { x: candidate.x, y: candidate.y + 48 };
    return candidate;
};

// Enlace de texto de DESIGN.md §7.1 (acción terciaria) en los avisos del editor.
const ISSUE_LINK_CLASSES =
    "w-auto border-0 bg-transparent p-0 text-left text-xs font-semibold text-neutral-600 underline shadow-none hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-300 dark:hover:text-white";

// Separación de cada copia pegada o duplicada respecto al original.
const PASTE_OFFSET = 40;
// Tiempo mínimo que se ve el estado de ejecución: con bibliotecas pequeñas la respuesta llega al instante
// y la animación sería solo un parpadeo.
const MIN_RUN_FEEDBACK_MS = 800;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
// Pasos que se pueden deshacer.
const MAX_HISTORY = 100;
// Ctrl/⌘ (o Shift) + arrastrar sobre el lienzo selecciona un área; con esas teclas, el clic en un nodo lo suma a la selección.
const SELECTION_KEYS = ["Meta", "Control", "Shift"];

// Lo que cuenta para el resultado de una ejecución: nodos, su configuración y conexiones (no la posición).
const getLogicKey = (nodes, edges) =>
    JSON.stringify([nodes.map((node) => [node.id, node.data.type, node.data.config]), edges.map((edge) => [edge.id, edge.source, edge.sourceHandle, edge.target])]);

// Acciones sobre varios nodos seleccionados (área o Ctrl/⌘ + clic), abajo en el lienzo.
const SelectionBar = ({ count, onDuplicate, onDelete }) => (
    <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white/95 py-1 pl-3 pr-1 text-xs font-semibold text-neutral-700 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200">
        <span className="tabular-nums" aria-live="polite">{count} nodes selected</span>
        <IconButton onClick={onDuplicate} aria-label="Duplicate selected nodes" title="Duplicate selected nodes">
            <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
        </IconButton>
        <IconButton onClick={onDelete} aria-label="Delete selected nodes" title="Delete selected nodes">
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
        </IconButton>
    </div>
);

// Resumen de la última ejecución, abajo en el lienzo, hasta que se cierra o se cambia el workflow.
const RunResultNotice = ({ result, onClear }) => (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white/95 px-3 py-2 text-xs font-semibold text-neutral-700 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200" role="status" aria-live="polite">
        <FontAwesomeIcon icon={faCircleCheck} className="text-green-600 dark:text-green-400" aria-hidden="true" />
        <span className="tabular-nums">
            Checked {result.processedCount} media · {result.changedCount} changed
        </span>
        <button type="button" className={ISSUE_LINK_CLASSES} onClick={onClear}>Clear results</button>
    </div>
);

const getSnapshot = (name, isActive, nodes, edges) => JSON.stringify({ name, isActive, graph: toApiGraph(nodes, edges) });
const getAnimationDuration = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250);
const pluralNodes = (count) => `${count} ${count === 1 ? "node" : "nodes"}`;

// Lista de lo que falta para poder activar o ejecutar la regla. Cada problema de un nodo lo centra en el lienzo.
const IssuesNotice = ({ issues, nodes, isActive, onFocusNode }) => (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm" role="status">
        <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0">
            <p className="font-semibold">{isActive ? "Finish the workflow or turn the rule off to save it" : "Finish the workflow to turn the rule on or run it"}</p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {issues.map((issue) => {
                    const node = issue.nodeId ? nodes.find((item) => item.id === issue.nodeId) : null;
                    const label = node ? `${RULE_NODE_TYPES[node.data.type].label}: ${issue.message.toLowerCase()}` : issue.message;
                    return (
                        <li key={`${issue.nodeId || "rule"}-${issue.message}`}>
                            {node ? (
                                <button type="button" className={ISSUE_LINK_CLASSES} onClick={() => onFocusNode(node.id)}>{label}</button>
                            ) : (
                                <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    </div>
);

// Editor de una regla: lienzo de React Flow con los nodos del workflow, paleta de nodos y panel de configuración.
// Los cambios viven aquí hasta que se pulsa "Save"; "Run rule" guarda antes si hay cambios.
export const RuleEditor = ({ rule }) => {
    const navigate = useNavigate();
    const { screenToFlowPosition, deleteElements, zoomIn, zoomOut, fitView, setCenter, getNode, getZoom } = useReactFlow();
    const [initialState] = useState(() => {
        const initialNodes = toFlowNodes(rule.graph);
        const initialEdges = toFlowEdges(rule.graph).map((edge) => ({ ...edge, ...EDGE_DEFAULTS }));
        return { nodes: initialNodes, edges: initialEdges, snapshot: getSnapshot(rule.name, rule.is_active, initialNodes, initialEdges) };
    });
    const [nodes, setNodes, onNodesChange] = useNodesState(initialState.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges);
    const [name, setName] = useState(rule.name);
    const [isActive, setIsActive] = useState(rule.is_active);
    const [savedSnapshot, setSavedSnapshot] = useState(initialState.snapshot);
    const [editingNodeId, setEditingNodeId] = useState(null);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    // "run" (confirmar la ejecución) o "leave" (salir con cambios sin guardar).
    const [pendingConfirm, setPendingConfirm] = useState(null);
    // Estados anteriores (past) y deshechos (future) del lienzo: { nodes, edges }.
    const [history, setHistory] = useState({ past: [], future: [] });
    // Mientras se ejecuta (guardado previo incluido) el lienzo se bloquea y las conexiones se animan.
    const [isRunning, setIsRunning] = useState(false);
    // Resultado de la última ejecución: { processedCount, changedCount, trace, logicKey }.
    const [runResult, setRunResult] = useState(null);
    // Modo "seleccionar área" para táctil: arrastrar selecciona en lugar de mover el lienzo.
    const [isAreaSelecting, setIsAreaSelecting] = useState(false);
    const canvasRef = useRef(null);

    const updateRule = useUpdateRule();
    const runRule = useRunRule();
    const { metadata, tagColorByName, tagTypeByName, tagNameSet } = useMetadata();
    const albumsQuery = useAlbums();

    const albumsById = useMemo(() => (albumsQuery.data ? new Map(albumsQuery.data.map((album) => [album.id, album])) : null), [albumsQuery.data]);
    const validationContext = useMemo(() => ({ albumsById }), [albumsById]);
    const issues = useMemo(() => getRuleIssues(nodes, edges, validationContext), [nodes, edges, validationContext]);
    const reachableIds = useMemo(() => getReachableNodeIds(nodes, edges), [nodes, edges]);
    const currentSnapshot = getSnapshot(name, isActive, nodes, edges);
    const isDirty = currentSnapshot !== savedSnapshot;
    const isBusy = updateRule.isPending || runRule.isPending;
    const editingNode = nodes.find((node) => node.id === editingNodeId);
    const hasOpenModal = Boolean(editingNode || isPaletteOpen || isRenaming || pendingConfirm);
    const selectedNodes = nodes.filter((node) => node.selected);
    const selectedEdgeCount = edges.filter((edge) => edge.selected).length;
    const logicKey = useMemo(() => getLogicKey(nodes, edges), [nodes, edges]);
    // El resultado solo se enseña mientras el workflow sea el que se ejecutó.
    const visibleRunResult = runResult?.logicKey === logicKey ? runResult : null;
    // Conexiones animadas durante la ejecución (las que salen de nodos conectados a un disparador).
    const displayedEdges = useMemo(
        () => (isRunning ? edges.map((edge) => (reachableIds.has(edge.source) ? { ...edge, animated: true } : edge)) : edges),
        [edges, isRunning, reachableIds],
    );

    // Guarda el estado actual antes de un cambio para poder deshacerlo. Un cambio nuevo descarta lo deshecho.
    const recordHistory = () => setHistory((current) => ({ past: [...current.past.slice(-(MAX_HISTORY - 1)), { nodes, edges }], future: [] }));

    const undo = () => {
        const previous = history.past.at(-1);
        if (!previous) return;
        setHistory({ past: history.past.slice(0, -1), future: [{ nodes, edges }, ...history.future] });
        setNodes(previous.nodes);
        setEdges(previous.edges);
    };

    const redo = () => {
        const next = history.future[0];
        if (!next) return;
        setHistory({ past: [...history.past, { nodes, edges }], future: history.future.slice(1) });
        setNodes(next.nodes);
        setEdges(next.edges);
    };

    const editNode = useCallback((nodeId) => setEditingNodeId(nodeId), []);
    const deleteNode = useCallback(
        (nodeId) => {
            deleteElements({ nodes: [{ id: nodeId }] });
            setEditingNodeId(null);
        },
        [deleteElements],
    );
    const deleteEdge = useCallback((edgeId) => deleteElements({ edges: [{ id: edgeId }] }), [deleteElements]);

    // Inserta copias de unos nodos (con las conexiones que hay entre ellos) desplazadas y seleccionadas.
    // fresh: mismo tipo de nodo pero con la configuración inicial, como recién añadido desde la paleta.
    const insertNodeCopies = (sourceNodes, sourceEdges, { fresh, offset }) => {
        const newIds = new Map(sourceNodes.map((node) => [node.id, createRuleId(RULE_NODE_TYPES[node.type].category)]));
        const copies = sourceNodes.map((node) => ({
            id: newIds.get(node.id),
            type: "rule",
            position: { x: node.position.x + offset, y: node.position.y + offset },
            selected: true,
            data: { type: node.type, config: structuredClone(fresh ? RULE_NODE_TYPES[node.type].defaultConfig : node.config) },
        }));
        const edgeCopies = sourceEdges.map((edge) => ({
            id: createRuleId("edge"),
            source: newIds.get(edge.source),
            sourceHandle: edge.sourceHandle,
            target: newIds.get(edge.target),
            targetHandle: "in",
            ...EDGE_DEFAULTS,
        }));
        recordHistory();
        setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...copies]);
        setEdges((current) => [...current.map((edge) => ({ ...edge, selected: false })), ...edgeCopies]);
        revealPosition(copies[0].position);
    };

    const toCopySource = (node) => ({ id: node.id, type: node.data.type, position: node.position, config: structuredClone(node.data.config) });

    // Ctrl/Cmd + C: copia los nodos seleccionados y las conexiones entre ellos. Devuelve si había algo que copiar.
    // Nodos seleccionados y las conexiones que hay entre ellos, listos para copiar o duplicar.
    const getSelectionContent = () => {
        const selectedIds = new Set(selectedNodes.map((node) => node.id));
        return {
            nodes: selectedNodes.map(toCopySource),
            edges: edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)).map(({ source, sourceHandle, target }) => ({ source, sourceHandle, target })),
        };
    };

    const copySelectedNodes = () => {
        if (selectedNodes.length === 0) return false;
        copyToRuleClipboard(getSelectionContent());
        toast.success(selectedNodes.length === 1 ? "Node copied" : `${selectedNodes.length} nodes copied`);
        return true;
    };

    // Barra de selección múltiple: duplicar o borrar todos los nodos seleccionados (también en táctil).
    const duplicateSelection = () => {
        const content = getSelectionContent();
        insertNodeCopies(content.nodes, content.edges, { fresh: false, offset: PASTE_OFFSET });
    };
    const deleteSelection = () => deleteElements({ nodes: selectedNodes.map(({ id }) => ({ id })) });

    const clearSelection = () => {
        setNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)));
        setEdges((current) => current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)));
    };

    // Ctrl/Cmd + V pega los nodos copiados con su configuración; con Shift, solo el tipo de nodo (sin configurar).
    // Cada pegado se desplaza un poco más para no quedar encima del anterior.
    const pasteNodes = (fresh) => {
        const content = takeRuleClipboard();
        if (content) insertNodeCopies(content.nodes, content.edges, { fresh, offset: PASTE_OFFSET * content.pasteCount });
    };

    // Botón "Duplicate" de la barra del nodo: el equivalente táctil de copiar y pegar.
    const duplicateNode = (nodeId) => {
        const node = nodes.find((item) => item.id === nodeId);
        if (node) insertNodeCopies([toCopySource(node)], [], { fresh: false, offset: PASTE_OFFSET });
    };

    const editorContext = {
        context: validationContext,
        tagInfo: { tagColorByName, tagTypeByName, tagNameSet, isLoaded: Boolean(metadata) },
        reachableIds,
        editNode,
        duplicateNode,
        deleteNode,
        deleteEdge,
        isRunning,
        runTrace: visibleRunResult?.trace ?? null,
        // La barra de un nodo y el botón de borrar una conexión solo aparecen si es lo único seleccionado.
        selectedNodeCount: selectedNodes.length,
        selectedEdgeCount,
    };

    const getViewportCenter = () => {
        const rect = canvasRef.current.getBoundingClientRect();
        const center = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        return { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_BOX.height / 2 };
    };

    // Si el nodo nuevo queda fuera de la vista (p. ej. en móvil), el lienzo se desplaza hasta él sin cambiar el zoom.
    const revealPosition = (position) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
        const bottomRight = screenToFlowPosition({ x: rect.right, y: rect.bottom });
        const isVisible = position.x >= topLeft.x && position.y >= topLeft.y && position.x + NODE_BOX.width <= bottomRight.x && position.y + NODE_BOX.height <= bottomRight.y;
        if (!isVisible) setCenter(position.x + NODE_BOX.width / 2, position.y + NODE_BOX.height / 2, { zoom: getZoom(), duration: getAnimationDuration() });
    };

    // Con un nodo seleccionado, el nuevo se coloca a su derecha y se conecta a su salida ("True" en condiciones),
    // así se puede construir el workflow sin arrastrar conexiones (útil en táctil).
    const addNode = (type, dropPosition = null) => {
        const definition = RULE_NODE_TYPES[type];
        const id = createRuleId(definition.category);
        const selectedNodes = nodes.filter((node) => node.selected);
        const anchor = !dropPosition && selectedNodes.length === 1 ? selectedNodes[0] : null;
        const anchorCategory = anchor ? RULE_NODE_TYPES[anchor.data.type].category : null;
        const position = dropPosition || findFreePosition(anchor ? { x: anchor.position.x + NODE_WIDTH + NODE_GAP, y: anchor.position.y } : getViewportCenter(), nodes);

        recordHistory();
        setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), { id, type: "rule", position, selected: true, data: { type, config: structuredClone(definition.defaultConfig) } }]);
        if (anchor && definition.category !== "trigger") {
            const connection = { source: anchor.id, sourceHandle: anchorCategory === "condition" ? "true" : "out", target: id, targetHandle: "in" };
            setEdges((current) => addEdge({ ...connection, id: createRuleId("edge"), ...EDGE_DEFAULTS }, current));
        }
        setIsPaletteOpen(false);
        if (!dropPosition) revealPosition(position);
    };

    const onConnect = (connection) => {
        recordHistory();
        setEdges((current) => addEdge({ ...connection, id: createRuleId("edge"), ...EDGE_DEFAULTS }, current));
    };

    const handleDrop = (event) => {
        const type = event.dataTransfer.getData(RULE_NODE_DRAG_TYPE);
        if (!RULE_NODE_TYPES[type]) return;
        event.preventDefault();
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode(type, { x: position.x - NODE_WIDTH / 2, y: position.y - 32 });
    };

    const applyNodeConfig = (config) => {
        if (JSON.stringify(config) !== JSON.stringify(editingNode.data.config)) recordHistory();
        setNodes((current) => current.map((node) => (node.id === editingNodeId ? { ...node, data: { ...node.data, config } } : node)));
        setEditingNodeId(null);
    };

    const focusNode = (nodeId) => {
        const node = getNode(nodeId);
        if (!node) return;
        setNodes((current) => current.map((item) => ({ ...item, selected: item.id === nodeId })));
        setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + 60, { zoom: 1, duration: getAnimationDuration() });
    };

    // Guarda lo que hay en pantalla. El apiClient ya muestra el error si el servidor la rechaza.
    const save = async () => {
        const snapshot = currentSnapshot;
        await updateRule.mutateAsync({ changes: { id: rule.id, name, is_active: isActive, graph: toApiGraph(nodes, edges) } });
        setSavedSnapshot(snapshot);
    };
    const handleSave = () => save().catch(() => null);

    // La confirmación se cierra al momento: el progreso se ve en el lienzo (conexiones animadas e indicador) y,
    // al terminar, cada nodo y conexión muestra cuántas medias pasaron por él.
    const confirmRun = async () => {
        const runLogicKey = logicKey;
        const startedAt = Date.now();
        setPendingConfirm(null);
        setIsRunning(true);
        try {
            if (isDirty) await save();
            const result = await runRule.mutateAsync(rule.id);
            await wait(MIN_RUN_FEEDBACK_MS - (Date.now() - startedAt));
            setRunResult({ ...result, logicKey: runLogicKey });
            toast.success(`${result.changedCount} media changed`, { description: `The rule checked ${result.processedCount} media.` });
        } catch {
            // El toast de error lo muestra el apiClient.
        } finally {
            setIsRunning(false);
        }
    };

    const leave = () => (isDirty ? setPendingConfirm("leave") : navigate("/rules"));

    // Atajos, como en n8n: Ctrl/Cmd + S guarda; C y V copian y pegan nodos (Shift + V, sin su configuración);
    // Z deshace y Shift + Z (o Ctrl + Y) rehace. Salvo guardar, no actúan mientras se escribe en un campo (ahí son
    // los del propio campo), hay texto seleccionado, hay un modal abierto o se está ejecutando la regla.
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Escape deselecciona todo (los modales atienden su propio Escape antes).
            if (event.key === "Escape" && !event.defaultPrevented && !hasOpenModal && !isEditableTarget(event.target)) {
                clearSelection();
                return;
            }
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            const key = event.key.toLowerCase();
            if (key === "s") {
                event.preventDefault();
                if (isDirty && !isBusy) save().catch(() => null);
                return;
            }
            if (!["c", "v", "z", "y"].includes(key) || hasOpenModal || isRunning || isEditableTarget(event.target) || window.getSelection()?.toString()) return;
            if (key === "z" || key === "y") {
                event.preventDefault();
                if (key === "y" || event.shiftKey) redo();
                else undo();
            } else if (key === "c") {
                if (copySelectedNodes()) event.preventDefault();
            } else if (hasRuleClipboard()) {
                event.preventDefault();
                pasteNodes(event.shiftKey);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    // Avisa antes de cerrar o recargar la pestaña con cambios sin guardar.
    useEffect(() => {
        if (!isDirty) return undefined;
        const handleBeforeUnload = (event) => event.preventDefault();
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    const canRun = issues.length === 0;
    const statusText = `${pluralNodes(nodes.length)} · ${updateRule.isPending ? "Saving..." : isDirty ? "Unsaved changes" : "All changes saved"}`;

    return (
        <RuleEditorContext.Provider value={editorContext}>
            <section className="flex h-[calc(100dvh-6rem)] min-h-[34rem] flex-col gap-4 text-neutral-950 dark:text-neutral-100 xl:h-[calc(100dvh-4rem)]">
                <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <IconButton onClick={leave} aria-label="Back to rules" title="Back to rules">
                            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                        </IconButton>
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Rule</p>
                            <div className="flex min-w-0 items-center gap-2">
                                <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl" title={name}>{name}</h1>
                                <IconButton onClick={() => setIsRenaming(true)} aria-label="Rename rule" title="Rename rule">
                                    <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                                </IconButton>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end lg:gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400" aria-live="polite">{statusText}</p>
                            <Switch
                                checked={isActive}
                                onChange={setIsActive}
                                label="Active"
                                disabled={!isActive && !canRun}
                                title={!isActive && !canRun ? "Finish the workflow to turn the rule on" : "Active rules run automatically"}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            <button type="button" className={buttonClasses.secondary} onClick={() => setPendingConfirm("run")} disabled={!canRun || isBusy || isRunning} title={canRun ? "Apply the rule to every media in your library" : "Finish the workflow to run it"}>
                                <FontAwesomeIcon icon={isRunning ? faSpinner : faPlay} spin={isRunning} aria-hidden="true" />
                                {isRunning ? "Running..." : "Run rule"}
                            </button>
                            <button type="button" className={buttonClasses.primary} onClick={handleSave} disabled={!isDirty || isBusy || isRunning}>
                                <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                                {updateRule.isPending ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </header>

                {issues.length > 0 ? <IssuesNotice issues={issues} nodes={nodes} isActive={isActive} onFocusNode={focusNode} /> : null}

                <div className="flex min-h-0 flex-1 gap-4">
                    <aside className="hidden w-72 shrink-0 flex-col rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900 lg:flex" aria-labelledby="rule-palette-title">
                        <h2 id="rule-palette-title" className="mb-3 text-sm font-semibold">Add nodes</h2>
                        <NodePalette onAdd={(type) => addNode(type)} disabled={isRunning} />
                    </aside>

                    <div
                        ref={canvasRef}
                        className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950"
                        onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => (isRunning ? event.preventDefault() : handleDrop(event))}
                        // Enter sobre un nodo con el foco abre su configuración (React Flow ya lo selecciona).
                        onKeyDown={(event) => {
                            const nodeId = event.key === "Enter" ? event.target.closest?.(".react-flow__node")?.dataset.id : null;
                            if (nodeId) editNode(nodeId);
                        }}
                    >
                        <ReactFlow
                            nodes={nodes}
                            edges={displayedEdges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            isValidConnection={(connection) => isValidRuleConnection(connection, nodes, edges)}
                            nodeTypes={NODE_TYPES}
                            edgeTypes={EDGE_TYPES}
                            defaultEdgeOptions={EDGE_DEFAULTS}
                            // El primer clic selecciona el nodo (para copiarlo o encadenar otro detrás); un clic sobre un nodo
                            // ya seleccionado, o un doble clic, abre su configuración. node.selected es el estado previo al clic.
                            // Arrastrarlo no cuenta como clic, tocar un punto de conexión sirve para conectar y con una tecla
                            // modificadora el clic solo cambia la selección. Los clics de la barra del nodo (un portal) también
                            // llegan aquí por React: solo cuentan los que ocurren dentro del propio nodo.
                            onNodeClick={(event, node) => {
                                const isInsideNode = event.currentTarget.contains(event.target);
                                const isSelectionClick = event.metaKey || event.ctrlKey || event.shiftKey;
                                if (isInsideNode && node.selected && !isSelectionClick && !event.target.closest(".react-flow__handle")) editNode(node.id);
                            }}
                            // Borrar (teclado, barra del nodo o conexión) y arrastrar nodos se pueden deshacer.
                            onBeforeDelete={async ({ nodes: deletedNodes, edges: deletedEdges }) => {
                                if (deletedNodes.length > 0 || deletedEdges.length > 0) recordHistory();
                                return true;
                            }}
                            onNodeDragStart={recordHistory}
                            onSelectionDragStart={recordHistory}
                            deleteKeyCode={hasOpenModal || isRunning ? null : ["Backspace", "Delete"]}
                            // Mientras se ejecuta, el lienzo solo se puede mover y ampliar.
                            nodesDraggable={!isRunning}
                            nodesConnectable={!isRunning}
                            elementsSelectable={!isRunning}
                            // Seleccionar un área: Ctrl/⌘ (o Shift) + arrastrar, o el modo "Select area" en táctil.
                            // Selecciona los nodos que toca el área, como la selección de medias en la galería.
                            selectionKeyCode={SELECTION_KEYS}
                            multiSelectionKeyCode={SELECTION_KEYS}
                            selectionOnDrag={isAreaSelecting}
                            panOnDrag={!isAreaSelecting}
                            selectionMode={SelectionMode.Partial}
                            fitView
                            fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
                            minZoom={0.25}
                            maxZoom={1.75}
                            aria-label="Workflow canvas"
                        >
                            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
                            <Panel position="top-left" className="lg:hidden">
                                <button type="button" className={buttonClasses.primary} onClick={() => setIsPaletteOpen(true)}>
                                    <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                                    Add node
                                </button>
                            </Panel>
                            <Panel position="top-right" className="flex gap-1">
                                <IconButton onClick={undo} disabled={history.past.length === 0 || isRunning} aria-label="Undo" title={`Undo (${MODIFIER_KEY} + Z)`}>
                                    <FontAwesomeIcon icon={faArrowRotateLeft} aria-hidden="true" />
                                </IconButton>
                                <IconButton onClick={redo} disabled={history.future.length === 0 || isRunning} aria-label="Redo" title={`Redo (${MODIFIER_KEY} + Shift + Z)`}>
                                    <FontAwesomeIcon icon={faArrowRotateRight} aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                    onClick={() => setIsAreaSelecting((current) => !current)}
                                    isActive={isAreaSelecting}
                                    aria-pressed={isAreaSelecting}
                                    aria-label="Select area"
                                    title={isAreaSelecting ? "Drag to select nodes. Turn off to move the canvas" : `Select area (or hold ${MODIFIER_KEY} and drag)`}
                                >
                                    <FontAwesomeIcon icon={faObjectGroup} aria-hidden="true" />
                                </IconButton>
                            </Panel>
                            {/* En teléfono se sube por encima de los botones de zoom, que ocupan la esquina inferior. */}
                            <Panel position="bottom-center" className="mb-40 flex flex-col items-center gap-2 whitespace-nowrap sm:mb-4">
                                {selectedNodes.length > 1 && !isRunning ? <SelectionBar count={selectedNodes.length} onDuplicate={duplicateSelection} onDelete={deleteSelection} /> : null}
                                {isRunning ? <ResultsLoadingIndicator isVisible label="Running the rule on your library..." placement="inline" /> : null}
                                {!isRunning && visibleRunResult ? <RunResultNotice result={visibleRunResult} onClear={() => setRunResult(null)} /> : null}
                            </Panel>
                            <Panel position="bottom-left" className="flex flex-col gap-1">
                                <IconButton onClick={() => zoomIn({ duration: getAnimationDuration() })} aria-label="Zoom in" title="Zoom in">
                                    <FontAwesomeIcon icon={faMagnifyingGlassPlus} aria-hidden="true" />
                                </IconButton>
                                <IconButton onClick={() => zoomOut({ duration: getAnimationDuration() })} aria-label="Zoom out" title="Zoom out">
                                    <FontAwesomeIcon icon={faMagnifyingGlassMinus} aria-hidden="true" />
                                </IconButton>
                                <IconButton onClick={() => fitView({ maxZoom: 1, padding: 0.3, duration: getAnimationDuration() })} aria-label="Fit workflow to screen" title="Fit workflow to screen">
                                    <FontAwesomeIcon icon={faExpand} aria-hidden="true" />
                                </IconButton>
                            </Panel>
                        </ReactFlow>
                    </div>
                </div>
            </section>

            {editingNode ? <NodeConfigModal key={editingNode.id} node={editingNode} onApply={applyNodeConfig} onDelete={() => deleteNode(editingNode.id)} onClose={() => setEditingNodeId(null)} /> : null}

            {isPaletteOpen ? (
                <MediaFormModal titleId="rule-palette-modal-title" title="Add node" subtitle="Triggers, conditions and actions" onClose={() => setIsPaletteOpen(false)} compact>
                    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
                        <NodePalette onAdd={(type) => addNode(type)} disabled={isRunning} />
                    </div>
                </MediaFormModal>
            ) : null}

            {isRenaming ? (
                <RuleNameModal
                    initialName={name}
                    onSubmit={(nextName) => {
                        setName(nextName);
                        setIsRenaming(false);
                    }}
                    onClose={() => setIsRenaming(false)}
                />
            ) : null}

            <DeleteConfirmationModal
                isOpen={pendingConfirm === "run"}
                title="Run this rule on your library?"
                description={`Every media in your library goes through the workflow, starting from all its triggers. Tags, favourites and albums it changes won't be undone automatically.${isDirty ? " Your changes will be saved first." : ""}`}
                confirmLabel="Run rule"
                pendingLabel="Running..."
                confirmIcon={faPlay}
                tone="neutral"
                isDeleting={isBusy}
                onConfirm={confirmRun}
                onClose={() => setPendingConfirm(null)}
            />
            <DeleteConfirmationModal
                isOpen={pendingConfirm === "leave"}
                title="Discard unsaved changes?"
                description="The changes you made to this rule since you last saved it will be lost."
                confirmLabel="Discard changes"
                confirmIcon={faXmark}
                onConfirm={() => navigate("/rules")}
                onClose={() => setPendingConfirm(null)}
            />
        </RuleEditorContext.Provider>
    );
};
