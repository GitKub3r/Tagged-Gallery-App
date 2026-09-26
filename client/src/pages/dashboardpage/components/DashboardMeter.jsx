// Medidor del panel: etiqueta, barra (pista y relleno del mismo tono) y dato. tone="strong" para la medida
// principal y "soft" para la secundaria, con el mismo significado en todas las filas de una sección.
export const DashboardMeter = ({ label, value, detail, tone = "strong" }) => (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-xs font-semibold">
        <span className="truncate text-neutral-500 dark:text-neutral-400">{label}</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <span className={`block h-full rounded-full ${tone === "strong" ? "bg-neutral-950 dark:bg-white" : "bg-neutral-500 dark:bg-neutral-400"}`} style={{ width: `${Math.max(value * 100, value > 0 ? 2 : 0)}%` }} />
        </span>
        <span className="min-w-24 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{detail}</span>
    </div>
);
