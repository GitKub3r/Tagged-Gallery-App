// Dato de una ficha técnica (DESIGN.md §4.4): sin caja, separado por una línea fina a la izquierda. Va dentro de
// un <dl>. tone "warning" pinta el valor en ámbar.
export const SpecFigure = ({ label, value, hint, tone }) => (
    <div className="min-w-0 border-l border-neutral-200 pl-3 dark:border-neutral-800">
        <dt className="truncate text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</dt>
        <dd className={`mt-0.5 truncate text-xl font-black tracking-tight ${tone === "warning" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</dd>
        {hint ? <dd className="truncate text-xs font-semibold text-neutral-500 dark:text-neutral-400">{hint}</dd> : null}
    </div>
);
