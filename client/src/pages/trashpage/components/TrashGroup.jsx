import { faCheckDouble, faRotateLeft, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { MediaCard } from "../../../components/media-card/MediaCard";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { URGENT_DAYS, formatDay } from "../trashTime";

export const TRASH_GRID_CLASSES = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";
// Lo que más se desvanece una media en su último día: sigue reconociéndose.
const MAX_FADE = 0.85;

const getThumbnailUrl = (media) => (media.thumbpath ? `${API_ORIGIN}${media.thumbpath}` : "");

const describeRemaining = (daysLeft) => (daysLeft <= 0 ? "Last day" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`);

const describeDeletion = (daysLeft) => (daysLeft <= 0 ? "Deleted forever today" : daysLeft === 1 ? "Deleted forever tomorrow" : `Deleted forever in ${daysLeft} days`);

// Mecha de la cuenta atrás: se acorta según pasan los días y avisa en ámbar al final.
const Countdown = ({ daysLeft, retentionDays }) => {
    const isUrgent = daysLeft <= URGENT_DAYS;
    return (
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
            <span className="h-1 min-w-6 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                <span className={`block h-full rounded-full ${isUrgent ? "bg-amber-500" : "bg-neutral-950 dark:bg-white"}`} style={{ width: `${Math.max(daysLeft / retentionDays, 0.03) * 100}%` }} />
            </span>
            <span className={`flex shrink-0 items-center gap-1 tabular-nums ${isUrgent ? "text-amber-600 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400"}`}>
                {isUrgent ? <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" /> : null}
                {describeRemaining(daysLeft)}
            </span>
        </span>
    );
};

// Medias que se borran el mismo día: cabecera con la fecha y la cuenta atrás, selección del grupo y rejilla.
export const TrashGroup = ({ group, retentionDays, selectedIds, isBusy, onToggleSelect, onToggleGroup, onRestore }) => {
    const headingId = `trash-group-${group.daysLeft}`;
    const isUrgent = group.daysLeft <= URGENT_DAYS;
    const isGroupSelected = group.media.every((item) => selectedIds.has(item.id));

    return (
        <section aria-labelledby={headingId}>
            <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
                <div className="min-w-0">
                    <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${isUrgent ? "text-amber-600 dark:text-amber-400" : "text-neutral-400 dark:text-neutral-500"}`}>
                        {isUrgent ? <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" /> : null}
                        {formatDay(group.date)}
                    </p>
                    <h2 id={headingId} className="mt-0.5 text-lg font-bold">{describeDeletion(group.daysLeft)}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">{group.media.length} media</span>
                    <button type="button" className={buttonClasses.text} onClick={() => onToggleGroup(group)} aria-label={`${isGroupSelected ? "Deselect" : "Select"} media ${describeDeletion(group.daysLeft).toLowerCase()}`}>
                        <FontAwesomeIcon icon={isGroupSelected ? faXmark : faCheckDouble} aria-hidden="true" />
                        {isGroupSelected ? "Deselect" : "Select"}
                    </button>
                </div>
            </header>
            <div className={TRASH_GRID_CLASSES}>
                {group.media.map((item) => (
                    <MediaCard
                        key={item.id}
                        media={item}
                        resolvePreviewUrl={getThumbnailUrl}
                        selectionMode
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelect={onToggleSelect}
                        disableLongPressSelection
                        fade={Math.min(MAX_FADE, 1 - item.daysLeft / retentionDays)}
                        mediaAction={{ icon: faRotateLeft, label: "Restore", onClick: onRestore, disabled: isBusy }}
                        footer={<Countdown daysLeft={item.daysLeft} retentionDays={retentionDays} />}
                    />
                ))}
            </div>
        </section>
    );
};
