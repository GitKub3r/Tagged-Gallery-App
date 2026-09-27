import { faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { RULE_NODE_TYPES } from "../../../utils/ruleGraph";

// Tamaño de un nodo en coordenadas del lienzo (RuleNode mide w-64 y unos 110 px de alto).
const NODE_WIDTH = 256;
const NODE_HEIGHT = 112;
const PADDING = 72;
// Tamaño mínimo del área dibujada: con uno o dos nodos, los chips no crecen hasta llenar la tarjeta.
const MIN_WIDTH = 1200;
const MIN_HEIGHT = 420;
// Altura relativa de cada salida en el nodo ("True" arriba y "False" abajo en las condiciones).
const OUTPUT_OFFSETS = { out: 0.5, true: 0.36, false: 0.7 };
const PINS = [0.2, 0.4, 0.6, 0.8];

const CHIP_CLASSES = {
    trigger: "fill-neutral-950 dark:fill-neutral-100",
    condition: "fill-white stroke-neutral-400 dark:fill-neutral-900 dark:stroke-neutral-500",
    action: "fill-neutral-200 stroke-neutral-300 dark:fill-neutral-800 dark:stroke-neutral-700",
};
const CHIP_CONTENT_CLASSES = {
    trigger: "fill-white dark:fill-neutral-950",
    condition: "fill-neutral-700 dark:fill-neutral-200",
    action: "fill-neutral-700 dark:fill-neutral-200",
};

// Icono de Font Awesome dibujado como <path> dentro del SVG.
const SvgIcon = ({ icon, x, y, size, className }) => {
    const [width, height, , , path] = icon.icon;
    return (
        <svg x={x} y={y} width={size} height={size} viewBox={`0 0 ${width} ${height}`} className={className}>
            <path d={Array.isArray(path) ? path.join(" ") : path} />
        </svg>
    );
};

// Pista en ángulo recto de la salida de un nodo a la entrada del siguiente, como en una placa de circuito.
const getTracePath = (source, target, sourceHandle) => {
    const startX = source.position.x + NODE_WIDTH;
    const startY = source.position.y + NODE_HEIGHT * (OUTPUT_OFFSETS[sourceHandle] ?? OUTPUT_OFFSETS.out);
    const endX = target.position.x;
    const endY = target.position.y + NODE_HEIGHT / 2;
    const middleX = endX > startX ? (startX + endX) / 2 : startX + PADDING / 2;
    return { d: `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`, startX, startY, endX, endY };
};

const getViewBox = (nodes) => {
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxX = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT));
    const width = Math.max(maxX - minX + PADDING * 2, MIN_WIDTH);
    const height = Math.max(maxY - minY + PADDING * 2, MIN_HEIGHT);
    return `${(minX + maxX - width) / 2} ${(minY + maxY - height) / 2} ${width} ${height}`;
};

// Esquema del workflow en miniatura para la tarjeta de una regla: cada nodo es un chip con el icono de su tipo
// y las conexiones son pistas. Con la regla activa, una señal recorre las pistas. Es decorativo: la tarjeta
// da los mismos datos en texto, y no captura los clics para que también abra el editor como el resto de la tarjeta.
export const RuleSchematic = ({ graph, isActive }) => {
    const nodes = graph.nodes.filter((node) => RULE_NODE_TYPES[node.type] && node.position);
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const traces = graph.edges
        .filter((edge) => nodesById.has(edge.source) && nodesById.has(edge.target))
        .map((edge) => ({ id: edge.id, ...getTracePath(nodesById.get(edge.source), nodesById.get(edge.target), edge.sourceHandle) }));

    return (
        <div className="pointer-events-none relative h-32 bg-neutral-50 bg-[radial-gradient(rgba(0,0,0,0.12)_1px,transparent_1px)] bg-[size:12px_12px] dark:bg-neutral-950 dark:bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)]" aria-hidden="true">
            {nodes.length === 0 ? (
                <p className="flex h-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
                    <FontAwesomeIcon icon={faDiagramProject} />
                    Empty workflow
                </p>
            ) : (
                <svg className="h-full w-full" viewBox={getViewBox(nodes)} preserveAspectRatio="xMidYMid meet">
                    {traces.map((trace) => (
                        <path key={trace.id} d={trace.d} fill="none" className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    ))}
                    {isActive
                        ? traces.map((trace) => (
                            <path
                                key={`${trace.id}-signal`}
                                d={trace.d}
                                fill="none"
                                className="animate-signal stroke-neutral-950 motion-reduce:animate-none dark:stroke-white"
                                strokeWidth="1.5"
                                strokeDasharray="4 12"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        ))
                        : null}
                    {traces.flatMap((trace) => [
                        <circle key={`${trace.id}-start`} cx={trace.startX} cy={trace.startY} r="9" className="fill-neutral-400 dark:fill-neutral-500" />,
                        <circle key={`${trace.id}-end`} cx={trace.endX} cy={trace.endY} r="9" className="fill-neutral-400 dark:fill-neutral-500" />,
                    ])}
                    {nodes.map((node) => {
                        const definition = RULE_NODE_TYPES[node.type];
                        const { x, y } = node.position;
                        return (
                            <g key={node.id}>
                                {/* Patillas del chip arriba y abajo. */}
                                {PINS.map((ratio) => (
                                    <g key={ratio} className="stroke-neutral-400 dark:stroke-neutral-600" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                                        <line x1={x + NODE_WIDTH * ratio} y1={y - 14} x2={x + NODE_WIDTH * ratio} y2={y} vectorEffect="non-scaling-stroke" />
                                        <line x1={x + NODE_WIDTH * ratio} y1={y + NODE_HEIGHT} x2={x + NODE_WIDTH * ratio} y2={y + NODE_HEIGHT + 14} vectorEffect="non-scaling-stroke" />
                                    </g>
                                ))}
                                <rect x={x} y={y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="22" className={CHIP_CLASSES[definition.category]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                <SvgIcon icon={definition.icon} x={x + 30} y={y + 32} size={48} className={CHIP_CONTENT_CLASSES[definition.category]} />
                                <rect x={x + 102} y={y + 36} width={118} height={14} rx="7" className={`${CHIP_CONTENT_CLASSES[definition.category]} opacity-60`} />
                                <rect x={x + 102} y={y + 62} width={74} height={14} rx="7" className={`${CHIP_CONTENT_CLASSES[definition.category]} opacity-30`} />
                            </g>
                        );
                    })}
                </svg>
            )}
        </div>
    );
};
