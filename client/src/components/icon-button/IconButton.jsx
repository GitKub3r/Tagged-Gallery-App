const BASE_CLASSES =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border p-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50";
const DEFAULT_CLASSES =
    "border-neutral-300 bg-neutral-50 text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800";
// Botón de estado activado (con aria-pressed), en invertido como el resto de opciones activas.
const ACTIVE_CLASSES = "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950";

export const IconButton = ({ className = "", type = "button", isActive = false, children, ...props }) => (
    <button type={type} className={`${BASE_CLASSES} ${isActive ? ACTIVE_CLASSES : DEFAULT_CLASSES} ${className}`.trim()} {...props}>
        {children}
    </button>
);
