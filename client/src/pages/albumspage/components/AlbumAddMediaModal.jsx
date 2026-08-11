import {
    faCheck,
    faCheckDouble,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faImage,
    faList,
    faMinus,
    faPhotoFilm,
    faPlus,
    faTableCellsLarge,
    faTag,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ErrorToast } from "../../../components/toast/ErrorToast";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../../../components/icon-button/IconButton";
import { MediaFacetSearch } from "../../../components/media-facet-search/MediaFacetSearch";
import { SearchField } from "../../../components/search-field/SearchField";

const useCompactViewport = () => {
    const [isCompact, setIsCompact] = useState(() =>
        typeof window === "undefined" ? false : window.matchMedia("(max-width: 639px)").matches,
    );

    useEffect(() => {
        const query = window.matchMedia("(max-width: 639px)");
        const handleChange = (event) => setIsCompact(event.matches);
        query.addEventListener("change", handleChange);
        return () => query.removeEventListener("change", handleChange);
    }, []);

    return isCompact;
};

const Pagination = ({ page, pageCount, onPrevious, onNext }) => {
    if (pageCount <= 1) return null;
    const buttonClasses = "grid! h-9! w-9! place-items-center! rounded-xl! border! border-neutral-300! bg-white! p-0! text-neutral-600! shadow-none! hover:bg-neutral-100! disabled:opacity-30! dark:border-neutral-700! dark:bg-neutral-950! dark:text-neutral-300! dark:hover:bg-neutral-800!";
    return (
        <div className="flex items-center justify-center gap-2" aria-label="Media pagination">
            <button type="button" className={buttonClasses} onClick={onPrevious} disabled={page === 0} aria-label="Previous media page"><FontAwesomeIcon icon={faChevronLeft} /></button>
            <span className="min-w-12 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">{page + 1} / {pageCount}</span>
            <button type="button" className={buttonClasses} onClick={onNext} disabled={page >= pageCount - 1} aria-label="Next media page"><FontAwesomeIcon icon={faChevronRight} /></button>
        </div>
    );
};

