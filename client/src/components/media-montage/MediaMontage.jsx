import { useCallback, useEffect, useRef, useState } from "react";
import { faChevronLeft, faChevronRight, faPause, faPlay, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "../../pages/albumspage/AlbumDetailPage.css";

const DEFAULT_IMAGE_DURATION_MS = 4200;
const SETTINGS_STORAGE_KEY = "tagged_album_detail_montage_settings";
const TRANSITION_DURATION_MS = 820;

const isVideoMedia = (media) => String(media?.mediatype || "").toLowerCase().includes("video");
const isHeicMedia = (media) => /\.hei[cf](?:$|[?#])/i.test(String(media?.filepath || media?.filename || ""));

const getStoredSettings = () => {
    if (typeof window === "undefined") return { imageDurationMs: DEFAULT_IMAGE_DURATION_MS, animationType: "slide" };

    try {
        const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
        const seconds = Number(stored.imageDurationSeconds);
        return {
            imageDurationMs: Number.isFinite(seconds) ? Math.max(3, Math.min(60, seconds)) * 1000 : DEFAULT_IMAGE_DURATION_MS,
            animationType: ["slide", "fade", "drop", "none"].includes(stored.animationType) ? stored.animationType : "slide",
        };
    } catch {
        return { imageDurationMs: DEFAULT_IMAGE_DURATION_MS, animationType: "slide" };
    }
};

const formatMediaSize = (bytes) => {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "Size unavailable";
    if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(1)} GB`;
    if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const formatMediaDate = (media) => {
    const value = media?.updatedAt || media?.updated_at || media?.createdAt || media?.created_at;
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

export const MediaMontage = ({ items, getAssetUrl, onClose, onOpenMedia }) => {
    const [settings] = useState(getStoredSettings);
    const [index, setIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [direction, setDirection] = useState("next");
    const [previousFrame, setPreviousFrame] = useState(null);
    const videoRef = useRef(null);
    const progressRef = useRef(0);
    const transitionTimerRef = useRef(null);
    const currentMedia = items[index] || null;
    const currentIsVideo = isVideoMedia(currentMedia);

    const resolveMediaUrl = useCallback((media) => getAssetUrl(
        isHeicMedia(media) ? media?.thumbpath || media?.filepath || "" : media?.filepath || media?.thumbpath || "",
    ), [getAssetUrl]);
    const resolvePosterUrl = useCallback((media) => getAssetUrl(media?.thumbpath || ""), [getAssetUrl]);
    const resolveBackgroundUrl = useCallback((media) => getAssetUrl(media?.thumbpath || media?.filepath || ""), [getAssetUrl]);

    const moveTo = useCallback((nextIndex, nextDirection) => {
        if (!items.length || nextIndex === index) return;
        const outgoingMedia = items[index];
        setPreviousFrame({
            media: outgoingMedia,
            index,
            mediaUrl: resolveMediaUrl(outgoingMedia),
            posterUrl: resolvePosterUrl(outgoingMedia),
            backgroundUrl: resolveBackgroundUrl(outgoingMedia),
            isVideo: isVideoMedia(outgoingMedia),
        });
        setDirection(nextDirection);
        setIndex(nextIndex);
        progressRef.current = 0;
        setProgress(0);
        if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = window.setTimeout(() => setPreviousFrame(null), TRANSITION_DURATION_MS);
    }, [index, items, resolveBackgroundUrl, resolveMediaUrl, resolvePosterUrl]);

    const showNext = useCallback(() => moveTo((index + 1) % items.length, "next"), [index, items.length, moveTo]);
    const showPrevious = useCallback(() => moveTo((index - 1 + items.length) % items.length, "previous"), [index, items.length, moveTo]);

    useEffect(() => () => {
        if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    }, []);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose();
            else if (event.key === "ArrowRight") showNext();
            else if (event.key === "ArrowLeft") showPrevious();
            else if (event.key === " ") {
                event.preventDefault();
                setIsPlaying((current) => !current);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, showNext, showPrevious]);

    useEffect(() => {
        if (!isPlaying || currentIsVideo || items.length <= 1) return undefined;
        const startedAt = performance.now() - progressRef.current * settings.imageDurationMs;
        const timer = window.setInterval(() => {
            const nextProgress = Math.min(1, (performance.now() - startedAt) / settings.imageDurationMs);
            progressRef.current = nextProgress;
            setProgress(nextProgress);
            if (nextProgress >= 1) showNext();
        }, 50);
        return () => window.clearInterval(timer);
    }, [currentIsVideo, index, isPlaying, items.length, settings.imageDurationMs, showNext]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentIsVideo) return;
        if (isPlaying) video.play().catch(() => {});
        else video.pause();
    }, [currentIsVideo, index, isPlaying]);

    if (!currentMedia) return null;

    const title = String(currentMedia.displayname || currentMedia.filename || "").trim() || "Untitled media";
    const author = String(currentMedia.author || "").trim() || "Unknown";
    const mediaUrl = resolveMediaUrl(currentMedia);
    const posterUrl = resolvePosterUrl(currentMedia);
    const backgroundUrl = resolveBackgroundUrl(currentMedia);
    const transitionClass = `tagged-album-montage-frame--${settings.animationType}`;

    return (
        <div className="tagged-album-montage" role="dialog" aria-modal="true" aria-label="Selected media montage">
            <div className="tagged-album-montage-backdrop" aria-hidden="true" />
            <div className="tagged-album-montage-topbar">
                <div className="tagged-album-montage-title-block">
                    <div className="tagged-album-montage-title-line"><strong title={title}>{title}</strong></div>
                    <span className="tagged-album-montage-count">{index + 1} / {items.length}<span className="tagged-album-montage-meta-dot" aria-hidden="true">·</span>{author}</span>
                </div>
                <button type="button" className="tagged-album-montage-icon-button" onClick={onClose} aria-label="Close montage" title="Close"><FontAwesomeIcon icon={faXmark} aria-hidden="true" /></button>
            </div>

            <div className="tagged-album-montage-stage">
                {previousFrame ? (
                    <div key={`previous-${previousFrame.media.id}-${previousFrame.index}`} className={`tagged-album-montage-frame tagged-album-montage-frame--previous ${transitionClass} is-${direction}${previousFrame.isVideo ? " tagged-album-montage-frame--previous-video" : ""}`}>
                        {previousFrame.mediaUrl ? <div className="tagged-album-montage-frame-inner">
                            {previousFrame.backgroundUrl ? <div className="tagged-album-montage-blur-bg" style={{ backgroundImage: `url(${previousFrame.backgroundUrl})` }} aria-hidden="true" /> : null}
                            {previousFrame.isVideo && !previousFrame.posterUrl ? <video className="tagged-album-montage-media" src={previousFrame.mediaUrl} muted playsInline /> : <img className="tagged-album-montage-media" src={previousFrame.isVideo ? previousFrame.posterUrl : previousFrame.mediaUrl} alt="" />}
                        </div> : <div className="tagged-album-montage-empty">No preview</div>}
                    </div>
                ) : null}

                <div key={`${currentMedia.id}-${index}`} className={`tagged-album-montage-frame tagged-album-montage-frame--current ${transitionClass} is-${direction}`}>
                    {mediaUrl ? <div className="tagged-album-montage-frame-inner">
                        {backgroundUrl ? <div className="tagged-album-montage-blur-bg" style={{ backgroundImage: `url(${backgroundUrl})` }} aria-hidden="true" /> : null}
                        {currentIsVideo ? (
                            <video ref={videoRef} className="tagged-album-montage-media" src={mediaUrl} poster={posterUrl || undefined} autoPlay muted playsInline onLoadedMetadata={(event) => { const ratio = event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0; progressRef.current = ratio; setProgress(ratio); }} onTimeUpdate={(event) => { const ratio = event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0; progressRef.current = ratio; setProgress(ratio); }} onEnded={showNext} />
                        ) : <img className="tagged-album-montage-media" src={mediaUrl} alt={title} />}
                        <button type="button" className="tagged-album-montage-media-hitbox" onClick={() => onOpenMedia?.(currentMedia, index, items)} aria-label={`Open ${title} detail`} />
                        <div className="tagged-album-montage-media-info" aria-hidden="true">
                            <div className="tagged-album-montage-media-info-top"><div className="tagged-album-montage-media-info-top-main"><span className="tagged-album-montage-media-info-pill">{author}</span><span className="tagged-album-montage-media-info-pill">{formatMediaSize(currentMedia.size)}</span></div></div>
                            <div className="tagged-album-montage-media-info-bottom"><h2 title={title}>{title}</h2><p className="tagged-album-montage-media-info-date">{formatMediaDate(currentMedia)}</p></div>
                        </div>
                    </div> : <div className="tagged-album-montage-empty">No preview</div>}
                </div>
            </div>

            <div className="tagged-album-montage-bottom">
                <div className="tagged-album-montage-progress" role="progressbar" aria-label="Montage progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ transform: `scaleX(${progress})` }} /></div>
                <div className="tagged-album-montage-controls" aria-label="Montage controls">
                    <button type="button" className="tagged-album-montage-icon-button" onClick={showPrevious} disabled={items.length <= 1} aria-label="Previous media" title="Previous"><FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" /></button>
                    <button type="button" className="tagged-album-montage-icon-button tagged-album-montage-play-button" onClick={() => setIsPlaying((current) => !current)} aria-label={isPlaying ? "Pause montage" : "Play montage"} title={isPlaying ? "Pause" : "Play"}><FontAwesomeIcon icon={isPlaying ? faPause : faPlay} aria-hidden="true" /></button>
                    <button type="button" className="tagged-album-montage-icon-button" onClick={showNext} disabled={items.length <= 1} aria-label="Next media" title="Next"><FontAwesomeIcon icon={faChevronRight} aria-hidden="true" /></button>
                </div>
            </div>
        </div>
    );
};
