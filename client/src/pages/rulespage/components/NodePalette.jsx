import { useState } from "react";
import { SearchField } from "../../../components/search-field/SearchField";
import { RULE_CATEGORIES, RULE_NODE_TYPES } from "../../../utils/ruleGraph";
import { RuleNodeIcon } from "./RuleNodeIcon";

// Tipo MIME del arrastre desde la paleta al lienzo.
export const RULE_NODE_DRAG_TYPE = "application/x-tagged-rule-node";

const NODE_ENTRIES = Object.entries(RULE_NODE_TYPES);

// Nodos disponibles por categoría. Se arrastran al lienzo o se añaden con un clic (en táctil no hay arrastre).
export const NodePalette = ({ onAdd, autoFocusSearch = false }) => {
    const [search, setSearch] = useState("");
    const term = search.trim().toLowerCase();
    const matches = term ? NODE_ENTRIES.filter(([, definition]) => `${definition.label} ${definition.description}`.toLowerCase().includes(term)) : NODE_ENTRIES;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <SearchField label="Search nodes" value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder="Search nodes" size="compact" autoFocus={autoFocusSearch} />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Drag a node onto the canvas or select it to add it. With a node selected, the new one is connected after it.</p>
            <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
                {RULE_CATEGORIES.map((category) => {
                    const entries = matches.filter(([, definition]) => definition.category === category.key);
                    if (entries.length === 0) return null;
                    return (
                        <section key={category.key} aria-labelledby={`palette-${category.key}`}>
                            <h3 id={`palette-${category.key}`} className="mb-2 text-xs font-black uppercase tracking-widest text-neutral-500">{category.plural}</h3>
                            <ul className="grid gap-1.5">
                                {entries.map(([type, definition]) => (
                                    <li key={type}>
                                        <button
                                            type="button"
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData(RULE_NODE_DRAG_TYPE, type);
                                                event.dataTransfer.effectAllowed = "move";
                                            }}
                                            onClick={() => onAdd(type)}
                                            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left shadow-none transition-colors hover:border-neutral-300 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
                                        >
                                            <RuleNodeIcon icon={definition.icon} />
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">{definition.label}</span>
                                                <span className="line-clamp-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">{definition.description}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
                {matches.length === 0 ? <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">No nodes match your search.</p> : null}
            </div>
        </div>
    );
};
