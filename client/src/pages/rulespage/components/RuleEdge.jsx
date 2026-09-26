import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore } from "@xyflow/react";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { useRuleEditor } from "./ruleEditorContext";

// Conexión entre nodos. Al seleccionarla (clic o toque) muestra un botón para borrarla: en táctil no hay tecla Supr.
export const RuleEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }) => {
    const { deleteEdge, runTrace, selectedNodeCount, selectedEdgeCount } = useRuleEditor();
    const showDelete = selected && selectedNodeCount === 0 && selectedEdgeCount === 1;
    const passedCount = runTrace?.edges[id]?.passed ?? 0;
    // El botón vive dentro del lienzo: se compensa el zoom para que mantenga su tamaño táctil.
    const zoom = useStore((state) => state.transform[2]);
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

    return (
        <>
            <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={24} />
            {showDelete || passedCount > 0 ? (
                <EdgeLabelRenderer>
                    <div className="nodrag nopan pointer-events-auto absolute" style={{ transform: `translate(${labelX}px, ${labelY}px) translate(-50%, -50%) scale(${1 / zoom})` }}>
                        {showDelete ? (
                            <IconButton onClick={() => deleteEdge(id)} aria-label="Delete connection" title="Delete connection">
                                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                            </IconButton>
                        ) : (
                            // Medias que pasaron por la conexión en la última ejecución.
                            <span className="inline-flex h-6 items-center rounded-full border border-neutral-300 bg-white px-2 text-xs font-bold tabular-nums text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200" title={`${passedCount} media went through this connection`}>
                                {passedCount}
                                <span className="sr-only"> media</span>
                            </span>
                        )}
                    </div>
                </EdgeLabelRenderer>
            ) : null}
        </>
    );
};
