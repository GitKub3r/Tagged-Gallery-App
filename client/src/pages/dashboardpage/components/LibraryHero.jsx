import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { faChevronLeft, faChevronRight, faImage, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SpecFigure } from "../../../components/spec-figure/SpecFigure";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { formatBytes, formatDecimal, formatMonthYear, formatNumber, formatPercent, formatShortDate, share } from "../dashboardFormat";

// Perforaciones de la película: más de las que caben, recortadas por el contenedor.
const SPROCKET_COUNT = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const TYPE_LABELS = { image: "images", video: "videos", gif: "GIFs" };
// Controles sobre la película (DESIGN.md §7.9). Solo con ratón: en táctil y con touchpad se desliza.
const ARROW_CLASSES =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-xl border-0 bg-black/65 p-0 text-white shadow-md transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 pointer-fine:grid";

const Sprockets = () => (
    <div className="flex gap-3 overflow-hidden px-3" aria-hidden="true">
        {Array.from({ length: SPROCKET_COUNT }, (_, index) => <span key={index} className="h-2 w-3 shrink-0 rounded-xl bg-white dark:bg-neutral-800" />)}
    </div>
);

const getThumbnailUrl = (media) => {
    const path = media.thumbpath || (media.mediatype === "image" ? media.previewpath || media.filepath : "");
    return path ? `${API_ORIGIN}${path}` : "";
};

const describeDaysAgo = (value) => {
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
                        <img src={thumbnailUrl} alt={name} loading="lazy" draggable="false" className="h-full w-full object-cover transition-transform group-hover:scale-105 motion-reduce:transition-none" />
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

// 01 · Library: la cifra de la biblioteca con su ficha técnica y la tira de película con las últimas subidas.
export const LibraryHero = ({ dashboard }) => {
    const stripRef = useRef(null);
    // Hacia dónde se puede avanzar en la tira (las flechas solo aparecen si hay algo más que ver).
    const [edges, setEdges] = useState({ canGoBack: false, canGoForward: false });
    const { totalMedia, totalBytes, favoriteMediaCount, totalTags, averageTagsPerMedia, recentMedia, mediaTypeBreakdown, vocabulary } = dashboard;
    const since = formatMonthYear(dashboard.firstUploadAt);
    const lastUploadAt = recentMedia[0]?.created_at;
    const countByType = new Map(mediaTypeBreakdown.map((item) => [item.mediatype, item.mediaCount]));
    // Qué tipo de media ocupa más espacio (los vídeos suelen dominar aunque sean pocos).
    const heaviestType = [...mediaTypeBreakdown].sort((a, b) => b.totalBytes - a.totalBytes)[0];
    const images = countByType.get("image") || 0;
    const videos = countByType.get("video") || 0;
    const gifs = countByType.get("gif") || 0;

    const updateEdges = () => {
        const strip = stripRef.current;
        if (!strip) return;
        setEdges({ canGoBack: strip.scrollLeft > 4, canGoForward: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4 });
    };

    // El observador avisa al montarse y cada vez que cambia el ancho de la tira.
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) return undefined;
        const observer = new ResizeObserver(() => {
            setEdges({ canGoBack: strip.scrollLeft > 4, canGoForward: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4 });
        });
        observer.observe(strip);
        return () => observer.disconnect();
    }, []);

    const scrollStrip = (direction) => {
        const strip = stripRef.current;
        if (!strip) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
    };

    return (
        <section aria-labelledby="dashboard-library" className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center xl:gap-10">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 tabular-nums dark:text-neutral-500">
                        01 <span aria-hidden="true">·</span> Library
                    </p>
                    <h2 id="dashboard-library" className="mt-1">
                        <span className="block text-5xl font-black tracking-tight sm:text-6xl">{formatNumber(totalMedia)}</span>
                        <span className="block text-sm font-medium text-neutral-500 dark:text-neutral-400">media{since ? ` since ${since}` : ""}</span>
                    </h2>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 2xl:grid-cols-7">
                    <SpecFigure label="Storage" value={formatBytes(totalBytes)} hint={heaviestType ? `${formatPercent(share(heaviestType.totalBytes, totalBytes))} in ${TYPE_LABELS[heaviestType.mediatype] || heaviestType.mediatype}` : "—"} />
                    <SpecFigure label="Images" value={formatNumber(images)} hint={gifs > 0 ? `and ${formatNumber(gifs)} GIFs` : formatPercent(share(images, totalMedia))} />
                    <SpecFigure label="Videos" value={formatNumber(videos)} hint={formatPercent(share(videos, totalMedia))} />
                    <SpecFigure label="Favourites" value={formatNumber(favoriteMediaCount)} hint={formatPercent(share(favoriteMediaCount, totalMedia))} />
                    <SpecFigure label="Tags" value={formatNumber(totalTags)} hint={`${formatDecimal(averageTagsPerMedia)} per media`} />
                    <SpecFigure label="Authors" value={formatNumber(vocabulary.distinctAuthors)} hint={`${formatNumber(vocabulary.distinctDisplaynames)} media names`} />
                    <SpecFigure label="Last upload" value={lastUploadAt ? formatShortDate(new Date(lastUploadAt)) : "—"} hint={lastUploadAt ? describeDaysAgo(lastUploadAt) : "No uploads"} />
                </dl>
            </div>

            {/* Tira de película: oscura en los dos temas, como el visor de medias. Se desliza sin barra de desplazamiento. */}
            <div className="bg-neutral-950 py-2 dark:bg-black">
                <Sprockets />
                <div className="relative">
                    {edges.canGoBack ? (
                        <button type="button" className={`${ARROW_CLASSES} left-3`} onClick={() => scrollStrip(-1)} aria-label="Previous uploads">
                            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                        </button>
                    ) : null}
                    <ol
                        ref={stripRef}
                        onScroll={updateEdges}
                        className="flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto overscroll-x-contain px-3 py-3 scrollbar-none"
                        aria-label="Latest uploads"
                    >
                        {recentMedia.map((media, index) => <Frame key={media.id} media={media} index={index} />)}
                        <li className="w-36 shrink-0 snap-start sm:w-44">
                            <Link to="/gallery" className="grid aspect-[3/2] place-items-center rounded-xl border border-neutral-700 text-sm font-semibold text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400">
                                Open gallery
                            </Link>
                        </li>
                    </ol>
                    {edges.canGoForward ? (
                        <button type="button" className={`${ARROW_CLASSES} right-3`} onClick={() => scrollStrip(1)} aria-label="More uploads">
                            <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
                <Sprockets />
                <p className="flex justify-between px-3 pt-2 text-xs font-bold uppercase tracking-widest text-neutral-600" aria-hidden="true">
                    <span>Tagged ▸ Latest uploads</span>
                    <span className="tabular-nums">{recentMedia.length} frames</span>
                </p>
            </div>
        </section>
    );
};
