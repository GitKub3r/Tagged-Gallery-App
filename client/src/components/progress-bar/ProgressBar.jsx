// Barra de progreso de DESIGN.md §7.7. value de 0 a 100; indeterminate cuando aún no se sabe cuánto falta.
// label: nombre accesible (sin él, la barra es decorativa y el progreso se cuenta con texto al lado).
const HEIGHTS = { sm: "h-1.5", md: "h-2" };

export const ProgressBar = ({ value = 0, indeterminate = false, size = "md", label }) => {
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    const accessibility = label
        ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": indeterminate ? undefined : Math.round(progress) }
        : { "aria-hidden": true };

    return (
        <div className={`${HEIGHTS[size] || HEIGHTS.md} overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700`} {...accessibility}>
            <span
                className={`block h-full rounded-full bg-neutral-950 transition-[width] duration-150 motion-reduce:transition-none dark:bg-white ${indeterminate ? "w-1/3 animate-pulse motion-reduce:animate-none" : ""}`}
                style={indeterminate ? undefined : { width: `${progress}%` }}
            />
        </div>
    );
};
