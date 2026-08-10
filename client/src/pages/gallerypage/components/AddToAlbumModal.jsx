import {
    faCheck,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faFolder,
    faFolderOpen,
    faMagnifyingGlass,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../../../components/icon-button/IconButton";
import { ErrorToast } from "../../../components/toast/ErrorToast";

const PAGE_BUTTON_CLASSES =
    "flex! h-9! w-9! items-center! justify-center! rounded-xl! border! border-neutral-300! bg-white! p-0! text-neutral-600! shadow-none! hover:bg-neutral-100! disabled:opacity-30! dark:border-neutral-700! dark:bg-neutral-950! dark:text-neutral-300! dark:hover:bg-neutral-800!";

const useCompactViewport = () => {
    const [isCompact, setIsCompact] = useState(() =>
        typeof window === "undefined" ? false : window.matchMedia("(max-width: 639px)").matches,
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 639px)");
        const handleChange = (event) => setIsCompact(event.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return isCompact;
};

const SearchField = ({ value, onChange, placeholder, label, disabled = false }) => (
    <label className="relative block">
        <span className="sr-only">{label}</span>
        <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-600"
            aria-hidden="true"
        />
        <input
            type="search"
            className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
        />
    </label>
);

const Pagination = ({ page, pageCount, onPrevious, onNext }) => {
    if (pageCount <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2" aria-label="Pagination">
            <button type="button" className={PAGE_BUTTON_CLASSES} onClick={onPrevious} disabled={page === 0} aria-label="Previous page">
                <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
            </button>
            <span className="min-w-12 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {page + 1} / {pageCount}
            </span>
            <button type="button" className={PAGE_BUTTON_CLASSES} onClick={onNext} disabled={page >= pageCount - 1} aria-label="Next page">
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </button>
        </div>
    );
};

export const AddToAlbumModal = ({
    isOpen,
    onClose,
    onSubmit,
    isSaving,
    isLoading,
    error,
    albumSearch,
    onAlbumSearchChange,
    albums,
    filteredAlbums,
    selectedAlbumIds,
    onToggleAlbumSelection,
    onClearAlbumSelection,
    tagFilterMode,
    onToggleTagFilterMode,
    selectedFilterTags,
    onClearFilterTags,
    tagFilterSearch,
    onTagFilterSearchChange,
    visibleTagFilterCandidates,
    onToggleFilterTag,
    getAssetUrl,
    selectedMediaCount,
}) => {
    const [mobileView, setMobileView] = useState("albums");
    const [albumPage, setAlbumPage] = useState(0);
    const [tagPage, setTagPage] = useState(0);
    const isCompactViewport = useCompactViewport();
    const albumPageSize = isCompactViewport ? 4 : 8;
    const tagPageSize = 7;
    const albumPageCount = Math.max(1, Math.ceil(filteredAlbums.length / albumPageSize));
    const tagPageCount = Math.max(1, Math.ceil(visibleTagFilterCandidates.length / tagPageSize));
    const currentAlbumPage = Math.min(albumPage, albumPageCount - 1);
    const currentTagPage = Math.min(tagPage, tagPageCount - 1);
    const visibleAlbums = useMemo(
        () => filteredAlbums.slice(currentAlbumPage * albumPageSize, (currentAlbumPage + 1) * albumPageSize),
        [albumPageSize, currentAlbumPage, filteredAlbums],
    );
    const visibleTags = useMemo(
        () => visibleTagFilterCandidates.slice(currentTagPage * tagPageSize, (currentTagPage + 1) * tagPageSize),
        [currentTagPage, visibleTagFilterCandidates],
    );

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !isSaving) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isSaving, onClose]);

    if (!isOpen) return null;

    const tagModeLabel = tagFilterMode === "exclude" ? "Exclude" : "Include";
    const sectionTabClasses = (active) =>
        `inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border-0! px-3! py-1.5! text-xs! font-semibold! shadow-none! ${active ? "bg-neutral-950! text-white! dark:bg-neutral-100! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-100! dark:text-neutral-400! dark:hover:bg-neutral-800!"}`;

    return createPortal(
        <div
            className="fixed inset-0 z-[1400] flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tagged-gallery-add-album-modal-title"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSaving) onClose();
            }}
        >
            <section className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl sm:h-[min(42rem,calc(100dvh-2rem))] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                    <div className="min-w-0">
                        <h2 id="tagged-gallery-add-album-modal-title" className="text-xl font-semibold tracking-tight sm:text-2xl">Add to album</h2>
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {selectedMediaCount} selected item{selectedMediaCount === 1 ? "" : "s"}
                        </p>
                    </div>
                    <IconButton onClick={onClose} disabled={isSaving} aria-label="Close add to album modal">
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </IconButton>
                </header>

                <div className="flex shrink-0 gap-1 border-b border-neutral-200 px-4 py-2 lg:hidden dark:border-neutral-800">
                    <button type="button" className={sectionTabClasses(mobileView === "albums")} onClick={() => setMobileView("albums")}>
                        <FontAwesomeIcon icon={faFolderOpen} aria-hidden="true" /> Albums
                    </button>
                    <button type="button" className={sectionTabClasses(mobileView === "filters")} onClick={() => setMobileView("filters")}>
                        <FontAwesomeIcon icon={faFilter} aria-hidden="true" /> Filters
                        {selectedFilterTags.length ? <span>({selectedFilterTags.length})</span> : null}
                    </button>
                </div>

                <form id="tagged-gallery-add-album-form" className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_17rem]" onSubmit={onSubmit}>
                    <main className={`${mobileView === "albums" ? "flex" : "hidden"} min-h-0 flex-col p-4 sm:p-5 lg:flex lg:border-r lg:border-neutral-200 dark:lg:border-neutral-800`}>
                        <SearchField value={albumSearch} onChange={(value) => { setAlbumPage(0); onAlbumSearchChange(value); }} placeholder="Search albums" label="Search albums" disabled={isSaving || isLoading} />

                        <div className="mt-4 min-h-0 flex-1">
                            {isLoading ? (
                                <div className="grid h-full place-items-center text-sm text-neutral-500 dark:text-neutral-400">Loading albums...</div>
                            ) : albums.length === 0 ? (
                                <div className="grid h-full place-items-center text-center">
                                    <div>
                                        <FontAwesomeIcon icon={faFolder} className="mb-3 text-3xl text-neutral-400 dark:text-neutral-600" aria-hidden="true" />
                                        <p className="text-sm font-semibold">No albums yet</p>
                                    </div>
                                </div>
                            ) : filteredAlbums.length === 0 ? (
                                <div className="grid h-full place-items-center text-sm text-neutral-500 dark:text-neutral-400">No albums match these filters.</div>
                            ) : (
                                <div className="grid h-full grid-cols-2 content-start gap-3 sm:grid-cols-4">
                                    {visibleAlbums.map((album) => {
                                        const coverUrl = getAssetUrl(album.albumthumbpath || album.albumcoverpath);
                                        const albumDisplayName = album.displayname || album.albumname || "Untitled album";
                                        const mediaCount = Number(album.media_count || 0);
                                        const isSelected = selectedAlbumIds.has(album.id);

                                        return (
                                            <button
                                                key={album.id}
                                                type="button"
                                                className={`group! relative! aspect-[4/3]! min-h-0! w-full! overflow-hidden! rounded-xl! border! p-0! text-left! shadow-none! transition-transform! hover:scale-[1.015]! ${isSelected ? "border-neutral-950! ring-2! ring-neutral-950/20! dark:border-neutral-100! dark:ring-neutral-100/20!" : "border-neutral-300! dark:border-neutral-700!"}`}
                                                onClick={() => onToggleAlbumSelection(album.id)}
                                                aria-pressed={isSelected}
                                                disabled={isSaving}
                                            >
                                                {coverUrl ? <img className="h-full w-full object-cover" src={coverUrl} alt="" /> : <span className="grid h-full w-full place-items-center bg-neutral-200 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-600"><FontAwesomeIcon icon={faFolder} className="text-2xl" aria-hidden="true" /></span>}
                                                <span className="absolute inset-x-0 bottom-0 bg-neutral-950/90 px-2.5 py-2 text-white backdrop-blur-sm">
                                                    <span className="block truncate text-xs font-semibold" title={albumDisplayName}>{albumDisplayName}</span>
                                                    <span className="block text-[0.65rem] text-neutral-400">{mediaCount} item{mediaCount === 1 ? "" : "s"}</span>
                                                </span>
                                                <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border text-[0.65rem] ${isSelected ? "border-white bg-white text-neutral-950" : "border-white/80 bg-neutral-950/70 text-transparent"}`} aria-hidden="true">
                                                    <FontAwesomeIcon icon={faCheck} />
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="mt-3 shrink-0">
                            <Pagination page={currentAlbumPage} pageCount={albumPageCount} onPrevious={() => setAlbumPage(currentAlbumPage - 1)} onNext={() => setAlbumPage(currentAlbumPage + 1)} />
                        </div>
                    </main>

                    <aside className={`${mobileView === "filters" ? "flex" : "hidden"} min-h-0 flex-col p-4 sm:p-5 lg:flex`} aria-label="Filter albums by tags">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold">Filter by tags</h3>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">Narrow the album list</p>
                            </div>
                            <button
                                type="button"
                                className="h-8! w-auto! rounded-xl! border! border-neutral-300! bg-white! px-2.5! py-1! text-xs! font-semibold! text-neutral-600! shadow-none! dark:border-neutral-700! dark:bg-neutral-950! dark:text-neutral-300!"
                                onClick={() => { setAlbumPage(0); onToggleTagFilterMode(); }}
                                aria-label={`Tag mode: ${tagModeLabel}`}
                            >
                                {tagModeLabel}
                            </button>
                        </div>
                        <SearchField value={tagFilterSearch} onChange={(value) => { setTagPage(0); onTagFilterSearchChange(value); }} placeholder="Search tags" label="Search tags" />
                        <ul className="mt-3 grid min-h-0 flex-1 content-start gap-1" aria-label="Album tag filters">
                            {visibleTags.map((tagName) => {
                                const isSelected = selectedFilterTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());
                                return (
                                    <li key={tagName}>
                                        <button
                                            type="button"
                                            className={`flex! h-9! w-full! items-center! justify-between! rounded-xl! border-0! px-3! py-1.5! text-left! text-xs! font-semibold! shadow-none! ${isSelected ? "bg-neutral-950! text-white! dark:bg-neutral-100! dark:text-neutral-950!" : "bg-neutral-100! text-neutral-700! hover:bg-neutral-200! dark:bg-neutral-800! dark:text-neutral-200! dark:hover:bg-neutral-700!"}`}
                                            onClick={() => { setAlbumPage(0); onToggleFilterTag(tagName); }}
                                            aria-pressed={isSelected}
                                        >
                                            <span className="truncate">{tagName}</span>
                                            {isSelected ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="mt-3 shrink-0">
                            <Pagination page={currentTagPage} pageCount={tagPageCount} onPrevious={() => setTagPage(currentTagPage - 1)} onNext={() => setTagPage(currentTagPage + 1)} />
                        </div>
                        {selectedFilterTags.length ? (
                            <button type="button" className="mt-2 h-8! w-full! border-0! bg-transparent! p-1! text-xs! font-semibold! text-neutral-500! shadow-none! hover:text-neutral-950! dark:text-neutral-400! dark:hover:text-white!" onClick={() => { setAlbumPage(0); onClearFilterTags(); }}>
                                Clear filters ({selectedFilterTags.length})
                            </button>
                        ) : null}
                    </aside>
                </form>

                <ErrorToast message={error} />

                <footer className="flex h-16 shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                    <button type="button" className="h-9! w-auto! border-0! bg-transparent! px-1! text-xs! font-semibold! text-neutral-500! shadow-none! hover:text-neutral-950! disabled:opacity-40! dark:text-neutral-400! dark:hover:text-white!" onClick={onClearAlbumSelection} disabled={isSaving || selectedAlbumIds.size === 0}>
                        Clear selection
                    </button>
                    <div className="flex items-center gap-2">
                        <button type="button" className="h-10! w-auto! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-2! text-sm! font-semibold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!" onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" form="tagged-gallery-add-album-form" className="inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! py-2! text-sm! font-semibold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-40! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white!" disabled={isSaving || selectedAlbumIds.size === 0 || selectedMediaCount === 0}>
                            <FontAwesomeIcon icon={faFolderOpen} aria-hidden="true" />
                            <span>{isSaving ? "Adding..." : `Add${selectedAlbumIds.size ? ` (${selectedAlbumIds.size})` : ""}`}</span>
                        </button>
                    </div>
                </footer>
            </section>
        </div>,
        document.body,
    );
};
