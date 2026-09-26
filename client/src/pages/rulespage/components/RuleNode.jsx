import { memo } from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { faCheck, faPen, faTrash, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { TagChip } from "../../../components/tag-chip/TagChip";
import { RULE_CATEGORIES, RULE_NODE_TYPES } from "../../../utils/ruleGraph";
import { RuleNodeIcon } from "./RuleNodeIcon";
import { useRuleEditor } from "./ruleEditorContext";

const MAX_VISIBLE_TAGS = 4;

// Punto de conexión. El pseudo-elemento amplía la zona táctil sin cambiar el tamaño visible.
const HANDLE_CLASSES =
    "h-3.5 w-3.5 rounded-full border border-neutral-50 bg-neutral-500 before:absolute before:-inset-3 before:rounded-full dark:border-neutral-900 dark:bg-neutral-400";

const BRANCHES = [
    { id: "true", label: "True", icon: faCheck },
    { id: "false", label: "False", icon: faXmark },
];

const NodeTags = ({ tags }) => {
    const { tagInfo } = useRuleEditor();
    const hiddenCount = tags.length - MAX_VISIBLE_TAGS;

    return (
        <div className="mt-2 flex min-w-0 flex-wrap gap-1">
            {tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => {
                const key = tag.trim().toLowerCase();
                return <TagChip key={tag} tag={tag} color={tagInfo.tagColorByName[key]} type={tagInfo.tagTypeByName[key]} isExisting={!tagInfo.isLoaded || tagInfo.tagNameSet.has(key)} />;
            })}
            {hiddenCount > 0 ? <span className="inline-flex items-center px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">+{hiddenCount}</span> : null}
        </div>
    );
};

export const RuleNode = memo(({ id, data, selected }) => {
    const { context, reachableIds, editNode, deleteNode } = useRuleEditor();
    const definition = RULE_NODE_TYPES[data.type];
    const category = RULE_CATEGORIES.find((item) => item.key === definition.category);
    const issue = definition.validate(data.config, context);
    const summary = definition.summarize(data.config, context);
    const tags = definition.tags?.(data.config) || [];
    const isConnected = definition.category === "trigger" || reachableIds.has(id);

    return (
        <>
            <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1">
                <IconButton onClick={() => editNode(id)} aria-label={`Edit ${definition.label} node`} title="Edit node">
                    <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                </IconButton>
                <IconButton onClick={() => deleteNode(id)} aria-label={`Delete ${definition.label} node`} title="Delete node">
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                </IconButton>
            </NodeToolbar>

            <article
                className={`w-64 rounded-xl border bg-white text-neutral-950 transition-colors dark:bg-neutral-900 dark:text-neutral-100 ${selected ? "border-neutral-950 ring-2 ring-neutral-950 ring-offset-2 ring-offset-neutral-50 dark:border-neutral-100 dark:ring-neutral-100 dark:ring-offset-neutral-950" : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"}`}
                aria-label={`${category.label}: ${definition.label}`}
            >
                {/* Entrada y salida a la altura de la cabecera: las conexiones quedan alineadas entre nodos. */}
                <header className="relative flex min-w-0 items-center gap-3 p-3">
                    {definition.category !== "trigger" ? <Handle type="target" position={Position.Left} id="in" className={HANDLE_CLASSES} /> : null}
                    <RuleNodeIcon icon={definition.icon} />
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{category.label}</p>
                        <h3 className="truncate text-sm font-bold" title={definition.label}>{definition.label}</h3>
                    </div>
                    {definition.category !== "condition" ? <Handle type="source" position={Position.Right} id="out" className={HANDLE_CLASSES} /> : null}
                </header>

                {summary || tags.length > 0 || issue || !isConnected ? (
                    <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
                        {summary ? <p className="line-clamp-2 text-xs font-medium text-neutral-600 dark:text-neutral-300" title={summary}>{summary}</p> : null}
                        {tags.length > 0 ? <NodeTags tags={tags} /> : null}
                        {issue ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                                {issue}
                            </p>
                        ) : null}
                        {!issue && !isConnected ? <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Not connected to a trigger</p> : null}
                    </div>
                ) : null}

                {definition.category === "condition" ? (
                    <div className="divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                        {BRANCHES.map((branch) => (
                            <div key={branch.id} className="relative flex h-8 items-center justify-end gap-1.5 px-4 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                <FontAwesomeIcon icon={branch.icon} aria-hidden="true" />
                                {branch.label}
                                <Handle type="source" position={Position.Right} id={branch.id} className={HANDLE_CLASSES} />
                            </div>
                        ))}
                    </div>
                ) : null}
            </article>
        </>
    );
});

RuleNode.displayName = "RuleNode";
