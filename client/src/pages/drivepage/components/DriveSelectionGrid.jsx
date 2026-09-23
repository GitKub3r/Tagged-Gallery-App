import { faFilm, faImage, faPlay, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Skeleton } from "../../../components/loading-skeletons/Skeleton";
import { formatMediaSize } from "../../../utils/mediaFormat";

const isVideo = (file) => String(file?.mimeType || "").startsWith("video/");

// Revisión de los archivos elegidos en el Picker, con su miniatura real y opción de quitarlos.
export const DriveSelectionGrid = ({ files, previewsById, isLoadingPreviews, disabled, onRemove }) => (
    <ul className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3" aria-label="Selected Drive files">
        {files.map((file) => {
            const preview = previewsById[file.id];
            const name = preview?.name || file.name;
            const size = preview?.size || file.sizeBytes;

            return (
                <li key={file.id} className="min-w-0">
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-950">
                        {preview?.thumbnail ? (
                            <img className="h-full w-full object-cover" src={preview.thumbnail} alt={name} />
                        ) : isLoadingPreviews ? (
                            <Skeleton className="h-full w-full" />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-2xl text-neutral-500 dark:text-neutral-400">
                                <FontAwesomeIcon icon={isVideo(file) ? faFilm : faImage} aria-hidden="true" />
                            </div>
                        )}
                        {isVideo(file) && preview?.thumbnail ? (
                            <FontAwesomeIcon icon={faPlay} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl text-white drop-shadow-lg" aria-hidden="true" />
                        ) : null}
                        <button
                            type="button"
                            className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-xl border-0 bg-black/65 p-0 text-white shadow-none transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => onRemove(file.id)}
                            disabled={disabled}
                            aria-label={`Remove ${name}`}
                            title="Remove from selection"
                        >
                            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                        </button>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold" title={name}>{name}</p>
                    {size ? <p className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">{formatMediaSize(size)}</p> : null}
                </li>
            );
        })}
    </ul>
);
