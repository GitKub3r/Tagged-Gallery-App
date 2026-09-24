import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Segmented control de DESIGN.md §7.1. labels="responsive": texto desde sm (en móvil solo icono);
// labels="hidden": solo icono, con el texto en title y aria-label.
export const SegmentedControl = ({ options, value, onChange, ariaLabel, labels = "responsive", disabled = false, className = "" }) => (
    <div
        className={`flex h-11 items-center gap-1 rounded-xl border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950 ${disabled ? "opacity-50" : ""} ${className}`}
        role="group"
        aria-label={ariaLabel}
    >
        {options.map((option) => {
            const isActive = option.value === value;
            return (
                <button
                    key={option.value}
                    type="button"
                    className={`inline-flex h-9 w-auto flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 px-3 text-sm font-bold shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed ${isActive ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-transparent text-neutral-500 hover:bg-neutral-100 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800"}`}
                    onClick={() => onChange(option.value)}
                    disabled={disabled}
                    aria-pressed={isActive}
                    aria-label={option.label}
                    title={option.label}
                >
                    <FontAwesomeIcon icon={option.icon} aria-hidden="true" />
                    {labels === "responsive" ? <span className="hidden sm:inline">{option.label}</span> : null}
                </button>
            );
        })}
    </div>
);
