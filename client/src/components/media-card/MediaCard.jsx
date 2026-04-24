import { useRef } from "react";
import "./MediaCard.css";

const getMediaPreviewUrl = (media, uploadsBaseUrl) => {
    const previewPath = media.thumbpath || media.filepath;

    if (!previewPath) {
        return "";
    }

    if (previewPath.startsWith("http://") || previewPath.startsWith("https://")) {
        return previewPath;
    }

    return `${uploadsBaseUrl}${previewPath}`;
};

const FavouriteIcon = ({ active }) => (
    <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`tagged-media-card-favourite-icon${active ? " is-active" : ""}`}
    >
        <path d="m12 20.55-1.45-1.32C5.4 14.56 2 11.48 2 7.7 2 4.62 4.42 2.2 7.5 2.2c1.74 0 3.41.81 4.5 2.09A6.02 6.02 0 0 1 16.5 2.2C19.58 2.2 22 4.62 22 7.7c0 3.78-3.4 6.86-8.55 11.54L12 20.55Z" />
    </svg>
);

export const MediaCard = ({
    media,
    uploadsBaseUrl,
    onToggleFavourite,
    isTogglingFavourite = false,
    onOpenMedia,
    selectionMode = false,
    isSelected = false,
    onToggleSelect,
    onActivateSelectionMode,
    disableLongPressSelection = false,
}) => {
    const TOUCH_MOVE_THRESHOLD_PX = 12;
    const previewUrl = getMediaPreviewUrl(media, uploadsBaseUrl);
    const isFavourite = media.is_favourite === 1 || media.is_favourite === true;
    const authorLabel = String(media.author || "").trim() || "Unknown";
    const mediaTitle = String(media.displayname || "").trim() || "Undefined";
    const truncatedMediaTitle = mediaTitle.length > 15 ? `${mediaTitle.slice(0, 14)}...` : mediaTitle;
    const mediaTagCandidates = media.tags || media.tag_names || media.mediaTags || media.relatedTags || [];
    const mediaTagCount = Array.isArray(mediaTagCandidates)
        ? mediaTagCandidates.filter((tag) => {
              if (typeof tag === "string") {
                  return String(tag).trim().length > 0;
              }

              const tagName = String(tag?.tagname || tag?.name || "").trim();
              return tagName.length > 0;
          }).length
        : 0;
    const isVideo =
        String(media.mediatype || "")
            .toLowerCase()
            .includes("video") ||
        String(media.mediatype || "")
            .toLowerCase()
            .includes("gif");
    const longPressTimerRef = useRef(null);
    const longPressTriggeredRef = useRef(false);
    const touchStartPointRef = useRef(null);
    const touchMovedRef = useRef(false);
    const suppressNextClickRef = useRef(false);

    const handleOpenMedia = () => {
        onOpenMedia?.(media.id);
    };

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleCardClick = () => {
        if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
        }

        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
        }

        if (selectionMode) {
            onToggleSelect?.(media.id);
            return;
        }

        handleOpenMedia();
    };

    const handleCardTouchStart = (event) => {
        const activeSelection = typeof window !== "undefined" ? window.getSelection?.() : null;
        if (activeSelection && activeSelection.rangeCount > 0) {
            activeSelection.removeAllRanges();
        }

        if (selectionMode || disableLongPressSelection) {
            return;
        }

        longPressTriggeredRef.current = false;
        touchMovedRef.current = false;
        suppressNextClickRef.current = false;
        clearLongPressTimer();

        const touch = event.touches?.[0];

        if (touch) {
            touchStartPointRef.current = {
                x: touch.clientX,
                y: touch.clientY,
            };
        }

        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            onActivateSelectionMode?.(media.id);
        }, 420);
    };

    const handleCardTouchMove = (event) => {
        if (selectionMode || disableLongPressSelection) {
            return;
        }

        const touch = event.touches?.[0];

        if (!touch) {
            return;
        }

        if (!touchStartPointRef.current) {
            touchStartPointRef.current = {
                x: touch.clientX,
                y: touch.clientY,
            };
            return;
        }

        const deltaX = Math.abs(touch.clientX - touchStartPointRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPointRef.current.y);

        if (deltaX > TOUCH_MOVE_THRESHOLD_PX || deltaY > TOUCH_MOVE_THRESHOLD_PX) {
            touchMovedRef.current = true;
            clearLongPressTimer();
        }
    };

    const handleCardTouchEnd = () => {
        if (touchMovedRef.current) {
            suppressNextClickRef.current = true;
        }

        touchStartPointRef.current = null;
        touchMovedRef.current = false;
        clearLongPressTimer();
    };

    const handleCardTouchCancel = () => {
        touchStartPointRef.current = null;
        touchMovedRef.current = false;
        clearLongPressTimer();
    };

    const handleCardKeyDown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();

        if (selectionMode) {
            onToggleSelect?.(media.id);
            return;
        }

        handleOpenMedia();
    };

    return (
        <article
            className={`tagged-media-card${selectionMode ? " is-selection-mode" : ""}${isSelected ? " is-selected" : ""}`}
            aria-label={`Media ${mediaTitle}`}
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
            onTouchStart={handleCardTouchStart}
            onTouchMove={handleCardTouchMove}
            onTouchEnd={handleCardTouchEnd}
            onTouchCancel={handleCardTouchCancel}
        >
            {selectionMode ? (
                <div
                    className={`tagged-media-card-select-indicator${isSelected ? " is-selected" : ""}`}
                    aria-hidden="true"
                >
                    <img src="/icons/check.svg" alt="" />
                </div>
            ) : null}
            <div className="tagged-media-card-preview-wrap">
                {previewUrl ? (
                    <>
                        <img className="tagged-media-card-preview" src={previewUrl} alt={mediaTitle} />
                        {isVideo ? (
                            <span className="tagged-media-card-play-badge" aria-hidden="true">
                                <svg viewBox="0 0 24 24" className="tagged-media-card-play-icon" aria-hidden="true">
                                    <path d="M8 6.8v10.4c0 .8.9 1.3 1.6.9l8.5-5.2c.7-.4.7-1.4 0-1.8L9.6 5.9c-.7-.4-1.6.1-1.6.9Z" />
                                </svg>
                            </span>
                        ) : null}
                    </>
                ) : (
                    <div className="tagged-media-card-preview tagged-media-card-preview--empty">No preview</div>
                )}
            </div>

            <div className="tagged-media-card-body">
                <div className="tagged-media-card-title-block">
                    <h2 title={mediaTitle}>{truncatedMediaTitle}</h2>
                </div>

                <div className="tagged-media-card-footer">
                    <div className="tagged-media-card-meta-inline">
                        <p className="tagged-media-card-author" title={authorLabel}>
                            {authorLabel}
                        </p>

                        <span className="tagged-media-card-meta-separator" aria-hidden="true">
                            •
                        </span>

                        <span
                            className="tagged-media-card-tag-summary"
                            title={`${mediaTagCount} ${mediaTagCount === 1 ? "tag" : "tags"}`}
                            aria-label={`${mediaTagCount} ${mediaTagCount === 1 ? "tag" : "tags"}`}
                        >
                            <span className="tagged-media-card-tag-icon" aria-hidden="true" />
                            <span>{mediaTagCount}</span>
                        </span>
                    </div>

                    <button
                        type="button"
                        className="tagged-media-card-favourite-button"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (selectionMode) {
                                return;
                            }
                            onToggleFavourite?.(media.id);
                        }}
                        aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                        aria-pressed={isFavourite}
                        disabled={isTogglingFavourite || selectionMode}
                    >
                        <FavouriteIcon active={isFavourite} />
                    </button>
                </div>
            </div>
        </article>
    );
};
