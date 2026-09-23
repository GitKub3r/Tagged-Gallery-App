import { useNavigate } from "react-router-dom";
import { MediaCard } from "../../../components/media-card/MediaCard";
import { useToggleFavourite } from "../../../hooks/useToggleFavourite";
import { API_ORIGIN } from "../../../utils/assetUrl";

export const DriveRecentMedia = ({ media }) => {
    const navigate = useNavigate();
    const { toggleFavourite, pendingMediaId } = useToggleFavourite();

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => (
                <MediaCard
                    key={item.id}
                    media={item}
                    uploadsBaseUrl={API_ORIGIN}
                    onOpenMedia={(mediaId) => navigate(`/gallery/${mediaId}`)}
                    onToggleFavourite={toggleFavourite}
                    isTogglingFavourite={pendingMediaId === item.id}
                    disableLongPressSelection
                />
            ))}
        </div>
    );
};
