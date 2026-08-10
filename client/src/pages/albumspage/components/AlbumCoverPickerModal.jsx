import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    faArrowLeft,
    faCheck,
    faChevronLeft,
    faChevronRight,
    faImage,
    faList,
    faMagnifyingGlass,
    faMinus,
    faPlus,
    faSliders,
    faTableCellsLarge,
    faTag,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { MediaCard } from "../../../components/media-card/MediaCard";

const LAPTOP_MEDIA_PAGE_SIZE = 8;
const DESKTOP_MEDIA_PAGE_SIZE = 10;
const MOBILE_MEDIA_PAGE_SIZE = 4;
const DESKTOP_TAG_PAGE_SIZE = 8;
const MOBILE_TAG_PAGE_SIZE = 4;

const Pagination = ({ currentPage, totalPages, onPrevious, onNext, disabled, label }) => {
    if (totalPages <= 1) {
        return null;
    }

    return (
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-neutral-500 dark:text-neutral-400">
            <IconButton
                className="h-9 w-9"
                onClick={onPrevious}
                disabled={disabled || currentPage <= 1}
                aria-label={`Previous ${label} page`}
            >
                <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
            </IconButton>
            <span className="min-w-12 text-center tabular-nums">
                {currentPage} / {totalPages}
            </span>
            <IconButton
                className="h-9 w-9"
                onClick={onNext}
                disabled={disabled || currentPage >= totalPages}
                aria-label={`Next ${label} page`}
            >
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </IconButton>
        </div>
    );
};

