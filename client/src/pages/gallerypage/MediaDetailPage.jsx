import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./MediaDetailPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const UPLOADS_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");
const LIGHTBOX_MIN_ZOOM = 1;
const LIGHTBOX_DEFAULT_ZOOM = 1.9;
const LIGHTBOX_MAX_ZOOM = 4;
const MAX_SUGGESTIONS = 8;
const DESKTOP_DEFAULT_TAG_LIMIT = 6;
const DESKTOP_COPYRIGHT_TAG_LIMIT = 3;
const MEDIA_SWITCH_ANIMATION_MS = 320;
const DEFAULT_NEW_TAG_COLOR = "#643aff";
const EDIT_MODAL_CLOSE_ON_SAVE_STORAGE_KEY = "tagged.mediaDetail.closeEditModalOnSave";
const MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY = "tagged.mediaDetail.autoplay";
const MEDIA_DETAIL_AUTOPLAY_EVENT = "tagged:media-detail-autoplay";

const normalizeHexColor = (input) => {
    const raw = String(input || "").trim();

    if (!raw) {
        return null;
    }

    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
        return raw;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        const [, r, g, b] = raw;
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    return null;
};

const getHexRgb = (hexColor) => {
    const normalized = normalizeHexColor(hexColor);

    if (!normalized) {
        return null;
    }

    const parsed = Number.parseInt(normalized.slice(1), 16);

    return {
        r: (parsed >> 16) & 255,
        g: (parsed >> 8) & 255,
        b: parsed & 255,
        hex: normalized,
    };
};

const getRelativeLuminance = ({ r, g, b }) => {
    const toLinear = (channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const toHexChannel = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

const mixRgbWithWhite = (rgb, amount = 0.5) => {
    const ratio = Math.max(0, Math.min(1, amount));
    const mix = (channel) => channel + (255 - channel) * ratio;
    return `#${toHexChannel(mix(rgb.r))}${toHexChannel(mix(rgb.g))}${toHexChannel(mix(rgb.b))}`;
};

const isDarkThemeActive = () => {
    if (typeof document === "undefined") {
        return false;
    }

    return document.documentElement?.getAttribute("data-theme") === "dark";
};

const buildTagStyle = (hexColor, surface = "light") => {
    const rgb = getHexRgb(hexColor);
    const darkTheme = isDarkThemeActive();

    if (!rgb) {
        if (!darkTheme && surface === "light") {
            return {
                backgroundColor: `${DEFAULT_NEW_TAG_COLOR}22`,
                color: DEFAULT_NEW_TAG_COLOR,
                "--tagged-media-detail-tag-hover-color": DEFAULT_NEW_TAG_COLOR,
                borderColor: `${DEFAULT_NEW_TAG_COLOR}66`,
                borderWidth: "2px",
                boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.22)",
            };
        }

        return {
            backgroundColor: `${DEFAULT_NEW_TAG_COLOR}38`,
            color: "#f7f9ff",
            "--tagged-media-detail-tag-hover-color": "#f7f9ff",
            borderColor: `${DEFAULT_NEW_TAG_COLOR}BB`,
            borderWidth: "2px",
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.3)",
        };
    }

    const luminance = getRelativeLuminance(rgb);
    const isDarkSurface = surface === "dark" || darkTheme;
    const isLightSurface = !isDarkSurface;
    const isNearWhite = luminance > 0.88;
    const isDarkTone = luminance < 0.3;
    const isVeryDark = luminance < 0.12;

    let textColor = rgb.hex;

    if (isNearWhite) {
        textColor = isLightSurface ? "#111111" : "#f7f9ff";
    } else if (isDarkSurface && isDarkTone) {
        textColor = mixRgbWithWhite(rgb, isVeryDark ? 0.72 : 0.56);
    }

    if (isLightSurface && isNearWhite) {
        textColor = "#111111";
    }

    const hoverTextColor = textColor;

    const borderColor =
        isNearWhite && isLightSurface
            ? "rgba(0, 0, 0, 0.22)"
            : isNearWhite && isDarkSurface
              ? "rgba(255, 255, 255, 0.72)"
              : `${textColor}${isLightSurface ? "66" : "BB"}`;

    return {
        backgroundColor:
            isNearWhite && isDarkSurface
                ? "rgba(255, 255, 255, 0.16)"
                : `${textColor}${isLightSurface ? "22" : "38"}`,
        color: textColor,
        "--tagged-media-detail-tag-hover-color": hoverTextColor,
        borderColor,
        borderWidth: "2px",
        boxShadow: `inset 0 0 0 1px ${isLightSurface ? "rgba(0, 0, 0, 0.22)" : "rgba(255, 255, 255, 0.3)"}`,
    };
};

const formatMediaSize = (sizeInBytes) => {
    const numericSize = Number(sizeInBytes);

    if (!Number.isFinite(numericSize) || numericSize <= 0) {
        return "0 KB";
    }

    const bytesInKb = 1024;
    const bytesInMb = bytesInKb * 1024;
    const bytesInGb = bytesInMb * 1024;

    if (numericSize < bytesInMb) {
        return `${(numericSize / bytesInKb).toFixed(2)} KB`;
    }

    if (numericSize < bytesInGb) {
        return `${(numericSize / bytesInMb).toFixed(2)} MB`;
    }

    return `${(numericSize / bytesInGb).toFixed(2)} GB`;
};

const FavouriteIcon = ({ active }) => (
    <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`tagged-media-detail-favourite-icon${active ? " is-active" : ""}`}
    >
        <path d="m12 20.55-1.45-1.32C5.4 14.56 2 11.48 2 7.7 2 4.62 4.42 2.2 7.5 2.2c1.74 0 3.41.81 4.5 2.09A6.02 6.02 0 0 1 16.5 2.2C19.58 2.2 22 4.62 22 7.7c0 3.78-3.4 6.86-8.55 11.54L12 20.55Z" />
    </svg>
);

const formatUploadDate = (dateValue) => {
    if (!dateValue) {
        return "Unknown";
    }

    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
        return "Unknown";
    }

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(parsedDate);
};

const getMediaUrl = (media) => {
    const mediaPath = media?.filepath;

    if (!mediaPath) {
        return "";
    }

    if (mediaPath.startsWith("http://") || mediaPath.startsWith("https://")) {
        return mediaPath;
    }

    return `${UPLOADS_BASE_URL}${mediaPath}`;
};

const getThumbnailUrl = (media) => {
    const thumbnailPath = media?.thumbpath;

    if (!thumbnailPath) {
        return "";
    }

    if (thumbnailPath.startsWith("http://") || thumbnailPath.startsWith("https://")) {
        return thumbnailPath;
    }

    return `${UPLOADS_BASE_URL}${thumbnailPath}`;
};

const parseApiResponse = async (response, fallbackMessage) => {
    const clonedResponse = response.clone();

    try {
        return await response.json();
    } catch {
        let bodyText = "";

        try {
            bodyText = (await clonedResponse.text()).trim();
        } catch {
            bodyText = "";
        }

        return {
            success: false,
            message: bodyText || fallbackMessage,
        };
    }
};

const normalizeTags = (media) => {
    const candidates = media?.tags || media?.tag_names || media?.mediaTags || media?.relatedTags || [];

    if (!Array.isArray(candidates)) {
        return [];
    }

    return candidates.map((tag, index) => {
        if (typeof tag === "string") {
            return {
                id: `${tag}-${index}`,
                tagname: tag,
                tagcolor_hex: null,
                type: "default",
            };
        }

        return {
            id: tag.id || `${tag.tagname || tag.name || "tag"}-${index}`,
            tagname: tag.tagname || tag.name || "Tag",
            tagcolor_hex: tag.tagcolor_hex || null,
            type: tag.type || "default",
        };
    });
};

