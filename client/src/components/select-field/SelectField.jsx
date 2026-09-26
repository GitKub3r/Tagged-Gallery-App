import { useId } from "react";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { mediaFormInputClasses } from "../media-form-modal/mediaFormStyles";

// Select de DESIGN.md §7.2 con su etiqueta. options: [{ value, label }]; placeholder añade una opción vacía.
export const SelectField = ({ label, value, onChange, options, placeholder, disabled = false, autoFocus = false }) => {
    const selectId = useId();

    return (
        <div className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            <label className="mb-1.5 block" htmlFor={selectId}>{label}</label>
            <div className="relative">
                <select id={selectId} className={`${mediaFormInputClasses} appearance-none pr-10`} value={value} disabled={disabled} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)}>
                    {placeholder ? <option value="">{placeholder}</option> : null}
                    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
            </div>
        </div>
    );
};
