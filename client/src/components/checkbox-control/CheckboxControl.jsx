import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const CheckboxControl = ({ checked, onChange, disabled = false }) => (
    <span className="relative grid h-4 w-4 shrink-0 place-items-center">
        <input
            type="checkbox"
            className="peer h-4 w-4 appearance-none rounded-xl border border-neutral-400 bg-white checked:border-neutral-950 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-950 dark:checked:border-white dark:checked:bg-white"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
        />
        <FontAwesomeIcon icon={faCheck} className="pointer-events-none absolute text-[0.55rem] text-white opacity-0 peer-checked:opacity-100 dark:text-black" aria-hidden="true" />
    </span>
);
