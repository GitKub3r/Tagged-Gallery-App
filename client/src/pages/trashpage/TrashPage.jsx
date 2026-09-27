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
import { TrashRoute } from "./components/TrashRoute";
import { TRASH_GRID_CLASSES, TrashStop } from "./components/TrashStop";
import { TrashSelectionBar } from "./components/TrashSelectionBar";
import { addDays, daysUntil, getStopHeadingId } from "./trashTime";

const SORT_OPTIONS = [
    { value: "recent", label: "Recently deleted", icon: faClock },
    { value: "expiring", label: "Expiring first", icon: faHourglassHalf },
];

// Esqueleto con la forma de la cabecera de ruta y de la primera parada.
const TrashSkeleton = () => (
    <div role="status" aria-label="Loading trash">
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6" aria-hidden="true">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-56" /></div>
                <div className="grid grid-cols-3 gap-4 lg:w-96"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
            </div>
            <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:pt-6"><Skeleton className="h-64 sm:h-40" /></div>
        </div>
        <div className="pl-8 sm:pl-10">
            <div className="mb-4 space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-6 w-56" /></div>
            <div className={TRASH_GRID_CLASSES}>{Array.from({ length: 10 }, (_, index) => <MediaCardSkeleton key={index} />)}</div>
        </div>
        <span className="sr-only">Loading trash</span>
    </div>
);

// Papelera como una línea de ruta: las medias viajan hacia el día en que se borran para siempre. Cada día con
// medias es una parada; restaurarlas antes las devuelve a la galería y a sus álbumes.
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
    // Paradas por el día en que se borran, en orden de llegada: la 01 es la más cercana.
    const stops = useMemo(() => {
        const byDay = new Map();
        media.forEach((item) => byDay.set(item.daysLeft, [...(byDay.get(item.daysLeft) || []), item]));
        return [...byDay]
            .sort(([a], [b]) => a - b)
            .map(([daysLeft, items], index) => ({ daysLeft, number: index + 1, date: addDays(new Date(), daysLeft), media: items }));
    }, [media]);
    // Los recién borrados (más días por delante) o los que se borran antes, primero.
    const orderedStops = sortOrder === "recent" ? [...stops].reverse() : stops;

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

    const toggleStop = (stop) => {
        const isStopSelected = stop.media.every((item) => selectedIds.has(item.id));
        setSelectedIds((current) => {
            const next = new Set(current);
            stop.media.forEach((item) => (isStopSelected ? next.delete(item.id) : next.add(item.id)));
            return next;
        });
    };

    const selectStop = (stop) => setSelectedIds((current) => new Set([...current, ...stop.media.map((item) => item.id)]));

    // Salta a una parada desde la línea y le pasa el foco (su título), para que el teclado siga desde ahí.
    // Se desplaza la ventana y no se usa scrollIntoView: también movería <main>, que oculta su desbordamiento.
    const goToStop = (daysLeft) => {
        const heading = document.getElementById(getStopHeadingId(daysLeft));
        if (!heading) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const top = heading.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(heading).scrollMarginTop || 0);
        window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
        heading.focus({ preventScroll: true });
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
                <TrashRoute stops={stops} retentionDays={retentionDays} onGoToStop={goToStop} onSelectStop={selectStop} />

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

                <div>
                    {orderedStops.map((stop, index) => (
                        <TrashStop
                            key={stop.daysLeft}
                            stop={stop}
                            isLast={index === orderedStops.length - 1}
                            selectedIds={selectedIds}
                            isBusy={isBusy}
                            onToggleSelect={toggleSelection}
                            onToggleStop={toggleStop}
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
                        Deleted media keep their tags and albums here for {retentionDays} days, then are deleted forever at their stop. Restore them before then to bring them back.
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
