// Interruptor de DESIGN.md §7.2. label es el nombre accesible; showLabel lo muestra junto al interruptor.
export const Switch = ({ checked, onChange, label, showLabel = true, disabled = false, title }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={showLabel ? undefined : label}
        title={title}
        className="inline-flex h-10 w-auto shrink-0 items-center gap-2 rounded-xl border-0 bg-transparent p-0 text-sm font-semibold text-neutral-700 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200"
        onClick={() => onChange(!checked)}
        disabled={disabled}
    >
        <span className={`flex h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${checked ? "bg-neutral-950 dark:bg-white" : "bg-neutral-300 dark:bg-neutral-700"}`} aria-hidden="true">
            <span className={`block h-4 w-4 rounded-full transition-transform motion-reduce:transition-none ${checked ? "translate-x-4 bg-white dark:bg-neutral-950" : "bg-white dark:bg-neutral-300"}`} />
        </span>
        {showLabel ? <span>{label}</span> : null}
    </button>
);
