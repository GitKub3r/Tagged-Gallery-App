import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { faCheckDouble, faClock, faHourglassHalf, faTrash, faTrashCan, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { MediaCardSkeleton } from "../../components/loading-skeletons/CollectionLoadingSkeleton";
import { Skeleton } from "../../components/loading-skeletons/Skeleton";
import { SegmentedControl } from "../../components/segmented-control/SegmentedControl";
import { useDevTools } from "../../hooks/useDevTools";
import { useDeleteForever, useRestoreFromTrash, useTrash } from "../../hooks/useTrash";
import { isDriveMedia } from "../../utils/mediaSource";
import { RetentionPanel } from "./components/RetentionPanel";
import { TRASH_GRID_CLASSES, TrashGroup } from "./components/TrashGroup";
import { TrashSelectionBar } from "./components/TrashSelectionBar";
import { addDays, daysUntil } from "./trashTime";

const SORT_OPTIONS = [
    { value: "recent", label: "Recently deleted", icon: faClock },
    { value: "expiring", label: "Expiring first", icon: faHourglassHalf },
];

const TrashSkeleton = () => (
    <div role="status" aria-label="Loading trash">
        <Skeleton className="mb-6 h-56" />
        <div className={TRASH_GRID_CLASSES}>{Array.from({ length: 10 }, (_, index) => <MediaCardSkeleton key={index} />)}</div>
        <span className="sr-only">Loading trash</span>
    </div>
);

// Papelera como copias que se desvanecen: cada media pierde color a medida que se acerca el día en que se
// borra para siempre, agrupada por ese día. Restaurarla la devuelve a la galería y a sus álbumes.
export const TrashPage = () => {
    const navigate = useNavigate();
    const { forceLoading } = useDevTools();
    const trashQuery = useTrash();
    const restoreMutation = useRestoreFromTrash();
    const deleteForeverMutation = useDeleteForever();
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [sortOrder, setSortOrder] = useState("recent");
    // "selected" (borrar la selección) o "all" (vaciar la papelera).
    const [pendingDelete, setPendingDelete] = useState(null);

    const retentionDays = trashQuery.data?.retentionDays ?? 30;
    const media = useMemo(() => (trashQuery.data?.media ?? []).map((item) => ({ ...item, daysLeft: daysUntil(item.expires_at) })), [trashQuery.data]);
    // Grupos por el día en que se borran: los recién borrados (más días por delante) o los que caducan antes, primero.
    const groups = useMemo(() => {
        const byDay = new Map();
        media.forEach((item) => byDay.set(item.daysLeft, [...(byDay.get(item.daysLeft) || []), item]));
        return [...byDay]
            .map(([daysLeft, items]) => ({ daysLeft, date: addDays(new Date(), daysLeft), media: items }))
            .sort((a, b) => (sortOrder === "recent" ? b.daysLeft - a.daysLeft : a.daysLeft - b.daysLeft));
    }, [media, sortOrder]);

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

    const toggleGroup = (group) => {
        const isGroupSelected = group.media.every((item) => selectedIds.has(item.id));
        setSelectedIds((current) => {
            const next = new Set(current);
            group.media.forEach((item) => (isGroupSelected ? next.delete(item.id) : next.add(item.id)));
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const restore = (ids) => restoreMutation.mutate(ids, {
        onSuccess: () => setSelectedIds((current) => new Set([...current].filter((id) => !ids.includes(id)))),
    });

    const confirmDelete = () => {
        const ids = pendingDelete === "all" ? null : selectedMedia.map((item) => item.id);
        deleteForeverMutation.mutate(ids, {
            onSuccess: clearSelection,
            onSettled: () => setPendingDelete(null),
        });
    };

    const renderContent = () => {
        if (forceLoading || trashQuery.isPending) return <TrashSkeleton />;
        if (trashQuery.isError) return <LoadErrorState title="Could not load the trash" onRetry={() => trashQuery.refetch()} placement="section" />;
        if (media.length === 0) return <EmptyState title="The trash is empty" icon={faTrashCan} placement="section" actionLabel="Go to gallery" onAction={() => navigate("/gallery")} />;

        return (
            <>
                <RetentionPanel media={media} retentionDays={retentionDays} />

                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <p className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400" aria-live="polite">
                            {selectedMedia.length ? `${selectedMedia.length} of ${media.length} selected` : `${media.length} media`}
                        </p>
                        <button type="button" className={buttonClasses.text} onClick={() => (areAllSelected ? clearSelection() : setSelectedIds(new Set(media.map((item) => item.id))))}>
                            <FontAwesomeIcon icon={areAllSelected ? faXmark : faCheckDouble} aria-hidden="true" />
                            {areAllSelected ? "Deselect all" : "Select all"}
                        </button>
                    </div>
                    <SegmentedControl options={SORT_OPTIONS} value={sortOrder} onChange={setSortOrder} ariaLabel="Order" className="sm:w-96" />
                </div>

                <div className="grid gap-10">
                    {groups.map((group) => (
                        <TrashGroup
                            key={group.daysLeft}
                            group={group}
                            retentionDays={retentionDays}
                            selectedIds={selectedIds}
                            isBusy={isBusy}
                            onToggleSelect={toggleSelection}
                            onToggleGroup={toggleGroup}
                            onRestore={(mediaId) => restore([mediaId])}
                        />
                    ))}
                </div>

                {selectedMedia.length > 0 ? (
                    <TrashSelectionBar
                        count={selectedMedia.length}
                        isRestoring={restoreMutation.isPending}
                        isBusy={isBusy}
                        onRestore={() => restore(selectedMedia.map((item) => item.id))}
                        onDelete={() => setPendingDelete("selected")}
                        onClear={clearSelection}
                    />
                ) : null}
            </>
        );
    };

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Media library</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Trash</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                        Deleted media stay here for {retentionDays} days with their tags and albums, slowly fading. Restore them to bring them back, or they are deleted forever.
                    </p>
                </div>
                <button type="button" className={buttonClasses.dangerOutline} onClick={() => setPendingDelete("all")} disabled={media.length === 0 || isBusy}>
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    Empty trash
                </button>
            </header>

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
