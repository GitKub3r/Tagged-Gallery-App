import { useMemo, useState } from "react";
import { faFolderOpen, faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const AlbumSearchField = ({ value, suggestions, onChange, onSubmit }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = useMemo(() => {
        const query = value.trim().toLowerCase();
        if (!query) return [];
        return suggestions.filter((name) => name.toLowerCase().includes(query)).slice(0, 8);
    }, [suggestions, value]);

    const selectOption = (name) => { onChange(name); onSubmit(name); setIsOpen(false); };

    return <label className="relative block min-w-0">
        <span className="sr-only">Search albums</span>
        <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input type="search" className="h-12 w-full rounded-xl border border-neutral-300 bg-white pl-11 pr-11 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600" value={value} onChange={(event) => { onChange(event.target.value); setIsOpen(Boolean(event.target.value.trim())); }} onFocus={() => setIsOpen(Boolean(value.trim()))} onBlur={() => setIsOpen(false)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSubmit(value); setIsOpen(false); } else if (event.key === "Escape") setIsOpen(false); }} placeholder="Search albums by name or date..." autoComplete="off" />
        {value ? <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl border-0 bg-transparent p-0 text-neutral-400 shadow-none hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); onSubmit(""); setIsOpen(false); }} aria-label="Clear album search"><FontAwesomeIcon icon={faXmark} /></button> : null}
        {isOpen && options.length ? <ul className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 grid gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="listbox">{options.map((name) => <li key={name}><button type="button" className="flex! min-h-10! w-full! items-center! gap-3! rounded-xl! border-0! bg-transparent! px-3! py-2! text-left! text-sm! text-neutral-700! shadow-none! hover:bg-neutral-100! dark:text-neutral-200! dark:hover:bg-neutral-800!" onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(name)}><FontAwesomeIcon icon={faFolderOpen} className="w-4 text-neutral-400 dark:text-neutral-500" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{name}</span><span className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-400">Album</span></button></li>)}</ul> : null}
    </label>;
};
