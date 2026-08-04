const BASE_CLASSES =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-50 p-0 text-neutral-600 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800";

export const IconButton = ({ className = "", type = "button", children, ...props }) => (
    <button type={type} className={`${BASE_CLASSES} ${className}`.trim()} {...props}>
        {children}
    </button>
);
