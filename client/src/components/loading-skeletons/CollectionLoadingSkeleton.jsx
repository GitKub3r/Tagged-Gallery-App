import { useEffect, useState } from "react";
import { Skeleton } from "./Skeleton";

const SKELETON_VISIBILITY_DELAY_MS = 180;
const keys = Array.from({ length: 15 }, (_, index) => index);

const MediaCardSkeleton = () => (
    <article className="w-full" aria-hidden="true">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl"><Skeleton className="absolute inset-0 h-full w-full" /><Skeleton className="absolute right-2 top-2 h-10 w-10" /></div>
        <div className="px-1 pb-1 pt-3"><Skeleton className="h-5 w-2/3" /><div className="mt-2 flex items-center gap-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-12" /></div></div>
    </article>
);

const AlbumCardSkeleton = () => (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white/60 dark:border-neutral-800 dark:bg-neutral-900/60" aria-hidden="true">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="space-y-2 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-2/5" /></div>
    </article>
);

const ListSkeleton = ({ itemType }) => (
    <article className="flex min-h-20 items-center gap-4 border-b border-neutral-200 py-3 dark:border-neutral-800" aria-hidden="true">
        <Skeleton className={`${itemType === "album" ? "h-14 w-20" : "h-16 w-20"} shrink-0`} />
        <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
        <Skeleton className="h-9 w-9 shrink-0" />
    </article>
);

export const CollectionLoadingSkeleton = ({ itemType = "media", viewMode = "card", gridColumns = 5, context = "gallery", className = "", ariaLabel = "Loading content" }) => {
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => { const timer = window.setTimeout(() => setIsVisible(true), SKELETON_VISIBILITY_DELAY_MS); return () => window.clearTimeout(timer); }, []);
    if (!isVisible) return null;
    const count = viewMode === "list" ? 8 : Math.max(8, Math.min(15, Number(gridColumns || 5) * 3));
    const containerClass = viewMode === "list" ? `${itemType === "album" ? "tagged-album-list" : "tagged-gallery-list"} ${context === "album-detail" ? "tagged-album-detail-list" : ""}` : `${itemType === "album" ? "tagged-album-grid-v2" : "tagged-gallery-grid"} ${context === "album-detail" ? "tagged-album-detail-grid" : ""}`;
    return <div className={`${containerClass} ${className}`} style={viewMode === "card" ? { "--tagged-grid-columns": gridColumns } : undefined} role="status" aria-live="polite" aria-label={ariaLabel}>{keys.slice(0, count).map((key) => viewMode === "list" ? <ListSkeleton key={key} itemType={itemType} /> : itemType === "album" ? <AlbumCardSkeleton key={key} /> : <MediaCardSkeleton key={key} />)}<span className="sr-only">{ariaLabel}</span></div>;
};