export const AlbumAddMediaModal = ({
    isOpen,
    onClose,
    onSubmit,
    isSaving,
    searchValue,
    onSearchChange,
    mediaViewMode,
    onMediaViewModeChange,
    availableMediaItems,
    filteredMediaCandidates,
    selectedMediaIds,
    onSelectAllVisibleMedia,
    onToggleMediaSelection,
    onClearSelection,
    getAssetUrl,
    mapTagsFromMedia,
    selectedIncludeFilterTags,
    selectedExcludeFilterTags,
    onToggleIncludeFilterTag,
    onToggleExcludeFilterTag,
    onClearFilterTags,
    tagFilterSearch,
    onTagFilterSearchChange,
    visibleTagFilterCandidates,
    error,
}) => {
    const [mobileView, setMobileView] = useState("media");
    const [mediaPage, setMediaPage] = useState(0);
    const [tagPage, setTagPage] = useState(0);
    const isCompact = useCompactViewport();
    const mediaPageSize = isCompact ? 4 : mediaViewMode === "list" ? 6 : 8;
    const tagPageSize = 7;
    const mediaPageCount = Math.max(1, Math.ceil(filteredMediaCandidates.length / mediaPageSize));
    const tagPageCount = Math.max(1, Math.ceil(visibleTagFilterCandidates.length / tagPageSize));
    const currentMediaPage = Math.min(mediaPage, mediaPageCount - 1);
    const currentTagPage = Math.min(tagPage, tagPageCount - 1);
    const visibleMedia = useMemo(() => filteredMediaCandidates.slice(currentMediaPage * mediaPageSize, (currentMediaPage + 1) * mediaPageSize), [currentMediaPage, filteredMediaCandidates, mediaPageSize]);
    const visibleTags = useMemo(() => visibleTagFilterCandidates.slice(currentTagPage * tagPageSize, (currentTagPage + 1) * tagPageSize), [currentTagPage, visibleTagFilterCandidates]);
    const allVisibleSelected = visibleMedia.length > 0 && visibleMedia.every((media) => selectedMediaIds.has(media.id));
    const filterCount = selectedIncludeFilterTags.length + selectedExcludeFilterTags.length;

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleEscape = (event) => {
            if (event.key === "Escape" && !isSaving) onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, isSaving, onClose]);

    if (!isOpen) return null;

    const resetMediaPage = () => setMediaPage(0);
    const tabClasses = (active) => `inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border-0! px-3! py-1.5! text-xs! font-semibold! shadow-none! ${active ? "bg-neutral-950! text-white! dark:bg-neutral-100! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-100! dark:text-neutral-400! dark:hover:bg-neutral-800!"}`;
    const viewButtonClasses = (active) => `grid! h-11! w-11! shrink-0! place-items-center! rounded-xl! border! p-0! shadow-none! ${active ? "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!" : "border-neutral-300! bg-white! text-neutral-500! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-950! dark:text-neutral-400! dark:hover:bg-neutral-800!"}`;

    return createPortal(
        <div className="fixed inset-0 z-[1400] flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="album-add-media-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}>
            <section className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl sm:h-[min(42rem,calc(100dvh-2rem))] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                    <div>
                        <h2 id="album-add-media-title" className="text-xl font-semibold tracking-tight sm:text-2xl">Add media</h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Choose items from your library</p>
                    </div>
                    <IconButton onClick={onClose} disabled={isSaving} aria-label="Close add media modal"><FontAwesomeIcon icon={faXmark} /></IconButton>
                </header>

                <div className="flex shrink-0 gap-1 border-b border-neutral-200 px-4 py-2 lg:hidden dark:border-neutral-800">
                    <button type="button" className={tabClasses(mobileView === "media")} onClick={() => setMobileView("media")}><FontAwesomeIcon icon={faPhotoFilm} /> Media</button>
                    <button type="button" className={tabClasses(mobileView === "filters")} onClick={() => setMobileView("filters")}><FontAwesomeIcon icon={faFilter} /> Filters {filterCount ? `(${filterCount})` : ""}</button>
                </div>

                <form id="album-add-media-form" className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_17rem]" onSubmit={onSubmit}>
                    <main className={`${mobileView === "media" ? "flex" : "hidden"} min-h-0 flex-col p-4 sm:p-5 lg:flex lg:border-r lg:border-neutral-200 dark:lg:border-neutral-800`}>
                        <div className="flex shrink-0 items-start gap-2">
                            <div className="min-w-0 flex-1"><MediaFacetSearch value={searchValue} onChange={(value) => { resetMediaPage(); onSearchChange(value); }} mediaItems={availableMediaItems} disabled={isSaving} /></div>
                            <button type="button" className={viewButtonClasses(allVisibleSelected)} onClick={() => onSelectAllVisibleMedia(visibleMedia, allVisibleSelected)} disabled={!visibleMedia.length || isSaving} aria-label="Select all visible media"><FontAwesomeIcon icon={faCheckDouble} /></button>
                            <button type="button" className={viewButtonClasses(mediaViewMode === "card")} onClick={() => { resetMediaPage(); onMediaViewModeChange("card"); }} aria-label="Card view"><FontAwesomeIcon icon={faTableCellsLarge} /></button>
                            <button type="button" className={viewButtonClasses(mediaViewMode === "list")} onClick={() => { resetMediaPage(); onMediaViewModeChange("list"); }} aria-label="List view"><FontAwesomeIcon icon={faList} /></button>
                        </div>

                        <div className="mt-4 min-h-0 flex-1">
                            {availableMediaItems.length === 0 ? (
                                <div className="grid h-full place-items-center text-center text-sm text-neutral-500 dark:text-neutral-400"><div><FontAwesomeIcon icon={faImage} className="mb-3 text-3xl text-neutral-400 dark:text-neutral-600" /><p>All your media is already in this album.</p></div></div>
                            ) : filteredMediaCandidates.length === 0 ? (
                                <div className="grid h-full place-items-center text-sm text-neutral-500 dark:text-neutral-400">No media matches these filters.</div>
                            ) : (
                                <div className={mediaViewMode === "list" ? "grid h-full content-start gap-2" : "grid h-full grid-cols-2 content-start gap-3 sm:grid-cols-4"} role="listbox" aria-label="Select media to add">
                                    {visibleMedia.map((media) => {
                                        const previewUrl = getAssetUrl(media.thumbpath || media.filepath);
                                        const selected = selectedMediaIds.has(media.id);
                                        const title = media.displayname || media.filename || `Media #${media.id}`;
                                        const author = String(media.author || "").trim() || "Unknown";
                                        const tagCount = mapTagsFromMedia(media).length;
                                        return (
                                            <button key={media.id} type="button" className={`${mediaViewMode === "list" ? "flex! h-[4.35rem]! items-center!" : "relative! grid! aspect-[4/3]! grid-rows-[minmax(0,1fr)_3rem]! overflow-hidden!"} group! w-full! rounded-xl! border! p-0! text-left! shadow-none! transition-transform! hover:scale-[1.012]! ${selected ? "border-neutral-950! ring-2! ring-neutral-950/20! dark:border-neutral-100! dark:ring-neutral-100/20!" : "border-neutral-300! dark:border-neutral-700!"}`} onClick={(event) => onToggleMediaSelection(media.id, event)} aria-pressed={selected} disabled={isSaving}>
                                                <span className={`${mediaViewMode === "list" ? "h-full w-24 shrink-0" : "relative h-full w-full"} block overflow-hidden bg-neutral-200 dark:bg-neutral-950`}>
                                                    {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center text-neutral-500"><FontAwesomeIcon icon={faImage} /></span>}
                                                </span>
                                                <span className={mediaViewMode === "list" ? "min-w-0 flex-1 px-3" : "min-w-0 bg-neutral-950 px-2.5 py-1.5 text-white"}>
                                                    <span className="block truncate text-xs font-semibold" title={title}>{title}</span>
                                                    <span className={`mt-0.5 flex items-center gap-1.5 text-[0.65rem] ${mediaViewMode === "list" ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-400"}`}><span className="truncate">{author}</span><span>·</span><FontAwesomeIcon icon={faTag} /><span>{tagCount}</span></span>
                                                </span>
                                                <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border text-[0.65rem] ${selected ? "border-white bg-white text-neutral-950" : "border-white/80 bg-neutral-950/70 text-transparent"}`}><FontAwesomeIcon icon={faCheck} /></span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="mt-3 shrink-0"><Pagination page={currentMediaPage} pageCount={mediaPageCount} onPrevious={() => setMediaPage(currentMediaPage - 1)} onNext={() => setMediaPage(currentMediaPage + 1)} /></div>
                    </main>

                    <aside className={`${mobileView === "filters" ? "flex" : "hidden"} min-h-0 flex-col p-4 sm:p-5 lg:flex`} aria-label="Filter media by tags">
                        <div className="mb-3"><h3 className="text-sm font-semibold">Filter by tags</h3><p className="text-xs text-neutral-500 dark:text-neutral-400">Include or exclude media</p></div>
                        <SearchField value={tagFilterSearch} onChange={(value) => { setTagPage(0); onTagFilterSearchChange(value); }} placeholder="Search tags" label="Search tags" />
                        <ul className="mt-3 grid min-h-0 flex-1 content-start gap-1" aria-label="Tag filters">
                            {visibleTags.map((tagName) => {
                                const included = selectedIncludeFilterTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());
                                const excluded = selectedExcludeFilterTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());
                                return (
                                    <li key={tagName} className="flex h-10 items-center gap-1 rounded-xl bg-neutral-100 px-2 dark:bg-neutral-800">
                                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{tagName}</span>
                                        <button type="button" className={`grid! h-7! w-7! place-items-center! rounded-lg! border-0! p-0! text-xs! shadow-none! ${included ? "bg-neutral-950! text-white! dark:bg-neutral-100! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-200! dark:text-neutral-400! dark:hover:bg-neutral-700!"}`} onClick={() => { resetMediaPage(); onToggleIncludeFilterTag(tagName); }} aria-pressed={included} aria-label={`Include tag ${tagName}`}><FontAwesomeIcon icon={faPlus} /></button>
                                        <button type="button" className={`grid! h-7! w-7! place-items-center! rounded-lg! border-0! p-0! text-xs! shadow-none! ${excluded ? "bg-neutral-950! text-white! dark:bg-neutral-100! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-200! dark:text-neutral-400! dark:hover:bg-neutral-700!"}`} onClick={() => { resetMediaPage(); onToggleExcludeFilterTag(tagName); }} aria-pressed={excluded} aria-label={`Exclude tag ${tagName}`}><FontAwesomeIcon icon={faMinus} /></button>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="mt-3 shrink-0"><Pagination page={currentTagPage} pageCount={tagPageCount} onPrevious={() => setTagPage(currentTagPage - 1)} onNext={() => setTagPage(currentTagPage + 1)} /></div>
                        {filterCount ? <button type="button" className="mt-2 h-8! w-full! border-0! bg-transparent! p-1! text-xs! font-semibold! text-neutral-500! shadow-none! hover:text-neutral-950! dark:text-neutral-400! dark:hover:text-white!" onClick={() => { resetMediaPage(); onClearFilterTags(); }}>Clear filters ({filterCount})</button> : null}
                    </aside>
                </form>

                <ErrorToast message={error} />
                <footer className="flex h-16 shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                    <button type="button" className="h-9! w-auto! border-0! bg-transparent! px-1! text-xs! font-semibold! text-neutral-500! shadow-none! hover:text-neutral-950! disabled:opacity-40! dark:text-neutral-400! dark:hover:text-white!" onClick={onClearSelection} disabled={isSaving || selectedMediaIds.size === 0}>Clear selection</button>
                    <div className="flex items-center gap-2">
                        <button type="button" className="h-10! w-auto! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-2! text-sm! font-semibold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!" onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" form="album-add-media-form" className="inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! py-2! text-sm! font-semibold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-40! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white!" disabled={isSaving || selectedMediaIds.size === 0}><FontAwesomeIcon icon={faPlus} /><span>{isSaving ? "Adding..." : `Add${selectedMediaIds.size ? ` (${selectedMediaIds.size})` : ""}`}</span></button>
                    </div>
                </footer>
            </section>
        </div>,
        document.body,
    );
};
