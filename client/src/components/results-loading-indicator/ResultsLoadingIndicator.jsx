import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// placement="page": flotante sobre la página; "inline": dentro de otro contenedor (p. ej. un panel del lienzo de reglas).
export const ResultsLoadingIndicator = ({ isVisible, label = "Updating results", placement = "page" }) => {
    if (!isVisible) return null;

    const indicator = (
        <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white/95 px-3 text-xs font-bold text-neutral-700 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200">
            <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
            {label}
        </span>
    );

    return (
        <div className={placement === "page" ? "pointer-events-none fixed left-1/2 top-20 z-[80] -translate-x-1/2" : "pointer-events-none"} role="status" aria-live="polite">
            {indicator}
        </div>
    );
};
