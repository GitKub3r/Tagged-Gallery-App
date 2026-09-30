// Tecla de un atajo de teclado (DESIGN.md §7.7), p. ej. dentro de un Tooltip o de una lista de atajos.
export const Kbd = ({ children }) => (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 px-1.5 font-sans text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {children}
    </kbd>
);
