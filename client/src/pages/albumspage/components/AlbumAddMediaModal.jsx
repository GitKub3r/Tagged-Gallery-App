export const AlbumAddMediaModal = ({
    isOpen,
    onClose,
    onSubmit,
    isSaving,
    searchValue,
    onSearchChange,
    availableMediaItems,
    filteredMediaCandidates,
    selectedMediaIds,
    onToggleMediaSelection,
    onClearSelection,
    getAssetUrl,
    mapTagsFromMedia,
    tagFilterMode,
    onToggleTagFilterMode,
    selectedFilterTags,
    onClearFilterTags,
    tagFilterSearch,
    onTagFilterSearchChange,
    visibleTagFilterCandidates,
    onToggleFilterTag,
    error,
}) => {
    if (!isOpen) {
        return null;
    }

    const tagModeLabel = tagFilterMode === "exclude" ? "Exclude" : "Include";

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
                                <span>Search media</span>
                                <div className="tagged-album-search-input-wrap">
                                    <input
                                        type="search"
                                        value={searchValue}
                                        onChange={(event) => onSearchChange(event.target.value)}
                                        placeholder="Search by display name"
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
                                            <span
                                                className="tagged-album-search-inline-clear-icon"
                                                aria-hidden="true"
                                            />
                                        </button>
                                    ) : null}
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
                                        className="tagged-album-add-media-picker"
                                        role="listbox"
                                        aria-label="Select media to add"
                                    >
                                        {filteredMediaCandidates.map((media) => {
                                            const previewUrl = getAssetUrl(media.thumbpath || media.filepath);
                                            const isSelected = selectedMediaIds.has(media.id);
                                            const title = media.displayname || media.filename || `Media #${media.id}`;

                                            return (
                                                <button
                                                    key={media.id}
                                                    type="button"
                                                    className={`tagged-album-add-media-option${isSelected ? " is-selected" : ""}`}
                                                    onClick={(event) => onToggleMediaSelection(media.id, event)}
                                                    aria-pressed={isSelected}
                                                    disabled={isSaving}
                                                >
                                                    <div className="tagged-album-add-media-option-preview-wrap">
                                                        {previewUrl ? (
                                                            <img
                                                                className="tagged-album-add-media-option-preview"
                                                                src={previewUrl}
                                                                alt={title}
                                                            />
                                                        ) : (
                                                            <div className="tagged-album-add-media-option-preview tagged-album-add-media-option-preview--empty">
                                                                No preview
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="tagged-album-add-media-option-title-block">
                                                        <span
                                                            className="tagged-album-add-media-option-title"
                                                            title={title}
                                                        >
                                                            {title}
                                                        </span>
                                                        <span className="tagged-album-add-media-option-subtitle">
                                                            {mapTagsFromMedia(media).slice(0, 3).join(" · ") ||
                                                                "No tags"}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <aside className="tagged-album-add-media-tag-panel" aria-label="Filter media by tags">
                            <div className="tagged-album-add-media-tag-panel-header">
                                <div className="tagged-album-add-media-tag-panel-header-main">
                                    <span className="tagged-album-add-media-tag-panel-title">Filter by tags</span>
                                    <button
                                        type="button"
                                        className={`tagged-album-add-media-tag-mode-switch${tagFilterMode === "exclude" ? " is-exclude" : ""}`}
                                        onClick={onToggleTagFilterMode}
                                        role="switch"
                                        aria-checked={tagFilterMode === "exclude"}
                                        aria-label={`Tag mode: ${tagModeLabel}`}
                                    >
                                        <span
                                            className="tagged-album-add-media-tag-mode-switch-track"
                                            aria-hidden="true"
                                        >
                                            <span className="tagged-album-add-media-tag-mode-switch-thumb" />
                                        </span>
                                        <span
                                            className="tagged-album-add-media-tag-mode-switch-label"
                                            aria-hidden="true"
                                        >
                                            {tagModeLabel}
                                        </span>
                                    </button>
                                </div>

                                {selectedFilterTags.length > 0 ? (
                                    <button
                                        type="button"
                                        className="tagged-album-add-media-tag-panel-clear"
                                        onClick={onClearFilterTags}
                                    >
                                        Clear ({selectedFilterTags.length})
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

                            <ul className="tagged-album-add-media-tag-list" aria-label="Tag filters">
                                {visibleTagFilterCandidates.map((tagName) => {
                                    const isSelected = selectedFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );

                                    return (
                                        <li key={tagName}>
                                            <button
                                                type="button"
                                                className={`tagged-album-add-media-tag-item${isSelected ? " is-selected" : ""}`}
                                                onClick={() => onToggleFilterTag(tagName)}
                                                aria-pressed={isSelected}
                                            >
                                                <span
                                                    className="tagged-album-add-media-tag-item-dot"
                                                    aria-hidden="true"
                                                />
                                                <span>{tagName}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </aside>
                    </div>

                    {error ? <p className="tagged-album-add-media-form-error">{error}</p> : null}

                    <div className="tagged-album-add-media-form-actions">
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
                </form>
            </div>
        </div>
    );
};
