import { useMemo, useState } from "react";
import { faImage, faUser, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { parseMediaFacetFilters, serializeMediaFacetFilters } from "../../utils/mediaFacetFilters";
import { SearchField } from "../search-field/SearchField";

const normalizeOptions = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

export const MediaFacetSearch = ({ value, onChange, mediaItems = [], displayNames = [], authors = [], label = "Search media", placeholder = "Search media names or authors", disabled = false }) => {
    const [inputValue, setInputValue] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const selectedFilters = useMemo(() => parseMediaFacetFilters(value), [value]);
    const options = useMemo(() => {
        const nameValues = normalizeOptions([...displayNames, ...mediaItems.map((media) => media?.displayname)]);
        const authorValues = normalizeOptions([...authors, ...mediaItems.map((media) => media?.author)]);
        const query = inputValue.trim().toLowerCase();

        if (!query) return [];

        return [
            ...nameValues.map((optionValue) => ({ type: "name", value: optionValue })),
            ...authorValues.map((optionValue) => ({ type: "author", value: optionValue })),
        ]
            .filter((option) => option.value.toLowerCase().includes(query))
            .filter((option) => !selectedFilters.some((filter) => filter.type === option.type && filter.value.toLowerCase() === option.value.toLowerCase()))
            .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base", numeric: true }))
            .slice(0, 8);
    }, [authors, displayNames, inputValue, mediaItems, selectedFilters]);

    const selectOption = (option) => {
        onChange(serializeMediaFacetFilters([...selectedFilters, option]));
        setInputValue("");
        setIsOpen(false);
    };

    const removeFilter = (filterToRemove) => {
        onChange(serializeMediaFacetFilters(selectedFilters.filter((filter) => filter !== filterToRemove)));
    };

    return (
        <div className="min-w-0">
            <div className="relative">
                <SearchField
                    label={label}
                    value={inputValue}
                    onChange={(nextValue) => { setInputValue(nextValue); setIsOpen(Boolean(nextValue.trim())); }}
                    onFocus={() => setIsOpen(Boolean(inputValue.trim()))}
                    onBlur={() => setIsOpen(false)}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            setIsOpen(false);
                        } else if (event.key === "Enter" && options[0]) {
                            event.preventDefault();
                            selectOption(options[0]);
                        }
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                {isOpen && options.length > 0 ? (
                    <ul className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 grid gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="listbox">
                        {options.map((option) => (
                            <li key={`${option.type}-${option.value}`}>
                                <button type="button" className="flex! min-h-10! w-full! items-center! gap-3! rounded-xl! border-0! bg-transparent! px-3! py-2! text-left! text-sm! text-neutral-700! shadow-none! hover:bg-neutral-100! dark:text-neutral-200! dark:hover:bg-neutral-800!" onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)}>
                                    <FontAwesomeIcon icon={option.type === "author" ? faUser : faImage} className="w-4 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate">{option.value}</span>
                                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-400">{option.type === "author" ? "Author" : "Media"}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>

            {selectedFilters.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Active media filters">
                    {selectedFilters.map((filter) => (
                        <span key={`${filter.type}-${filter.value}`} className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                            <FontAwesomeIcon icon={filter.type === "author" ? faUser : faImage} className="shrink-0 text-neutral-400" aria-hidden="true" />
                            <span className="truncate">{filter.value}</span>
                            <button type="button" className="grid! h-5! w-5! shrink-0! place-items-center! rounded-full! border-0! bg-transparent! p-0! text-neutral-400! shadow-none! hover:bg-neutral-200! hover:text-neutral-700! dark:hover:bg-neutral-700! dark:hover:text-white!" onClick={() => removeFilter(filter)} aria-label={`Remove ${filter.type} filter ${filter.value}`}>
                                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