const TagGroup = ({
    title,
    iconSrc,
    tags,
    expanded,
    onToggle,
    onTagClick,
    headerRight = null,
    extraClassName = "",
    tagSurface = "light",
}) => {
    const visibleTags = expanded ? tags : tags.slice(0, 10);
    const hasOverflow = tags.length > 10;

    return (
        <section className={`tagged-media-detail-tag-group ${extraClassName}`.trim()} aria-label={`${title} tags`}>
            <div className="tagged-media-detail-tag-group-header">
                <h3>
                    {iconSrc ? <img src={iconSrc} alt="" aria-hidden="true" /> : null}
                    <span>{title}</span>
                </h3>

                <div className="tagged-media-detail-tag-group-actions">
                    {headerRight ? <div className="tagged-media-detail-tag-group-right-slot">{headerRight}</div> : null}

                    {hasOverflow ? (
                        <button type="button" className="tagged-media-detail-expand-button" onClick={onToggle}>
                            <span aria-hidden="true">{expanded ? "▲" : "▼"}</span>
                        </button>
                    ) : null}
                </div>
            </div>

            {tags.length > 0 ? (
                <ul className="tagged-media-detail-tag-list">
                    {visibleTags.map((tag) => (
                        <li key={tag.id}>
                            <button
                                type="button"
                                className="tagged-media-detail-tag tagged-media-detail-tag-button"
                                style={buildTagStyle(tag.tagcolor_hex, tagSurface)}
                                onClick={() => onTagClick?.(tag.tagname)}
                                aria-label={`Filter gallery by tag ${tag.tagname}`}
                            >
                                {tag.tagname}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="tagged-media-detail-empty-tags">No tags in this group.</p>
            )}
        </section>
    );
};

export const MediaDetailPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { mediaId } = useParams();
    const { user, fetchWithAuth } = useAuth();
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTogglingFavourite, setIsTogglingFavourite] = useState(false);
    const [expandedDefaultTags, setExpandedDefaultTags] = useState(false);
    const [expandedCopyrightTags, setExpandedCopyrightTags] = useState(false);
    // null = not yet calculated, 'blur' = contain + blurred bg (never stretch media).
    const [mediaFit, setMediaFit] = useState(null);
    const [isDetailVideoPlaying, setIsDetailVideoPlaying] = useState(false);
    const [mediaDetailAutoplay, setMediaDetailAutoplay] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }
        return window.localStorage.getItem(MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY) === "true";
    });
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isLightboxImageZoomed, setIsLightboxImageZoomed] = useState(false);
    const [lightboxImageScale, setLightboxImageScale] = useState(LIGHTBOX_MIN_ZOOM);
    const [lightboxImagePan, setLightboxImagePan] = useState({ x: 0, y: 0 });
    const [isLightboxImagePanning, setIsLightboxImagePanning] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditPreviewLightboxOpen, setIsEditPreviewLightboxOpen] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeletingMedia, setIsDeletingMedia] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isMediaChanging, setIsMediaChanging] = useState(false);
    const [actionToast, setActionToast] = useState(null);
    const [editError, setEditError] = useState(null);
    const [editDisplayNameInput, setEditDisplayNameInput] = useState("");
    const [editAuthorInput, setEditAuthorInput] = useState("");
    const [editTagInput, setEditTagInput] = useState("");
    const [editSelectedTags, setEditSelectedTags] = useState([]);
    const [editDistinctDisplayNames, setEditDistinctDisplayNames] = useState([]);
    const [editDistinctAuthors, setEditDistinctAuthors] = useState([]);
    const [editDistinctTagNames, setEditDistinctTagNames] = useState([]);
    const [editTagColorByName, setEditTagColorByName] = useState({});
    const [editActiveSuggestionField, setEditActiveSuggestionField] = useState(null);
    const [editActiveSuggestionIndex, setEditActiveSuggestionIndex] = useState(0);
    const [closeEditModalOnSave, setCloseEditModalOnSave] = useState(() => {
        if (typeof window === "undefined") {
            return true;
        }

        const storedValue = window.localStorage.getItem(EDIT_MODAL_CLOSE_ON_SAVE_STORAGE_KEY);

        if (storedValue === null) {
            return true;
        }

        return storedValue === "true";
    });
    const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
    const [expandedDesktopDefaultTags, setExpandedDesktopDefaultTags] = useState(false);
    const [expandedDesktopCopyrightTags, setExpandedDesktopCopyrightTags] = useState(false);

    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
    const editPreviewTouchStartXRef = useRef(0);
    const editPreviewTouchStartYRef = useRef(0);
    const editPreviewDidSwipeRef = useRef(false);
    const lightboxImagePointerDownTimeRef = useRef(0);
    const lightboxImagePointerDownXRef = useRef(0);
    const lightboxImagePointerDownYRef = useRef(0);
    const lightboxImageDragPointerIdRef = useRef(null);
    const lightboxImageDragStartXRef = useRef(0);
    const lightboxImageDragStartYRef = useRef(0);
    const lightboxImageDragStartPanXRef = useRef(0);
    const lightboxImageDragStartPanYRef = useRef(0);
    const lightboxImageHasDraggedRef = useRef(false);
    const lightboxActivePointersRef = useRef(new Map());
    const lightboxPinchStartDistanceRef = useRef(0);
    const lightboxPinchStartScaleRef = useRef(LIGHTBOX_DEFAULT_ZOOM);
    const lightboxPinchActiveRef = useRef(false);
    const lightboxSuppressNextClickRef = useRef(false);
    const lightboxVideoRef = useRef(null);
    const detailVideoRef = useRef(null);
    const mediaChangeTimeoutRef = useRef(null);
    const actionToastTimeoutRef = useRef(null);

    const clampLightboxScale = (scale) =>
        Math.min(LIGHTBOX_MAX_ZOOM, Math.max(LIGHTBOX_MIN_ZOOM, Number(scale) || LIGHTBOX_MIN_ZOOM));

    const resetLightboxGestureState = () => {
        lightboxImagePointerDownTimeRef.current = 0;
        lightboxImageDragPointerIdRef.current = null;
        lightboxImageHasDraggedRef.current = false;
        lightboxActivePointersRef.current.clear();
        lightboxPinchStartDistanceRef.current = 0;
        lightboxPinchStartScaleRef.current = LIGHTBOX_DEFAULT_ZOOM;
        lightboxPinchActiveRef.current = false;
        lightboxSuppressNextClickRef.current = false;
        setIsLightboxImagePanning(false);
    };

    const resetLightboxImageTransform = () => {
        setIsLightboxImageZoomed(false);
        setLightboxImageScale(LIGHTBOX_MIN_ZOOM);
        setLightboxImagePan({ x: 0, y: 0 });
        resetLightboxGestureState();
    };

    const clearActionToastTimer = () => {
        if (actionToastTimeoutRef.current) {
            window.clearTimeout(actionToastTimeoutRef.current);
            actionToastTimeoutRef.current = null;
        }
    };

    const showActionToast = (nextToast, autoCloseMs = 0) => {
        clearActionToastTimer();
        setActionToast(nextToast);

        if (autoCloseMs > 0) {
            actionToastTimeoutRef.current = window.setTimeout(() => {
                setActionToast(null);
                actionToastTimeoutRef.current = null;
            }, autoCloseMs);
        }
    };

    const hideActionToast = () => {
        clearActionToastTimer();
        setActionToast(null);
    };

    useEffect(
        () => () => {
            if (actionToastTimeoutRef.current) {
                window.clearTimeout(actionToastTimeoutRef.current);
                actionToastTimeoutRef.current = null;
            }
        },
        [],
    );

    const activeTagFilter = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("tag")?.trim() || "";
    }, [location.search]);

    const activeAuthorFilter = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("author")?.trim() || "";
    }, [location.search]);

    useEffect(() => {
        if (!user || user.type === "admin") {
            return;
        }

        const stateItems = location.state?.mediaItems;
        if (Array.isArray(stateItems) && stateItems.length > 0) {
            setMediaItems(stateItems);
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadMediaList = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetchWithAuth(`${API_URL}/media?limit=200`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Could not load media list");
                }

                if (!cancelled) {
                    setMediaItems(Array.isArray(data.data) ? data.data : []);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load media list");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadMediaList();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, user, location.state]);

    useEffect(() => {
        const scrollToTop = () => {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;

            const shellContent = document.querySelector(".tagged-shell-content");
            if (shellContent instanceof HTMLElement) {
                shellContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
            }
        };

        // Run immediately and once more after paint to catch mobile layout shifts.
        scrollToTop();
        const frame = window.requestAnimationFrame(scrollToTop);

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [mediaId]);

    useEffect(() => {
        setExpandedDefaultTags(false);
        setExpandedCopyrightTags(false);
        setMediaFit(null);
        setExpandedDesktopDefaultTags(false);
        setExpandedDesktopCopyrightTags(false);
    }, [mediaId]);

    useEffect(() => {
        if (mediaChangeTimeoutRef.current) {
            window.clearTimeout(mediaChangeTimeoutRef.current);
        }

        setIsMediaChanging(true);

        mediaChangeTimeoutRef.current = window.setTimeout(() => {
            setIsMediaChanging(false);
            mediaChangeTimeoutRef.current = null;
        }, MEDIA_SWITCH_ANIMATION_MS);

        return () => {
            if (mediaChangeTimeoutRef.current) {
                window.clearTimeout(mediaChangeTimeoutRef.current);
                mediaChangeTimeoutRef.current = null;
            }
        };
    }, [mediaId]);

    useEffect(() => {
        if (!isLightboxOpen) {
            resetLightboxImageTransform();
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setIsLightboxOpen(false);
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isLightboxOpen]);

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        const className = "tagged-lightbox-open";

        if (isLightboxOpen) {
            document.body.classList.add(className);
        } else {
            document.body.classList.remove(className);
        }

        return () => {
            document.body.classList.remove(className);
        };
    }, [isLightboxOpen]);

    useEffect(() => {
        resetLightboxImageTransform();
    }, [mediaId]);

    const computeAndSetFit = () => {
        setMediaFit("blur");
    };

    const handleImageLoad = (event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (!naturalWidth || !naturalHeight) {
            setMediaFit("blur");
            return;
        }
        computeAndSetFit();
    };

    const handleVideoMetadata = (event) => {
        const { videoWidth, videoHeight } = event.currentTarget;
        if (!videoWidth || !videoHeight) {
            setMediaFit("blur");
            return;
        }
        computeAndSetFit();
    };

    const resetDetailVideoPreview = () => {
        const video = detailVideoRef.current;

        if (!video) {
            return;
        }

        video.pause();
        video.muted = true;
        video.currentTime = 0;
        video.load();
        setIsDetailVideoPlaying(false);
    };

    const playDetailVideoPreview = async ({ withAudio = false } = {}) => {
        if (!viewerIsVideo) {
            return;
        }

        const video = detailVideoRef.current;

        if (!video) {
            return;
        }

        try {
            video.muted = !withAudio;
            video.volume = withAudio ? 1 : 0;
            video.controls = false;
            video.currentTime = 0;

            const playPromise = video.play();

            if (playPromise && typeof playPromise.then === "function") {
                await playPromise;
            }
            setIsDetailVideoPlaying(true);
        } catch {
            // Ignore hover preview playback failures.
            setIsDetailVideoPlaying(false);
        }
    };

    const handleDetailPreviewMouseEnter = () => {
        if (mediaDetailAutoplay) {
            return;
        }
        void playDetailVideoPreview({ withAudio: false });
    };

    const handleDetailPreviewMouseLeave = () => {
        if (mediaDetailAutoplay) {
            return;
        }
        resetDetailVideoPreview();
    };

    const filteredMediaItems = useMemo(() => {
        const normalizedTagFilter = activeTagFilter.toLowerCase();
        const normalizedAuthorFilter = activeAuthorFilter.toLowerCase();

        return mediaItems.filter((media) => {
            if (normalizedAuthorFilter) {
                const mediaAuthor = String(media.author || "").toLowerCase();

                if (mediaAuthor !== normalizedAuthorFilter) {
                    return false;
                }
            }

            if (!normalizedTagFilter) {
                return true;
            }

            const candidates = media.tags || media.tag_names || media.mediaTags || media.relatedTags || [];

            if (!Array.isArray(candidates)) {
                return false;
            }

            return candidates.some((tag) => {
                if (typeof tag === "string") {
                    return tag.toLowerCase() === normalizedTagFilter;
                }

                const tagName = String(tag.tagname || tag.name || "").toLowerCase();
                return tagName === normalizedTagFilter;
            });
        });
    }, [mediaItems, activeTagFilter, activeAuthorFilter]);

    const currentIndex = useMemo(
        () => filteredMediaItems.findIndex((item) => String(item.id) === String(mediaId)),
        [filteredMediaItems, mediaId],
    );

    const currentMedia = currentIndex >= 0 ? filteredMediaItems[currentIndex] : null;
    const mediaUrl = currentMedia ? getMediaUrl(currentMedia) : "";
    const thumbnailUrl = currentMedia ? getThumbnailUrl(currentMedia) : "";
    const isVideo = String(currentMedia?.mediatype || "")
        .toLowerCase()
        .includes("video");
    const hasSeparateThumbnail = Boolean(thumbnailUrl) && thumbnailUrl !== mediaUrl;
    const shouldUseOriginalInViewer = isVideo || isOriginalLoaded || !hasSeparateThumbnail;
    const viewerUrl = shouldUseOriginalInViewer ? mediaUrl : thumbnailUrl;
    const viewerIsVideo = isVideo && shouldUseOriginalInViewer;
    const viewerBlurBackgroundUrl = viewerIsVideo ? thumbnailUrl || mediaUrl || "" : viewerUrl;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < filteredMediaItems.length - 1;
    const shouldShowCounter = filteredMediaItems.length > 1;
    const shouldShowDesktopSidePreviews = filteredMediaItems.length >= 3;
    const previousMedia = hasPrevious ? filteredMediaItems[currentIndex - 1] : null;
    const nextMedia = hasNext ? filteredMediaItems[currentIndex + 1] : null;
    const previousIsVideo = String(previousMedia?.mediatype || "")
        .toLowerCase()
        .includes("video");
    const nextIsVideo = String(nextMedia?.mediatype || "")
        .toLowerCase()
        .includes("video");
    const previousPreviewUrl = previousMedia ? getMediaUrl(previousMedia) || getThumbnailUrl(previousMedia) : "";
    const nextPreviewUrl = nextMedia ? getMediaUrl(nextMedia) || getThumbnailUrl(nextMedia) : "";
    const previousPreviewPosterUrl = previousMedia ? getThumbnailUrl(previousMedia) : "";
    const nextPreviewPosterUrl = nextMedia ? getThumbnailUrl(nextMedia) : "";

    useEffect(() => {
        setIsOriginalLoaded(false);
    }, [mediaId]);

    useEffect(() => {
        if (!viewerUrl || viewerIsVideo) {
            return;
        }

        let isCancelled = false;
        const image = new Image();

        image.onload = () => {
            if (isCancelled || !image.naturalWidth || !image.naturalHeight) {
                return;
            }

            computeAndSetFit();
        };

        image.onerror = () => {
            if (!isCancelled) {
                setMediaFit("blur");
            }
        };

        image.src = viewerUrl;

        return () => {
            isCancelled = true;
        };
    }, [viewerUrl, viewerIsVideo, mediaId]);

    useEffect(() => {
        const handleAutoplayChange = (event) => {
            const enabled = Boolean(event?.detail?.enabled);
            setMediaDetailAutoplay(enabled);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY, enabled ? "true" : "false");
            }
            if (enabled && viewerIsVideo) {
                void playDetailVideoPreview({ withAudio: true });
            } else if (!enabled && viewerIsVideo) {
                resetDetailVideoPreview();
            }
        };

        window.addEventListener(MEDIA_DETAIL_AUTOPLAY_EVENT, handleAutoplayChange);

        return () => {
            window.removeEventListener(MEDIA_DETAIL_AUTOPLAY_EVENT, handleAutoplayChange);
        };
    }, [viewerIsVideo]);

    useEffect(() => {
        if (!viewerIsVideo) {
            setIsDetailVideoPlaying(false);
            return;
        }

        if (mediaDetailAutoplay) {
            void playDetailVideoPreview({ withAudio: true });
            return;
        }

        resetDetailVideoPreview();
    }, [viewerIsVideo, viewerUrl, mediaDetailAutoplay]);

    useEffect(() => {
        if (!isLightboxOpen || !isVideo) {
            return;
        }

        const video = lightboxVideoRef.current;

        if (!video) {
            return;
        }

        const playPromise = video.play();

        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
                // Ignore autoplay rejections on restrictive browsers.
            });
        }
    }, [isLightboxOpen, isVideo, mediaId]);

    const goToMediaAtIndex = (targetIndex) => {
        if (targetIndex < 0 || targetIndex >= filteredMediaItems.length) {
            return;
        }

        const targetMedia = filteredMediaItems[targetIndex];

        if (!targetMedia?.id) {
            return;
        }

        navigate(`/gallery/${targetMedia.id}${location.search || ""}`, {
            replace: true,
            state: {
                mediaItems: filteredMediaItems,
            },
        });
    };

    const handlePrevMedia = () => {
        goToMediaAtIndex(currentIndex - 1);
    };

    const handleNextMedia = () => {
        goToMediaAtIndex(currentIndex + 1);
    };

    const handleToggleFavourite = async () => {
        if (!currentMedia?.id || isTogglingFavourite) {
            return;
        }

        setIsTogglingFavourite(true);

        try {
            const response = await fetchWithAuth(`${API_URL}/media/${currentMedia.id}/toggle-favourite`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok || !data.success || !data.data) {
                throw new Error(data.message || "Could not update favourite");
            }

            setMediaItems((previous) =>
                previous.map((item) => (item.id === currentMedia.id ? { ...item, ...data.data } : item)),
            );
        } catch (toggleError) {
            setError(toggleError.message || "Could not update favourite");
        } finally {
            setIsTogglingFavourite(false);
        }
    };

    const openDeleteCurrentMediaConfirm = () => {
        if (!currentMedia?.id || isDeletingMedia) {
            return;
        }

        setIsDeleteConfirmOpen(true);
    };

    const closeDeleteCurrentMediaConfirm = () => {
        if (isDeletingMedia) {
            return;
        }

        setIsDeleteConfirmOpen(false);
    };

    const handleDeleteCurrentMedia = async () => {
        if (!currentMedia?.id || isDeletingMedia) {
            return;
        }
        const deletedMediaLabel = String(currentMedia.displayname || currentMedia.filename || "media").trim();

        try {
            setError(null);
            setIsDeleteConfirmOpen(false);
            setIsDeletingMedia(true);

            const response = await fetchWithAuth(`${API_URL}/media`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ids: [currentMedia.id] }),
            });

            const data = await parseApiResponse(response, "Could not delete media");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not delete media");
            }

            const remainingMediaItems = filteredMediaItems.filter(
                (item) => String(item.id) !== String(currentMedia.id),
            );

            setMediaItems(remainingMediaItems);
            showActionToast(
                {
                    status: "success",
                    title: "Media deleted",
                    message: `${deletedMediaLabel} was deleted successfully.`,
                },
                3200,
            );

            if (remainingMediaItems.length === 0) {
                navigate(`/gallery${location.search || ""}`, {
                    replace: true,
                });
                return;
            }

            const nextIndex = Math.min(currentIndex, remainingMediaItems.length - 1);
            const nextMedia = remainingMediaItems[nextIndex];

            navigate(`/gallery/${nextMedia.id}${location.search || ""}`, {
                replace: true,
                state: {
                    mediaItems: remainingMediaItems,
                },
            });
        } catch (requestError) {
            showActionToast(
                {
                    status: "error",
                    title: "Delete failed",
                    message: requestError.message || "Could not delete media",
                },
                4200,
            );
        } finally {
            setIsDeletingMedia(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && isDeleteConfirmOpen) {
                event.preventDefault();
                closeDeleteCurrentMediaConfirm();
                return;
            }

            if (event.key === "ArrowLeft" && hasPrevious) {
                event.preventDefault();
                handlePrevMedia();
                return;
            }

            if (event.key === "ArrowRight" && hasNext) {
                event.preventDefault();
                handleNextMedia();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [hasPrevious, hasNext, currentIndex, filteredMediaItems, isDeleteConfirmOpen]);

    const handleTouchStart = (event) => {
        touchStartXRef.current = event.changedTouches[0]?.clientX || 0;
        touchStartYRef.current = event.changedTouches[0]?.clientY || 0;
    };

    const handleTouchEnd = (event) => {
        const touchEndY = event.changedTouches[0]?.clientY || 0;
        const touchEndX = event.changedTouches[0]?.clientX || 0;
        const deltaX = touchEndX - touchStartXRef.current;
        const deltaY = touchEndY - touchStartYRef.current;
        const swipeThreshold = 65;

        if (Math.abs(deltaX) <= Math.abs(deltaY)) {
            return;
        }

        if (Math.abs(deltaX) < swipeThreshold) {
            return;
        }

        if (deltaX > 0 && hasPrevious) {
            handlePrevMedia();
            return;
        }

        if (deltaX < 0 && hasNext) {
            handleNextMedia();
            return;
        }
    };

    const handleEditPreviewTouchStart = (event) => {
        editPreviewTouchStartXRef.current = event.changedTouches[0]?.clientX || 0;
        editPreviewTouchStartYRef.current = event.changedTouches[0]?.clientY || 0;
        editPreviewDidSwipeRef.current = false;
    };

    const handleEditPreviewTouchEnd = (event) => {
        const touchEndY = event.changedTouches[0]?.clientY || 0;
        const touchEndX = event.changedTouches[0]?.clientX || 0;
        const deltaX = touchEndX - editPreviewTouchStartXRef.current;
        const deltaY = touchEndY - editPreviewTouchStartYRef.current;
        const swipeThreshold = 48;

        if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < swipeThreshold) {
            return;
        }

        if (deltaX > 0 && hasPrevious) {
            editPreviewDidSwipeRef.current = true;
            handlePrevMedia();
            return;
        }

        if (deltaX < 0 && hasNext) {
            editPreviewDidSwipeRef.current = true;
            handleNextMedia();
        }
    };

    const handleEditPreviewClick = () => {
        if (editPreviewDidSwipeRef.current) {
            editPreviewDidSwipeRef.current = false;
            return;
        }

        setIsEditPreviewLightboxOpen(true);
    };

    const handleOpenLightbox = () => {
        if (!currentMedia) {
            return;
        }

        if (!shouldUseOriginalInViewer && hasSeparateThumbnail) {
            setIsOriginalLoaded(true);
        }

        if (isVideo) {
            resetDetailVideoPreview();
        }

        setIsLightboxOpen(true);
    };

    const handleFilterByTag = (rawTag) => {
        const selectedTag = String(rawTag || "").trim();

        if (!selectedTag) {
            return;
        }

        navigate(`/gallery?tag=${encodeURIComponent(selectedTag)}`);
    };

    const handleFilterByAuthor = (rawAuthor) => {
        const selectedAuthor = String(rawAuthor || "").trim();

        if (!selectedAuthor) {
            return;
        }

        navigate(`/gallery?author=${encodeURIComponent(selectedAuthor)}`);
    };

    const handleDownloadMedia = async () => {
        if (!mediaUrl || !currentMedia) {
            return;
        }

        const inferredExtension = isVideo ? ".mp4" : "";
        const filename = String(
            currentMedia.filename || currentMedia.displayname || `media${inferredExtension}`,
        ).trim();

        const userAgent = navigator.userAgent || "";
        const platform = navigator.platform || "";
        const isIOSDevice =
            /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);

        if (isIOSDevice && isVideo) {
            if (typeof navigator.share === "function") {
                try {
                    const response = await fetch(mediaUrl);

                    if (response.ok) {
                        const blob = await response.blob();
                        const fileType = blob.type || "video/mp4";
                        const shareFile = new File([blob], filename, { type: fileType });

                        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [shareFile] })) {
                            await navigator.share({ files: [shareFile], title: filename });
                            return;
                        }
                    }
                } catch {
                    // Fall through to URL share/open for browsers that block file sharing.
                }

                try {
                    await navigator.share({ title: filename, url: mediaUrl });
                    return;
                } catch {
                    // Fall through to opening the media URL.
                }
            }

            window.open(mediaUrl, "_blank", "noopener,noreferrer");
            return;
        }

        const tempLink = document.createElement("a");
        tempLink.href = mediaUrl;
        tempLink.download = filename || true;
        tempLink.rel = "noopener noreferrer";
        document.body.appendChild(tempLink);
        tempLink.click();
        tempLink.remove();
    };

    const handleCloseLightbox = () => {
        const video = lightboxVideoRef.current;

        if (video) {
            video.pause();
            video.currentTime = 0;
        }

        resetLightboxImageTransform();
        setIsLightboxOpen(false);
        resetDetailVideoPreview();
    };

    const toggleLightboxImageZoom = () => {
        if (isVideo) {
            return;
        }

        setIsLightboxImageZoomed((previous) => {
            const next = !previous;

            if (!next) {
                setLightboxImageScale(LIGHTBOX_MIN_ZOOM);
                setLightboxImagePan({ x: 0, y: 0 });
                setIsLightboxImagePanning(false);
                resetLightboxGestureState();
            } else {
                setLightboxImageScale(LIGHTBOX_DEFAULT_ZOOM);
            }

            return next;
        });
    };

    const handleLightboxImageWheel = (event) => {
        if (isVideo) {
            return;
        }

        if (typeof window === "undefined") {
            return;
        }

        const isDesktopPointer = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;

        if (!isDesktopPointer) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const direction = event.deltaY > 0 ? -1 : 1;
        const zoomStep = event.altKey ? 0.08 : 0.14;

        setLightboxImageScale((previousScale) => {
            const currentScale = isLightboxImageZoomed ? Number(previousScale) || LIGHTBOX_MIN_ZOOM : LIGHTBOX_MIN_ZOOM;
            const nextScale = clampLightboxScale(currentScale + direction * zoomStep);

            if (nextScale <= LIGHTBOX_MIN_ZOOM + 0.01) {
                setLightboxImagePan({ x: 0, y: 0 });
                setIsLightboxImagePanning(false);
                return LIGHTBOX_MIN_ZOOM;
            }

            setIsLightboxImageZoomed(true);
            return nextScale;
        });
    };

    const handleLightboxImageClick = (event) => {
        event.stopPropagation();

        if (isVideo) {
            return;
        }

        if (typeof window === "undefined") {
            return;
        }

        const isDesktopPointer = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;

        if (!isDesktopPointer) {
            return;
        }

        if (lightboxSuppressNextClickRef.current) {
            lightboxSuppressNextClickRef.current = false;
            return;
        }

        if (!isLightboxImagePanning) {
            toggleLightboxImageZoom();
        }
    };

    const handleLightboxImagePointerDown = (event) => {
        if (isVideo) {
            return;
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        lightboxActivePointersRef.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });

        lightboxImagePointerDownTimeRef.current = Date.now();
        lightboxImagePointerDownXRef.current = event.clientX;
        lightboxImagePointerDownYRef.current = event.clientY;
        lightboxImageHasDraggedRef.current = false;

        if (lightboxActivePointersRef.current.size === 2) {
            const pointerValues = Array.from(lightboxActivePointersRef.current.values());
            const [firstPointer, secondPointer] = pointerValues;
            lightboxPinchStartDistanceRef.current = Math.hypot(
                secondPointer.x - firstPointer.x,
                secondPointer.y - firstPointer.y,
            );
            lightboxPinchStartScaleRef.current = lightboxImageScale;
            lightboxPinchActiveRef.current = true;
            lightboxImageHasDraggedRef.current = true;
            lightboxSuppressNextClickRef.current = true;
            lightboxImageDragPointerIdRef.current = null;
            setIsLightboxImagePanning(true);
            return;
        }

        if (!isLightboxImageZoomed) {
            return;
        }

        lightboxImageDragPointerIdRef.current = event.pointerId;
        lightboxImageDragStartXRef.current = event.clientX;
        lightboxImageDragStartYRef.current = event.clientY;
        lightboxImageDragStartPanXRef.current = lightboxImagePan.x;
        lightboxImageDragStartPanYRef.current = lightboxImagePan.y;
        lightboxImageHasDraggedRef.current = false;

        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Ignore capture failures on some browsers.
        }
    };

    const handleLightboxImagePointerMove = (event) => {
        if (isVideo) {
            return;
        }

        if (!lightboxActivePointersRef.current.has(event.pointerId)) {
            return;
        }

        lightboxActivePointersRef.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
        });

        if (lightboxActivePointersRef.current.size >= 2) {
            const pointerValues = Array.from(lightboxActivePointersRef.current.values());
            const [firstPointer, secondPointer] = pointerValues;
            const distance = Math.hypot(secondPointer.x - firstPointer.x, secondPointer.y - firstPointer.y);

            if (lightboxPinchStartDistanceRef.current > 0) {
                const nextScale = clampLightboxScale(
                    lightboxPinchStartScaleRef.current * (distance / lightboxPinchStartDistanceRef.current),
                );

                setLightboxImageScale(nextScale);

                if (nextScale <= LIGHTBOX_MIN_ZOOM + 0.01) {
                    setIsLightboxImageZoomed(false);
                    setLightboxImagePan({ x: 0, y: 0 });
                } else {
                    setIsLightboxImageZoomed(true);
                }

                lightboxImageHasDraggedRef.current = true;
            }

            event.preventDefault();
            return;
        }

        if (!isLightboxImageZoomed || lightboxImageDragPointerIdRef.current !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - lightboxImageDragStartXRef.current;
        const deltaY = event.clientY - lightboxImageDragStartYRef.current;

        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            lightboxImageHasDraggedRef.current = true;
            lightboxSuppressNextClickRef.current = true;
            setIsLightboxImagePanning(true);
        }

        setLightboxImagePan({
            x: lightboxImageDragStartPanXRef.current + deltaX,
            y: lightboxImageDragStartPanYRef.current + deltaY,
        });

        event.preventDefault();
    };

    const handleLightboxImagePointerCancel = (event) => {
        lightboxActivePointersRef.current.delete(event.pointerId);

        if (lightboxActivePointersRef.current.size < 2) {
            lightboxPinchActiveRef.current = false;
            lightboxPinchStartDistanceRef.current = 0;
            lightboxPinchStartScaleRef.current = lightboxImageScale;
        }

        if (lightboxImageDragPointerIdRef.current !== event.pointerId) {
            return;
        }

        lightboxImageDragPointerIdRef.current = null;
        lightboxImageHasDraggedRef.current = false;
        setIsLightboxImagePanning(false);
    };

    const handleLightboxImagePointerUp = (event) => {
        if (isVideo) {
            return;
        }

        lightboxActivePointersRef.current.delete(event.pointerId);

        if (lightboxImageDragPointerIdRef.current === event.pointerId) {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                // Ignore release failures on browsers that do not support it well.
            }

            lightboxImageDragPointerIdRef.current = null;
            setIsLightboxImagePanning(false);

            if (lightboxImageHasDraggedRef.current) {
                lightboxImageHasDraggedRef.current = false;
                lightboxSuppressNextClickRef.current = true;
                lightboxImagePointerDownTimeRef.current = 0;
                return;
            }
        }

        if (lightboxActivePointersRef.current.size === 1 && isLightboxImageZoomed) {
            const remainingEntry = Array.from(lightboxActivePointersRef.current.entries())[0];

            if (remainingEntry) {
                const [remainingPointerId, remainingPointer] = remainingEntry;
                lightboxImageDragPointerIdRef.current = remainingPointerId;
                lightboxImageDragStartXRef.current = remainingPointer.x;
                lightboxImageDragStartYRef.current = remainingPointer.y;
                lightboxImageDragStartPanXRef.current = lightboxImagePan.x;
                lightboxImageDragStartPanYRef.current = lightboxImagePan.y;
                lightboxImageHasDraggedRef.current = false;
            }
        }

        if (lightboxActivePointersRef.current.size < 2) {
            lightboxPinchActiveRef.current = false;
            lightboxPinchStartDistanceRef.current = 0;
            lightboxPinchStartScaleRef.current = lightboxImageScale;
        }

        const tapDurationMs = Date.now() - lightboxImagePointerDownTimeRef.current;
        const deltaX = Math.abs(event.clientX - lightboxImagePointerDownXRef.current);
        const deltaY = Math.abs(event.clientY - lightboxImagePointerDownYRef.current);
        const maxTapDurationMs = 260;
        const tapMoveThreshold = 18;

        const isSingleTap =
            lightboxImagePointerDownTimeRef.current > 0 &&
            tapDurationMs <= maxTapDurationMs &&
            deltaX <= tapMoveThreshold &&
            deltaY <= tapMoveThreshold &&
            !lightboxPinchActiveRef.current &&
            !lightboxImageHasDraggedRef.current &&
            event.pointerType !== "mouse";

        lightboxImagePointerDownTimeRef.current = 0;
        lightboxImageHasDraggedRef.current = false;

        if (!isSingleTap) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        toggleLightboxImageZoom();
        lightboxImagePointerDownTimeRef.current = 0;
    };

    const visibleEditDisplayNameSuggestions = useMemo(() => {
        const currentInput = editDisplayNameInput.trim().toLowerCase();

        return editDistinctDisplayNames
            .filter((value) => {
                const normalized = String(value || "").toLowerCase();

                if (!normalized) {
                    return false;
                }

                if (!currentInput) {
                    return true;
                }

                return normalized.includes(currentInput);
            })
            .slice(0, MAX_SUGGESTIONS);
    }, [editDistinctDisplayNames, editDisplayNameInput]);

    const visibleEditAuthorSuggestions = useMemo(() => {
        const currentInput = editAuthorInput.trim().toLowerCase();

        return editDistinctAuthors
            .filter((value) => {
                const normalized = String(value || "").toLowerCase();

                if (!normalized) {
                    return false;
                }

                if (!currentInput) {
                    return true;
                }

                return normalized.includes(currentInput);
            })
            .slice(0, MAX_SUGGESTIONS);
    }, [editDistinctAuthors, editAuthorInput]);

    const visibleEditTagSuggestions = useMemo(() => {
        const currentInput = editTagInput.trim().toLowerCase();
        const selectedSet = new Set(editSelectedTags.map((tag) => tag.toLowerCase()));

        return editDistinctTagNames
            .filter((tagName) => {
                const normalized = String(tagName || "").toLowerCase();

                if (!normalized || selectedSet.has(normalized)) {
                    return false;
                }

                if (!currentInput) {
                    return true;
                }

                return normalized.includes(currentInput);
            })
            .slice(0, MAX_SUGGESTIONS);
    }, [editDistinctTagNames, editSelectedTags, editTagInput]);

    useEffect(() => {
        const activeSuggestions =
            editActiveSuggestionField === "displayname"
                ? visibleEditDisplayNameSuggestions
                : editActiveSuggestionField === "author"
                  ? visibleEditAuthorSuggestions
                  : editActiveSuggestionField === "tag"
                    ? visibleEditTagSuggestions
                    : [];

        if (activeSuggestions.length === 0) {
            setEditActiveSuggestionIndex(0);
            return;
        }

        setEditActiveSuggestionIndex((previous) => {
            if (previous < 0) {
                return 0;
            }

            if (previous >= activeSuggestions.length) {
                return activeSuggestions.length - 1;
            }

            return previous;
        });
    }, [
        editActiveSuggestionField,
        visibleEditDisplayNameSuggestions,
        visibleEditAuthorSuggestions,
        visibleEditTagSuggestions,
    ]);

    useEffect(() => {
        if (!isEditModalOpen || !user || user.type === "admin") {
            return;
        }

        let cancelled = false;

        const loadDistinctData = async () => {
            try {
                const [displayNamesResponse, authorsResponse, tagsResponse] = await Promise.all([
                    fetchWithAuth(`${API_URL}/media/displaynames`, { method: "GET" }),
                    fetchWithAuth(`${API_URL}/media/authors`, { method: "GET" }),
                    fetchWithAuth(`${API_URL}/tags`, { method: "GET" }),
                ]);

                const [displayNamesData, authorsData, tagsData] = await Promise.all([
                    displayNamesResponse.json(),
                    authorsResponse.json(),
                    tagsResponse.json(),
                ]);

                if (cancelled) {
                    return;
                }

                setEditDistinctDisplayNames(
                    displayNamesResponse.ok && displayNamesData.success && Array.isArray(displayNamesData.data)
                        ? displayNamesData.data.filter(Boolean)
                        : [],
                );

                setEditDistinctAuthors(
                    authorsResponse.ok && authorsData.success && Array.isArray(authorsData.data)
                        ? authorsData.data.filter(Boolean)
                        : [],
                );

                if (tagsResponse.ok && tagsData.success && Array.isArray(tagsData.data)) {
                    const validTags = tagsData.data.filter(
                        (item) => item && typeof item.tagname === "string" && item.tagname.trim(),
                    );

                    setEditDistinctTagNames(validTags.map((item) => item.tagname.trim()));
                    setEditTagColorByName(
                        validTags.reduce((accumulator, item) => {
                            const key = String(item.tagname).trim().toLowerCase();

                            if (!key) {
                                return accumulator;
                            }

                            return {
                                ...accumulator,
                                [key]: normalizeHexColor(item.tagcolor_hex),
                            };
                        }, {}),
                    );
                } else {
                    setEditDistinctTagNames([]);
                    setEditTagColorByName({});
                }
            } catch {
                if (!cancelled) {
                    setEditDistinctDisplayNames([]);
                    setEditDistinctAuthors([]);
                    setEditDistinctTagNames([]);
                    setEditTagColorByName({});
                }
            }
        };

        loadDistinctData();

        return () => {
            cancelled = true;
        };
    }, [isEditModalOpen, fetchWithAuth, user]);

    useEffect(() => {
        if (!isEditModalOpen) {
            return undefined;
        }

        const handleEditModalKeyDown = (event) => {
            if (event.key === "Escape" && !isSavingEdit) {
                setIsEditModalOpen(false);
            }
        };

        window.addEventListener("keydown", handleEditModalKeyDown);

        return () => {
            window.removeEventListener("keydown", handleEditModalKeyDown);
        };
    }, [isEditModalOpen, isSavingEdit]);

    useEffect(() => {
        if (!isEditModalOpen || !currentMedia?.id || isSavingEdit) {
            return;
        }

        const currentTags = Array.from(
            new Set(
                normalizeTags(currentMedia)
                    .map((tag) => String(tag?.tagname || "").trim())
                    .filter(Boolean),
            ),
        );

        setEditDisplayNameInput(String(currentMedia.displayname || ""));
        setEditAuthorInput(String(currentMedia.author || ""));
        setEditTagInput("");
        setEditSelectedTags(currentTags);
        setEditError(null);
        setIsEditPreviewLightboxOpen(false);
        setEditActiveSuggestionField(null);
        setEditActiveSuggestionIndex(0);
    }, [isEditModalOpen, isSavingEdit, currentMedia?.id]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        try {
            window.localStorage.setItem(EDIT_MODAL_CLOSE_ON_SAVE_STORAGE_KEY, closeEditModalOnSave ? "true" : "false");
        } catch {
            // Ignore storage failures in private mode or restricted browsers.
        }
    }, [closeEditModalOnSave]);

    if (user?.type === "admin") {
        return (
            <section className="tagged-app-page tagged-media-detail-page">
                <article className="tagged-app-page-card tagged-media-detail-message-card">
                    <h2>Media detail is not available for admin</h2>
                    <p>Please log in with a regular user account to browse media files.</p>
                </article>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="tagged-app-page tagged-media-detail-page">
                <article
                    className="tagged-app-page-card tagged-media-detail-empty-card tagged-media-detail-empty-card--loading"
                    aria-live="polite"
                >
                    <h2>Loading media</h2>
                    <p>Fetching your media library.</p>
                    <span className="tagged-media-detail-loading-spinner" aria-hidden="true" />
                </article>
            </section>
        );
    }

    if (error) {
        return (
            <section className="tagged-app-page tagged-media-detail-page">
                <article className="tagged-app-page-card tagged-media-detail-message-card" aria-live="assertive">
                    <h2>Could not load media</h2>
                    <p>{error}</p>
                </article>
            </section>
        );
    }

    if (!currentMedia) {
        return (
            <section className="tagged-app-page tagged-media-detail-page">
                <article className="tagged-app-page-card tagged-media-detail-message-card">
                    <h2>Media not found</h2>
                    <p>The selected media does not exist in your gallery.</p>
                </article>
            </section>
        );
    }

    const isFavourite = currentMedia.is_favourite === 1 || currentMedia.is_favourite === true;
    const authorLabel = String(currentMedia.author || "").trim() || "Unknown";
    const hasKnownAuthor = authorLabel.toLowerCase() !== "unknown";
    const allTags = normalizeTags(currentMedia);
    const defaultTags = allTags.filter((tag) => String(tag.type).toLowerCase() === "default");
    const copyrightTags = allTags.filter((tag) => String(tag.type).toLowerCase() === "copyright");
    const desktopDefaultTags = expandedDesktopDefaultTags
        ? defaultTags
        : defaultTags.slice(0, DESKTOP_DEFAULT_TAG_LIMIT);
    const desktopCopyrightTags = expandedDesktopCopyrightTags
        ? copyrightTags
        : copyrightTags.slice(0, DESKTOP_COPYRIGHT_TAG_LIMIT);
    const hiddenDesktopDefaultTags = Math.max(0, defaultTags.length - DESKTOP_DEFAULT_TAG_LIMIT);
    const hiddenDesktopCopyrightTags = Math.max(0, copyrightTags.length - DESKTOP_COPYRIGHT_TAG_LIMIT);
    const editPreviewPosterPath = currentMedia.thumbpath || "";
    const editPreviewMediaPath = currentMedia.filepath || "";
    const editPreviewPosterUrl = editPreviewPosterPath
        ? editPreviewPosterPath.startsWith("http://") || editPreviewPosterPath.startsWith("https://")
            ? editPreviewPosterPath
            : `${UPLOADS_BASE_URL}${editPreviewPosterPath}`
        : "";
    const editPreviewMediaUrl = editPreviewMediaPath
        ? editPreviewMediaPath.startsWith("http://") || editPreviewMediaPath.startsWith("https://")
            ? editPreviewMediaPath
            : `${UPLOADS_BASE_URL}${editPreviewMediaPath}`
        : "";
    const isEditPreviewVideo = isVideo && Boolean(editPreviewMediaUrl);
    const editPreviewUrl = isEditPreviewVideo
        ? editPreviewPosterUrl || editPreviewMediaUrl
        : editPreviewMediaUrl || editPreviewPosterUrl;

    const openEditSuggestions = (field) => {
        setEditActiveSuggestionField(field);
        setEditActiveSuggestionIndex(0);
    };

    const closeEditSuggestions = () => {
        setEditActiveSuggestionField(null);
        setEditActiveSuggestionIndex(0);
    };

    const openEditModal = () => {
        setEditDisplayNameInput(currentMedia.displayname || "");
        setEditAuthorInput(currentMedia.author || "");
        setEditTagInput("");
        setEditSelectedTags(Array.from(new Set(allTags.map((tag) => tag.tagname).filter(Boolean))));
        setEditError(null);
        setIsEditPreviewLightboxOpen(false);
        closeEditSuggestions();
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        if (isSavingEdit) {
            return;
        }

        setIsEditModalOpen(false);
        setIsEditPreviewLightboxOpen(false);
        setEditError(null);
        closeEditSuggestions();
    };

    const addEditTag = (rawTag) => {
        const trimmed = String(rawTag || "").trim();

        if (!trimmed) {
            return;
        }

        setEditSelectedTags((previous) => {
            const exists = previous.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());

            if (exists) {
                return previous;
            }

            return [...previous, trimmed];
        });

        setEditTagInput("");
        closeEditSuggestions();
    };

    const removeEditTag = (tagToRemove) => {
        setEditSelectedTags((previous) => previous.filter((tag) => tag !== tagToRemove));
    };

    const handleEditSuggestionKeyboard = (event, field, suggestions, onSelect, onEnterFallback = null) => {
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            if (event.key === "Enter" && onEnterFallback) {
                onEnterFallback();
                closeEditSuggestions();
            }

            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();

            if (editActiveSuggestionField !== field) {
                openEditSuggestions(field);
                return;
            }

            setEditActiveSuggestionIndex((previous) => (previous + 1) % suggestions.length);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();

            if (editActiveSuggestionField !== field) {
                openEditSuggestions(field);
                return;
            }

            setEditActiveSuggestionIndex((previous) => (previous - 1 + suggestions.length) % suggestions.length);
            return;
        }

        if (event.key === "Enter") {
            if (editActiveSuggestionField === field) {
                event.preventDefault();
                onSelect(suggestions[editActiveSuggestionIndex] || suggestions[0]);
                return;
            }

            if (onEnterFallback) {
                onEnterFallback();
            }

            return;
        }

        if (event.key === "Escape" && editActiveSuggestionField === field) {
            event.preventDefault();
            closeEditSuggestions();
        }
    };

    const handleEditMediaSubmit = async (event) => {
        event.preventDefault();

        if (!currentMedia?.id || isSavingEdit) {
            return;
        }

        try {
            setEditError(null);
            setIsSavingEdit(true);

            const response = await fetchWithAuth(`${API_URL}/media/${currentMedia.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    displayname: editDisplayNameInput.trim(),
                    author: editAuthorInput.trim(),
                    tag_names: JSON.stringify(editSelectedTags),
                }),
            });

            const data = await parseApiResponse(response, "Could not update media");

            if (!response.ok || !data.success || !data.data) {
                throw new Error(data.message || "Could not update media");
            }

            setMediaItems((previous) =>
                previous.map((item) =>
                    String(item.id) === String(currentMedia.id) ? { ...item, ...data.data } : item,
                ),
            );

            if (closeEditModalOnSave) {
                setIsEditModalOpen(false);
                setIsEditPreviewLightboxOpen(false);
                closeEditSuggestions();
            } else {
                setIsEditPreviewLightboxOpen(false);
                setEditTagInput("");
                closeEditSuggestions();
            }
            showActionToast(
                {
                    status: "success",
                    title: "Media updated",
                    message: "Changes saved successfully.",
                },
                3200,
            );
        } catch (requestError) {
            setEditError(requestError.message || "Could not update media");
            showActionToast(
                {
                    status: "error",
                    title: "Update failed",
                    message: requestError.message || "Could not update media",
                },
                4200,
            );
        } finally {
            setIsSavingEdit(false);
        }
    };

    return (
        <section className="tagged-app-page tagged-media-detail-page">
            {actionToast ? (
                <aside
                    className={`tagged-media-detail-toast tagged-media-detail-toast--${actionToast.status || "info"}`}
                    role={actionToast.status === "error" ? "alert" : "status"}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <header className="tagged-media-detail-toast-header">
                        <strong>{actionToast.title}</strong>
                        <button
                            type="button"
                            className="tagged-media-detail-toast-close"
                            onClick={hideActionToast}
                            aria-label="Close media action status"
                        >
                            ×
                        </button>
                    </header>
                    <p>{actionToast.message}</p>
                </aside>
            ) : null}

            <div className="tagged-media-detail-shell">
                <div
                    className="tagged-media-detail-media-column"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div
                        className="tagged-media-detail-viewer"
                        aria-label="Selected media preview"
                        onMouseEnter={handleDetailPreviewMouseEnter}
                        onMouseLeave={handleDetailPreviewMouseLeave}
                    >
                        {viewerBlurBackgroundUrl && mediaFit === "blur" && (
                            <div
                                className="tagged-media-detail-viewer-blur-bg"
                                style={{ backgroundImage: `url(${viewerBlurBackgroundUrl})` }}
                                aria-hidden="true"
                            />
                        )}

                        {viewerUrl ? (
                            viewerIsVideo ? (
                                <video
                                    ref={detailVideoRef}
                                    key={`viewer-video-${currentMedia.id}`}
                                    className={`tagged-media-detail-media${isMediaChanging ? " is-changing" : ""}`}
                                    src={viewerUrl}
                                    controls={false}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    poster={thumbnailUrl || undefined}
                                    onLoadedMetadata={handleVideoMetadata}
                                    onPlay={() => setIsDetailVideoPlaying(true)}
                                    onPause={() => setIsDetailVideoPlaying(false)}
                                    onEnded={() => setIsDetailVideoPlaying(false)}
                                    onMouseEnter={handleDetailPreviewMouseEnter}
                                    onMouseLeave={handleDetailPreviewMouseLeave}
                                    loop={true}
                                    style={{ objectFit: "contain" }}
                                />
                            ) : (
                                <img
                                    key={`viewer-image-${currentMedia.id}`}
                                    className={`tagged-media-detail-media${isMediaChanging ? " is-changing" : ""}`}
                                    src={viewerUrl}
                                    alt={currentMedia.displayname || currentMedia.filename || "Media"}
                                    onLoad={handleImageLoad}
                                    style={{ objectFit: "contain" }}
                                />
                            )
                        ) : (
                            <div className="tagged-media-detail-empty-preview">
                                <p>No preview available for this file.</p>
                            </div>
                        )}

                        {viewerUrl && (
                            <button
                                type="button"
                                className={`tagged-media-detail-viewer-hitbox${viewerIsVideo ? " is-video" : ""}`}
                                onClick={handleOpenLightbox}
                                aria-label="Open media in modal view"
                            />
                        )}

                        {isVideo && !isDetailVideoPlaying ? (
                            <span className="tagged-media-detail-play-badge" aria-hidden="true">
                                <svg viewBox="0 0 24 24" className="tagged-media-detail-play-icon" aria-hidden="true">
                                    <path d="M8 6.8v10.4c0 .8.9 1.3 1.6.9l8.5-5.2c.7-.4.7-1.4 0-1.8L9.6 5.9c-.7-.4-1.6.1-1.6.9Z" />
                                </svg>
                            </span>
                        ) : null}

                        <div className="tagged-media-detail-desktop-overlay">
                            <div className="tagged-media-detail-desktop-top">
                                <div className="tagged-media-detail-desktop-top-main">
                                    <button
                                        type="button"
                                        className="tagged-media-detail-desktop-author tagged-media-detail-desktop-author-button"
                                        onClick={() => handleFilterByAuthor(currentMedia.author)}
                                        aria-label={`Filter gallery by author ${authorLabel}`}
                                        disabled={!currentMedia.author}
                                    >
                                        {authorLabel}
                                    </button>
                                    <span className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag--meta">
                                        {formatMediaSize(currentMedia.size)}
                                    </span>
                                </div>
                                <div className="tagged-media-detail-desktop-top-right">
                                    <div className="tagged-media-detail-actions tagged-media-detail-actions--desktop">
                                        <button
                                            type="button"
                                            className="tagged-media-detail-action tagged-media-detail-action--edit tagged-media-detail-action--icon tagged-media-detail-action--favourite"
                                            onClick={handleToggleFavourite}
                                            aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                                            aria-pressed={isFavourite}
                                            disabled={isTogglingFavourite}
                                            title={isFavourite ? "Remove from favourites" : "Add to favourites"}
                                        >
                                            <FavouriteIcon active={isFavourite} />
                                        </button>

                                        <button
                                            type="button"
                                            className="tagged-media-detail-action tagged-media-detail-action--edit tagged-media-detail-action--icon"
                                            onClick={openEditModal}
                                            aria-label="Edit media"
                                            title="Edit media"
                                        >
                                            <img src="/icons/edit.svg" alt="" aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className="tagged-media-detail-action tagged-media-detail-action--delete tagged-media-detail-action--icon"
                                            onClick={openDeleteCurrentMediaConfirm}
                                            aria-label="Delete media"
                                            title="Delete media"
                                            disabled={isDeletingMedia}
                                        >
                                            <img src="/icons/delete.svg" alt="" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="tagged-media-detail-desktop-bottom">
                                <h1 title={currentMedia.displayname}>{currentMedia.displayname || "Undefined"}</h1>
                                <p className="tagged-media-detail-upload-date">
                                    {formatUploadDate(currentMedia.updatedAt)}
                                </p>

                                {desktopCopyrightTags.length > 0 ? (
                                    <div className="tagged-media-detail-desktop-tag-row" aria-label="Copyright tags">
                                        {desktopCopyrightTags.map((tag) => (
                                            <button
                                                type="button"
                                                key={`desktop-copyright-${tag.id}`}
                                                className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag-button tagged-media-detail-desktop-tag--copyright"
                                                style={buildTagStyle(tag.tagcolor_hex, "dark")}
                                                onClick={() => handleFilterByTag(tag.tagname)}
                                                aria-label={`Filter gallery by tag ${tag.tagname}`}
                                            >
                                                {tag.tagname}
                                            </button>
                                        ))}
                                        {hiddenDesktopCopyrightTags > 0 && !expandedDesktopCopyrightTags ? (
                                            <button
                                                type="button"
                                                className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag-button tagged-media-detail-desktop-tag--more"
                                                onClick={() => setExpandedDesktopCopyrightTags(true)}
                                                aria-label={`Show ${hiddenDesktopCopyrightTags} more copyright tags`}
                                            >
                                                +{hiddenDesktopCopyrightTags}
                                            </button>
                                        ) : null}
                                        {expandedDesktopCopyrightTags && hiddenDesktopCopyrightTags > 0 ? (
                                            <button
                                                type="button"
                                                className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag-button tagged-media-detail-desktop-tag--more tagged-media-detail-desktop-tag-toggle"
                                                onClick={() => setExpandedDesktopCopyrightTags(false)}
                                                aria-label="Collapse copyright tags"
                                                title="Collapse tags"
                                            >
                                                <span aria-hidden="true">▲</span>
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}

                                {desktopDefaultTags.length > 0 ? (
                                    <div className="tagged-media-detail-desktop-tag-row" aria-label="Tags">
                                        {desktopDefaultTags.map((tag) => (
                                            <button
                                                type="button"
                                                key={`desktop-default-${tag.id}`}
                                                className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag-button"
                                                style={buildTagStyle(tag.tagcolor_hex, "dark")}
                                                onClick={() => handleFilterByTag(tag.tagname)}
                                                aria-label={`Filter gallery by tag ${tag.tagname}`}
                                            >
                                                {tag.tagname}
                                            </button>
                                        ))}
                                        {hiddenDesktopDefaultTags > 0 && !expandedDesktopDefaultTags ? (
                                            <button
                                                type="button"
                                                className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag-button tagged-media-detail-desktop-tag--more"
                                                onClick={() => setExpandedDesktopDefaultTags(true)}
                                                aria-label={`Show ${hiddenDesktopDefaultTags} more tags`}
                                            >
                                                +{hiddenDesktopDefaultTags}
                                            </button>
                                        ) : null}
                                        {expandedDesktopDefaultTags && hiddenDesktopDefaultTags > 0 ? (
                                            <button
                                                type="button"
                                                className="tagged-media-detail-desktop-tag tagged-media-detail-desktop-tag-button tagged-media-detail-desktop-tag--more tagged-media-detail-desktop-tag-toggle"
                                                onClick={() => setExpandedDesktopDefaultTags(false)}
                                                aria-label="Collapse tags"
                                                title="Collapse tags"
                                            >
                                                <span aria-hidden="true">▲</span>
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="tagged-media-detail-info-column tagged-media-detail-info-column--mobile">
                    <header className="tagged-media-detail-header">
                        <div className="tagged-media-detail-header-top-row">
                            <div className="tagged-media-detail-title-block">
                                <div className="tagged-media-detail-title-row">
                                    <h1 title={currentMedia.displayname}>{currentMedia.displayname || "Undefined"}</h1>
                                </div>
                            </div>

                            <div className="tagged-media-detail-header-actions">
                                <button
                                    type="button"
                                    className="tagged-media-detail-favourite-button"
                                    onClick={handleToggleFavourite}
                                    aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                                    aria-pressed={isFavourite}
                                    disabled={isTogglingFavourite}
                                >
                                    <FavouriteIcon active={isFavourite} />
                                </button>
                            </div>
                        </div>

                        <div className="tagged-media-detail-mobile-meta-row">
                            <p className="tagged-media-detail-upload-date">
                                {formatUploadDate(currentMedia.updatedAt)}
                            </p>
                        </div>
                    </header>

                    <hr className="tagged-media-detail-separator" aria-hidden="true" />

                    <div className="tagged-media-detail-content-block">
                        <TagGroup
                            title="Copyright"
                            iconSrc="/icons/copyright.svg"
                            extraClassName="tagged-media-detail-tag-group--copyright"
                            tags={copyrightTags}
                            expanded={expandedCopyrightTags}
                            onToggle={() => setExpandedCopyrightTags((previous) => !previous)}
                            onTagClick={handleFilterByTag}
                            tagSurface="light"
                            headerRight={
                                <div className="tagged-media-detail-meta-group">
                                    <div className="tagged-media-detail-meta-row">
                                        <span className="tagged-media-detail-meta-pill">
                                            {formatMediaSize(currentMedia.size)}
                                        </span>
                                        <span className="tagged-media-detail-meta-pill tagged-media-detail-meta-pill--type">
                                            <img
                                                src={isVideo ? "/icons/video.svg" : "/icons/image.svg"}
                                                alt=""
                                                aria-hidden="true"
                                            />
                                            {isVideo ? "Video" : "Image"}
                                        </span>
                                    </div>
                                </div>
                            }
                        />

                        <TagGroup
                            title="Tags"
                            iconSrc="/icons/tags.svg"
                            tags={defaultTags}
                            expanded={expandedDefaultTags}
                            onToggle={() => setExpandedDefaultTags((previous) => !previous)}
                            onTagClick={handleFilterByTag}
                            tagSurface="light"
                        />

                        <section className="tagged-media-detail-author-group" aria-label="Author info">
                            <h3>
                                <img src="/icons/account.svg" alt="" aria-hidden="true" />
                                <span>Author</span>
                            </h3>
                            <button
                                type="button"
                                className={`tagged-media-detail-tag tagged-media-detail-tag-button tagged-media-detail-author-tag${
                                    hasKnownAuthor ? "" : " is-unknown"
                                }`}
                                onClick={() => handleFilterByAuthor(currentMedia.author)}
                                disabled={!hasKnownAuthor}
                                aria-label={
                                    hasKnownAuthor ? `Filter gallery by author ${authorLabel}` : "Author not available"
                                }
                            >
                                {authorLabel}
                            </button>
                        </section>

                        <div className="tagged-media-detail-actions">
                            <button
                                type="button"
                                className="tagged-media-detail-action tagged-media-detail-action--edit"
                                onClick={openEditModal}
                            >
                                <img src="/icons/edit.svg" alt="" aria-hidden="true" />
                                Edit Media
                            </button>
                            <button
                                type="button"
                                className="tagged-media-detail-action tagged-media-detail-action--delete"
                                onClick={openDeleteCurrentMediaConfirm}
                                disabled={isDeletingMedia}
                                aria-label="Delete media"
                                title="Delete media"
                            >
                                <img src="/icons/delete.svg" alt="" aria-hidden="true" />
                                Delete Media
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            <nav
                className="tagged-media-detail-page-nav tagged-media-detail-page-nav--desktop"
                aria-label="Media navigation"
            >
                {shouldShowDesktopSidePreviews ? (
                    <>
                        {hasPrevious && previousPreviewUrl ? (
                            <button
                                type="button"
                                className="tagged-media-detail-side-preview tagged-media-detail-side-preview--prev"
                                onClick={handlePrevMedia}
                                aria-label="Open previous media preview"
                            >
                                {previousIsVideo ? (
                                    <video
                                        className="tagged-media-detail-side-preview-media"
                                        src={previousPreviewUrl}
                                        poster={previousPreviewPosterUrl || undefined}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <img
                                        className="tagged-media-detail-side-preview-media"
                                        src={previousPreviewUrl}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                )}

                                {previousIsVideo ? (
                                    <span
                                        className="tagged-media-detail-side-preview-play-badge tagged-media-detail-side-preview-play-badge--left"
                                        aria-hidden="true"
                                    >
                                        <svg
                                            className="tagged-media-detail-side-preview-play-icon"
                                            viewBox="0 0 24 24"
                                            focusable="false"
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </span>
                                ) : null}
                            </button>
                        ) : null}

                        {hasNext && nextPreviewUrl ? (
                            <button
                                type="button"
                                className="tagged-media-detail-side-preview tagged-media-detail-side-preview--next"
                                onClick={handleNextMedia}
                                aria-label="Open next media preview"
                            >
                                {nextIsVideo ? (
                                    <video
                                        className="tagged-media-detail-side-preview-media"
                                        src={nextPreviewUrl}
                                        poster={nextPreviewPosterUrl || undefined}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <img
                                        className="tagged-media-detail-side-preview-media"
                                        src={nextPreviewUrl}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                )}

                                {nextIsVideo ? (
                                    <span
                                        className="tagged-media-detail-side-preview-play-badge tagged-media-detail-side-preview-play-badge--right"
                                        aria-hidden="true"
                                    >
                                        <svg
                                            className="tagged-media-detail-side-preview-play-icon"
                                            viewBox="0 0 24 24"
                                            focusable="false"
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </span>
                                ) : null}
                            </button>
                        ) : null}
                    </>
                ) : null}

                {shouldShowCounter ? (
                    <p className="tagged-media-detail-counter tagged-media-detail-counter--desktop" aria-live="polite">
                        <strong>{currentIndex + 1}</strong> / {filteredMediaItems.length}
                    </p>
                ) : null}

                {hasPrevious ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button tagged-media-detail-nav-button--desktop tagged-media-detail-nav-button--prev"
                        onClick={handlePrevMedia}
                        aria-label="Previous media"
                    >
                        <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                    </button>
                ) : null}

                {hasNext ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button tagged-media-detail-nav-button--desktop tagged-media-detail-nav-button--next"
                        onClick={handleNextMedia}
                        aria-label="Next media"
                    >
                        <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                    </button>
                ) : null}
            </nav>

            <nav
                className="tagged-media-detail-bottom-nav tagged-media-detail-bottom-nav--mobile"
                aria-label="Media navigation"
            >
                {hasPrevious ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button"
                        onClick={handlePrevMedia}
                        aria-label="Previous media"
                    >
                        <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                    </button>
                ) : null}

                {shouldShowCounter ? (
                    <p className="tagged-media-detail-counter" aria-live="polite">
                        <strong>{currentIndex + 1}</strong> / {filteredMediaItems.length}
                    </p>
                ) : null}

                {hasNext ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button"
                        onClick={handleNextMedia}
                        aria-label="Next media"
                    >
                        <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                    </button>
                ) : null}
            </nav>

            {isEditModalOpen ? (
                <div
                    className="tagged-media-edit-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Edit media"
                    onClick={closeEditModal}
                >
                    <div className="tagged-media-edit-modal-content" onClick={(event) => event.stopPropagation()}>
                        <header className="tagged-media-edit-modal-header">
                            <h2>Edit Media</h2>
                            <button
                                type="button"
                                className="tagged-media-edit-modal-close"
                                onClick={closeEditModal}
                                disabled={isSavingEdit}
                                aria-label="Close edit modal"
                            >
                                ×
                            </button>
                        </header>

                        <form className="tagged-media-edit-form" onSubmit={handleEditMediaSubmit}>
                            <div className="tagged-media-edit-form-layout">
                                <div className="tagged-media-edit-form-main-column">
                                    {editPreviewUrl ? (
                                        <button
                                            type="button"
                                            className="tagged-media-edit-preview-inline tagged-media-edit-preview-inline--mobile"
                                            aria-label="Open selected media preview"
                                            onClick={handleEditPreviewClick}
                                            onTouchStart={handleEditPreviewTouchStart}
                                            onTouchEnd={handleEditPreviewTouchEnd}
                                        >
                                            {isEditPreviewVideo ? (
                                                <video
                                                    src={editPreviewMediaUrl}
                                                    poster={editPreviewPosterUrl || undefined}
                                                    muted
                                                    playsInline
                                                    preload="auto"
                                                />
                                            ) : (
                                                <img src={editPreviewUrl} alt="" />
                                            )}

                                            {isEditPreviewVideo ? (
                                                <span
                                                    className="tagged-media-edit-preview-play-badge"
                                                    aria-hidden="true"
                                                >
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        className="tagged-media-edit-preview-play-icon"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M8 6.8v10.4c0 .8.9 1.3 1.6.9l8.5-5.2c.7-.4.7-1.4 0-1.8L9.6 5.9c-.7-.4-1.6.1-1.6.9Z" />
                                                    </svg>
                                                </span>
                                            ) : null}
                                        </button>
                                    ) : null}

                                    {editPreviewUrl && (hasPrevious || hasNext || shouldShowCounter) ? (
                                        <nav
                                            className="tagged-media-edit-mobile-nav"
                                            aria-label="Edit modal media navigation"
                                        >
                                            <button
                                                type="button"
                                                className="tagged-media-edit-mobile-nav-button"
                                                onClick={handlePrevMedia}
                                                disabled={!hasPrevious}
                                                aria-label="Previous media"
                                            >
                                                <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                                            </button>

                                            {shouldShowCounter ? (
                                                <p className="tagged-media-edit-mobile-counter" aria-live="polite">
                                                    <strong>{currentIndex + 1}</strong> / {filteredMediaItems.length}
                                                </p>
                                            ) : null}

                                            <button
                                                type="button"
                                                className="tagged-media-edit-mobile-nav-button"
                                                onClick={handleNextMedia}
                                                disabled={!hasNext}
                                                aria-label="Next media"
                                            >
                                                <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                                            </button>
                                        </nav>
                                    ) : null}

                                    <div className="tagged-media-edit-row tagged-media-edit-row--two-columns">
                                        <label className="tagged-media-edit-field">
                                            <span>Media Name</span>
                                            <div className="tagged-media-edit-autocomplete">
                                                <input
                                                    type="text"
                                                    value={editDisplayNameInput}
                                                    onChange={(event) => {
                                                        setEditDisplayNameInput(event.target.value);
                                                        openEditSuggestions("displayname");
                                                    }}
                                                    onFocus={() => openEditSuggestions("displayname")}
                                                    onBlur={closeEditSuggestions}
                                                    onKeyDown={(event) =>
                                                        handleEditSuggestionKeyboard(
                                                            event,
                                                            "displayname",
                                                            visibleEditDisplayNameSuggestions,
                                                            (selectedValue) => {
                                                                setEditDisplayNameInput(selectedValue || "");
                                                                closeEditSuggestions();
                                                            },
                                                        )
                                                    }
                                                    placeholder="Undefined"
                                                />

                                                {editActiveSuggestionField === "displayname" &&
                                                visibleEditDisplayNameSuggestions.length > 0 ? (
                                                    <ul className="tagged-media-edit-suggestion-list" role="listbox">
                                                        {visibleEditDisplayNameSuggestions.map((value, index) => (
                                                            <li key={value}>
                                                                <button
                                                                    type="button"
                                                                    className={`tagged-media-edit-suggestion-item${index === editActiveSuggestionIndex ? " is-active" : ""}`}
                                                                    onMouseDown={(event) => event.preventDefault()}
                                                                    onClick={() => {
                                                                        setEditDisplayNameInput(value);
                                                                        closeEditSuggestions();
                                                                    }}
                                                                >
                                                                    {value}
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                            </div>
                                        </label>

                                        <label className="tagged-media-edit-field">
                                            <span>Author</span>
                                            <div className="tagged-media-edit-autocomplete">
                                                <input
                                                    type="text"
                                                    value={editAuthorInput}
                                                    onChange={(event) => {
                                                        setEditAuthorInput(event.target.value);
                                                        openEditSuggestions("author");
                                                    }}
                                                    onFocus={() => openEditSuggestions("author")}
                                                    onBlur={closeEditSuggestions}
                                                    onKeyDown={(event) =>
                                                        handleEditSuggestionKeyboard(
                                                            event,
                                                            "author",
                                                            visibleEditAuthorSuggestions,
                                                            (selectedValue) => {
                                                                setEditAuthorInput(selectedValue || "");
                                                                closeEditSuggestions();
                                                            },
                                                        )
                                                    }
                                                    placeholder="Optional"
                                                />

                                                {editActiveSuggestionField === "author" &&
                                                visibleEditAuthorSuggestions.length > 0 ? (
                                                    <ul className="tagged-media-edit-suggestion-list" role="listbox">
                                                        {visibleEditAuthorSuggestions.map((value, index) => (
                                                            <li key={value}>
                                                                <button
                                                                    type="button"
                                                                    className={`tagged-media-edit-suggestion-item${index === editActiveSuggestionIndex ? " is-active" : ""}`}
                                                                    onMouseDown={(event) => event.preventDefault()}
                                                                    onClick={() => {
                                                                        setEditAuthorInput(value);
                                                                        closeEditSuggestions();
                                                                    }}
                                                                >
                                                                    {value}
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                            </div>
                                        </label>
                                    </div>

                                    <label className="tagged-media-edit-field">
                                        <span>Tags (press Enter to add)</span>
                                        <div className="tagged-media-edit-autocomplete">
                                            <input
                                                type="text"
                                                value={editTagInput}
                                                onChange={(event) => {
                                                    setEditTagInput(event.target.value);
                                                    openEditSuggestions("tag");
                                                }}
                                                onFocus={() => openEditSuggestions("tag")}
                                                onBlur={closeEditSuggestions}
                                                placeholder="Write tag name and press Enter"
                                                onKeyDown={(event) =>
                                                    handleEditSuggestionKeyboard(
                                                        event,
                                                        "tag",
                                                        visibleEditTagSuggestions,
                                                        (selectedValue) => addEditTag(selectedValue),
                                                        () => {
                                                            if (event.key === "Enter") {
                                                                event.preventDefault();
                                                                addEditTag(editTagInput);
                                                            }
                                                        },
                                                    )
                                                }
                                            />

                                            {editActiveSuggestionField === "tag" &&
                                            visibleEditTagSuggestions.length > 0 ? (
                                                <ul className="tagged-media-edit-suggestion-list" role="listbox">
                                                    {visibleEditTagSuggestions.map((value, index) => (
                                                        <li key={value}>
                                                            <button
                                                                type="button"
                                                                className={`tagged-media-edit-suggestion-item${index === editActiveSuggestionIndex ? " is-active" : ""}`}
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                onClick={() => addEditTag(value)}
                                                            >
                                                                {value}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : null}
                                        </div>
                                    </label>

                                    {editSelectedTags.length > 0 ? (
                                        <div className="tagged-media-edit-tag-preview" aria-label="Selected tags">
                                            {editSelectedTags.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    className="tagged-media-edit-tag-chip"
                                                    style={buildTagStyle(
                                                        editTagColorByName[String(tag).toLowerCase()],
                                                        "light",
                                                    )}
                                                    onClick={() => removeEditTag(tag)}
                                                    aria-label={`Remove tag ${tag}`}
                                                >
                                                    <span>{tag}</span>
                                                    <span aria-hidden="true">×</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    {editError ? <p className="tagged-media-edit-error">{editError}</p> : null}

                                </div>

                                <aside className="tagged-media-edit-preview-panel" aria-label="Selected media preview">
                                    {editPreviewUrl ? (
                                        <button
                                            type="button"
                                            className="tagged-media-edit-preview-inline tagged-media-edit-preview-inline--panel"
                                            aria-label="Open selected media preview"
                                            onClick={() => setIsEditPreviewLightboxOpen(true)}
                                        >
                                            {isEditPreviewVideo ? (
                                                <video
                                                    src={editPreviewMediaUrl}
                                                    poster={editPreviewPosterUrl || undefined}
                                                    muted
                                                    playsInline
                                                    preload="auto"
                                                />
                                            ) : (
                                                <img src={editPreviewUrl} alt="" />
                                            )}

                                            {isEditPreviewVideo ? (
                                                <span
                                                    className="tagged-media-edit-preview-play-badge"
                                                    aria-hidden="true"
                                                >
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        className="tagged-media-edit-preview-play-icon"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M8 6.8v10.4c0 .8.9 1.3 1.6.9l8.5-5.2c.7-.4.7-1.4 0-1.8L9.6 5.9c-.7-.4-1.6.1-1.6.9Z" />
                                                    </svg>
                                                </span>
                                            ) : null}
                                        </button>
                                    ) : (
                                        <div className="tagged-media-edit-preview-placeholder" aria-hidden="true">
                                            <span>No preview</span>
                                        </div>
                                    )}
                                </aside>
                            </div>

                            <footer className="tagged-media-edit-modal-footer">
                                <label className="tagged-media-edit-close-on-save">
                                    <input
                                        type="checkbox"
                                        checked={closeEditModalOnSave}
                                        onChange={(event) => setCloseEditModalOnSave(event.target.checked)}
                                        disabled={isSavingEdit}
                                    />
                                    <span>Close on save</span>
                                </label>

                                <div className="tagged-media-edit-modal-actions">
                                    <button
                                        type="button"
                                        className="tagged-media-edit-modal-cancel"
                                        onClick={closeEditModal}
                                        disabled={isSavingEdit}
                                        aria-label="Cancel editing"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="tagged-media-edit-submit"
                                        disabled={isSavingEdit}
                                    >
                                        {isSavingEdit ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </footer>
                        </form>

                        {isEditPreviewLightboxOpen && editPreviewUrl ? (
                            <div
                                className="tagged-media-edit-preview-lightbox"
                                role="dialog"
                                aria-modal="true"
                                aria-label="Selected media preview"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setIsEditPreviewLightboxOpen(false);
                                }}
                            >
                                <div
                                    className="tagged-media-edit-preview-lightbox-content"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        className="tagged-media-edit-preview-lightbox-close"
                                        onClick={() => setIsEditPreviewLightboxOpen(false)}
                                        aria-label="Close selected media preview"
                                    >
                                        ×
                                    </button>

                                    {isEditPreviewVideo ? (
                                        <video
                                            className="tagged-media-edit-preview-lightbox-media"
                                            src={editPreviewMediaUrl}
                                            controls
                                            playsInline
                                            autoPlay
                                        />
                                    ) : (
                                        <img
                                            className="tagged-media-edit-preview-lightbox-media"
                                            src={editPreviewUrl}
                                            alt=""
                                        />
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {isDeleteConfirmOpen ? (
                <div
                    className="tagged-media-detail-confirm-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-media-detail-confirm-title"
                    aria-describedby="tagged-media-detail-confirm-description"
                    onClick={closeDeleteCurrentMediaConfirm}
                >
                    <div
                        className="tagged-media-detail-confirm-modal-content"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="tagged-media-detail-confirm-title">You are about to delete 1 element</h2>
                        <p id="tagged-media-detail-confirm-description">This action can not be undone</p>
                        <div className="tagged-media-detail-confirm-actions">
                            <button
                                type="button"
                                className="tagged-media-detail-confirm-continue"
                                onClick={handleDeleteCurrentMedia}
                                disabled={isDeletingMedia}
                            >
                                Continue
                            </button>
                            <button
                                type="button"
                                className="tagged-media-detail-confirm-cancel"
                                onClick={closeDeleteCurrentMediaConfirm}
                                disabled={isDeletingMedia}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isLightboxOpen && mediaUrl && (
                <div
                    className="tagged-media-lightbox"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Media modal view"
                    onClick={handleCloseLightbox}
                >
                    <div className="tagged-media-lightbox-content">
                        <header className="tagged-media-lightbox-header">
                            <h2 title={currentMedia.displayname || currentMedia.filename}>
                                <img
                                    src={isVideo ? "/icons/video.svg" : "/icons/image.svg"}
                                    alt=""
                                    aria-hidden="true"
                                />
                                <span>{currentMedia.displayname || currentMedia.filename || "Media"}</span>
                            </h2>

                            <button
                                type="button"
                                className="tagged-media-lightbox-close"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleCloseLightbox();
                                }}
                                aria-label="Close modal"
                            >
                                ×
                            </button>
                        </header>

                        <div className="tagged-media-lightbox-media-wrap">
                            {isVideo ? (
                                <video
                                    ref={lightboxVideoRef}
                                    key={`lightbox-video-${currentMedia.id}`}
                                    className="tagged-media-lightbox-media"
                                    src={mediaUrl}
                                    controls
                                    playsInline
                                    onClick={(event) => event.stopPropagation()}
                                    loop={true}
                                />
                            ) : (
                                <img
                                    key={`lightbox-image-${currentMedia.id}`}
                                    className={`tagged-media-lightbox-media${isLightboxImageZoomed ? " is-zoomed" : ""}${isLightboxImagePanning ? " is-panning" : ""}`}
                                    src={mediaUrl}
                                    alt={currentMedia.displayname || currentMedia.filename || "Media"}
                                    draggable={false}
                                    onClick={handleLightboxImageClick}
                                    onWheel={handleLightboxImageWheel}
                                    onDragStart={(event) => event.preventDefault()}
                                    onPointerDown={handleLightboxImagePointerDown}
                                    onPointerMove={handleLightboxImagePointerMove}
                                    onPointerUp={handleLightboxImagePointerUp}
                                    onPointerCancel={handleLightboxImagePointerCancel}
                                    style={
                                        isLightboxImageZoomed
                                            ? {
                                                  objectFit: "contain",
                                                  transform: `translate(${lightboxImagePan.x}px, ${lightboxImagePan.y}px) scale(${lightboxImageScale})`,
                                              }
                                            : {
                                                  objectFit: "contain",
                                              }
                                    }
                                />
                            )}
                        </div>

                        <div className="tagged-media-lightbox-bottom-spacer" aria-hidden="true" />
                    </div>
                </div>
            )}
        </section>
    );
};
