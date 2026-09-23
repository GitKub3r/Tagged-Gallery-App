import { faFilm, faHardDrive, faImage, faPhotoFilm } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatMediaSize } from "../../../utils/mediaFormat";

const formatLastAdded = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : `Last added ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date)}`;
};

const StatTile = ({ icon, label, value, hint }) => (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            <FontAwesomeIcon icon={icon} className="w-4" aria-hidden="true" />
            {label}
        </p>
        <p className="mt-2 truncate text-2xl font-black tabular-nums tracking-tight sm:text-3xl">{value}</p>
        {hint ? <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </div>
);

export const DriveStats = ({ summary }) => (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
            icon={faPhotoFilm}
            label="Media"
            value={summary.total}
            hint={summary.unavailable > 0 ? `${summary.unavailable} unavailable in Drive` : formatLastAdded(summary.lastAddedAt) || "Nothing added yet"}
        />
        <StatTile icon={faImage} label="Photos" value={summary.photos} hint="Images and GIFs" />
        <StatTile icon={faFilm} label="Videos" value={summary.videos} />
        <StatTile icon={faHardDrive} label="Size in Drive" value={formatMediaSize(summary.totalBytes)} hint="Not stored on this server" />
    </div>
);
