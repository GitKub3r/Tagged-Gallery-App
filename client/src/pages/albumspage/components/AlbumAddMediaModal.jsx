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
    visibleMediaCount,
    selectedMediaIds,
    isAllVisibleMediaSelected,
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
    if (!isOpen) {
        return null;
    }

    const activeTagFiltersCount = selectedIncludeFilterTags.length + selectedExcludeFilterTags.length;

    return (
        <div
            className="tagged-album-add-media-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tagged-album-add-media-modal-title"
            onClick={onClose}
        >
            <div className="tagged-album-add-media-modal-content" onClick={(event) => event.stopPropagation()}>
                <header className="tagged-album-add-media-modal-header">
                    <h2 id="tagged-album-add-media-modal-title">Add media to album</h2>

                    <button
                        type="button"
                        className="tagged-album-add-media-modal-close"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Close add media modal"
                    >
                        <img src="/icons/close.svg" alt="" aria-hidden="true" />
                    </button>
                </header>

                <form className="tagged-album-add-media-modal-form" onSubmit={onSubmit}>
                    <div className="tagged-album-add-media-modal-layout">
                        <div className="tagged-album-add-media-modal-main-column">
                            <label className="tagged-album-add-media-search-field">
                                <div className="tagged-album-add-media-search-header">
                                    <span>Search media</span>
                                </div>

                                <div className="tagged-album-add-media-search-controls">
                                    <div className="tagged-album-search-input-wrap">
                                        <input
                                            type="search"
                                            value={searchValue}
                                            onChange={(event) => onSearchChange(event.target.value)}
                                            placeholder="Search media... (tip: a:author n:name)"
                                            aria-label="Search media by name or author. Supports a:author and n:name."
                                            disabled={isSaving}
                                        />

                                        {searchValue.trim().length > 0 ? (
                                            <button
                                                type="button"
                                                className="tagged-album-search-inline-clear"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => onSearchChange("")}
                                                aria-label="Clear search"
                                                title="Clear search"
                                                disabled={isSaving}
                                            >
                                                <span className="tagged-album-search-inline-clear-icon" aria-hidden="true" />
                                            </button>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        className={`tagged-album-add-media-select-all-button${
                                            isAllVisibleMediaSelected ? " is-active" : ""
                                        }`}
                                        onClick={onSelectAllVisibleMedia}
                                        disabled={isSaving || visibleMediaCount === 0}
                                        aria-label="Select all visible media"
                                        title="Select all visible media"
                                    >
                                        <img src="/icons/select-all.svg" alt="" aria-hidden="true" />
                                    </button>

                                    <div className="tagged-album-add-media-view-controls" aria-label="Media view mode">
                                        <div className="tagged-album-media-view-switch">
                                            <button
                                                type="button"
                                                className={`tagged-album-view-switch-button${mediaViewMode === "card" ? " is-active" : ""}`}
                                                onClick={() => onMediaViewModeChange("card")}
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
                                                onClick={() => onMediaViewModeChange("list")}
                                                aria-pressed={mediaViewMode === "list"}
                                                aria-label="List view"
                                                title="List view"
                                                disabled={isSaving}
                                            >
                                                <span className="tagged-album-media-view-switch-icon tagged-album-media-view-switch-icon--list" />
                                                <span className="tagged-album-view-switch-label">List</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </label>

                            {availableMediaItems.length === 0 ? (
                                <p className="tagged-album-add-media-picker-empty">
                                    All your media is already in this album.
                                </p>
                            ) : filteredMediaCandidates.length === 0 ? (
                                <p className="tagged-album-add-media-picker-empty">No media matches this search.</p>
                            ) : (
                                <div className="tagged-album-add-media-picker-scroll">
                                    <div
                                        className={`tagged-album-add-media-picker${mediaViewMode === "list" ? " tagged-album-add-media-picker--list" : ""}`}
                                        role="listbox"
                                        aria-label="Select media to add"
                                    >
                                        {filteredMediaCandidates.map((media) => {
                                            const previewUrl = getAssetUrl(media.thumbpath || media.filepath);
                                            const isSelected = selectedMediaIds.has(media.id);
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
                                                    className={`tagged-album-add-media-option${mediaViewMode === "list" ? " tagged-album-add-media-option--list" : ""}${isSelected ? " is-selected" : ""}`}
                                                    onClick={(event) => onToggleMediaSelection(media.id, event)}
                                                    aria-pressed={isSelected}
                                                    disabled={isSaving}
                                                >
                                                    <div className="tagged-album-add-media-option-preview-wrap">
                                                        {previewUrl ? (
                                                            <>
                                                                <img
                                                                    className="tagged-album-add-media-option-preview"
                                                                    src={previewUrl}
                                                                    alt={title}
                                                                />
                                                                {isVideo ? (
                                                                    <span className="tagged-album-add-media-option-play-badge" aria-hidden="true">
                                                                        <svg
                                                                            viewBox="0 0 24 24"
                                                                            className="tagged-album-add-media-option-play-icon"
                                                                            aria-hidden="true"
                                                                        >
                                                                            <path d="M8 6.8v10.4c0 .8.9 1.3 1.6.9l8.5-5.2c.7-.4.7-1.4 0-1.8L9.6 5.9c-.7-.4-1.6.1-1.6.9Z" />
                                                                        </svg>
                                                                    </span>
                                                                ) : null}
                                                            </>
                                                        ) : (
                                                            <div className="tagged-album-add-media-option-preview tagged-album-add-media-option-preview--empty">
                                                                No preview
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="tagged-album-add-media-option-title-block">
                                                        <span className="tagged-album-add-media-option-title" title={title}>
                                                            {title}
                                                        </span>
                                                        <span className="tagged-album-add-media-option-subtitle">
                                                            <span>{authorLabel}</span>
                                                            <span className="tagged-album-add-media-option-subtitle-dot" aria-hidden="true">
                                                                &bull;
                                                            </span>
                                                            <span
                                                                className="tagged-album-add-media-option-subtitle-tag-icon"
                                                                aria-hidden="true"
                                                            />
                                                            <span>{mediaTagCount}</span>
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {error ? <p className="tagged-album-add-media-form-error">{error}</p> : null}

                            <div className="tagged-album-add-media-main-actions">
                                <button
                                    type="button"
                                    className="tagged-album-add-media-form-cancel"
                                    onClick={onClearSelection}
                                    disabled={isSaving || selectedMediaIds.size === 0}
                                >
                                    Clear selection
                                </button>
                                <button
                                    type="submit"
                                    className="tagged-album-add-media-form-submit"
                                    disabled={isSaving || selectedMediaIds.size === 0}
                                >
                                    {isSaving
                                        ? `Adding (${selectedMediaIds.size})...`
                                        : `Add media${selectedMediaIds.size > 0 ? ` (${selectedMediaIds.size})` : ""}`}
                                </button>
                            </div>
                        </div>

                        <aside className="tagged-album-add-media-tag-panel" aria-label="Filter media by tags">
                            <div className="tagged-album-add-media-tag-panel-header">
                                <div className="tagged-album-add-media-tag-panel-header-main">
                                    <span className="tagged-album-add-media-tag-panel-title">Filter by tags</span>
                                </div>

                                {activeTagFiltersCount > 0 ? (
                                    <button
                                        type="button"
                                        className="tagged-album-add-media-tag-panel-clear"
                                        onClick={onClearFilterTags}
                                    >
                                        Clear ({activeTagFiltersCount})
                                    </button>
                                ) : null}
                            </div>

                            <input
                                type="search"
                                className="tagged-album-add-media-tag-panel-search"
                                value={tagFilterSearch}
                                onChange={(event) => onTagFilterSearchChange(event.target.value)}
                                placeholder="Search tags..."
                                aria-label="Search tags"
                            />

                            <ul className="tagged-album-add-media-tag-list tagged-sidebar-tag-list" aria-label="Tag filters">
                                {visibleTagFilterCandidates.map((tagName) => {
                                    const isIncluded = selectedIncludeFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );
                                    const isExcluded = selectedExcludeFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );

                                    return (
                                        <li key={tagName}>
                                            <div
                                                className={`tagged-sidebar-tag-item${isIncluded ? " is-included" : ""}${isExcluded ? " is-excluded" : ""}`}
                                            >
                                                <div
                                                    className="tagged-sidebar-tag-item-label-wrap"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => onToggleIncludeFilterTag(tagName)}
                                                    onKeyDown={(event) =>
                                                        event.key === "Enter" || event.key === " "
                                                            ? onToggleIncludeFilterTag(tagName)
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
                                                        onClick={() => onToggleIncludeFilterTag(tagName)}
                                                        aria-pressed={isIncluded}
                                                        title={`Include tag ${tagName}`}
                                                    >
                                                        +
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={`tagged-sidebar-tag-item-action tagged-sidebar-tag-item-action--exclude${isExcluded ? " is-active" : ""}`}
                                                        onClick={() => onToggleExcludeFilterTag(tagName)}
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
                </form>
            </div>
        </div>
    );
};
