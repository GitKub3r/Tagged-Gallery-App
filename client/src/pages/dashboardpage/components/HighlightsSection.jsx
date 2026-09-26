import { useNavigate } from "react-router-dom";
import { MediaCard } from "../../../components/media-card/MediaCard";
import { useToggleFavourite } from "../../../hooks/useToggleFavourite";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { DashboardSection } from "./DashboardSection";

// 07 · Highlights: las medias con más tags.
export const HighlightsSection = ({ media }) => {
    const navigate = useNavigate();
    const { toggleFavourite, pendingMediaId } = useToggleFavourite();
    if (media.length === 0) return null;

    return (
        <DashboardSection frame="07" eyebrow="Highlights" title="Your most described media" description="The media with the most tags in your library.">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
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
        </DashboardSection>
    );
};
