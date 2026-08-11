import { faImage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const ConvergingShuffleOverlay = ({ items, getPreviewUrl, fallbackIcon = faImage, ariaLabel }) => (
    <div className="tagged-media-detail-shuffle-overlay" role="status" aria-live="polite" aria-label={ariaLabel}>
        <div className="tagged-media-detail-shuffle-stage" aria-hidden="true">
            {items.map((item, index) => {
                const previewUrl = getPreviewUrl(item);
                const animationSlot = index === items.length - 1 ? 3 : index + 1;
                return (
                    <span key={item.id} className={`tagged-media-detail-shuffle-card tagged-media-detail-shuffle-card--${animationSlot}`}>
                        {previewUrl ? <img src={previewUrl} alt="" /> : <FontAwesomeIcon icon={fallbackIcon} />}
                    </span>
                );
            })}
            <span className="tagged-media-detail-shuffle-particles">
                {Array.from({ length: 12 }, (_, particleIndex) => <i key={particleIndex} />)}
            </span>
        </div>
    </div>
);
