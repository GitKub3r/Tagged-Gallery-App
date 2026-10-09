import { faFilm, faHardDrive, faImage, faPhotoFilm } from "@fortawesome/free-solid-svg-icons";
import { StatTile } from "../../../components/stat-tile/StatTile";
import { formatMediaSize } from "../../../utils/mediaFormat";

const formatLastAdded = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : `Last added ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date)}`;
};

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
