import { useEffect, useState } from "react";
import { faExpand, faHardDrive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatMediaResolution, formatMediaSize } from "../../utils/mediaFormat";

export const MediaFileMeta = ({ size, mediaUrl, isVideo = false, className = "" }) => {
    const [resolutionState, setResolutionState] = useState({ mediaUrl: "", dimensions: null });
    const dimensions = resolutionState.mediaUrl === mediaUrl ? resolutionState.dimensions : null;

    useEffect(() => {
        if (!mediaUrl) return undefined;

        let cancelled = false;
        const media = isVideo ? document.createElement("video") : new Image();
        const handleLoaded = () => {
            if (cancelled) return;
            setResolutionState({
                mediaUrl,
                dimensions: isVideo
                    ? { width: media.videoWidth, height: media.videoHeight }
                    : { width: media.naturalWidth, height: media.naturalHeight },
            });
        };
        const loadedEvent = isVideo ? "loadedmetadata" : "load";
        media.addEventListener(loadedEvent, handleLoaded, { once: true });
        if (isVideo) {
            media.preload = "metadata";
            media.src = mediaUrl;
        } else {
            media.src = mediaUrl;
        }

        return () => {
            cancelled = true;
            media.removeEventListener(loadedEvent, handleLoaded);
            if (isVideo) media.removeAttribute("src");
        };
    }, [isVideo, mediaUrl]);

    return (
        <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><FontAwesomeIcon icon={faHardDrive} aria-hidden="true" />{formatMediaSize(size)}</span>
            <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
            <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap"><FontAwesomeIcon icon={faExpand} aria-hidden="true" />{dimensions ? formatMediaResolution(dimensions.width, dimensions.height) : "— × —"}</span>
        </span>
    );
};
