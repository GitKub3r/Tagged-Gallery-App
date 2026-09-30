import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { Kbd } from "../../../components/kbd/Kbd";
import { Tooltip } from "../../../components/tooltip/Tooltip";
import { MODIFIER_KEY } from "./keyboardShortcuts";

const SHORTCUTS = [
    ["Select several nodes", [MODIFIER_KEY, "Drag"]],
    ["Copy nodes", [MODIFIER_KEY, "C"]],
    ["Paste nodes", [MODIFIER_KEY, "V"]],
    ["Paste without settings", [MODIFIER_KEY, "Shift", "V"]],
    ["Undo", [MODIFIER_KEY, "Z"]],
    ["Redo", [MODIFIER_KEY, "Shift", "Z"]],
    ["Save", [MODIFIER_KEY, "S"]],
    ["Delete selection", ["Delete"]],
];

const HelpContent = () => (
    <div className="grid gap-3">
        <div>
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-100">Build a workflow</p>
            <p className="mt-1">Drag a node onto the canvas or select it to add it. With a node selected, the new one is connected after it.</p>
        </div>
        {/* Los atajos solo sirven con teclado: en móvil se usa el botón "Duplicate" del nodo. */}
        <div className="hidden border-t border-neutral-200 pt-3 dark:border-neutral-800 sm:block">
            <p className="mb-2 font-semibold text-neutral-950 dark:text-neutral-100">Keyboard shortcuts</p>
            <dl className="grid gap-1.5">
                {SHORTCUTS.map(([action, keys]) => (
                    <div key={action} className="flex items-center justify-between gap-4">
                        <dt>{action}</dt>
                        <dd className="flex shrink-0 gap-1">
                            {keys.map((key) => <Kbd key={key}>{key}</Kbd>)}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    </div>
);

// Ayuda del editor de reglas: se abre al pulsar el botón, también en táctil.
export const RuleEditorHelp = () => (
    <Tooltip openOn="click" placement="bottom-end" label="Workflow editor help" content={<HelpContent />}>
        <IconButton aria-label="Workflow editor help">
            <FontAwesomeIcon icon={faCircleQuestion} aria-hidden="true" />
        </IconButton>
    </Tooltip>
);
