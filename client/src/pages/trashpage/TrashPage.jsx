import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { faCheckDouble, faRotateLeft, faTrash, faTrashCan, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { MediaCardSkeleton } from "../../components/loading-skeletons/CollectionLoadingSkeleton";
import { MediaCard } from "../../components/media-card/MediaCard";
import { useDevTools } from "../../hooks/useDevTools";
import { useDeleteForever, useRestoreFromTrash, useTrash } from "../../hooks/useTrash";
import { API_ORIGIN } from "../../utils/assetUrl";
import { isDriveMedia } from "../../utils/mediaSource";

const GRID_CLASSES = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";

const getThumbnailUrl = (media) => (media.thumbpath ? `${API_ORIGIN}${media.thumbpath}` : "");

const describeDaysLeft = (daysLeft) => (daysLeft <= 0 ? "Deleted today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`);

export const TrashPage = () => {
    const navigate = useNavigate();
    const { forceLoading } = useDevTools();
    const trashQuery = useTrash();
    const restoreMutation = useRestoreFromTrash();
    const deleteForeverMutation = useDeleteForever();
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    // "selected" (borrar la selección) o "all" (vaciar la papelera).
    const [pendingDelete, setPendingDelete] = useState(null);

    const media = trashQuery.data?.media ?? [];
    const retentionDays = trashQuery.data?.retentionDays ?? 30;
    // La selección solo cuenta medias que siguen en la papelera (tras restaurar o borrar desaparecen).
    const selectedMedia = media.filter((item) => selectedIds.has(item.id));
    const areAllSelected = media.length > 0 && selectedMedia.length === media.length;
    const isBusy = restoreMutation.isPending || deleteForeverMutation.isPending;
    const mediaToDelete = pendingDelete === "all" ? media : selectedMedia;

    const toggleSelection = (mediaId) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(mediaId)) next.delete(mediaId);
            else next.add(mediaId);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const restoreSelected = () => restoreMutation.mutate(selectedMedia.map((item) => item.id), { onSuccess: clearSelection });

    const confirmDelete = () => {
        const ids = pendingDelete === "all" ? null : selectedMedia.map((item) => item.id);
        deleteForeverMutation.mutate(ids, {
            onSuccess: clearSelection,
            onSettled: () => setPendingDelete(null),
        });
    };

    const renderContent = () => {
        if (forceLoading || trashQuery.isPending) {
            return (
                <div className={GRID_CLASSES} role="status" aria-label="Loading trash">
                    {Array.from({ length: 10 }, (_, index) => <MediaCardSkeleton key={index} />)}
                    <span className="sr-only">Loading trash</span>
                </div>
            );
        }
        if (trashQuery.isError) return <LoadErrorState title="Could not load the trash" onRetry={() => trashQuery.refetch()} placement="section" />;
        if (media.length === 0) return <EmptyState title="The trash is empty" icon={faTrashCan} placement="section" actionLabel="Go to gallery" onAction={() => navigate("/gallery")} />;

        return (
            <div className={GRID_CLASSES} aria-label="Media in the trash">
                {media.map((item) => (
                    <MediaCard
                        key={item.id}
                        media={item}
                        resolvePreviewUrl={getThumbnailUrl}
                        selectionMode
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={toggleSelection}
                        disableLongPressSelection
                        note={describeDaysLeft(item.days_left)}
                    />
                ))}
            </div>
        );
    };

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Media library</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Trash</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                        Deleted media stay here for {retentionDays} days with their tags and albums. After that they are deleted forever.
                    </p>
                </div>
                <button type="button" className={buttonClasses.dangerOutline} onClick={() => setPendingDelete("all")} disabled={media.length === 0 || isBusy}>
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    Empty trash
                </button>
            </header>

            {media.length > 0 ? (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <p className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400" aria-live="polite">
                            {selectedMedia.length ? `${selectedMedia.length} of ${media.length} selected` : `${media.length} media`}
                        </p>
                        <button type="button" className={buttonClasses.text} onClick={() => (areAllSelected ? clearSelection() : setSelectedIds(new Set(media.map((item) => item.id))))}>
                            <FontAwesomeIcon icon={areAllSelected ? faXmark : faCheckDouble} aria-hidden="true" />
                            {areAllSelected ? "Deselect all" : "Select all"}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button type="button" className={buttonClasses.secondary} onClick={restoreSelected} disabled={!selectedMedia.length || isBusy}>
                            <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
                            {restoreMutation.isPending ? "Restoring..." : "Restore"}
                        </button>
                        <button type="button" className={buttonClasses.dangerOutline} onClick={() => setPendingDelete("selected")} disabled={!selectedMedia.length || isBusy}>
                            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                            Delete forever
                        </button>
                    </div>
                </div>
            ) : null}

            {renderContent()}

            <DeleteConfirmationModal
                isOpen={Boolean(pendingDelete)}
                title={pendingDelete === "all" ? "Empty the trash?" : selectedMedia.length === 1 ? "Delete this media forever?" : `Delete ${selectedMedia.length} media forever?`}
                description={`${mediaToDelete.length === 1 ? "This media" : `These ${mediaToDelete.length} media`} will be deleted with their files. This can't be undone.${mediaToDelete.some(isDriveMedia) ? " Originals of Google Drive media stay in your Drive." : ""}`}
                confirmLabel={pendingDelete === "all" ? "Empty trash" : "Delete forever"}
                pendingLabel="Deleting..."
                isDeleting={deleteForeverMutation.isPending}
                onConfirm={confirmDelete}
                onClose={() => setPendingDelete(null)}
            />
        </section>
    );
};
