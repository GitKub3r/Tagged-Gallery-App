import { useRef } from "react";
import { Link } from "react-router-dom";
import { faChevronLeft, faChevronRight, faClock, faHardDrive, faHeart, faImage, faPlay, faTag } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { formatBytes, formatDecimal, formatMonthYear, formatNumber, formatPercent, formatShortDate, share } from "../dashboardFormat";

// Perforaciones de la película: más de las que caben, recortadas por el contenedor.
const SPROCKET_COUNT = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const Sprockets = () => (
    <div className="flex gap-3 overflow-hidden px-3" aria-hidden="true">
        {Array.from({ length: SPROCKET_COUNT }, (_, index) => <span key={index} className="h-2 w-3 shrink-0 rounded-xl bg-white dark:bg-neutral-800" />)}
    </div>
);

const getThumbnailUrl = (media) => {
    const path = media.thumbpath || (media.mediatype === "image" ? media.previewpath || media.filepath : "");
    return path ? `${API_ORIGIN}${path}` : "";
};

const describeLastUpload = (value) => {
    if (!value) return null;
    const days = Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS);
    return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

// Fotograma de la tira: miniatura, número de fotograma y nombre. Abre la media.
const Frame = ({ media, index }) => {
    const name = String(media.displayname || "").trim() || "Undefined";
    const thumbnailUrl = getThumbnailUrl(media);
    return (
        <li className="w-36 shrink-0 snap-start sm:w-44">
            <Link to={`/gallery/${media.id}`} className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400">
                <span className="relative block aspect-[3/2] overflow-hidden rounded-xl bg-neutral-800">
                    {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105 motion-reduce:transition-none" />
                    ) : (
                        <span className="grid h-full place-items-center text-neutral-500">
                            <FontAwesomeIcon icon={faImage} aria-hidden="true" />
                            <span className="sr-only">{name}</span>
                        </span>
                    )}
                    {media.mediatype !== "image" ? (
                        <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-xl bg-black/65 text-xs text-white">
                            <FontAwesomeIcon icon={faPlay} aria-hidden="true" />
                            <span className="sr-only">{media.mediatype === "gif" ? "GIF" : "Video"}</span>
                        </span>
                    ) : null}
                </span>
                <span className="mt-1.5 flex min-w-0 items-baseline gap-2 text-xs" aria-hidden="true">
                    <span className="font-bold tracking-widest text-neutral-500 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    <span className="truncate font-semibold text-neutral-400 group-hover:text-white">{name}</span>
                </span>
            </Link>
        </li>
    );
};

// Lectura junto a la cifra principal.
const Reading = ({ icon, label, value, hint }) => (
    <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-3 dark:bg-neutral-950">
        <dt className="flex items-center gap-1.5 truncate text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            <FontAwesomeIcon icon={icon} aria-hidden="true" />
            {label}
        </dt>
        <dd className="mt-1.5 truncate text-2xl font-black tracking-tight">{value}</dd>
        {hint ? <dd className="truncate text-xs font-semibold text-neutral-500 dark:text-neutral-400" title={hint}>{hint}</dd> : null}
    </div>
);

// 01 · Library: la cifra de la biblioteca, sus lecturas principales y la tira de película con las últimas subidas.
export const LibraryHero = ({ dashboard }) => {
    const stripRef = useRef(null);
    const { totalMedia, totalBytes, favoriteMediaCount, totalTags, averageTagsPerMedia, recentMedia, mediaTypeBreakdown } = dashboard;
    const since = formatMonthYear(dashboard.firstUploadAt);
    const lastUploadAt = recentMedia[0]?.created_at;
    // Qué tipo de media ocupa más espacio (los vídeos suelen dominar aunque sean pocos).
    const heaviestType = [...mediaTypeBreakdown].sort((a, b) => b.totalBytes - a.totalBytes)[0];
    const heaviestLabel = heaviestType ? { image: "images", video: "videos", gif: "GIFs" }[heaviestType.mediatype] || heaviestType.mediatype : null;

    const scrollStrip = (direction) => {
        const strip = stripRef.current;
        if (!strip) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
    };

    return (
        <section aria-labelledby="dashboard-library" className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="grid gap-6 p-4 sm:p-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] 2xl:items-end">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 tabular-nums dark:text-neutral-500">
                        01 <span aria-hidden="true">·</span> Library
                    </p>
                    <h2 id="dashboard-library" className="mt-2">
                        <span className="block text-6xl font-black tracking-tight sm:text-7xl">{formatNumber(totalMedia)}</span>
                        <span className="mt-1 block text-sm font-medium text-neutral-500 dark:text-neutral-400">
                            media in your library{since ? ` · since ${since}` : ""}
                        </span>
                    </h2>
                </div>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Reading icon={faHardDrive} label="Storage" value={formatBytes(totalBytes)} hint={heaviestType ? `${formatPercent(share(heaviestType.totalBytes, totalBytes))} in ${heaviestLabel}` : null} />
                    <Reading icon={faHeart} label="Favourites" value={formatNumber(favoriteMediaCount)} hint={`${formatPercent(share(favoriteMediaCount, totalMedia))} of the library`} />
                    <Reading icon={faTag} label="Tags" value={formatNumber(totalTags)} hint={`${formatDecimal(averageTagsPerMedia)} per media`} />
                    <Reading icon={faClock} label="Last upload" value={lastUploadAt ? formatShortDate(new Date(lastUploadAt)) : "—"} hint={describeLastUpload(lastUploadAt)} />
                </dl>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pb-3 sm:px-6">
                <h3 className="text-sm font-semibold">Latest uploads</h3>
                <div className="flex items-center gap-1">
                    <IconButton onClick={() => scrollStrip(-1)} aria-label="Scroll latest uploads back">
                        <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                    </IconButton>
                    <IconButton onClick={() => scrollStrip(1)} aria-label="Scroll latest uploads forward">
                        <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                    </IconButton>
                </div>
            </div>

            {/* Tira de película: oscura en los dos temas, como el visor de medias. */}
            <div className="bg-neutral-950 py-2 dark:bg-black">
                <Sprockets />
                <ol ref={stripRef} className="flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 py-3" aria-label="Latest uploads">
                    {recentMedia.map((media, index) => <Frame key={media.id} media={media} index={index} />)}
                    <li className="w-36 shrink-0 snap-start sm:w-44">
                        <Link to="/gallery" className="grid aspect-[3/2] place-items-center rounded-xl border border-neutral-700 text-sm font-semibold text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400">
                            Open gallery
                        </Link>
                    </li>
                </ol>
                <Sprockets />
                <p className="flex justify-between px-3 pt-2 text-xs font-bold uppercase tracking-widest text-neutral-600" aria-hidden="true">
                    <span>Tagged ▸ Latest uploads</span>
                    <span className="tabular-nums">{recentMedia.length} frames</span>
                </p>
            </div>
        </section>
    );
};
