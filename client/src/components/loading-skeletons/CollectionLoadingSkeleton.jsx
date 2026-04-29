import "./CollectionLoadingSkeleton.css";

const CARD_SKELETON_KEYS = Array.from({ length: 15 }, (_, index) => `card-skeleton-${index}`);
const LIST_SKELETON_KEYS = Array.from({ length: 8 }, (_, index) => `list-skeleton-${index}`);

const getCardSkeletonCount = (gridColumns) => {
    const normalizedColumns = Number(gridColumns);
    const columnCount = Number.isFinite(normalizedColumns) ? normalizedColumns : 5;
    return Math.max(8, Math.min(CARD_SKELETON_KEYS.length, columnCount * 3));
};

const SkeletonBlock = ({ className = "" }) => <span className={`tagged-skeleton-block ${className}`} aria-hidden="true" />;

const MediaCardSkeleton = () => (
    <article className="tagged-media-card tagged-loading-skeleton-card tagged-loading-skeleton-media-card" aria-hidden="true">
        <div className="tagged-media-card-preview-wrap tagged-loading-skeleton-preview">
            <SkeletonBlock className="tagged-loading-skeleton-play-pill" />
        </div>

        <div className="tagged-media-card-body tagged-loading-skeleton-body">
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--title" />
            <div className="tagged-loading-skeleton-meta-row">
                <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--meta" />
                <SkeletonBlock className="tagged-loading-skeleton-dot" />
            </div>
        </div>
    </article>
);

const MediaListSkeleton = () => (
    <article className="tagged-gallery-list-item tagged-loading-skeleton-list-item" aria-hidden="true">
        <div className="tagged-gallery-list-preview tagged-loading-skeleton-list-preview" />

        <div className="tagged-gallery-list-main tagged-loading-skeleton-list-main">
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--list-title" />
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--list-meta" />
        </div>

        <div className="tagged-gallery-list-actions tagged-loading-skeleton-list-actions">
            <SkeletonBlock className="tagged-loading-skeleton-action" />
            <SkeletonBlock className="tagged-loading-skeleton-action" />
        </div>
    </article>
);

const AlbumCardSkeleton = () => (
    <article className="tagged-album-card tagged-loading-skeleton-card tagged-loading-skeleton-album-card" aria-hidden="true">
        <div className="tagged-album-card-preview-wrap tagged-loading-skeleton-preview" />

        <div className="tagged-album-card-body tagged-loading-skeleton-body">
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--title" />
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--meta" />
        </div>
    </article>
);

const AlbumListSkeleton = () => (
    <article className="tagged-album-list-item tagged-loading-skeleton-list-item" aria-hidden="true">
        <div className="tagged-album-list-preview tagged-loading-skeleton-list-preview" />

        <div className="tagged-album-list-main tagged-loading-skeleton-list-main">
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--list-title" />
            <SkeletonBlock className="tagged-loading-skeleton-line tagged-loading-skeleton-line--list-meta" />
        </div>
    </article>
);

const getContainerClassName = (itemType, viewMode, context, className) => {
    const classes = ["tagged-loading-skeleton-collection"];

    if (viewMode === "list") {
        classes.push(itemType === "album" ? "tagged-album-list" : "tagged-gallery-list");
        if (context === "album-detail") {
            classes.push("tagged-album-detail-list");
        }
    } else if (itemType === "album") {
        classes.push("tagged-album-grid");
    } else {
        classes.push("tagged-gallery-grid");
        if (context === "album-detail") {
            classes.push("tagged-album-detail-grid");
        }
    }

    if (className) {
        classes.push(className);
    }

    return classes.join(" ");
};

export const CollectionLoadingSkeleton = ({
    itemType = "media",
    viewMode = "card",
    gridColumns = 5,
    context = "gallery",
    className = "",
    ariaLabel = "Loading content",
}) => {
    const normalizedViewMode = viewMode === "list" ? "list" : "card";
    const skeletonKeys =
        normalizedViewMode === "list"
            ? LIST_SKELETON_KEYS
            : CARD_SKELETON_KEYS.slice(0, getCardSkeletonCount(gridColumns));
    const SkeletonItem =
        itemType === "album"
            ? normalizedViewMode === "list"
                ? AlbumListSkeleton
                : AlbumCardSkeleton
            : normalizedViewMode === "list"
              ? MediaListSkeleton
              : MediaCardSkeleton;

    return (
        <div
            className={getContainerClassName(itemType, normalizedViewMode, context, className)}
            style={normalizedViewMode === "card" ? { "--tagged-grid-columns": gridColumns } : undefined}
            role="status"
            aria-live="polite"
            aria-label={ariaLabel}
        >
            {skeletonKeys.map((key) => (
                <SkeletonItem key={key} />
            ))}
        </div>
    );
};
