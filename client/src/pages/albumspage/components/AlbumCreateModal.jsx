export const AlbumCreateModal = ({
    isOpen,
    onClose,
    onSubmit,
    isSaving,
    albumName,
    onAlbumNameChange,
    coverSearch,
    onCoverSearchChange,
    imageMediaItems,
    filteredCoverCandidates,
    selectedCoverMediaId,
    onSelectCoverMedia,
    getAssetUrl,
    mapTagsFromMedia,
    editTagFilterMode,
    onToggleEditTagFilterMode,
    selectedEditFilterTags,
    onClearEditFilterTags,
    editTagFilterSearch,
    onEditTagFilterSearchChange,
    visibleEditTagFilterCandidates,
    onToggleEditFilterTag,
    error,
}) => {
    if (!isOpen) {
        return null;
    }

    const tagModeLabel = editTagFilterMode === "exclude" ? "Exclude" : "Include";

    return (
        <div
            className="tagged-album-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tagged-album-create-modal-title"
            onClick={onClose}
        >
            <div
                className="tagged-album-modal-content tagged-album-create-modal-content"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="tagged-album-modal-header">
                    <div>
                        <h2 id="tagged-album-create-modal-title">Create album</h2>
                    </div>

                    <button
                        type="button"
                        className="tagged-album-modal-close"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Close create album modal"
                    >
                        ×
                    </button>
                </header>

                <form className="tagged-album-form tagged-album-form--edit" onSubmit={onSubmit}>
                    <div className="tagged-album-edit-layout">
                        <div className="tagged-album-edit-main-column">
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

                            <div className="tagged-album-field">
                                <span>Album Cover</span>
                                <label className="tagged-album-cover-search">
                                    <div className="tagged-album-search-input-wrap">
                                        <input
                                            type="text"
                                            value={coverSearch}
                                            onChange={(event) => onCoverSearchChange(event.target.value)}
                                            placeholder="Search by display name"
                                            disabled={isSaving}
                                        />

                                        {coverSearch.trim().length > 0 ? (
                                            <button
                                                type="button"
                                                className="tagged-album-search-inline-clear"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => onCoverSearchChange("")}
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
                            </div>

                            {imageMediaItems.length === 0 ? (
                                <div className="tagged-album-media-empty" aria-live="polite">
                                    <img src="/icons/image.svg" alt="" aria-hidden="true" />
                                    <p>You need at least one image in your gallery before creating an album cover.</p>
                                </div>
                            ) : filteredCoverCandidates.length === 0 ? (
                                <p className="tagged-album-media-picker-empty">No media matches this search.</p>
                            ) : (
                                <div className="tagged-album-media-picker-scroll">
                                    <div
                                        className="tagged-album-media-picker"
                                        role="listbox"
                                        aria-label="Select album cover"
                                    >
                                        {filteredCoverCandidates.map((media) => {
                                            const previewUrl = getAssetUrl(media.thumbpath || media.filepath);
                                            const isSelected = selectedCoverMediaId === media.id;
                                            const title = media.displayname || media.filename || `Media #${media.id}`;

                                            return (
                                                <button
                                                    key={media.id}
                                                    type="button"
                                                    className={`tagged-album-media-option${isSelected ? " is-selected" : ""}`}
                                                    onClick={() => onSelectCoverMedia(media.id)}
                                                    aria-pressed={isSelected}
                                                    disabled={isSaving}
                                                >
                                                    <div className="tagged-album-media-option-preview-wrap">
                                                        {previewUrl ? (
                                                            <img
                                                                className="tagged-album-media-option-preview"
                                                                src={previewUrl}
                                                                alt={title}
                                                            />
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

                        <aside className="tagged-album-edit-tag-panel" aria-label="Filter cover by tags">
                            <div className="tagged-album-edit-tag-panel-header">
                                <div className="tagged-album-edit-tag-panel-header-main">
                                    <span className="tagged-album-edit-tag-panel-title">Filter by tags</span>
                                    <button
                                        type="button"
                                        className={`tagged-album-edit-tag-mode-switch${
                                            editTagFilterMode === "exclude" ? " is-exclude" : ""
                                        }`}
                                        onClick={onToggleEditTagFilterMode}
                                        role="switch"
                                        aria-checked={editTagFilterMode === "exclude"}
                                        aria-label={`Tag mode: ${tagModeLabel}`}
                                    >
                                        <span className="tagged-album-edit-tag-mode-switch-track" aria-hidden="true">
                                            <span className="tagged-album-edit-tag-mode-switch-thumb" />
                                        </span>
                                        <span className="tagged-album-edit-tag-mode-switch-label" aria-hidden="true">
                                            {tagModeLabel}
                                        </span>
                                    </button>
                                </div>

                                {selectedEditFilterTags.length > 0 ? (
                                    <button
                                        type="button"
                                        className="tagged-album-edit-tag-panel-clear"
                                        onClick={onClearEditFilterTags}
                                    >
                                        Clear ({selectedEditFilterTags.length})
                                    </button>
                                ) : null}
                            </div>

                            <input
                                type="search"
                                className="tagged-album-edit-tag-panel-search"
                                value={editTagFilterSearch}
                                onChange={(event) => onEditTagFilterSearchChange(event.target.value)}
                                placeholder="Search tags..."
                                aria-label="Search tags"
                            />

                            <ul className="tagged-album-edit-tag-list" aria-label="Tag filters">
                                {visibleEditTagFilterCandidates.map((tagName) => {
                                    const isSelected = selectedEditFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );

                                    return (
                                        <li key={tagName}>
                                            <button
                                                type="button"
                                                className={`tagged-album-edit-tag-item${isSelected ? " is-selected" : ""}`}
                                                onClick={() => onToggleEditFilterTag(tagName)}
                                                aria-pressed={isSelected}
                                            >
                                                <span className="tagged-album-edit-tag-item-dot" aria-hidden="true" />
                                                <span>{tagName}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </aside>
                    </div>

                    {error ? <p className="tagged-album-form-error">{error}</p> : null}

                    <div className="tagged-album-form-actions tagged-album-form-actions--end-only">
                        <button
                            type="button"
                            className="tagged-album-form-cancel"
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="tagged-album-form-submit" disabled={isSaving}>
                            {isSaving ? "Creating..." : "Create album"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
