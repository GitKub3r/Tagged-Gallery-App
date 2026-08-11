import { useId, useMemo, useState } from "react";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SearchField } from "../../../components/search-field/SearchField";
import { useSuggestionNavigation } from "../../../hooks/useSuggestionNavigation";
import { rankSuggestions } from "../../../utils/suggestionRanking";

export const AlbumSearchField = ({ value, suggestions, onChange, onSubmit }) => {
    const [isOpen, setIsOpen] = useState(false);
    const suggestionsId = useId();
    const options = useMemo(() => {
        const query = value.trim();
        if (!query) return [];
        return rankSuggestions(suggestions, query).slice(0, 8);
    }, [suggestions, value]);

    const selectOption = (name) => { onChange(name); onSubmit(name); setIsOpen(false); };
    const { activeIndex, setActiveIndex, openSuggestions, closeSuggestions, handleKeyDown } = useSuggestionNavigation({
        items: options,
        isOpen,
        onOpen: () => setIsOpen(true),
        onClose: () => setIsOpen(false),
        onSelect: selectOption,
        onEnter: (event) => {
            event.preventDefault();
            onSubmit(value);
            setIsOpen(false);
        },
    });

    return <div className="relative min-w-0">
        <SearchField label="Search albums" value={value} onChange={(nextValue) => { onChange(nextValue); if (nextValue.trim()) openSuggestions(); else closeSuggestions(); }} onFocus={() => { if (value.trim()) openSuggestions(); }} onBlur={closeSuggestions} onKeyDown={handleKeyDown} onClear={() => { onChange(""); onSubmit(""); closeSuggestions(); }} placeholder="Search albums by name or date..." inputClassName="h-12 pl-11" suggestionsId={suggestionsId} suggestionsExpanded={isOpen && options.length > 0} activeSuggestionId={activeIndex >= 0 ? `${suggestionsId}-option-${activeIndex}` : undefined} />
        {isOpen && options.length ? <ul id={suggestionsId} className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 grid gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="listbox">{options.map((name, index) => <li key={name} id={`${suggestionsId}-option-${index}`} role="option" aria-selected={index === activeIndex}><button type="button" className={`flex! min-h-10! w-full! items-center! gap-3! rounded-xl! border-0! px-3! py-2! text-left! text-sm! text-neutral-700! shadow-none! hover:bg-neutral-100! dark:text-neutral-200! dark:hover:bg-neutral-800! ${index === activeIndex ? "bg-neutral-100! dark:bg-neutral-800!" : "bg-transparent!"}`} onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(name)}><FontAwesomeIcon icon={faFolderOpen} className="w-4 text-neutral-400 dark:text-neutral-500" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{name}</span><span className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-400">Album</span></button></li>)}</ul> : null}
    </div>;
};
