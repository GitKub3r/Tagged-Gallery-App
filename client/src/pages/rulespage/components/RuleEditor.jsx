import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Background, BackgroundVariant, MarkerType, Panel, ReactFlow, addEdge, useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";
import {
    faArrowLeft,
    faExpand,
    faFloppyDisk,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faPen,
    faPlay,
    faPlus,
    faTriangleExclamation,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { IconButton } from "../../../components/icon-button/IconButton";
import { MediaFormModal } from "../../../components/media-form-modal/MediaFormModal";
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

const getSnapshot = (name, isActive, nodes, edges) => JSON.stringify({ name, isActive, graph: toApiGraph(nodes, edges) });
const hasSettings = (type) => Object.keys(RULE_NODE_TYPES[type].defaultConfig).length > 0;
const getAnimationDuration = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250);
const pluralNodes = (count) => `${count} ${count === 1 ? "node" : "nodes"}`;
// Enlace de texto de DESIGN.md §7.1 (acción terciaria) dentro del aviso.
const ISSUE_LINK_CLASSES =
    "w-auto border-0 bg-transparent p-0 text-left text-xs font-semibold text-neutral-600 underline shadow-none hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-300 dark:hover:text-white";

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

    const editNode = useCallback((nodeId) => setEditingNodeId(nodeId), []);
    const deleteNode = useCallback(
        (nodeId) => {
            deleteElements({ nodes: [{ id: nodeId }] });
            setEditingNodeId(null);
        },
        [deleteElements],
    );
    const deleteEdge = useCallback((edgeId) => deleteElements({ edges: [{ id: edgeId }] }), [deleteElements]);

    const editorContext = {
        context: validationContext,
        tagInfo: { tagColorByName, tagTypeByName, tagNameSet, isLoaded: Boolean(metadata) },
        reachableIds,
        editNode,
        deleteNode,
        deleteEdge,
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

        setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), { id, type: "rule", position, selected: true, data: { type, config: structuredClone(definition.defaultConfig) } }]);
        if (anchor && definition.category !== "trigger") {
            const connection = { source: anchor.id, sourceHandle: anchorCategory === "condition" ? "true" : "out", target: id, targetHandle: "in" };
            setEdges((current) => addEdge({ ...connection, id: createRuleId("edge"), ...EDGE_DEFAULTS }, current));
        }
        setIsPaletteOpen(false);
        if (!dropPosition) revealPosition(position);
        if (hasSettings(type)) setEditingNodeId(id);
    };

    const onConnect = useCallback((connection) => setEdges((current) => addEdge({ ...connection, id: createRuleId("edge"), ...EDGE_DEFAULTS }, current)), [setEdges]);

    const handleDrop = (event) => {
        const type = event.dataTransfer.getData(RULE_NODE_DRAG_TYPE);
        if (!RULE_NODE_TYPES[type]) return;
        event.preventDefault();
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode(type, { x: position.x - NODE_WIDTH / 2, y: position.y - 32 });
    };

    const applyNodeConfig = (config) => {
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

    const confirmRun = async () => {
        try {
            if (isDirty) await save();
            await runRule.mutateAsync(rule.id);
        } catch {
            // El toast de error lo muestra el apiClient.
        }
        setPendingConfirm(null);
    };

    const leave = () => (isDirty ? setPendingConfirm("leave") : navigate("/rules"));

    // Ctrl/Cmd + S guarda, como en n8n.
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
            event.preventDefault();
            if (isDirty && !isBusy) save().catch(() => null);
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
                            <button type="button" className={buttonClasses.secondary} onClick={() => setPendingConfirm("run")} disabled={!canRun || isBusy} title={canRun ? "Apply the rule to every media in your library" : "Finish the workflow to run it"}>
                                <FontAwesomeIcon icon={faPlay} aria-hidden="true" />
                                Run rule
                            </button>
                            <button type="button" className={buttonClasses.primary} onClick={handleSave} disabled={!isDirty || isBusy}>
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
                        <NodePalette onAdd={(type) => addNode(type)} />
                    </aside>

                    <div
                        ref={canvasRef}
                        className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950"
                        onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={handleDrop}
                        // Enter sobre un nodo con el foco abre su configuración (React Flow ya lo selecciona).
                        onKeyDown={(event) => {
                            const nodeId = event.key === "Enter" ? event.target.closest?.(".react-flow__node")?.dataset.id : null;
                            if (nodeId) editNode(nodeId);
                        }}
                    >
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            isValidConnection={(connection) => isValidRuleConnection(connection, nodes, edges)}
                            nodeTypes={NODE_TYPES}
                            edgeTypes={EDGE_TYPES}
                            defaultEdgeOptions={EDGE_DEFAULTS}
                            onNodeDoubleClick={(_, node) => editNode(node.id)}
                            deleteKeyCode={hasOpenModal ? null : ["Backspace", "Delete"]}
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
                        <NodePalette onAdd={(type) => addNode(type)} />
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
