import { Link } from "react-router-dom";
import { faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { Skeleton } from "../../../components/loading-skeletons/Skeleton";
import { Switch } from "../../../components/switch/Switch";
import { describeRuleGraph } from "../../../utils/ruleGraph";
import { RuleSchematic } from "./RuleSchematic";

const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

// Estado de la regla como el LED de un módulo. El texto acompaña siempre al color.
const STATUS = {
    running: { label: "Running", ledClasses: "bg-green-500 ring-4 ring-green-500/20" },
    paused: { label: "Paused", ledClasses: "bg-amber-500 ring-4 ring-amber-500/20" },
    off: { label: "Off", ledClasses: "bg-neutral-400 ring-4 ring-neutral-400/20 dark:bg-neutral-600 dark:ring-neutral-600/20" },
};

const getStatus = (rule, issue) => {
    if (!rule.is_active) return STATUS.off;
    return issue ? STATUS.paused : STATUS.running;
};

// Lectura de la fila inferior: cuántos nodos de cada categoría tiene el workflow.
const Reading = ({ label, value, title, children }) => (
    <div className="min-w-0 px-3 py-3" title={title}>
        <dt className="truncate text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">{label}</dt>
        <dd className="mt-1 flex min-w-0 items-center gap-2">
            <span className="text-xl font-black tabular-nums">{value}</span>
            {children}
        </dd>
    </div>
);

// Tarjeta de una regla como un módulo de circuito: LED de estado, esquema del workflow y lecturas.
// Toda la tarjeta abre el editor (enlace del título extendido).
export const RuleCard = ({ rule, issue, isToggling, onToggleActive, onDelete }) => {
    const { triggers, conditionCount, actionCount } = describeRuleGraph(rule.graph);
    const lastApplied = rule.last_applied_at ? formatDate(rule.last_applied_at) : null;
    const status = getStatus(rule, issue);
    const triggerNames = triggers.map((trigger) => trigger.label).join(", ");
    const readout = rule.applied_count > 0 ? `Changed ${rule.applied_count} media${lastApplied ? ` · Last on ${lastApplied}` : ""}` : "Hasn't changed any media yet";
    const issueText = issue ? `${rule.is_active ? "Paused until you finish it" : "Needs setup"}: ${issue.toLowerCase()}` : null;

    return (
        <li className="min-w-0">
            <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600">
                <header className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${status.ledClasses}`} aria-hidden="true" />
                            {status.label}
                        </p>
                        <h2 className="mt-1 truncate text-lg font-black tracking-tight" title={rule.name}>
                            <Link
                                to={`/rules/${rule.id}`}
                                className="text-neutral-950 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-neutral-500 dark:text-neutral-100"
                            >
                                {rule.name}
                            </Link>
                        </h2>
                    </div>
                    <div className="relative z-10">
                        <Switch
                            checked={rule.is_active}
                            onChange={(isActive) => onToggleActive(rule, isActive)}
                            label={`${rule.name} active`}
                            showLabel={false}
                            disabled={isToggling || (!rule.is_active && Boolean(issue))}
                            title={!rule.is_active && issue ? "Finish the workflow to turn the rule on" : rule.is_active ? "Turn off" : "Turn on"}
                        />
                    </div>
                </header>

                <div className="border-y border-neutral-200 dark:border-neutral-800">
                    <RuleSchematic graph={rule.graph} isActive={status === STATUS.running} />
                </div>

                <dl className="grid grid-cols-3 divide-x divide-neutral-200 dark:divide-neutral-800">
                    <Reading label="Triggers" value={triggers.length} title={triggerNames || "No trigger yet"}>
                        {triggerNames ? <span className="sr-only">: {triggerNames}</span> : null}
                    </Reading>
                    <Reading label="Conditions" value={conditionCount} />
                    <Reading label="Actions" value={actionCount} />
                </dl>

                <footer className="mt-auto flex min-h-14 items-center gap-3 border-t border-neutral-200 py-2 pl-4 pr-2 dark:border-neutral-800">
                    {issueText ? (
                        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400" title={issueText}>
                            <FontAwesomeIcon icon={faTriangleExclamation} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{issueText}</span>
                        </p>
                    ) : (
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400" title={readout}>{readout}</p>
                    )}
                    <IconButton className="relative z-10" onClick={() => onDelete(rule)} aria-label={`Delete ${rule.name}`} title={`Delete ${rule.name}`}>
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    </IconButton>
                </footer>
            </article>
        </li>
    );
};

// Esqueleto con la forma de RuleCard.
export const RuleCardSkeleton = () => (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" aria-hidden="true">
        <div className="flex items-start gap-3 p-4">
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-2/3" /></div>
            <Skeleton className="h-5 w-9" />
        </div>
        <Skeleton className="h-32" />
        <div className="grid grid-cols-3 gap-4 p-4"><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 dark:border-neutral-800"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-10 w-10" /></div>
    </div>
);
