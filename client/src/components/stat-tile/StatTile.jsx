import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Indicador de un resumen (DESIGN.md §4.4). Se agrupan en grid grid-cols-2 gap-3 lg:grid-cols-4.
export const StatTile = ({ icon, label, value, hint }) => (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            <FontAwesomeIcon icon={icon} className="w-4" aria-hidden="true" />
            {label}
        </p>
        <p className="mt-2 truncate text-2xl font-black tabular-nums tracking-tight sm:text-3xl">{value}</p>
        {hint ? <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </div>
);
