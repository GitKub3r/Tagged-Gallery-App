import { AlbumCoverPickerModal } from "./AlbumCoverPickerModal";

export const AlbumEditModal = ({
    isOpen,
    onClose,
    onSubmit,
    isSaving,
    albumName,
    onAlbumNameChange,
    coverSearch,
    onCoverSearchChange,
    mediaViewMode = "card",
    onMediaViewModeChange = () => {},
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
    modalContentClassName = "",
}) => {
    const isIncludeMode = editTagFilterMode !== "exclude";

    const handleToggleIncludeTag = (tagName) => {
        const isAlreadySelected = selectedEditFilterTags.some((tag) => tag.toLowerCase() === String(tagName).toLowerCase());

        if (!isIncludeMode) {
            onToggleEditTagFilterMode();
            if (!isAlreadySelected) {
                onToggleEditFilterTag(tagName);
            }
            return;
        }

        onToggleEditFilterTag(tagName);
    };

    const handleToggleExcludeTag = (tagName) => {
        const isAlreadySelected = selectedEditFilterTags.some((tag) => tag.toLowerCase() === String(tagName).toLowerCase());

        if (isIncludeMode) {
            onToggleEditTagFilterMode();
            if (!isAlreadySelected) {
                onToggleEditFilterTag(tagName);
            }
            return;
        }

        onToggleEditFilterTag(tagName);
    };

    return (
        <AlbumCoverPickerModal
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            isSaving={isSaving}
            mode="edit"
            albumName={albumName}
            onAlbumNameChange={onAlbumNameChange}
            coverSearch={coverSearch}
            onCoverSearchChange={onCoverSearchChange}
            mediaViewMode={mediaViewMode}
            onMediaViewModeChange={onMediaViewModeChange}
            mediaItems={imageMediaItems}
            filteredCoverCandidates={filteredCoverCandidates}
            selectedCoverMediaId={selectedCoverMediaId}
            onSelectCoverMedia={onSelectCoverMedia}
            getAssetUrl={getAssetUrl}
            mapTagsFromMedia={mapTagsFromMedia}
            selectedIncludeFilterTags={isIncludeMode ? selectedEditFilterTags : []}
            selectedExcludeFilterTags={!isIncludeMode ? selectedEditFilterTags : []}
            onToggleIncludeFilterTag={handleToggleIncludeTag}
            onToggleExcludeFilterTag={handleToggleExcludeTag}
            onClearFilterTags={onClearEditFilterTags}
            tagFilterSearch={editTagFilterSearch}
            onTagFilterSearchChange={onEditTagFilterSearchChange}
            visibleTagFilterCandidates={visibleEditTagFilterCandidates}
            error={error}
            modalContentClassName={modalContentClassName}
        />
    );
};
