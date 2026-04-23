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
    if (!isOpen) {
        return null;
    }

    const tagModeLabel = tagFilterMode === "exclude" ? "Exclude" : "Include";

    return (
        <div
            className="tagged-gallery-album-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tagged-gallery-add-album-modal-title"
            onClick={onClose}
        >
            <div className="tagged-gallery-album-modal-content" onClick={(event) => event.stopPropagation()}>
                <header className="tagged-gallery-album-modal-header">
                    <h2 id="tagged-gallery-add-album-modal-title">Add selected media to album</h2>
                    <button
                        type="button"
                        className="tagged-gallery-album-modal-close"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Close add to album modal"
                    >
                        <img src="/icons/close.svg" alt="" aria-hidden="true" />
                    </button>
                </header>

                <form
                    id="tagged-gallery-add-album-form"
                    className="tagged-gallery-album-modal-form"
                    onSubmit={onSubmit}
                >
                    <div className="tagged-gallery-album-modal-layout">
                        <div className="tagged-gallery-album-modal-main-column">
                            <label className="tagged-gallery-album-search-field">
                                <span>Search albums</span>
                                <input
                                    type="search"
                                    value={albumSearch}
                                    onChange={(event) => onAlbumSearchChange(event.target.value)}
                                    placeholder="Search by album name"
                                    disabled={isSaving || isLoading}
                                />
                            </label>

                            {isLoading ? (
                                <p className="tagged-gallery-album-picker-empty">Loading albums...</p>
                            ) : albums.length === 0 ? (
                                <p className="tagged-gallery-album-picker-empty">You do not have albums yet.</p>
                            ) : filteredAlbums.length === 0 ? (
                                <p className="tagged-gallery-album-picker-empty">No albums match this filter.</p>
                            ) : (
                                <div className="tagged-gallery-album-picker-scroll">
                                    <div
                                        className="tagged-gallery-album-picker"
                                        role="listbox"
                                        aria-label="Select albums"
                                    >
                                        {filteredAlbums.map((album) => {
                                            const coverUrl = getAssetUrl(album.albumthumbpath || album.albumcoverpath);
                                            const albumDisplayName =
                                                album.displayname || album.albumname || "Untitled album";
                                            const mediaCount = Number(album.media_count || 0);
                                            const isSelected = selectedAlbumIds.has(album.id);

                                            return (
                                                <button
                                                    key={album.id}
                                                    type="button"
                                                    className={`tagged-gallery-album-option${isSelected ? " is-selected" : ""}`}
                                                    onClick={() => onToggleAlbumSelection(album.id)}
                                                    aria-pressed={isSelected}
                                                    disabled={isSaving}
                                                >
                                                    <div className="tagged-gallery-album-option-preview-wrap">
                                                        {coverUrl ? (
                                                            <img
                                                                className="tagged-gallery-album-option-preview"
                                                                src={coverUrl}
                                                                alt={albumDisplayName}
                                                            />
                                                        ) : (
                                                            <div className="tagged-gallery-album-option-preview tagged-gallery-album-option-preview--empty">
                                                                <img src="/icons/album.svg" alt="" aria-hidden="true" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="tagged-gallery-album-option-title-block">
                                                        <span
                                                            className="tagged-gallery-album-option-title"
                                                            title={albumDisplayName}
                                                        >
                                                            {albumDisplayName}
                                                        </span>
                                                        <span className="tagged-gallery-album-option-subtitle">
                                                            {mediaCount} item{mediaCount === 1 ? "" : "s"}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <aside className="tagged-gallery-album-tag-panel" aria-label="Filter albums by tags">
                            <div className="tagged-gallery-album-tag-panel-header">
                                <div className="tagged-gallery-album-tag-panel-header-main">
                                    <span className="tagged-gallery-album-tag-panel-title">Filter by tags</span>
                                    <button
                                        type="button"
                                        className={`tagged-gallery-album-tag-mode-switch${tagFilterMode === "exclude" ? " is-exclude" : ""}`}
                                        onClick={onToggleTagFilterMode}
                                        role="switch"
                                        aria-checked={tagFilterMode === "exclude"}
                                        aria-label={`Tag mode: ${tagModeLabel}`}
                                    >
                                        <span className="tagged-gallery-album-tag-mode-switch-track" aria-hidden="true">
                                            <span className="tagged-gallery-album-tag-mode-switch-thumb" />
                                        </span>
                                        <span className="tagged-gallery-album-tag-mode-switch-label" aria-hidden="true">
                                            {tagModeLabel}
                                        </span>
                                    </button>
                                </div>

                                {selectedFilterTags.length > 0 ? (
                                    <button
                                        type="button"
                                        className="tagged-gallery-album-tag-panel-clear"
                                        onClick={onClearFilterTags}
                                    >
                                        Clear ({selectedFilterTags.length})
                                    </button>
                                ) : null}
                            </div>

                            <input
                                type="search"
                                className="tagged-gallery-album-tag-panel-search"
                                value={tagFilterSearch}
                                onChange={(event) => onTagFilterSearchChange(event.target.value)}
                                placeholder="Search tags..."
                                aria-label="Search album tags"
                            />

                            <ul className="tagged-gallery-album-tag-list" aria-label="Album tag filters">
                                {visibleTagFilterCandidates.map((tagName) => {
                                    const isSelected = selectedFilterTags.some(
                                        (tag) => tag.toLowerCase() === tagName.toLowerCase(),
                                    );

                                    return (
                                        <li key={tagName}>
                                            <button
                                                type="button"
                                                className={`tagged-gallery-album-tag-item${isSelected ? " is-selected" : ""}`}
                                                onClick={() => onToggleFilterTag(tagName)}
                                                aria-pressed={isSelected}
                                            >
                                                <span
                                                    className="tagged-gallery-album-tag-item-dot"
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

                    {error ? <p className="tagged-gallery-album-form-error">{error}</p> : null}
                </form>

                <div className="tagged-gallery-album-form-actions">
                    <button
                        type="button"
                        className="tagged-gallery-album-form-cancel"
                        onClick={onClearAlbumSelection}
                        disabled={isSaving || selectedAlbumIds.size === 0}
                    >
                        Clear selection
                    </button>
                    <button
                        type="submit"
                        form="tagged-gallery-add-album-form"
                        className="tagged-gallery-album-form-submit"
                        disabled={isSaving || selectedAlbumIds.size === 0 || selectedMediaCount === 0}
                    >
                        {isSaving
                            ? `Adding to albums (${selectedAlbumIds.size})...`
                            : `Add to albums${selectedAlbumIds.size > 0 ? ` (${selectedAlbumIds.size})` : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
};
