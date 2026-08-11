import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const SearchField = ({ value, onChange, placeholder, label, disabled = false, onFocus, onBlur, onKeyDown, onClear, suggestionsId, activeSuggestionId, suggestionsExpanded, className = "", inputClassName = "" }) => (
    <label className={`relative block min-w-0 ${className}`}>
        <span className="sr-only">{label}</span>
        <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-600" aria-hidden="true" />
        <input type="text" className={`h-11 w-full rounded-xl border border-neutral-300 bg-white pl-9 ${onClear ? "pr-11" : "pr-3"} text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 ${inputClassName}`} value={value} onChange={(event) => onChange(event.target.value)} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} placeholder={placeholder} disabled={disabled} autoComplete="off" role={suggestionsId ? "combobox" : undefined} aria-autocomplete={suggestionsId ? "list" : undefined} aria-controls={suggestionsId} aria-expanded={suggestionsId ? Boolean(suggestionsExpanded) : undefined} aria-activedescendant={activeSuggestionId} />
        {onClear && value ? <button type="button" className="absolute! right-2! top-1/2! grid! h-8! w-8! -translate-y-1/2! place-items-center! rounded-xl! border-0! bg-transparent! p-0! text-neutral-400! shadow-none! hover:bg-neutral-100! hover:text-neutral-700! dark:hover:bg-neutral-800! dark:hover:text-neutral-200!" onMouseDown={(event) => event.preventDefault()} onClick={onClear} aria-label={`Clear ${label.toLowerCase()}`}><FontAwesomeIcon icon={faXmark} aria-hidden="true" /></button> : null}
    </label>
);