export const AlbumCoverPickerModal = ({
    isOpen,
    onClose,
    onSubmit,
    isSaving,
    mode = "create",
    albumName,
    onAlbumNameChange,
    coverSearch,
    onCoverSearchChange,
    mediaViewMode,
    onMediaViewModeChange,
    mediaItems,
    filteredCoverCandidates,
    selectedCoverMediaId,
    onSelectCoverMedia,
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
    modalContentClassName = "",
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [tagPage, setTagPage] = useState(1);
    const [isCompactViewport, setIsCompactViewport] = useState(() =>
        typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
    );
    const [isWideViewport, setIsWideViewport] = useState(() =>
        typeof window === "undefined" ? false : window.matchMedia("(min-width: 1200px)").matches,
    );
    const [isMobileFilterPanelOpen, setIsMobileFilterPanelOpen] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const wideMediaQuery = window.matchMedia("(min-width: 1200px)");
        const handleChange = (event) => setIsCompactViewport(event.matches);
        const handleWideChange = (event) => setIsWideViewport(event.matches);

        mediaQuery.addEventListener("change", handleChange);
        wideMediaQuery.addEventListener("change", handleWideChange);
        return () => {
            mediaQuery.removeEventListener("change", handleChange);
            wideMediaQuery.removeEventListener("change", handleWideChange);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    const mediaPageSize = isCompactViewport
        ? MOBILE_MEDIA_PAGE_SIZE
        : isWideViewport
          ? DESKTOP_MEDIA_PAGE_SIZE
          : LAPTOP_MEDIA_PAGE_SIZE;
    const tagPageSize = isCompactViewport ? MOBILE_TAG_PAGE_SIZE : DESKTOP_TAG_PAGE_SIZE;
    const totalCandidates = filteredCoverCandidates.length;
    const totalPages = Math.max(1, Math.ceil(totalCandidates / mediaPageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const visibleCoverCandidates = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * mediaPageSize;
        return filteredCoverCandidates.slice(startIndex, startIndex + mediaPageSize);
    }, [filteredCoverCandidates, mediaPageSize, safeCurrentPage]);

    const totalTagPages = Math.max(1, Math.ceil(visibleTagFilterCandidates.length / tagPageSize));
    const safeTagPage = Math.min(tagPage, totalTagPages);
    const visibleTags = useMemo(() => {
        const startIndex = (safeTagPage - 1) * tagPageSize;
        return visibleTagFilterCandidates.slice(startIndex, startIndex + tagPageSize);
    }, [safeTagPage, tagPageSize, visibleTagFilterCandidates]);

    const resetLocalView = () => {
        setCurrentPage(1);
        setTagPage(1);
        setIsMobileFilterPanelOpen(false);
    };

    const handleClose = () => {
        resetLocalView();
        onClose();
    };

    const handleSubmit = (event) => {
        resetLocalView();
        onSubmit(event);
    };

    const handleCoverSearchChange = (value) => {
        setCurrentPage(1);
        onCoverSearchChange(value);
    };

    const handleMediaViewModeChange = (nextMode) => {
        setCurrentPage(1);
        onMediaViewModeChange(nextMode);
    };

    const handleTagFilterSearchChange = (value) => {
        setTagPage(1);
        setCurrentPage(1);
        onTagFilterSearchChange(value);
    };

    const handleToggleIncludeFilterTag = (tagName) => {
        setCurrentPage(1);
        onToggleIncludeFilterTag(tagName);
    };

    const handleToggleExcludeFilterTag = (tagName) => {
        setCurrentPage(1);
        onToggleExcludeFilterTag(tagName);
    };

    if (!isOpen) {
        return null;
    }

    const isEditMode = mode === "edit";
    const activeTagFiltersCount = selectedIncludeFilterTags.length + selectedExcludeFilterTags.length;
    const selectedCover = mediaItems.find((media) => media.id === selectedCoverMediaId);
    const selectedCoverLabel = selectedCover
        ? selectedCover.displayname || selectedCover.filename || `Media #${selectedCover.id}`
        : "No cover selected";
    const modalTitle = isEditMode ? "Edit album" : "Create album";
    const submitLabel = isEditMode ? "Save changes" : "Create album";
    const savingLabel = isEditMode ? "Saving..." : "Creating...";
    const canSubmit = Boolean(albumName.trim() && selectedCoverMediaId && !isSaving);

    return createPortal(
        <div
            className="fixed inset-0 z-[1300] flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tagged-album-upsert-modal-title"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    handleClose();
                }
            }}
        >
            <section
                className={`flex h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl sm:h-[min(48rem,calc(100dvh-2rem))] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 ${modalContentClassName}`.trim()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                    <div className="min-w-0">
                        <h2 id="tagged-album-upsert-modal-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
                            {modalTitle}
                        </h2>
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            Name your album and choose a cover from your library
                        </p>
                    </div>
                    <IconButton onClick={handleClose} disabled={isSaving} aria-label={`Close ${modalTitle.toLowerCase()} modal`}>
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </IconButton>
                </header>

                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
                    <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_16rem]">
                        <div className={`${isMobileFilterPanelOpen ? "hidden md:flex" : "flex"} min-h-0 flex-col gap-3 p-3 sm:gap-4 sm:p-5`}>
                            <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                                <label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                    <span className="mb-1.5 block">Album name</span>
                                    <input
                                        className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
                                        type="text"
                                        value={albumName}
                                        onChange={(event) => onAlbumNameChange(event.target.value)}
                                        placeholder="Summer collection"
                                        maxLength={255}
                                        disabled={isSaving}
                                        autoFocus
                                    />
                                </label>

                                <label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                    <span className="mb-1.5 block">Find a cover</span>
                                    <span className="relative block">
                                        <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                                        <input
                                            className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-9 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600"
                                            type="text"
                                            value={coverSearch}
                                            onChange={(event) => handleCoverSearchChange(event.target.value)}
                                            placeholder="Search by name or a:author"
                                            disabled={isSaving}
                                        />
                                        {coverSearch.trim() ? (
                                            <button
                                                type="button"
                                                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border-0 bg-transparent p-0 text-neutral-400 shadow-none hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                                                onClick={() => handleCoverSearchChange("")}
                                                aria-label="Clear cover search"
                                            >
                                                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                                            </button>
                                        ) : null}
                                    </span>
                                </label>
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-2">
                                <div className="flex items-center gap-2" aria-label="Cover view mode">
                                    <button
                                        type="button"
                                        className={`flex h-10 w-auto items-center gap-2 rounded-xl border px-3 text-xs font-bold shadow-none transition-transform hover:scale-[1.04] ${mediaViewMode === "card" ? "border-neutral-950 bg-neutral-950 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"}`}
                                        onClick={() => handleMediaViewModeChange("card")}
                                        aria-pressed={mediaViewMode === "card"}
                                    >
                                        <FontAwesomeIcon icon={faTableCellsLarge} aria-hidden="true" />
                                        <span className="hidden sm:inline">Cards</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex h-10 w-auto items-center gap-2 rounded-xl border px-3 text-xs font-bold shadow-none transition-transform hover:scale-[1.04] ${mediaViewMode === "list" ? "border-neutral-950 bg-neutral-950 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"}`}
                                        onClick={() => handleMediaViewModeChange("list")}
                                        aria-pressed={mediaViewMode === "list"}
                                    >
                                        <FontAwesomeIcon icon={faList} aria-hidden="true" />
                                        <span className="hidden sm:inline">List</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex h-10 w-auto items-center gap-2 rounded-xl border px-3 text-xs font-bold shadow-none md:hidden ${activeTagFiltersCount ? "border-neutral-950 bg-neutral-950 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"}`}
                                        onClick={() => setIsMobileFilterPanelOpen(true)}
                                    >
                                        <FontAwesomeIcon icon={faSliders} aria-hidden="true" />
                                        <span>Filters{activeTagFiltersCount ? ` (${activeTagFiltersCount})` : ""}</span>
                                    </button>
                                </div>

                                <Pagination
                                    currentPage={safeCurrentPage}
                                    totalPages={totalPages}
                                    onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    disabled={isSaving}
                                    label="cover"
                                />
                            </div>

                            <div className="min-h-0 flex-1">
                                {mediaItems.length === 0 ? (
                                    <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 text-center text-neutral-500 dark:text-neutral-400">
                                        <FontAwesomeIcon icon={faImage} className="text-4xl" aria-hidden="true" />
                                        <p className="max-w-sm text-sm font-semibold">Upload an image before creating an album.</p>
                                    </div>
                                ) : totalCandidates === 0 ? (
                                    <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 text-center text-neutral-500 dark:text-neutral-400">
                                        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-3xl" aria-hidden="true" />
                                        <p className="text-sm font-semibold">No cover matches the current search and filters.</p>
                                    </div>
                                ) : (
                                    <div
                                        className={`grid h-full min-h-0 content-start gap-2 sm:gap-3 ${mediaViewMode === "list" ? "grid-cols-1 grid-rows-4 md:grid-cols-2 md:grid-rows-4 xl:grid-cols-2 xl:grid-rows-5" : "grid-cols-2 md:grid-cols-4 xl:grid-cols-5"}`}
                                        aria-label="Select album cover"
                                    >
                                        {visibleCoverCandidates.map((media) => {
                                            const previewUrl = getAssetUrl(media.thumbpath || media.filepath);
                                            const isSelected = selectedCoverMediaId === media.id;
                                            const title = media.displayname || media.filename || `Media #${media.id}`;
                                            const authorLabel = String(media.author || "").trim() || "Unknown";
                                            const mediaTagCount = mapTagsFromMedia(media).length;

                                            if (mediaViewMode === "card") {
                                                return (
                                                    <MediaCard
                                                        key={media.id}
                                                        media={media}
                                                        resolvePreviewUrl={(mediaItem) => getAssetUrl(mediaItem.thumbpath || mediaItem.filepath)}
                                                        selectionMode
                                                        isSelected={isSelected}
                                                        onToggleSelect={onSelectCoverMedia}
                                                        onOpenMedia={onSelectCoverMedia}
                                                        disableLongPressSelection
                                                    />
                                                );
                                            }

                                            return (
                                                <button
                                                    key={media.id}
                                                    type="button"
                                                    className={`group relative flex min-h-0 w-full overflow-hidden rounded-xl border bg-white p-0 text-left shadow-none transition-[transform,border-color] hover:scale-[1.015] dark:bg-neutral-950 ${mediaViewMode === "list" ? "flex-row" : "flex-col"} ${isSelected ? "border-neutral-950 ring-2 ring-neutral-950 dark:border-neutral-100 dark:ring-neutral-100" : "border-neutral-300 dark:border-neutral-700"}`}
                                                    onClick={() => onSelectCoverMedia(media.id)}
                                                    aria-pressed={isSelected}
                                                    disabled={isSaving}
                                                >
                                                    <span className={`${mediaViewMode === "list" ? "h-full w-24 shrink-0" : "min-h-0 w-full flex-1"} relative block overflow-hidden bg-neutral-200 dark:bg-neutral-800`}>
                                                        {previewUrl ? (
                                                            <img className="h-full w-full object-cover" src={previewUrl} alt={title} loading="lazy" decoding="async" />
                                                        ) : (
                                                            <span className="grid h-full w-full place-items-center text-neutral-500">
                                                                <FontAwesomeIcon icon={faImage} aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
                                                        <span className="truncate text-xs font-bold text-neutral-950 dark:text-neutral-100" title={title}>{title}</span>
                                                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[0.68rem] font-semibold text-neutral-500 dark:text-neutral-400">
                                                            <span className="truncate">{authorLabel}</span>
                                                            <span aria-hidden="true">·</span>
                                                            <FontAwesomeIcon icon={faTag} aria-hidden="true" />
                                                            <span>{mediaTagCount}</span>
                                                        </span>
                                                    </span>
                                                    {isSelected ? (
                                                        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-xl bg-neutral-950 text-xs text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-950" aria-hidden="true">
                                                            <FontAwesomeIcon icon={faCheck} />
                                                        </span>
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <aside className={`${isMobileFilterPanelOpen ? "flex" : "hidden md:flex"} min-h-0 flex-col border-neutral-200 p-3 dark:border-neutral-800 sm:p-5 md:border-l`} aria-label="Filter cover by tags">
                            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-300 bg-white p-0 text-neutral-600 shadow-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 md:hidden"
                                        onClick={() => setIsMobileFilterPanelOpen(false)}
                                        aria-label="Back to cover selection"
                                    >
                                        <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                                    </button>
                                    <div>
                                        <h3 className="text-sm font-bold">Filter by tags</h3>
                                        <p className="text-[0.68rem] text-neutral-500 dark:text-neutral-400">Include or exclude media</p>
                                    </div>
                                </div>
                                {activeTagFiltersCount ? (
                                    <button
                                        type="button"
                                        className="h-auto w-auto border-0 bg-transparent p-0 text-xs font-bold text-neutral-500 shadow-none hover:text-neutral-950 dark:hover:text-neutral-100"
                                        onClick={() => {
                                            setCurrentPage(1);
                                            onClearFilterTags();
                                        }}
                                    >
                                        Clear ({activeTagFiltersCount})
                                    </button>
                                ) : null}
                            </div>

                            <label className="relative mb-3 block shrink-0">
                                <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400" aria-hidden="true" />
                                <input
                                    type="search"
                                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-950 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                                    value={tagFilterSearch}
                                    onChange={(event) => handleTagFilterSearchChange(event.target.value)}
                                    placeholder="Search tags"
                                    aria-label="Search tags"
                                />
                            </label>

                            <ul className="grid min-h-0 flex-1 auto-rows-[2.25rem] content-start gap-1.5" aria-label="Tag filters">
                                {visibleTags.map((tagName) => {
                                    const isIncluded = selectedIncludeFilterTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());
                                    const isExcluded = selectedExcludeFilterTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());

                                    return (
                                        <li key={tagName} className="flex min-h-0 items-center gap-1.5 rounded-xl bg-neutral-100 px-2 dark:bg-neutral-800/70">
                                            <button
                                                type="button"
                                                className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-xs font-bold text-neutral-700 shadow-none dark:text-neutral-200"
                                                onClick={() => handleToggleIncludeFilterTag(tagName)}
                                                aria-pressed={isIncluded}
                                                title={`Include ${tagName}`}
                                            >
                                                {tagName}
                                            </button>
                                            <button
                                                type="button"
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border p-0 text-[0.68rem] shadow-none ${isIncluded ? "border-neutral-950 bg-neutral-950 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"}`}
                                                onClick={() => handleToggleIncludeFilterTag(tagName)}
                                                aria-pressed={isIncluded}
                                                aria-label={`Include ${tagName}`}
                                            >
                                                <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border p-0 text-[0.68rem] shadow-none ${isExcluded ? "border-neutral-950 bg-neutral-950 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"}`}
                                                onClick={() => handleToggleExcludeFilterTag(tagName)}
                                                aria-pressed={isExcluded}
                                                aria-label={`Exclude ${tagName}`}
                                            >
                                                <FontAwesomeIcon icon={faMinus} aria-hidden="true" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>

                            {visibleTagFilterCandidates.length === 0 ? (
                                <div className="flex min-h-0 flex-1 items-center justify-center text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">No tags found</div>
                            ) : null}

                            <div className="mt-3 flex shrink-0 justify-center">
                                <Pagination
                                    currentPage={safeTagPage}
                                    totalPages={totalTagPages}
                                    onPrevious={() => setTagPage((page) => Math.max(1, page - 1))}
                                    onNext={() => setTagPage((page) => Math.min(totalTagPages, page + 1))}
                                    disabled={isSaving}
                                    label="tag"
                                />
                            </div>
                        </aside>
                    </div>

                    <footer className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-3 py-2 dark:border-neutral-800 sm:px-5">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-neutral-700 dark:text-neutral-300">{selectedCoverLabel}</p>
                            {error ? <p className="truncate text-xs font-semibold text-red-500" aria-live="assertive">{error}</p> : <p className="text-[0.68rem] text-neutral-500 dark:text-neutral-400">Selected album cover</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                className="h-10 w-auto rounded-xl border border-neutral-300 bg-transparent px-4 text-sm font-bold text-neutral-700 shadow-none hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                onClick={handleClose}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="h-10 w-auto rounded-xl border border-neutral-950 bg-neutral-950 px-4 text-sm font-bold text-white shadow-none transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950"
                                disabled={!canSubmit}
                            >
                                {isSaving ? savingLabel : submitLabel}
                            </button>
                        </div>
                    </footer>
                </form>
            </section>
        </div>,
        document.body,
    );
};
