import { useState } from "react";
import { faCheck, faFilm, faFolder, faImage, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { API_ORIGIN } from "../../../utils/assetUrl";

const formatDuration = (durationMs) => {
    const totalSeconds = Math.round(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

// Mismo indicador circular de selección que MediaCard.
const SelectionIndicator = ({ isSelected, className = "" }) => (
    <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${isSelected ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-400 bg-transparent text-transparent dark:border-neutral-500"} ${className}`}
        aria-hidden="true"
    >
        <FontAwesomeIcon icon={faCheck} className="text-xs" />
    </span>
);

// Carpeta: el nombre la abre y el círculo la selecciona (con sus subcarpetas).
export const DriveFolderTile = ({ folder, isSelected, onOpen, onToggle }) => (
    <li
        className={`flex h-14 min-w-0 items-center rounded-xl border transition-colors ${isSelected ? "border-neutral-950 bg-neutral-100 dark:border-neutral-100 dark:bg-neutral-800" : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"}`}
    >
        <button
            type="button"
            className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl border-0 bg-transparent py-0 pl-4 pr-2 text-left text-sm font-semibold text-neutral-800 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-100"
            onClick={() => onOpen(folder)}
            title={folder.name}
        >
            <FontAwesomeIcon icon={faFolder} className="shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
            <span className="truncate">{folder.name}</span>
        </button>
        <button
            type="button"
            className="grid h-full w-12 shrink-0 place-items-center rounded-xl border-0 bg-transparent p-0 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500"
            onClick={(event) => onToggle(folder, event)}
            aria-pressed={isSelected}
            aria-label={`${isSelected ? "Deselect" : "Select"} folder ${folder.name}`}
            title={isSelected ? "Deselect folder" : "Select the whole folder"}
        >
            <SelectionIndicator isSelected={isSelected} />
        </button>
    </li>
);

export const DriveFileTile = ({ file, isSelected, onToggle }) => {
    const [hasBrokenThumbnail, setHasBrokenThumbnail] = useState(false);
    const isVideo = file.mimeType.startsWith("video/");
    const thumbnailUrl = file.thumbnailUrl && !hasBrokenThumbnail ? `${API_ORIGIN}${file.thumbnailUrl}` : "";

    return (
        <li className="min-w-0">
            <button
                type="button"
                className="group block w-full rounded-xl border-0 bg-transparent p-0 text-left shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed"
                onClick={(event) => onToggle(file, event)}
                disabled={file.inLibrary}
                aria-pressed={file.inLibrary ? undefined : isSelected}
                title={file.inLibrary ? `${file.name} is already in your library` : file.name}
            >
                <span
                    className={`relative block aspect-square overflow-hidden rounded-xl bg-neutral-200 transition-shadow dark:bg-neutral-800 ${isSelected ? "ring-2 ring-neutral-950 ring-offset-2 ring-offset-neutral-50 dark:ring-neutral-100 dark:ring-offset-neutral-900" : ""}`}
                >
                    {thumbnailUrl ? (
                        <img
                            className={`h-full w-full object-cover ${file.inLibrary ? "opacity-40" : ""}`}
                            src={thumbnailUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={() => setHasBrokenThumbnail(true)}
                        />
                    ) : (
                        <span className="grid h-full w-full place-items-center text-3xl text-neutral-400 dark:text-neutral-600" aria-hidden="true">
                            <FontAwesomeIcon icon={isVideo ? faFilm : faImage} />
                        </span>
                    )}

                    {file.inLibrary ? (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-xl bg-black/65 px-2 py-1 text-xs font-semibold text-white">
                            <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                            In library
                        </span>
                    ) : (
                        <span
                            className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-md transition-colors ${isSelected ? "bg-white text-neutral-950" : "bg-black/20 text-transparent"}`}
                            aria-hidden="true"
                        >
                            <FontAwesomeIcon icon={faCheck} className="text-xs" />
                        </span>
                    )}

                    {isVideo ? (
                        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-xl bg-black/65 px-2 py-1 text-xs font-semibold tabular-nums text-white">
                            <FontAwesomeIcon icon={faPlay} className="text-[0.6rem]" aria-hidden="true" />
                            {file.durationMs ? formatDuration(file.durationMs) : "Video"}
                        </span>
                    ) : null}
                </span>
                <span className="mt-1.5 block truncate text-xs font-semibold text-neutral-600 dark:text-neutral-300">{file.name}</span>
            </button>
        </li>
    );
};
