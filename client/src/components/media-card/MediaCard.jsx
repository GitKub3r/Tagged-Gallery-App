import { useEffect, useRef, useState } from "react";
import { faCheck, faHeart as faHeartSolid, faImage, faPlay, faTag } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./MediaCard.css";

const getMediaPreviewUrl = (media, uploadsBaseUrl, resolvePreviewUrl) => {
    if (resolvePreviewUrl) {
        return resolvePreviewUrl(media);
    }

    const previewPath = media.thumbpath || media.filepath;

    if (!previewPath) {
        return "";
    }

    if (previewPath.startsWith("http://") || previewPath.startsWith("https://")) {
        return previewPath;
    }

    return `${uploadsBaseUrl}${previewPath}`;
};

export const MediaCard = ({
    media,
    uploadsBaseUrl,
    resolvePreviewUrl,
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
    const previewUrl = getMediaPreviewUrl(media, uploadsBaseUrl, resolvePreviewUrl);
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
    const favouriteAnimationTimerRef = useRef(null);
    const longPressTriggeredRef = useRef(false);
    const touchStartPointRef = useRef(null);
    const touchMovedRef = useRef(false);
    const suppressNextClickRef = useRef(false);
    const [favouriteAnimation, setFavouriteAnimation] = useState("");

    useEffect(
        () => () => {
            if (favouriteAnimationTimerRef.current) {
                window.clearTimeout(favouriteAnimationTimerRef.current);
            }
        },
        [],
    );

    const handleFavouriteClick = (event) => {
        event.stopPropagation();

        if (favouriteAnimationTimerRef.current) {
            window.clearTimeout(favouriteAnimationTimerRef.current);
        }

        setFavouriteAnimation(isFavourite ? "is-favourite-removed" : "is-favourite-added");
        favouriteAnimationTimerRef.current = window.setTimeout(() => {
            setFavouriteAnimation("");
            favouriteAnimationTimerRef.current = null;
        }, 440);

        onToggleFavourite?.(media.id);
    };

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
            className="group relative w-full cursor-pointer transition-transform duration-200 ease-out hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-500"
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
                <span
                    className={`absolute left-3 top-3 z-20 grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-md transition-[background-color,color,transform] ${isSelected ? "scale-100 bg-white text-neutral-950" : "bg-black/20 text-transparent"}`}
                    aria-hidden="true"
                >
                    {isSelected ? <FontAwesomeIcon icon={faCheck} className="text-[0.68rem]" /> : null}
                </span>
            ) : null}
            <div className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-900 ${isSelected ? "ring-2 ring-neutral-950 ring-offset-2 ring-offset-neutral-50 dark:ring-neutral-100 dark:ring-offset-neutral-950" : ""}`}>
                {previewUrl ? (
                    <>
                        <img className="h-full w-full object-cover transition-opacity group-hover:opacity-95" src={previewUrl} alt={mediaTitle} />
                        {isVideo ? (
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl text-white drop-shadow-lg" aria-hidden="true">
                                <FontAwesomeIcon icon={faPlay} />
                            </span>
                        ) : null}
                    </>
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-500">
                        <FontAwesomeIcon icon={faImage} className="text-2xl" aria-hidden="true" />
                        <span className="text-xs font-semibold">No preview</span>
                    </div>
                )}

                {!selectionMode ? (
                    <button
                        type="button"
                        className="tagged-media-card-favourite-button absolute! right-2! top-2! flex! h-10! w-10! items-center! justify-center! rounded-xl! border-0! p-0! text-white! disabled:opacity-50!"
                        onClick={handleFavouriteClick}
                        aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                        aria-pressed={isFavourite}
                        disabled={isTogglingFavourite}
                    >
                        <FontAwesomeIcon
                            icon={isFavourite ? faHeartSolid : faHeartRegular}
                            className={`tagged-media-card-favourite-icon text-xl ${favouriteAnimation}`}
                            aria-hidden="true"
                        />
                    </button>
                ) : null}
            </div>

            <div className="px-1 pb-1 pt-3">
                <h2 className="truncate text-base font-bold text-neutral-950 dark:text-neutral-100" title={mediaTitle}>
                    {truncatedMediaTitle}
                </h2>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    <span className="truncate" title={authorLabel}>{authorLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5" aria-label={`${mediaTagCount} ${mediaTagCount === 1 ? "tag" : "tags"}`}>
                        <FontAwesomeIcon icon={faTag} aria-hidden="true" />
                        {mediaTagCount}
                    </span>
                </div>
            </div>
        </article>
    );
};
