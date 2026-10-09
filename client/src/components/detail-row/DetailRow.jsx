import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Fila de datos de una página de integración o herramienta (DESIGN.md §4.3): etiqueta en mayúsculas con icono a la
// izquierda y valor (con detalle opcional) a la derecha. Va dentro de un <dl> con divide-y.
export const DetailRow = ({ icon, label, value, detail }) => (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-3">
        <dt className="flex w-44 shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            <FontAwesomeIcon icon={icon} className="w-4" aria-hidden="true" />
            {label}
        </dt>
        <dd className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold" title={typeof value === "string" ? value : undefined}>{value}</span>
            {detail ? <span className="block text-xs text-neutral-500 dark:text-neutral-400">{detail}</span> : null}
        </dd>
    </div>
);
