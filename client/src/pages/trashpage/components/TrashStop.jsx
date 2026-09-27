import { faCheckDouble, faRotateLeft, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { MediaCard } from "../../../components/media-card/MediaCard";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { formatMediaSize } from "../../../utils/mediaFormat";
import { describeDeletion, formatDay, getStopHeadingId, isUrgent, stopDotClasses } from "../trashTime";

export const TRASH_GRID_CLASSES = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";

const getThumbnailUrl = (media) => (media.thumbpath ? `${API_ORIGIN}${media.thumbpath}` : "");

// Parada de la línea de ruta: las medias que se borran el mismo día. Las paradas cuelgan de un raíl vertical,
// la misma línea de la cabecera; el punto de cada una se separa del raíl como una estación.
export const TrashStop = ({ stop, isLast, selectedIds, isBusy, onToggleSelect, onToggleStop, onRestore }) => {
    const headingId = getStopHeadingId(stop.daysLeft);
    const urgent = isUrgent(stop.daysLeft);
    const isStopSelected = stop.media.every((item) => selectedIds.has(item.id));
    const totalBytes = stop.media.reduce((sum, item) => sum + Number(item.size || 0), 0);

    return (
        <section aria-labelledby={headingId} className={`relative pl-8 sm:pl-10 ${isLast ? "" : "pb-10"}`}>
            <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full ${stopDotClasses(stop.daysLeft)}`} aria-hidden="true" />
            {isLast ? null : <span className="absolute bottom-1 left-2 top-5 w-0.5 -translate-x-1/2 bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />}

            <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest tabular-nums ${urgent ? "text-amber-600 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400"}`}>
                        {urgent ? <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" /> : null}
                        Stop {String(stop.number).padStart(2, "0")} <span aria-hidden="true">·</span> {formatDay(stop.date)}
                    </p>
                    {/* Destino de los enlaces de la línea: recibe el foco al saltar a la parada. */}
                    <h2 id={headingId} tabIndex={-1} className="mt-0.5 scroll-mt-24 text-lg font-bold outline-none xl:scroll-mt-8">{describeDeletion(stop.daysLeft)}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">{stop.media.length} media · {formatMediaSize(totalBytes)}</span>
                    <button
                        type="button"
                        className={buttonClasses.text}
                        onClick={() => onToggleStop(stop)}
                        aria-label={`${isStopSelected ? "Deselect" : "Select"} media ${describeDeletion(stop.daysLeft).toLowerCase()}`}
                    >
                        <FontAwesomeIcon icon={isStopSelected ? faXmark : faCheckDouble} aria-hidden="true" />
                        {isStopSelected ? "Deselect" : "Select"}
                    </button>
                </div>
            </header>

            <div className={TRASH_GRID_CLASSES}>
                {stop.media.map((item) => (
                    <MediaCard
                        key={item.id}
                        media={item}
                        resolvePreviewUrl={getThumbnailUrl}
                        selectionMode
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={onToggleSelect}
                        disableLongPressSelection
                        mediaAction={{ icon: faRotateLeft, label: "Restore", onClick: onRestore, disabled: isBusy }}
                    />
                ))}
            </div>
        </section>
    );
};
