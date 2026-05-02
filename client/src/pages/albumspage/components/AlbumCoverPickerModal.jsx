import { useMemo, useState } from "react";
import { MEDIA_PICKER_PAGE_SIZE, MediaPickerPagination } from "./MediaPickerPagination";

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

    const totalCandidates = filteredCoverCandidates.length;
    const totalPages = Math.max(1, Math.ceil(totalCandidates / MEDIA_PICKER_PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const visibleCoverCandidates = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * MEDIA_PICKER_PAGE_SIZE;
        return filteredCoverCandidates.slice(startIndex, startIndex + MEDIA_PICKER_PAGE_SIZE);
    }, [safeCurrentPage, filteredCoverCandidates]);
    const pageStart = totalCandidates === 0 ? 0 : (safeCurrentPage - 1) * MEDIA_PICKER_PAGE_SIZE + 1;
    const pageEnd = Math.min(safeCurrentPage * MEDIA_PICKER_PAGE_SIZE, totalCandidates);

    const resetCoverPage = () => {
        setCurrentPage(1);
    };

    const handleClose = () => {
        resetCoverPage();
        onClose();
    };

    const handleSubmit = (event) => {
        resetCoverPage();
        onSubmit(event);
    };

    const handleCoverSearchChange = (value) => {
        resetCoverPage();
        onCoverSearchChange(value);
    };

    const handleMediaViewModeChange = (nextMode) => {
        resetCoverPage();
        onMediaViewModeChange(nextMode);
    };

    const handleTagFilterSearchChange = (value) => {
        resetCoverPage();
        onTagFilterSearchChange(value);
    };

    const handleToggleIncludeFilterTag = (tagName) => {
        resetCoverPage();
        onToggleIncludeFilterTag(tagName);
    };

    const handleToggleExcludeFilterTag = (tagName) => {
        resetCoverPage();
        onToggleExcludeFilterTag(tagName);
    };

    const handleClearFilterTags = () => {
        resetCoverPage();
        onClearFilterTags();
    };

    const goToPreviousPage = () => {
        setCurrentPage((page) => Math.max(1, Math.min(page, totalPages) - 1));
    };

    const goToNextPage = () => {
        setCurrentPage((page) => Math.min(totalPages, Math.min(page, totalPages) + 1));
    };

    if (!isOpen) {
        return null;
    }

    const isEditMode = mode === "edit";
    const activeTagFiltersCount = selectedIncludeFilterTags.length + selectedExcludeFilterTags.length;
    const modalTitle = isEditMode ? "Edit album" : "Create album";
    const submitLabel = isEditMode ? "Save changes" : "Create album";
    const savingLabel = isEditMode ? "Saving..." : "Creating...";
    const renderPagination = (modifierClassName = "") => (
        <MediaPickerPagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={totalCandidates}
            pageStart={pageStart}
            pageEnd={pageEnd}
            onPreviousPage={goToPreviousPage}
            onNextPage={goToNextPage}
            disabled={isSaving}
            className={modifierClassName}
        />
    );

    return (
        <div className="tagged-album-modal" role="dialog" aria-modal="true" aria-labelledby="tagged-album-upsert-modal-title" onClick={handleClose}>
            <div
                className={`tagged-album-modal-content tagged-album-create-modal-content tagged-album-upsert-modal-content ${modalContentClassName}`.trim()}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="tagged-album-modal-header">
                    <div>
                        <h2 id="tagged-album-upsert-modal-title">{modalTitle}</h2>
                    </div>

                    <button
                        type="button"
                        className="tagged-album-modal-close"
                        onClick={handleClose}
                        disabled={isSaving}
                        aria-label={`Close ${isEditMode ? "edit" : "create"} album modal`}
                    >
                        <img src="/icons/close.svg" alt="" aria-hidden="true" />
                    </button>
                </header>

                <form className="tagged-album-form tagged-album-form--edit" onSubmit={handleSubmit}>
                    <div className="tagged-album-edit-layout">
                        <div className="tagged-album-edit-main-column">
                            <div className="tagged-album-create-top-row">
                                <div className="tagged-album-create-fields-row">
                                    <label className="tagged-album-field">
                                        <span>Album Name</span>
                                        <input
                                            type="text"
                                            value={albumName}
                                            onChange={(event) => onAlbumNameChange(event.target.value)}
                                            placeholder="Summer collection"
                                            maxLength={255}
                                            disabled={isSaving}
                                        />
                                    </label>

                                    <div className="tagged-album-field tagged-album-cover-field">
                                        <div className="tagged-album-cover-search-header">
                                            <span>Album Cover</span>
                                        </div>

                                        <label className="tagged-album-cover-search">
                                            <div className="tagged-album-search-input-wrap">
                                                <input
                                                    type="text"
                                                    value={coverSearch}
                                                    onChange={(event) => handleCoverSearchChange(event.target.value)}
                                                    placeholder="Search cover... (tip: a:author n:name)"
                                                    disabled={isSaving}
                                                />

                                                {coverSearch.trim().length > 0 ? (
                                                    <button
                                                        type="button"
                                                        className="tagged-album-search-inline-clear"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => handleCoverSearchChange("")}
                                                        aria-label="Clear search"
                                                        title="Clear search"
                                                        disabled={isSaving}
                                                    >
                                                        <span className="tagged-album-search-inline-clear-icon" aria-hidden="true" />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="tagged-album-create-media-controls" aria-label="Cover media view mode">
                                    <div className="tagged-album-media-view-switch">
                                        <button
                                            type="button"
                                            className={`tagged-album-view-switch-button${mediaViewMode === "card" ? " is-active" : ""}`}
                                            onClick={() => handleMediaViewModeChange("card")}
                                            aria-pressed={mediaViewMode === "card"}
                                            aria-label="Card view"
                                            title="Card view"
                                            disabled={isSaving}
                                        >
                                            <span className="tagged-album-media-view-switch-icon tagged-album-media-view-switch-icon--card" />
                                            <span className="tagged-album-view-switch-label">Card</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`tagged-album-view-switch-button${mediaViewMode === "list" ? " is-active" : ""}`}
                                            onClick={() => handleMediaViewModeChange("list")}
                                            aria-pressed={mediaViewMode === "list"}
                                            aria-label="List view"
                                            title="List view"
                                            disabled={isSaving}
                                        >
                                            <span className="tagged-album-media-view-switch-icon tagged-album-media-view-switch-icon--list" />
                                            <span className="tagged-album-view-switch-label">List</span>
                                        </button>
                                    </div>

                                    {renderPagination("tagged-album-cover-pagination--controls")}
                                </div>
                            </div>

                            {mediaItems.length === 0 ? (
                                <div className="tagged-album-media-empty" aria-live="polite">
                                    <img src="/icons/image.svg" alt="" aria-hidden="true" />
                                    <p>
                                        {isEditMode
                                            ? "You have no image media available to set as cover."
                                            : "You need at least one media item in your gallery before creating an album cover."}
                                    </p>
                                </div>
                            ) : filteredCoverCandidates.length === 0 ? (
                                <p className="tagged-album-media-picker-empty">No media matches this search.</p>
                            ) : (
                                <div className="tagged-album-media-picker-shell">
                                    {renderPagination("tagged-album-cover-pagination--top")}

                                    <div className="tagged-album-media-picker-scroll">
                                    <div
                                        className={`tagged-album-media-picker${mediaViewMode === "list" ? " tagged-album-media-picker--list" : ""}`}
                                        role="listbox"
                                        aria-label="Select album cover"
                                    >
                                        {visibleCoverCandidates.map((media) => {
                                            const previewUrl = getAssetUrl(media.thumbpath || media.filepath);
                                            const isSelected = selectedCoverMediaId === media.id;
                                            const title = media.displayname || media.filename || `Media #${media.id}`;
                                            const authorLabel = String(media.author || "").trim() || "Unknown";
                                            const mediaTagCount = mapTagsFromMedia(media).length;
                                            const isVideo =
                                                String(media.mediatype || "")
                                                    .toLowerCase()
                                                    .includes("video") ||
                                                String(media.mediatype || "")
                                                    .toLowerCase()
                                                    .includes("gif");

                                            return (
                                                <button
                                                    key={media.id}
                                                    type="button"
                                                    className={`tagged-album-media-option${mediaViewMode === "list" ? " tagged-album-media-option--list" : ""}${isSelected ? " is-selected" : ""}`}
                                                    onClick={() => onSelectCoverMedia(media.id)}
                                                    aria-pressed={isSelected}
                                                    disabled={isSaving}
                                                >
                                                    <div className="tagged-album-media-option-preview-wrap">
                                                        {previewUrl ? (
                                                            <>
                                                                <img
                                                                    className="tagged-album-media-option-preview"
                                                                    src={previewUrl}
                                                                    alt={title}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                />
                                                                {isVideo ? (
                                                                    <span className="tagged-album-media-option-play-badge" aria-hidden="true">
                                                                        <svg viewBox="0 0 24 24" className="tagged-album-media-option-play-icon" aria-hidden="true">
                                                                            <path d="M8 6.8v10.4c0 .8.9 1.3 1.6.9l8.5-5.2c.7-.4.7-1.4 0-1.8L9.6 5.9c-.7-.4-1.6.1-1.6.9Z" />
                                                                        </svg>
                                                                    </span>
                                                                ) : null}
                                                            </>
                                                        ) : (
                                                            <div className="tagged-album-media-option-preview tagged-album-media-option-preview--empty">
                                                                No preview
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="tagged-album-media-option-title-block">
                                                        <span className="tagged-album-media-option-title" title={title}>
                                                            {title}
                                                        </span>
                                                        <span className="tagged-album-media-option-subtitle">
                                                            <span>{authorLabel}</span>
                                                            <span className="tagged-album-media-option-subtitle-dot" aria-hidden="true">
                                                                &bull;
                                                            </span>
                                                            <span className="tagged-album-media-option-subtitle-tag-icon" aria-hidden="true" />
                                                            <span>{mediaTagCount}</span>
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    </div>
                                </div>
                            )}

                            <div className="tagged-album-create-actions tagged-album-create-actions--inline">
                                <button type="button" className="tagged-album-form-cancel" onClick={handleClose} disabled={isSaving}>
                                    Cancel
                                </button>
                                <button type="submit" className="tagged-album-form-submit" disabled={isSaving}>
                                    {isSaving ? savingLabel : submitLabel}
                                </button>
                            </div>
                        </div>

                        <aside className="tagged-album-edit-tag-panel" aria-label="Filter cover by tags">
                            <div className="tagged-album-edit-tag-panel-header">
                                <div className="tagged-album-edit-tag-panel-header-main">
                                    <span className="tagged-album-edit-tag-panel-title">Filter by tags</span>
                                </div>

                                {activeTagFiltersCount > 0 ? (
                                    <button type="button" className="tagged-album-edit-tag-panel-clear" onClick={handleClearFilterTags}>
                                        Clear ({activeTagFiltersCount})
                                    </button>
                                ) : null}
                            </div>

                            <input
                                type="search"
                                className="tagged-album-edit-tag-panel-search"
                                value={tagFilterSearch}
                                onChange={(event) => handleTagFilterSearchChange(event.target.value)}
                                placeholder="Search tags..."
                                aria-label="Search tags"
                            />

                            <ul className="tagged-album-edit-tag-list tagged-sidebar-tag-list" aria-label="Tag filters">
                                {visibleTagFilterCandidates.map((tagName) => {
                                    const isIncluded = selectedIncludeFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );
                                    const isExcluded = selectedExcludeFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );

                                    return (
                                        <li key={tagName}>
                                            <div className={`tagged-sidebar-tag-item${isIncluded ? " is-included" : ""}${isExcluded ? " is-excluded" : ""}`}>
                                                <div
                                                    className="tagged-sidebar-tag-item-label-wrap"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleToggleIncludeFilterTag(tagName)}
                                                    onKeyDown={(event) =>
                                                        event.key === "Enter" || event.key === " "
                                                            ? handleToggleIncludeFilterTag(tagName)
                                                            : undefined
                                                    }
                                                    aria-pressed={isIncluded}
                                                    title={`Include tag ${tagName}`}
                                                >
                                                    <span className="tagged-sidebar-tag-item-label">{tagName}</span>
                                                </div>

                                                <div className="tagged-sidebar-tag-item-actions" aria-label={`Filter ${tagName}`}>
                                                    <button
                                                        type="button"
                                                        className={`tagged-sidebar-tag-item-action tagged-sidebar-tag-item-action--include${isIncluded ? " is-active" : ""}`}
                                                        onClick={() => handleToggleIncludeFilterTag(tagName)}
                                                        aria-pressed={isIncluded}
                                                        title={`Include tag ${tagName}`}
                                                    >
                                                        +
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={`tagged-sidebar-tag-item-action tagged-sidebar-tag-item-action--exclude${isExcluded ? " is-active" : ""}`}
                                                        onClick={() => handleToggleExcludeFilterTag(tagName)}
                                                        aria-pressed={isExcluded}
                                                        title={`Exclude tag ${tagName}`}
                                                    >
                                                        -
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </aside>
                    </div>

                    {error ? <p className="tagged-album-form-error">{error}</p> : null}

                    <div className="tagged-album-create-actions tagged-album-create-actions--mobile">
                        <button type="button" className="tagged-album-form-cancel" onClick={handleClose} disabled={isSaving}>
                            Cancel
                        </button>
                        <button type="submit" className="tagged-album-form-submit" disabled={isSaving}>
                            {isSaving ? savingLabel : submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
