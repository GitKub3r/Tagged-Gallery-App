import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Icono de un tipo de nodo en su caja (nodos, paleta y listado).
export const RuleNodeIcon = ({ icon }) => (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-500/10 text-neutral-700 dark:text-neutral-200" aria-hidden="true">
        <FontAwesomeIcon icon={icon} />
    </span>
);
