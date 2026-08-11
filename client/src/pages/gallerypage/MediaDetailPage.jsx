import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { faChevronLeft, faChevronRight, faCopyright, faDownload, faHeart as faHeartSolid, faImage, faPen, faPlay, faRepeat, faScrewdriverWrench, faShuffle, faTags, faTrash, faUser, faVideo, faXmark } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../components/icon-button/IconButton";
import { MediaEditModal } from "../../components/media-edit-modal/MediaEditModal";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { useAppToast } from "../../components/toast/useAppToast";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../hooks/useAuth";
import { useDevTools } from "../../hooks/useDevTools";
import { buildDefaultTagStyle, isDefaultTagColor } from "../../utils/tagStyle";
import { formatDownloadSpeed } from "../../utils/downloadUtils";
import "./MediaDetailPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const UPLOADS_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");
const LIGHTBOX_MIN_ZOOM = 1;
const LIGHTBOX_DEFAULT_ZOOM = 1.9;
const LIGHTBOX_MAX_ZOOM = 4;
const MAX_SUGGESTIONS = 8;
const DESKTOP_DEFAULT_TAG_LIMIT = 6;
const DESKTOP_COPYRIGHT_TAG_LIMIT = 3;
const MEDIA_SWITCH_ANIMATION_MS = 440;
const MEDIA_SWIPE_ANIMATION_ENABLED = true;
const KEYBOARD_REPEAT_INTERVAL_MS = 90;
const EDIT_MODAL_CLOSE_ON_SAVE_STORAGE_KEY = "tagged.mediaDetail.closeEditModalOnSave";
const MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY = "tagged.mediaDetail.autoplay";
const MEDIA_DETAIL_LOOP_STORAGE_KEY = "tagged.mediaDetail.loop";
const MEDIA_DETAIL_AUTOPLAY_EVENT = "tagged:media-detail-autoplay";
const MEDIA_DETAIL_PRELOAD_DISTANCE = 2;
const MEDIA_DETAIL_PRELOAD_CACHE_LIMIT = 12;
const mediaDetailPreloadCache = new Map();
const DETAIL_OVERLAY_ACTION_CLASSES =
    "pointer-events-auto! flex! h-10! w-10! items-center! justify-center! rounded-xl! border-0! bg-neutral-950! p-0! text-white! shadow-lg! transition-[transform,background-color]! duration-180! ease-out! hover:scale-[1.08]! hover:bg-neutral-800! hover:text-white! active:scale-[0.96]! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-white! disabled:scale-100! disabled:opacity-40!";
const MOBILE_DETAIL_ACTION_CLASSES =
    "flex! min-h-16! w-full! min-w-0! flex-col! items-center! justify-center! gap-1.5! rounded-xl! border! border-neutral-200! bg-transparent! px-1! py-2! text-xs! font-bold! text-neutral-600! shadow-none! transition-colors! hover:bg-neutral-100! hover:text-neutral-950! disabled:opacity-40! dark:border-neutral-800! dark:text-neutral-300! dark:hover:bg-neutral-800! dark:hover:text-white!";

const mergeDistinctValues = (currentValues, newValues) => {
    const valuesByKey = new Map();

    [...currentValues, ...newValues].forEach((value) => {
        const trimmed = String(value || "").trim();
        const normalized = trimmed.toLowerCase();

        if (!trimmed || valuesByKey.has(normalized)) {
            return;
        }

        valuesByKey.set(normalized, trimmed);
    });

    return Array.from(valuesByKey.values()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
    );
};

