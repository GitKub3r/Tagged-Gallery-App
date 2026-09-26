import { Link } from "react-router-dom";
import { faDiagramProject, faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { Switch } from "../../../components/switch/Switch";
import { describeRuleGraph } from "../../../utils/ruleGraph";
import { RuleNodeIcon } from "./RuleNodeIcon";

const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

// Tarjeta de gestión de una regla. Toda la tarjeta abre el editor (enlace del título extendido).
export const RuleCard = ({ rule, issue, isToggling, onToggleActive, onDelete }) => {
    const { triggers, conditionCount, actionCount } = describeRuleGraph(rule.graph);
    const lastApplied = rule.last_applied_at ? formatDate(rule.last_applied_at) : null;

    return (
        <li className="relative min-w-0 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
            <div className="flex min-w-0 items-start gap-3">
                <RuleNodeIcon icon={faDiagramProject} />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold" title={rule.name}>
                        <Link
                            to={`/rules/${rule.id}`}
                            className="text-neutral-950 transition-colors after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-neutral-500 dark:text-neutral-100"
                        >
                            {rule.name}
                        </Link>
                    </h2>
                    <p className="text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">
                        {plural(conditionCount, "condition")} · {plural(actionCount, "action")}
                    </p>
                </div>
                <div className="relative z-10 flex shrink-0 items-center gap-2">
                    <Switch
                        checked={rule.is_active}
                        onChange={(isActive) => onToggleActive(rule, isActive)}
                        label={`${rule.name} active`}
                        showLabel={false}
                        disabled={isToggling || (!rule.is_active && Boolean(issue))}
                        title={!rule.is_active && issue ? "Finish the workflow to turn the rule on" : rule.is_active ? "Turn off" : "Turn on"}
                    />
                    <IconButton onClick={() => onDelete(rule)} aria-label={`Delete ${rule.name}`} title={`Delete ${rule.name}`}>
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    </IconButton>
                </div>
            </div>

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <span className="mr-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Runs on</span>
                {triggers.length > 0 ? triggers.map((trigger) => (
                    <span key={trigger.label} className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                        <FontAwesomeIcon icon={trigger.icon} aria-hidden="true" />
                        {trigger.label}
                    </span>
                )) : <span className="text-xs text-neutral-500 dark:text-neutral-400">No trigger yet</span>}
            </div>

            {issue ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                    {rule.is_active ? "Paused until you finish it" : "Needs setup"}: {issue.toLowerCase()}
                </p>
            ) : null}
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                {rule.applied_count > 0 ? `Changed ${rule.applied_count} media${lastApplied ? ` · Last on ${lastApplied}` : ""}` : "Hasn't changed any media yet"}
            </p>
        </li>
    );
};
