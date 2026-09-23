// Recetas de botón de DESIGN.md §7.1. Reutilizar en lugar de copiar clases en cada componente.
const BASE =
    "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

export const buttonClasses = {
    primary: `${BASE} border-0 bg-neutral-950 font-bold text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white`,
    secondary: `${BASE} border border-neutral-300 bg-transparent font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800`,
    dangerGhost: `${BASE} border border-neutral-300 bg-transparent font-semibold text-neutral-700 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-200 dark:hover:text-red-400`,
    text: "inline-flex w-auto items-center gap-2 border-0 bg-transparent p-0 text-sm font-semibold text-neutral-600 shadow-none transition-colors hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-300 dark:hover:text-white",
};