const mapTagsFromMedia = (media) => {
    const candidates = media?.tags || media?.tag_names || media?.mediaTags || media?.relatedTags || [];

    if (!Array.isArray(candidates)) {
        return [];
    }

    return candidates
        .map((tag) => {
            if (typeof tag === "string") {
                return tag;
            }

            return String(tag?.tagname || tag?.name || "").trim();
        })
        .filter(Boolean);
};

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
    const rgb = isDefaultTagColor(hexColor) ? null : getHexRgb(hexColor);
    const darkTheme = isDarkThemeActive();

    if (!rgb) {
        const isDarkSurface = surface === "dark" || darkTheme;

        return buildDefaultTagStyle({
            darkSurface: isDarkSurface,
            hoverColorVariable: "--tagged-media-detail-tag-hover-color",
        });
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

const rememberPreloadedMedia = (key, resource) => {
    if (mediaDetailPreloadCache.has(key)) return;
    mediaDetailPreloadCache.set(key, resource);

    while (mediaDetailPreloadCache.size > MEDIA_DETAIL_PRELOAD_CACHE_LIMIT) {
        const [oldestKey, oldestResource] = mediaDetailPreloadCache.entries().next().value;
        if (oldestResource instanceof HTMLVideoElement) {
            oldestResource.removeAttribute("src");
            oldestResource.load();
        }
        mediaDetailPreloadCache.delete(oldestKey);
    }
};

const preloadMediaForNavigation = (media, distance) => {
    const mediaUrl = getMediaUrl(media);
    const thumbnailUrl = getThumbnailUrl(media);
    const isVideo = String(media?.mediatype || "").toLowerCase().includes("video");
    const previewUrl = isVideo ? mediaUrl : thumbnailUrl || mediaUrl;

    if (!previewUrl || mediaDetailPreloadCache.has(previewUrl)) return;

    if (isVideo) {
        if (thumbnailUrl && !mediaDetailPreloadCache.has(thumbnailUrl)) {
            const poster = new Image();
            poster.decoding = "async";
            poster.fetchPriority = "low";
            poster.src = thumbnailUrl;
            rememberPreloadedMedia(thumbnailUrl, poster);
        }

        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = distance === 1 ? "auto" : "metadata";
        video.src = mediaUrl;
        video.load();
        rememberPreloadedMedia(previewUrl, video);
        return;
    }

    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = previewUrl;
    rememberPreloadedMedia(previewUrl, image);
};

const isHeicMedia = (media) => {
    const fileReference = String(media?.filepath || media?.filename || "");
    return /\.hei[cf](?:$|[?#])/i.test(fileReference);
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
    icon,
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
                    {icon ? <FontAwesomeIcon icon={icon} aria-hidden="true" /> : null}
                    <span>{title}</span>
                </h3>

                <div className="tagged-media-detail-tag-group-actions">
                    {headerRight ? <div className="tagged-media-detail-tag-group-right-slot">{headerRight}</div> : null}

                    {hasOverflow ? (
                        <button type="button" className="tagged-media-detail-expand-button" onClick={onToggle}>
                            <span aria-hidden="true">{expanded ? "â–²" : "â–¼"}</span>
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
    const { forceLoading } = useDevTools();
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
    const [mediaDetailLoop, setMediaDetailLoop] = useState(() => {
        if (typeof window === "undefined") {
            return true;
        }

        const storedValue = window.localStorage.getItem(MEDIA_DETAIL_LOOP_STORAGE_KEY);
        return storedValue === null ? true : storedValue === "true";
    });
    const [isMediaToolsOpen, setIsMediaToolsOpen] = useState(true);
    const [isShufflingMedia, setIsShufflingMedia] = useState(false);
    const [shufflePreviewItems, setShufflePreviewItems] = useState([]);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isLightboxImageZoomed, setIsLightboxImageZoomed] = useState(false);
    const [lightboxImageScale, setLightboxImageScale] = useState(LIGHTBOX_MIN_ZOOM);
    const [lightboxImagePan, setLightboxImagePan] = useState({ x: 0, y: 0 });
    const [isLightboxImagePanning, setIsLightboxImagePanning] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeletingMedia, setIsDeletingMedia] = useState(false);
    const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isMediaChanging, setIsMediaChanging] = useState(false);
    const [mediaTransitionSnapshot, setMediaTransitionSnapshot] = useState(null);
    const [actionToast, setActionToast] = useState(null);
    const [editError, setEditError] = useState(null);
    const [editDisplayNameInput, setEditDisplayNameInput] = useState("");
    const [editAuthorInput, setEditAuthorInput] = useState("");
    const [editSelectedTags, setEditSelectedTags] = useState([]);
    const [editDistinctDisplayNames, setEditDistinctDisplayNames] = useState([]);
    const [editDistinctAuthors, setEditDistinctAuthors] = useState([]);
    const [editDistinctTagNames, setEditDistinctTagNames] = useState([]);
    const [editTagColorByName, setEditTagColorByName] = useState({});
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
    const [isCurrentMediaReady, setIsCurrentMediaReady] = useState(false);
    const [expandedDesktopDefaultTags, setExpandedDesktopDefaultTags] = useState(false);
    const [expandedDesktopCopyrightTags, setExpandedDesktopCopyrightTags] = useState(false);

    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
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
    const mediaTransitionDirectionRef = useRef("next");
    const mediaTransitionSnapshotRef = useRef(null);
    const keyboardMediaNavigationRef = useRef({ previous: null, next: null });
    const navigationBurstIndexRef = useRef(null);
    const navigationBurstResetTimeoutRef = useRef(null);
    const lastKeyboardRepeatNavigationRef = useRef(0);
    const actionToastTimeoutRef = useRef(null);
    const shuffleFeedbackTimeoutRef = useRef(null);
    const shuffleNavigationTimeoutRef = useRef(null);

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
    useAppToast(actionToast, { id: "media-detail-action", onDismiss: hideActionToast });

    useEffect(
        () => () => {
            if (actionToastTimeoutRef.current) {
                window.clearTimeout(actionToastTimeoutRef.current);
                actionToastTimeoutRef.current = null;
            }

            if (navigationBurstResetTimeoutRef.current) {
                window.clearTimeout(navigationBurstResetTimeoutRef.current);
                navigationBurstResetTimeoutRef.current = null;
            }

            if (shuffleFeedbackTimeoutRef.current) {
                window.clearTimeout(shuffleFeedbackTimeoutRef.current);
                shuffleFeedbackTimeoutRef.current = null;
            }

            if (shuffleNavigationTimeoutRef.current) {
                window.clearTimeout(shuffleNavigationTimeoutRef.current);
                shuffleNavigationTimeoutRef.current = null;
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

        if (!mediaTransitionSnapshotRef.current) {
            setIsMediaChanging(false);
            return undefined;
        }

        setIsMediaChanging(true);

        mediaChangeTimeoutRef.current = window.setTimeout(() => {
            setIsMediaChanging(false);
            setMediaTransitionSnapshot(null);
            mediaTransitionSnapshotRef.current = null;
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
        setIsCurrentMediaReady(true);
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

    const handleToggleMediaDetailAutoplay = () => {
        window.dispatchEvent(
            new CustomEvent(MEDIA_DETAIL_AUTOPLAY_EVENT, {
                detail: { enabled: !mediaDetailAutoplay },
            }),
        );
    };

    const handleToggleMediaDetailLoop = () => {
        setMediaDetailLoop((isEnabled) => {
            const nextValue = !isEnabled;
            window.localStorage.setItem(MEDIA_DETAIL_LOOP_STORAGE_KEY, nextValue ? "true" : "false");
            return nextValue;
        });
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

    const hasNavigableVideo = useMemo(
        () => filteredMediaItems.some((media) => String(media?.mediatype || "").toLowerCase().includes("video")),
        [filteredMediaItems],
    );

    const currentIndex = useMemo(
        () => filteredMediaItems.findIndex((item) => String(item.id) === String(mediaId)),
        [filteredMediaItems, mediaId],
    );

    const currentMedia = currentIndex >= 0 ? filteredMediaItems[currentIndex] : null;
    const mediaUrl = currentMedia ? getMediaUrl(currentMedia) : "";
    const thumbnailUrl = currentMedia ? getThumbnailUrl(currentMedia) : "";
    const isHeic = isHeicMedia(currentMedia);
    const isVideo = String(currentMedia?.mediatype || "")
        .toLowerCase()
        .includes("video");
    const hasSeparateThumbnail = Boolean(thumbnailUrl) && thumbnailUrl !== mediaUrl;
    const shouldUseOriginalInViewer = isVideo || (!isHeic && (isOriginalLoaded || !hasSeparateThumbnail));
    const viewerUrl = shouldUseOriginalInViewer ? mediaUrl : thumbnailUrl;
    const lightboxMediaUrl = isHeic ? thumbnailUrl || mediaUrl : mediaUrl;
    const viewerIsVideo = isVideo && shouldUseOriginalInViewer;
    const viewerBlurBackgroundUrl = viewerIsVideo ? thumbnailUrl || mediaUrl || "" : viewerUrl;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < filteredMediaItems.length - 1;
    const shouldShowCounter = filteredMediaItems.length > 1;
    const usesSegmentedProgress = filteredMediaItems.length <= 15;
    const galleryProgress = filteredMediaItems.length > 0 ? ((currentIndex + 1) / filteredMediaItems.length) * 100 : 0;

    useEffect(() => {
        setIsOriginalLoaded(false);
        setIsCurrentMediaReady(false);
    }, [mediaId]);

    useEffect(() => {
        if (!isCurrentMediaReady || currentIndex < 0 || filteredMediaItems.length < 2) return;

        const preloadNeighbors = () => {
            for (let distance = 1; distance <= MEDIA_DETAIL_PRELOAD_DISTANCE; distance += 1) {
                [currentIndex + distance, currentIndex - distance].forEach((index) => {
                    const media = filteredMediaItems[index];
                    if (media) preloadMediaForNavigation(media, distance);
                });
            }
        };

        if (typeof window.requestIdleCallback === "function") {
            const idleId = window.requestIdleCallback(preloadNeighbors, { timeout: 1200 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = window.setTimeout(preloadNeighbors, 250);
        return () => window.clearTimeout(timeoutId);
    }, [currentIndex, filteredMediaItems, isCurrentMediaReady]);

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

    const goToMediaAtIndex = (targetIndex, requestedDirection) => {
        if (targetIndex < 0 || targetIndex >= filteredMediaItems.length) {
            return;
        }

        const targetMedia = filteredMediaItems[targetIndex];

        if (!targetMedia?.id) {
            return;
        }

        const direction = requestedDirection || (targetIndex > currentIndex ? "next" : "previous");
        const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const navigateToTarget = () => {
            navigate(`/gallery/${targetMedia.id}${location.search || ""}`, {
                replace: true,
                state: {
                    mediaItems: filteredMediaItems,
                },
            });
        };

        if (MEDIA_SWIPE_ANIMATION_ENABLED && !prefersReducedMotion && currentMedia && viewerUrl) {
            mediaTransitionDirectionRef.current = direction;
            const snapshot = {
                id: currentMedia.id,
                direction,
                url: viewerUrl,
                blurUrl: viewerBlurBackgroundUrl,
                showBlur: mediaFit === "blur",
                isVideo: viewerIsVideo,
                poster: thumbnailUrl || undefined,
                label: currentMedia.displayname || currentMedia.filename || "Media",
            };
            mediaTransitionSnapshotRef.current = snapshot;
            setMediaTransitionSnapshot(snapshot);
        } else {
            mediaTransitionSnapshotRef.current = null;
            setMediaTransitionSnapshot(null);
        }

        navigateToTarget();
    };

    const requestMediaNavigation = (offset) => {
        const currentBurstIndex = navigationBurstIndexRef.current;
        const baseIndex = Number.isInteger(currentBurstIndex) ? currentBurstIndex : currentIndex;
        const targetIndex = Math.min(
            filteredMediaItems.length - 1,
            Math.max(0, baseIndex + offset),
        );

        if (targetIndex === baseIndex) {
            return;
        }

        navigationBurstIndexRef.current = targetIndex;

        if (navigationBurstResetTimeoutRef.current) {
            window.clearTimeout(navigationBurstResetTimeoutRef.current);
        }

        navigationBurstResetTimeoutRef.current = window.setTimeout(() => {
            navigationBurstIndexRef.current = null;
            navigationBurstResetTimeoutRef.current = null;
        }, 180);

        goToMediaAtIndex(targetIndex, offset > 0 ? "next" : "previous");
    };

    const handlePrevMedia = () => {
        requestMediaNavigation(-1);
    };

    const handleNextMedia = () => {
        requestMediaNavigation(1);
    };

    const handleShuffleMedia = () => {
        if (mediaItems.length < 2 || !currentMedia?.id || isShufflingMedia) return;

        const shuffledMediaItems = [...mediaItems];
        for (let index = shuffledMediaItems.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [shuffledMediaItems[index], shuffledMediaItems[randomIndex]] = [shuffledMediaItems[randomIndex], shuffledMediaItems[index]];
        }

        if (shuffledMediaItems.every((media, index) => media.id === mediaItems[index]?.id)) {
            shuffledMediaItems.push(shuffledMediaItems.shift());
        }

        setMediaItems(shuffledMediaItems);
        const navigableMediaIds = new Set(filteredMediaItems.map((media) => String(media.id)));
        const shuffledNavigableItems = shuffledMediaItems.filter((media) => navigableMediaIds.has(String(media.id)));
        const nextCurrentMedia = shuffledNavigableItems.find((media) => String(media.id) !== String(currentMedia?.id));
        if (!nextCurrentMedia) return;
        const supportingPreviewItems = shuffledNavigableItems
            .filter((media) => String(media.id) !== String(nextCurrentMedia.id))
            .slice(0, 2);
        setShufflePreviewItems([...supportingPreviewItems, nextCurrentMedia]);

        if (shuffleFeedbackTimeoutRef.current) window.clearTimeout(shuffleFeedbackTimeoutRef.current);
        const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        setIsShufflingMedia(true);
        shuffleNavigationTimeoutRef.current = window.setTimeout(() => {
            navigate(`/gallery/${nextCurrentMedia.id}${location.search || ""}`, {
                replace: true,
                state: { ...location.state, mediaItems: shuffledMediaItems },
            });
            shuffleNavigationTimeoutRef.current = null;
        }, prefersReducedMotion ? 0 : 950);
        shuffleFeedbackTimeoutRef.current = window.setTimeout(() => {
            setIsShufflingMedia(false);
            shuffleFeedbackTimeoutRef.current = null;
        }, prefersReducedMotion ? 250 : 1200);
    };

    keyboardMediaNavigationRef.current = {
        previous: hasPrevious ? handlePrevMedia : null,
        next: hasNext ? handleNextMedia : null,
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

            if (isDeleteConfirmOpen) {
                return;
            }

            if (isEditModalOpen || document.getElementById("edit-media-title")) {
                return;
            }

            if (event.repeat) {
                const now = Date.now();

                if (now - lastKeyboardRepeatNavigationRef.current < KEYBOARD_REPEAT_INTERVAL_MS) {
                    event.preventDefault();
                    return;
                }

                lastKeyboardRepeatNavigationRef.current = now;
            } else {
                lastKeyboardRepeatNavigationRef.current = 0;
            }

            if (event.key === "ArrowLeft" && keyboardMediaNavigationRef.current.previous) {
                event.preventDefault();
                keyboardMediaNavigationRef.current.previous();
                return;
            }

            if (event.key === "ArrowRight" && keyboardMediaNavigationRef.current.next) {
                event.preventDefault();
                keyboardMediaNavigationRef.current.next();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isDeleteConfirmOpen, isEditModalOpen]);

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

    const handleOpenLightbox = () => {
        if (!currentMedia) {
            return;
        }

        if (!isHeic && !shouldUseOriginalInViewer && hasSeparateThumbnail) {
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
        if (!mediaUrl || !currentMedia || isDownloadingMedia) {
            return;
        }

        const inferredExtension = isVideo ? ".mp4" : "";
        const filename = String(
            currentMedia.filename || currentMedia.displayname || `media${inferredExtension}`,
        ).trim();

        try {
            setIsDownloadingMedia(true);
            let sampledBytes = 0;
            let sampledAt = performance.now();
            let latestSpeedLabel = null;

            showActionToast({
                status: "info",
                title: "Downloading media",
                message: filename,
                progress: 0,
                speedLabel: null,
            });

            const response = await apiClient.get(mediaUrl, {
                responseType: "blob",
                _skipErrorToast: true,
                onDownloadProgress: ({ loaded, total, progress }) => {
                    const now = performance.now();
                    const elapsedSeconds = (now - sampledAt) / 1000;

                    if (elapsedSeconds >= 0.18) {
                        latestSpeedLabel = formatDownloadSpeed((loaded - sampledBytes) / elapsedSeconds);
                        sampledBytes = loaded;
                        sampledAt = now;
                    }

                    const percent = Number.isFinite(progress)
                        ? Math.round(progress * 100)
                        : Number.isFinite(total) && total > 0
                            ? Math.round((loaded / total) * 100)
                            : null;

                    showActionToast({
                        status: "info",
                        title: "Downloading media",
                        message: filename,
                        progress: percent,
                        indeterminate: percent === null,
                        speedLabel: latestSpeedLabel,
                    });
                },
            });
            const blob = response.data;

            if (!(blob instanceof Blob) || blob.size <= 0) {
                throw new Error("Downloaded file is empty or invalid.");
            }

            const userAgent = navigator.userAgent || "";
            const platform = navigator.platform || "";
            const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent)
                || (platform === "MacIntel" && navigator.maxTouchPoints > 1);

            if (isIOSDevice && isVideo && typeof navigator.share === "function") {
                const shareFile = new File([blob], filename, { type: blob.type || "video/mp4" });
                if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [shareFile] })) {
                    await navigator.share({ files: [shareFile], title: filename });
                    showActionToast({ status: "success", title: "Media ready", message: "The share sheet has opened.", progress: 100 }, 2200);
                    return;
                }
            }

            const tempUrl = URL.createObjectURL(blob);
            const tempLink = document.createElement("a");
            tempLink.href = tempUrl;
            tempLink.download = filename || "download";
            tempLink.rel = "noopener noreferrer";
            document.body.appendChild(tempLink);
            tempLink.click();
            tempLink.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(tempUrl);
            }, 60_000);

            showActionToast({ status: "success", title: "Download ready", message: "The file download has started.", progress: 100 }, 2200);
        } catch (downloadError) {
            showActionToast({
                status: "error",
                title: "Download failed",
                message: downloadError?.message || "Could not download media file.",
            }, 4200);
        } finally {
            setIsDownloadingMedia(false);
        }
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
        setEditSelectedTags(currentTags);
        setEditError(null);
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

    if (loading || forceLoading) {
        return (
            <section className="tagged-app-page tagged-media-detail-page">
                <PageLoadingSkeleton variant="detail" ariaLabel="Loading media detail" />
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
    const openEditModal = () => {
        setEditDisplayNameInput(currentMedia.displayname || "");
        setEditAuthorInput(currentMedia.author || "");
        setEditSelectedTags(Array.from(new Set(allTags.map((tag) => tag.tagname).filter(Boolean))));
        setEditError(null);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        if (isSavingEdit) {
            return;
        }

        setIsEditModalOpen(false);
        setEditError(null);
    };

    const handleEditMediaSubmit = async (payload) => {
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
                    displayname: String(payload?.displayname || "").trim(),
                    author: String(payload?.author || "").trim(),
                    tag_names: JSON.stringify(Array.isArray(payload?.tags) ? payload.tags : []),
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
            setEditDistinctDisplayNames((previous) => mergeDistinctValues(previous, [data.data.displayname]));
            setEditDistinctAuthors((previous) => mergeDistinctValues(previous, [data.data.author]));
            setEditDistinctTagNames((previous) => mergeDistinctValues(previous, mapTagsFromMedia(data.data)));

            if (closeEditModalOnSave) {
                setIsEditModalOpen(false);
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
            <header className="tagged-media-detail-tools-row" aria-label="Media tools">
                <div className={`tagged-media-detail-tools${isMediaToolsOpen ? " is-open" : ""}`}>
                    <button
                        type="button"
                        className="tagged-media-detail-tools-toggle"
                        onClick={() => setIsMediaToolsOpen((isOpen) => !isOpen)}
                        aria-label={isMediaToolsOpen ? "Collapse media tools" : "Expand media tools"}
                        aria-expanded={isMediaToolsOpen}
                        title={isMediaToolsOpen ? "Collapse tools" : "Expand tools"}
                    >
                        <FontAwesomeIcon icon={faScrewdriverWrench} aria-hidden="true" />
                    </button>

                    <div className="tagged-media-detail-tools-expandable" aria-hidden={!isMediaToolsOpen}>
                        <span className="tagged-media-detail-tools-separator" aria-hidden="true" />
                        <button
                            type="button"
                            className="tagged-media-detail-tool-action"
                            onClick={handleShuffleMedia}
                            disabled={filteredMediaItems.length < 2 || isShufflingMedia}
                            tabIndex={isMediaToolsOpen ? 0 : -1}
                            aria-label={isShufflingMedia ? "Media shuffled" : "Shuffle media"}
                        >
                            <FontAwesomeIcon icon={faShuffle} aria-hidden="true" />
                            <span>Shuffle</span>
                        </button>
                        {hasNavigableVideo ? <>
                            <button
                                type="button"
                                className="tagged-media-detail-tool-action"
                                onClick={handleToggleMediaDetailAutoplay}
                                aria-pressed={mediaDetailAutoplay}
                                tabIndex={isMediaToolsOpen ? 0 : -1}
                            >
                                <FontAwesomeIcon icon={faPlay} aria-hidden="true" />
                                <span>Autoplay</span>
                            </button>
                            <button
                                type="button"
                                className="tagged-media-detail-tool-action"
                                onClick={handleToggleMediaDetailLoop}
                                aria-pressed={mediaDetailLoop}
                                tabIndex={isMediaToolsOpen ? 0 : -1}
                            >
                                <FontAwesomeIcon icon={faRepeat} aria-hidden="true" />
                                <span>Loop</span>
                            </button>
                        </> : null}
                    </div>
                </div>
            </header>

            {isShufflingMedia ? (
                <div className="tagged-media-detail-shuffle-overlay" role="status" aria-live="polite" aria-label="Media order shuffled">
                    <div className="tagged-media-detail-shuffle-stage" aria-hidden="true">
                        {shufflePreviewItems.map((media, index) => {
                            const previewUrl = getThumbnailUrl(media) || getMediaUrl(media);
                            const animationSlot = index === shufflePreviewItems.length - 1 ? 3 : index + 1;
                            return (
                                <span key={media.id} className={`tagged-media-detail-shuffle-card tagged-media-detail-shuffle-card--${animationSlot}`}>
                                    {previewUrl ? <img src={previewUrl} alt="" /> : <FontAwesomeIcon icon={faImage} />}
                                </span>
                            );
                        })}
                        <span className="tagged-media-detail-shuffle-particles">
                            {Array.from({ length: 12 }, (_, particleIndex) => <i key={particleIndex} />)}
                        </span>
                    </div>
                </div>
            ) : null}

            <div className="tagged-media-detail-shell">
                <div
                    className="tagged-media-detail-media-column"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div
                        className={`tagged-media-detail-viewer${isMediaChanging ? " is-transitioning" : ""}`}
                        aria-label="Selected media preview"
                        onMouseEnter={handleDetailPreviewMouseEnter}
                        onMouseLeave={handleDetailPreviewMouseLeave}
                    >
                        <div
                            key={`current-frame-${currentMedia.id}`}
                            className={`tagged-media-detail-frame tagged-media-detail-frame--current${isMediaChanging ? ` is-entering is-${mediaTransitionDirectionRef.current}` : ""}`}
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
                                        className="tagged-media-detail-media"
                                        src={viewerUrl}
                                        controls={false}
                                        muted
                                        playsInline
                                        preload="auto"
                                        poster={thumbnailUrl || undefined}
                                        onLoadedMetadata={handleVideoMetadata}
                                        onCanPlay={() => setIsCurrentMediaReady(true)}
                                        onPlay={() => setIsDetailVideoPlaying(true)}
                                        onPause={() => setIsDetailVideoPlaying(false)}
                                        onEnded={() => setIsDetailVideoPlaying(false)}
                                        onMouseEnter={handleDetailPreviewMouseEnter}
                                        onMouseLeave={handleDetailPreviewMouseLeave}
                                        loop={mediaDetailLoop}
                                        style={{ objectFit: "contain" }}
                                    />
                                ) : (
                                    <img
                                        key={`viewer-image-${currentMedia.id}`}
                                        className="tagged-media-detail-media"
                                        src={viewerUrl}
                                        alt={currentMedia.displayname || currentMedia.filename || "Media"}
                                        onLoad={handleImageLoad}
                                        fetchPriority="high"
                                        decoding="async"
                                        style={{ objectFit: "contain" }}
                                    />
                                )
                            ) : (
                                <div className="tagged-media-detail-empty-preview">
                                    <p>No preview available for this file.</p>
                                </div>
                            )}
                        </div>

                        {mediaTransitionSnapshot ? (
                            <div
                                className={`tagged-media-detail-frame tagged-media-detail-frame--snapshot${isMediaChanging ? ` is-leaving is-${mediaTransitionSnapshot.direction}` : ""}`}
                                aria-hidden="true"
                            >
                                {mediaTransitionSnapshot.blurUrl && mediaTransitionSnapshot.showBlur ? (
                                    <div
                                        className="tagged-media-detail-viewer-blur-bg"
                                        style={{ backgroundImage: `url(${mediaTransitionSnapshot.blurUrl})` }}
                                    />
                                ) : null}
                                {mediaTransitionSnapshot.isVideo ? (
                                    <video
                                        className="tagged-media-detail-media"
                                        src={mediaTransitionSnapshot.url}
                                        poster={mediaTransitionSnapshot.poster}
                                        muted
                                        playsInline
                                        preload="metadata"
                                    />
                                ) : (
                                    <img
                                        className="tagged-media-detail-media"
                                        src={mediaTransitionSnapshot.url}
                                        alt=""
                                    />
                                )}
                            </div>
                        ) : null}

                        {viewerUrl && (
                            <button
                                type="button"
                                className={`tagged-media-detail-viewer-hitbox${viewerIsVideo ? " is-video" : ""}`}
                                onClick={handleOpenLightbox}
                                aria-label="Open media in modal view"
                            />
                        )}

                        {isVideo && !isDetailVideoPlaying && !isMediaChanging ? (
                            <span className="tagged-media-detail-play-badge" aria-hidden="true">
                                <FontAwesomeIcon icon={faPlay} className="text-xl text-white" />
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
                                            className={DETAIL_OVERLAY_ACTION_CLASSES}
                                            onClick={handleToggleFavourite}
                                            aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                                            aria-pressed={isFavourite}
                                            disabled={isTogglingFavourite}
                                            title={isFavourite ? "Remove from favourites" : "Add to favourites"}
                                        >
                                            <FontAwesomeIcon icon={isFavourite ? faHeartSolid : faHeartRegular} className="text-lg" aria-hidden="true" />
                                        </button>

                                        <button
                                            type="button"
                                            className={DETAIL_OVERLAY_ACTION_CLASSES}
                                            onClick={openEditModal}
                                            aria-label="Edit media"
                                            title="Edit media"
                                        >
                                            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className={DETAIL_OVERLAY_ACTION_CLASSES}
                                            onClick={openDeleteCurrentMediaConfirm}
                                            aria-label="Delete media"
                                            title="Delete media"
                                            disabled={isDeletingMedia}
                                        >
                                            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className={DETAIL_OVERLAY_ACTION_CLASSES}
                                            onClick={handleDownloadMedia}
                                            aria-label="Download media"
                                            title="Download media"
                                            disabled={!mediaUrl || !currentMedia || isDownloadingMedia}
                                        >
                                            <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
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
                                                <span aria-hidden="true">â–²</span>
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
                                                <span aria-hidden="true">â–²</span>
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {shouldShowCounter ? (
                        <div
                            className="tagged-media-detail-gallery-position"
                            role="status"
                            aria-label={`Media ${currentIndex + 1} of ${filteredMediaItems.length}`}
                        >
                            <div
                                className={`tagged-media-detail-gallery-progress${usesSegmentedProgress ? " is-segmented" : ""}`}
                                aria-hidden="true"
                                style={
                                    usesSegmentedProgress
                                        ? { "--tagged-gallery-segments": filteredMediaItems.length }
                                        : undefined
                                }
                            >
                                {usesSegmentedProgress ? (
                                    Array.from({ length: filteredMediaItems.length }, (_, index) => (
                                        <span
                                            key={`gallery-progress-${filteredMediaItems[index]?.id || index}`}
                                            className={`tagged-media-detail-gallery-progress-segment${index === currentIndex ? " is-active" : ""}`}
                                        />
                                    ))
                                ) : (
                                    <span
                                        className="tagged-media-detail-gallery-progress-value"
                                        style={{ width: `${galleryProgress}%` }}
                                    />
                                )}
                            </div>
                            <span className="tagged-media-detail-gallery-position-label" aria-hidden="true">
                                Media {currentIndex + 1} of {filteredMediaItems.length}
                            </span>
                        </div>
                    ) : null}
                </div>

                <aside className="tagged-media-detail-info-column tagged-media-detail-info-column--mobile h-auto! gap-4! rounded-xl! border! border-neutral-200! bg-white/70! p-4! shadow-none! backdrop-blur-sm! dark:border-neutral-800! dark:bg-neutral-900/70!">
                    <header className="tagged-media-detail-header">
                        <div className="tagged-media-detail-header-top-row">
                            <div className="tagged-media-detail-title-block">
                                <div className="tagged-media-detail-title-row">
                                    <h1 title={currentMedia.displayname}>{currentMedia.displayname || "Undefined"}</h1>
                                </div>
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
                            icon={faCopyright}
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
                                            <FontAwesomeIcon icon={isVideo ? faVideo : faImage} aria-hidden="true" />
                                            {isVideo ? "Video" : "Image"}
                                        </span>
                                    </div>
                                </div>
                            }
                        />

                        <TagGroup
                            title="Tags"
                            icon={faTags}
                            tags={defaultTags}
                            expanded={expandedDefaultTags}
                            onToggle={() => setExpandedDefaultTags((previous) => !previous)}
                            onTagClick={handleFilterByTag}
                            tagSurface="light"
                        />

                        <section className="tagged-media-detail-author-group" aria-label="Author info">
                            <h3>
                                <FontAwesomeIcon icon={faUser} aria-hidden="true" />
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

                    </div>

                    <div className="grid grid-cols-4 gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800" aria-label="Media actions">
                        <button type="button" className={MOBILE_DETAIL_ACTION_CLASSES} onClick={handleToggleFavourite} aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"} aria-pressed={isFavourite} disabled={isTogglingFavourite}>
                            <FontAwesomeIcon icon={isFavourite ? faHeartSolid : faHeartRegular} className="text-base" aria-hidden="true" />
                            <span>{isFavourite ? "Saved" : "Favourite"}</span>
                        </button>
                        <button type="button" className={MOBILE_DETAIL_ACTION_CLASSES} onClick={openEditModal}>
                            <FontAwesomeIcon icon={faPen} className="text-base" aria-hidden="true" />
                            <span>Edit</span>
                        </button>
                        <button type="button" className={MOBILE_DETAIL_ACTION_CLASSES} onClick={handleDownloadMedia} disabled={!mediaUrl || !currentMedia || isDownloadingMedia}>
                            <FontAwesomeIcon icon={faDownload} className="text-base" aria-hidden="true" />
                            <span>Download</span>
                        </button>
                        <button type="button" className={`${MOBILE_DETAIL_ACTION_CLASSES} border-red-500/30! text-red-600! hover:bg-red-500/10! hover:text-red-700! dark:text-red-400! dark:hover:text-red-300!`} onClick={openDeleteCurrentMediaConfirm} disabled={isDeletingMedia}>
                            <FontAwesomeIcon icon={faTrash} className="text-base" aria-hidden="true" />
                            <span>Delete</span>
                        </button>
                    </div>
                </aside>
            </div>

            <nav
                className={`tagged-media-detail-page-nav tagged-media-detail-page-nav--desktop${isMediaChanging ? " is-transitioning" : ""}`}
                aria-label="Media navigation"
            >
                {hasPrevious ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button tagged-media-detail-nav-button--desktop tagged-media-detail-nav-button--prev"
                        onClick={handlePrevMedia}
                        aria-label="Previous media"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                    </button>
                ) : null}

                {hasNext ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button tagged-media-detail-nav-button--desktop tagged-media-detail-nav-button--next"
                        onClick={handleNextMedia}
                        aria-label="Next media"
                    >
                        <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
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
                        <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                    </button>
                ) : null}

                {hasNext ? (
                    <button
                        type="button"
                        className="tagged-media-detail-nav-button"
                        onClick={handleNextMedia}
                        aria-label="Next media"
                    >
                        <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                    </button>
                ) : null}
            </nav>

            <MediaEditModal
                isOpen={isEditModalOpen}
                initialValues={{
                    displayname: editDisplayNameInput,
                    author: editAuthorInput,
                    tags: editSelectedTags,
                }}
                distinctDisplayNames={editDistinctDisplayNames}
                distinctAuthors={editDistinctAuthors}
                distinctTagNames={editDistinctTagNames}
                tagColorByName={editTagColorByName}
                tagTypeByName={Object.fromEntries(
                    allTags.map((tag) => [
                        String(tag?.tagname || "").trim().toLowerCase(),
                        String(tag?.type || "default").toLowerCase(),
                    ]),
                )}
                selectedMediaItems={[currentMedia]}
                getAssetUrl={(assetPath) => String(assetPath || "").startsWith("http")
                    ? String(assetPath)
                    : UPLOADS_BASE_URL + String(assetPath || "")}
                isSaving={isSavingEdit}
                error={editError}
                closeOnSave={closeEditModalOnSave}
                onCloseOnSaveChange={setCloseEditModalOnSave}
                navigation={{
                    current: currentIndex + 1,
                    total: filteredMediaItems.length,
                    hasPrevious,
                    hasNext,
                    onPrevious: handlePrevMedia,
                    onNext: handleNextMedia,
                }}
                onClose={closeEditModal}
                onSubmit={handleEditMediaSubmit}
            />

            <DeleteConfirmationModal
                isOpen={isDeleteConfirmOpen}
                title="Delete this media?"
                description="The file and its metadata will be permanently removed. This action cannot be undone."
                confirmLabel="Delete media"
                isDeleting={isDeletingMedia}
                onConfirm={handleDeleteCurrentMedia}
                onClose={closeDeleteCurrentMediaConfirm}
            />

            {isLightboxOpen && lightboxMediaUrl && (
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

                            <IconButton
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleCloseLightbox();
                                }}
                                aria-label="Close modal"
                            >
                                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                            </IconButton>
                        </header>

                        <div className="tagged-media-lightbox-media-wrap">
                            {isVideo ? (
                                <video
                                    ref={lightboxVideoRef}
                                    key={`lightbox-video-${currentMedia.id}`}
                                    className="tagged-media-lightbox-media"
                                    src={lightboxMediaUrl}
                                    controls
                                    playsInline
                                    onClick={(event) => event.stopPropagation()}
                                    loop={mediaDetailLoop}
                                />
                            ) : (
                                <img
                                    key={`lightbox-image-${currentMedia.id}`}
                                    className={`tagged-media-lightbox-media${isLightboxImageZoomed ? " is-zoomed" : ""}${isLightboxImagePanning ? " is-panning" : ""}`}
                                    src={lightboxMediaUrl}
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
