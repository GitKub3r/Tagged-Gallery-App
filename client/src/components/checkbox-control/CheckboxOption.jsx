import { CheckboxControl } from "./CheckboxControl";

// Opción con casilla, título y explicación dentro de una tarjeta clicable (DESIGN.md §7.2).
export const CheckboxOption = ({ checked, onChange, disabled = false, title, description }) => (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100/60 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/50">
        <CheckboxControl checked={checked} onChange={onChange} disabled={disabled} />
        <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            {description ? <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{description}</span> : null}
        </span>
    </label>
);
