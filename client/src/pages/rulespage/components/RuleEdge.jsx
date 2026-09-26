import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore } from "@xyflow/react";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { useRuleEditor } from "./ruleEditorContext";

// Conexión entre nodos. Al seleccionarla (clic o toque) muestra un botón para borrarla: en táctil no hay tecla Supr.
export const RuleEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }) => {
    const { deleteEdge } = useRuleEditor();
    // El botón vive dentro del lienzo: se compensa el zoom para que mantenga su tamaño táctil.
    const zoom = useStore((state) => state.transform[2]);
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

    return (
        <>
            <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={24} />
            {selected ? (
                <EdgeLabelRenderer>
                    <div className="nodrag nopan pointer-events-auto absolute" style={{ transform: `translate(${labelX}px, ${labelY}px) translate(-50%, -50%) scale(${1 / zoom})` }}>
                        <IconButton onClick={() => deleteEdge(id)} aria-label="Delete connection" title="Delete connection">
                            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        </IconButton>
                    </div>
                </EdgeLabelRenderer>
            ) : null}
        </>
    );
};
