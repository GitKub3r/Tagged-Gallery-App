import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import JSZip from "jszip";
import {
    faCircleCheck,
    faCheckDouble,
    faCloudArrowUp,
    faDownload,
    faFilm,
    faFolderPlus,
    faHeart,
    faImage,
    faList,
    faMagnifyingGlass,
    faPen,
    faShuffle,
    faTableCellsLarge,
    faTag,
    faTrash,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { UploadMediaModal } from "../../components/upload-media-modal/UploadMediaModal";
import { uploadMedia } from "../../api/mediaUploadRequest";
import { galleryApi } from "../../api/galleryApi";
import { MediaCard } from "../../components/media-card/MediaCard";
import { CollectionLoadingSkeleton } from "../../components/loading-skeletons/CollectionLoadingSkeleton";
import { Skeleton } from "../../components/loading-skeletons/Skeleton";
import { MediaEditModal } from "../../components/media-edit-modal/MediaEditModal";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { MediaFacetSearch } from "../../components/media-facet-search/MediaFacetSearch";
import { LibraryToolbar } from "../../components/library-toolbar/LibraryToolbar";
import { ResultsLoadingIndicator } from "../../components/results-loading-indicator/ResultsLoadingIndicator";
import { Pagination } from "../../components/pagination/Pagination";
import { useAppToast } from "../../components/toast/useAppToast";
import { AddToAlbumModal } from "./components/AddToAlbumModal";
import { useAuth } from "../../hooks/useAuth";
import { useDevTools } from "../../hooks/useDevTools";
import { useTagFilter } from "../../context/TagFilterContext";
import { useGridView } from "../../context/GridViewContext";
import { useMarqueeSelection } from "../../hooks/useMarqueeSelection";
import { buildDefaultTagStyle, isDefaultTagColor } from "../../utils/tagStyle";
import { matchesMediaFacetFilters } from "../../utils/mediaFacetFilters";
import { formatDownloadSpeed } from "../../utils/downloadUtils";
import "./GalleryPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const UPLOADS_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");
const OPEN_UPLOAD_EVENT = "tagged:open-upload";
const GENERAL_FILTER_COMMAND_EVENT = "tagged:general-filter-command";
const GENERAL_FILTER_STATE_EVENT = "tagged:general-filter-state";
const GALLERY_PAGE_SIZE_STORAGE_KEY = "tagged:gallery-page-size";
const GALLERY_CURRENT_PAGE_STORAGE_KEY = "tagged:gallery-current-page";
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 10;
const GALLERY_SEARCH_STORAGE_KEY = "tagged:gallery-search-query";
const GALLERY_SCROLL_STORAGE_KEY_PREFIX = "tagged:gallery-scroll-position";
const MAX_SUGGESTIONS = 8;
const TOOLBAR_BUTTON_CLASSES =
    "inline-flex! h-12! w-auto! items-center! gap-2! rounded-xl! border! px-4! py-2! text-sm! font-semibold! shadow-none! transition-colors! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-neutral-500!";
const TOOLBAR_BUTTON_ACTIVE_CLASSES =
    "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!";
const TOOLBAR_BUTTON_INACTIVE_CLASSES =
    "border-neutral-300! bg-white! text-neutral-600! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-300! dark:hover:bg-neutral-800!";
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

const isVideoOrGifMedia = (media) => {
    const mediaType = String(media?.mediatype || "").toLowerCase();
    return mediaType.includes("video") || mediaType.includes("gif");
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

        if (/^<!doctype|^<html/i.test(bodyText)) {
            return {
                success: false,
                message:
                    "El servidor devolvio HTML en lugar de JSON. Verifica VITE_API_URL y que el backend este corriendo.",
            };
        }

        return {
            success: false,
            message: bodyText || fallbackMessage,
        };
    }
};

const getAssetUrl = (assetPath) => {
    if (!assetPath) {
        return "";
    }

    if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
        return assetPath;
    }

    return `${UPLOADS_BASE_URL}${assetPath}`;
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

            return String(tag.tagname || tag.name || "").trim();
        })
        .filter(Boolean);
};

const getCommonTagNames = (mediaList) => {
    if (!Array.isArray(mediaList) || mediaList.length === 0) {
        return [];
    }

    const tagMaps = mediaList.map((media) => {
        const map = new Map();

        mapTagsFromMedia(media).forEach((tagName) => {
            const normalized = String(tagName || "")
                .trim()
                .toLowerCase();

            if (!normalized || map.has(normalized)) {
                return;
            }

            map.set(normalized, String(tagName || "").trim());
        });

        return map;
    });

    const [firstTagMap, ...remainingTagMaps] = tagMaps;

    return Array.from(firstTagMap.entries())
        .filter(([normalized]) => remainingTagMaps.every((map) => map.has(normalized)))
        .map(([, original]) => original);
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

const buildTagChipStyle = (hexColor) => {
    const rgb = isDefaultTagColor(hexColor) ? null : getHexRgb(hexColor);
    const darkTheme = isDarkThemeActive();

    if (!rgb) {
        return buildDefaultTagStyle();
    }

    const luminance = getRelativeLuminance(rgb);
    const isNearWhite = luminance > 0.88;
    const isDarkTone = luminance < 0.3;
    const isVeryDark = luminance < 0.12;

    if (darkTheme) {
        const liftedTone = isDarkTone ? mixRgbWithWhite(rgb, isVeryDark ? 0.72 : 0.56) : rgb.hex;
        const textColor = isNearWhite ? "#f7f9ff" : liftedTone;
        const borderColor = isNearWhite ? "rgba(255, 255, 255, 0.72)" : `${liftedTone}BB`;
        const backgroundColor = isNearWhite ? "rgba(255, 255, 255, 0.16)" : `${liftedTone}38`;

        return {
            backgroundColor,
            color: textColor,
            borderColor,
            borderWidth: "2px",
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.3)",
        };
    }

    return {
        backgroundColor: `${rgb.hex}22`,
        color: luminance > 0.72 ? "#111111" : rgb.hex,
        borderColor: isNearWhite ? "rgba(0, 0, 0, 0.22)" : `${rgb.hex}66`,
        borderWidth: "2px",
        boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.22)",
    };
};

const countMediaTags = (media) => {
    const candidates = media?.tags || media?.tag_names || media?.mediaTags || media?.relatedTags || [];

    if (!Array.isArray(candidates)) {
        return 0;
    }

    return candidates.filter((tag) => {
        if (typeof tag === "string") {
            return String(tag).trim().length > 0;
        }

        return String(tag?.tagname || tag?.name || "").trim().length > 0;
    }).length;
};

export const GalleryListItem = ({
    media,
    onOpenMedia,
    onToggleFavourite,
    onRequestDelete,
    onActivateSelectionMode,
    isTogglingFavourite,
    selectionMode,
    isSelected,
    onToggleSelect,
    showFavourite = true,
    showDelete = true,
}) => {
    const LONG_PRESS_MS = 420;
    const TOUCH_MOVE_THRESHOLD_PX = 12;
    const isFavourite = media.is_favourite === 1 || media.is_favourite === true;
    const authorLabel = String(media.author || "").trim() || "Unknown";
    const mediaTitle = String(media.displayname || "").trim() || "Undefined";
    const mediaTagCount = countMediaTags(media);
    const previewUrl = getAssetUrl(media.thumbpath || media.filepath || "");
    const longPressTimerRef = useRef(null);
    const longPressTriggeredRef = useRef(false);
    const touchStartPointRef = useRef(null);
    const touchMovedRef = useRef(false);
    const suppressNextClickRef = useRef(false);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
    };

    }
    const handleRowClick = () => {
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
        onOpenMedia?.(media.id);
    };

    const handleTouchStart = (event) => {
        const activeSelection = typeof window !== "undefined" ? window.getSelection?.() : null;
        if (activeSelection && activeSelection.rangeCount > 0) {
            activeSelection.removeAllRanges();

        }
        if (selectionMode) {
            return;

        }
        longPressTriggeredRef.current = false;
        touchMovedRef.current = false;
        suppressNextClickRef.current = false;
        clearLongPressTimer();

        const touch = event.touches?.[0];
        if (touch) {
            touchStartPointRef.current = { x: touch.clientX, y: touch.clientY };

        }
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            onActivateSelectionMode?.(media.id);
        }, LONG_PRESS_MS);
    };

    const handleTouchMove = (event) => {
        if (selectionMode) {
            return;

        }
        const touch = event.touches?.[0];

        if (!touch || !touchStartPointRef.current) {
            return;

        }
        const deltaX = Math.abs(touch.clientX - touchStartPointRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPointRef.current.y);

        if (deltaX > TOUCH_MOVE_THRESHOLD_PX || deltaY > TOUCH_MOVE_THRESHOLD_PX) {
            touchMovedRef.current = true;
            clearLongPressTimer();
    };

    }
    const handleTouchEnd = () => {
        if (touchMovedRef.current) {
            suppressNextClickRef.current = true;
        }

        touchStartPointRef.current = null;
        touchMovedRef.current = false;
        clearLongPressTimer();
    };

    const handleTouchCancel = () => {
        touchStartPointRef.current = null;
        touchMovedRef.current = false;
        clearLongPressTimer();
    };

    return (
        <article
            className="group flex min-h-20 w-full cursor-pointer items-center gap-3 border-b border-neutral-200 px-1 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:border-neutral-800 sm:gap-4"
            role="button"
            tabIndex={0}
            onClick={handleRowClick}
            onContextMenu={(event) => {
                if (selectionMode) {
                    return;
                }

                event.preventDefault();
                onActivateSelectionMode?.(media.id);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }

                event.preventDefault();
                handleRowClick();
            }}
            aria-label={`Media ${mediaTitle}`}
        >
            <div
                className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-950 sm:h-20 sm:w-28"
                aria-hidden="true"
            >
                {previewUrl ? (
                    <img className="h-full w-full object-cover" src={previewUrl} alt="" />
                ) : (
                    <span className="flex h-full items-center justify-center text-[0.65rem] font-semibold text-neutral-500">No preview</span>
                )}

                {selectionMode ? (
                    <span
                        className={`absolute left-2 top-2 text-lg drop-shadow-md ${isSelected ? "text-white" : "text-white/45"}`}
                        aria-hidden="true"
                    >
                        <FontAwesomeIcon icon={faCircleCheck} />
                    </span>
                ) : null}
            </div>

            <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-neutral-950 dark:text-neutral-100 sm:text-base" title={mediaTitle}>
                    {mediaTitle}
                </h3>

                <p className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400" title={`${authorLabel} - ${mediaTagCount} tags`}>
                    <span className="truncate">{authorLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                        <FontAwesomeIcon icon={faTag} aria-hidden="true" />
                        {mediaTagCount}
                    </span>
                </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {showFavourite ? (
                    <button
                        type="button"
                        className={`flex! h-9! w-9! items-center! justify-center! rounded-xl! border-0! bg-transparent! p-0! shadow-none! hover:bg-transparent! hover:text-neutral-950! dark:hover:bg-transparent! dark:hover:text-neutral-100! ${isFavourite ? "text-neutral-950! dark:text-neutral-100!" : "text-neutral-400! dark:text-neutral-500!"}`}
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
                        <FontAwesomeIcon icon={isFavourite ? faHeart : faHeartRegular} aria-hidden="true" />
                    </button>
                ) : null}

                {showDelete ? (
                    <button
                        type="button"
                        className="flex! h-9! w-9! items-center! justify-center! rounded-xl! border-0! bg-transparent! p-0! text-neutral-400! shadow-none! hover:bg-transparent! hover:text-neutral-950! dark:text-neutral-500! dark:hover:bg-transparent! dark:hover:text-neutral-100!"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (selectionMode) {
                                return;
                            }
                            onRequestDelete?.(media.id);
                        }}
                        aria-label={`Delete media ${mediaTitle}`}
                        title="Delete media"
                        disabled={selectionMode}
                    >
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    </button>
                ) : null}
            </div>
        </article>
    );
};

const LazyViewportItem = ({
    children,
    className = "",
    placeholderClassName = "",
    minHeight = "0",
    rootMargin = "180px 0px",
    selectionId,
}) => {
    const hostRef = useRef(null);
    const [hasBeenVisible, setHasBeenVisible] = useState(false);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const hostNode = hostRef.current;
        if (!hostNode) {
            return;
        }

        if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
            setHasBeenVisible(true);
            setIsInView(true);
            return;
        }

        const observer = new window.IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                const nowInView = Boolean(entry?.isIntersecting);
                setIsInView(nowInView);
                if (nowInView) {
                    setHasBeenVisible(true);
                }
            },
            {
                root: null,
                rootMargin,
                threshold: 0,
            },
        );

        observer.observe(hostNode);
        return () => observer.disconnect();
    }, [rootMargin]);

    return (
        <div
            ref={hostRef}
            data-marquee-selection-id={selectionId}
            className={`tagged-gallery-lazy-item ${className}${hasBeenVisible ? " is-mounted" : ""}${isInView ? " is-visible" : ""}`}
        >
            {hasBeenVisible ? (
                children
            ) : (
                <Skeleton className={placeholderClassName} style={{ minHeight }} />
            )}
        </div>
    );
};

export const GalleryPage = ({ onlyFavourites = false, basePath = "/gallery" }) => {
    const { user, fetchWithAuth, accessToken } = useAuth();
    const { forceLoading } = useDevTools();
    const navigate = useNavigate();
    const location = useLocation();
    const [mediaItems, setMediaItems] = useState([]);
    const [mediaTotal, setMediaTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [togglingIds, setTogglingIds] = useState(new Set());
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadToast, setUploadToast] = useState(null);
    const uploadToastTimeoutRef = useRef(null);
    const uploadAbortControllerRef = useRef(null);
    const [isUploadToastMode, setIsUploadToastMode] = useState(false);
    const [pageSize, setPageSize] = useState(() => {
        const stored = localStorage.getItem(GALLERY_PAGE_SIZE_STORAGE_KEY);
        const n = Number(stored);
        return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE;
    });
    useEffect(() => {
        localStorage.setItem(GALLERY_PAGE_SIZE_STORAGE_KEY, String(pageSize));
    }, [pageSize]);
    // Toast para progreso de subida (reutiliza estilos de download toast)
    const showUploadToast = (nextToast, autoCloseMs = 0) => {
        if (uploadToastTimeoutRef.current) {
            window.clearTimeout(uploadToastTimeoutRef.current);
            uploadToastTimeoutRef.current = null;
        }
        setUploadToast(nextToast);
        if (autoCloseMs > 0) {
            uploadToastTimeoutRef.current = window.setTimeout(() => {
                setUploadToast(null);
                uploadToastTimeoutRef.current = null;
            }, autoCloseMs);
    };
    }
    const hideUploadToast = () => {
        if (uploadToastTimeoutRef.current) {
            window.clearTimeout(uploadToastTimeoutRef.current);
            uploadToastTimeoutRef.current = null;
        }
        setUploadToast(null);
    };
    const [currentPage, setCurrentPage] = useState(() => {
        const stored = Number(localStorage.getItem(GALLERY_CURRENT_PAGE_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? stored : 1;
    });
    const [uploadPreviewUrls, setUploadPreviewUrls] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isDraggingUploadFiles, setIsDraggingUploadFiles] = useState(false);
    const [displayNameInput, setDisplayNameInput] = useState("");
    const [authorInput, setAuthorInput] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const uploadMediaMutation = useMutation({ mutationFn: uploadMedia });
    const [uploadTotal, setUploadTotal] = useState(0);
    const [uploadRemaining, setUploadRemaining] = useState(0);
    const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
    const [uploadSpeedLabel, setUploadSpeedLabel] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const [distinctDisplayNames, setDistinctDisplayNames] = useState([]);
    const [distinctAuthors, setDistinctAuthors] = useState([]);
    const [distinctTagNames, setDistinctTagNames] = useState([]);
    const [tagColorByName, setTagColorByName] = useState({});
    const [tagTypeByName, setTagTypeByName] = useState({});
    const [activeSuggestionField, setActiveSuggestionField] = useState(null);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMediaIds, setSelectedMediaIds] = useState(new Set());
    const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
    const [isDeletingSelected, setIsDeletingSelected] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isSingleDeleteFlow, setIsSingleDeleteFlow] = useState(false);
    const [selectionActionError, setSelectionActionError] = useState(null);
    const [downloadToast, setDownloadToast] = useState(null);
    const [selectionActionToast, setSelectionActionToast] = useState(null);
    const [isEditSelectedModalOpen, setIsEditSelectedModalOpen] = useState(false);
    const [isSavingSelectedEdit, setIsSavingSelectedEdit] = useState(false);
    const [selectedEditError, setSelectedEditError] = useState(null);
    const [selectedEditInitialValues, setSelectedEditInitialValues] = useState({
        displayname: "",
        author: "",
        tags: [],
    });
    const [isAddToAlbumModalOpen, setIsAddToAlbumModalOpen] = useState(false);
    const [isLoadingAlbumsForModal, setIsLoadingAlbumsForModal] = useState(false);
    const [isAddingSelectedToAlbums, setIsAddingSelectedToAlbums] = useState(false);
    const [addToAlbumError, setAddToAlbumError] = useState(null);
    const [albumCandidates, setAlbumCandidates] = useState([]);
    const [albumSelectionSearch, setAlbumSelectionSearch] = useState("");
    const [albumSelectionTagFilterSearch, setAlbumSelectionTagFilterSearch] = useState("");
    const [albumSelectionTagFilterMode, setAlbumSelectionTagFilterMode] = useState("include");
    const [selectedAlbumFilterTags, setSelectedAlbumFilterTags] = useState([]);
    const [selectedAlbumIdsForAdd, setSelectedAlbumIdsForAdd] = useState(new Set());
    const [submittedGallerySearchQuery, setSubmittedGallerySearchQuery] = useState(() => {
        if (typeof window === "undefined") {
            return "";
        }

        return String(window.localStorage.getItem(GALLERY_SEARCH_STORAGE_KEY) || "");
    });
    const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
    const [isRandomOrderEnabled, setIsRandomOrderEnabled] = useState(false);
    const [randomOrderSeed, setRandomOrderSeed] = useState(null);
    const [isGalleryShuffling, setIsGalleryShuffling] = useState(false);
    const [galleryShufflePreviewItems, setGalleryShufflePreviewItems] = useState([]);
    const { gridViewMode, setGridViewMode, gridColumns } = useGridView();
    const { selectedIncludeFilterTags, selectedExcludeFilterTags, clearFilterTags } = useTagFilter();
    const hiddenFileInputRef = useRef(null);
    const uploadPreviewUrlsRef = useRef([]);
    const downloadToastTimeoutRef = useRef(null);
    const selectionActionToastTimeoutRef = useRef(null);
    const galleryScrollSaveRafRef = useRef(null);
    const isRestoringGalleryScrollRef = useRef(false);
    const galleryShuffleTimeoutRef = useRef(null);
    const uploadDragDepthRef = useRef(0);

    const galleryScrollStorageKey = `${GALLERY_SCROLL_STORAGE_KEY_PREFIX}:${basePath}`;

    useLayoutEffect(() => {
        if (typeof window === "undefined" || !window.history) {
            return undefined;

        }
        const previousScrollRestoration = window.history.scrollRestoration;
        window.history.scrollRestoration = "manual";

        return () => {
            window.history.scrollRestoration = previousScrollRestoration;
        };
    }, []);

    const saveGalleryScrollPosition = () => {
        if (typeof window === "undefined") {
            return;

        }
        const shellContent = document.querySelector(".tagged-shell-content");
        const windowScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const shellScrollTop = shellContent instanceof HTMLElement ? shellContent.scrollTop : 0;

        try {
            window.localStorage.setItem(
                galleryScrollStorageKey,
                JSON.stringify({
                    windowScrollTop,
                    shellScrollTop,
                }),
            );
        } catch {
            // Ignore storage failures in restricted environments.
        }
    };

    const clearGalleryScrollPosition = () => {
        if (typeof window === "undefined") {
            return;
        }

        try {
            window.localStorage.setItem(
                galleryScrollStorageKey,
                JSON.stringify({
                    windowScrollTop: 0,
                    shellScrollTop: 0,
                }),
            );
        } catch {
            // Ignore storage failures in restricted environments.
        }
    };

    const scrollGalleryToTop = () => {
        if (typeof window === "undefined") {
            return;
        }

        if (galleryScrollSaveRafRef.current !== null) {
            window.cancelAnimationFrame(galleryScrollSaveRafRef.current);
            galleryScrollSaveRafRef.current = null;
        }

        isRestoringGalleryScrollRef.current = false;
        clearGalleryScrollPosition();

        const shellContent = document.querySelector(".tagged-shell-content");
        if (shellContent instanceof HTMLElement) {
            shellContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }

        window.scrollTo({ top: 0, left: 0, behavior: "auto" });

        window.requestAnimationFrame(() => {
            clearGalleryScrollPosition();
        });
    };

    useLayoutEffect(() => {
        if (typeof window === "undefined") {
            return undefined;

        }
        let isCancelled = false;
        let restoreRafId = null;
        let restoreAttempts = 0;
        const maxRestoreAttempts = 6;

        const rawStoredValue = window.localStorage.getItem(galleryScrollStorageKey) || "";
        let storedWindowScrollTop = 0;
        let storedShellScrollTop = 0;

        if (rawStoredValue.startsWith("{")) {
            try {
                const parsed = JSON.parse(rawStoredValue);
                storedWindowScrollTop = Number(parsed?.windowScrollTop) || 0;
                storedShellScrollTop = Number(parsed?.shellScrollTop) || 0;
            } catch {
                storedWindowScrollTop = 0;
                storedShellScrollTop = 0;
            }
        } else {
            const legacyStoredScrollTop = Number.parseInt(rawStoredValue, 10);
            if (Number.isFinite(legacyStoredScrollTop) && legacyStoredScrollTop > 0) {
                storedWindowScrollTop = legacyStoredScrollTop;
            }
        }
        const restoreScrollPosition = () => {
            if (isCancelled || loading || !isRestoringGalleryScrollRef.current) {
                return;

            }
            const shellContent = document.querySelector(".tagged-shell-content");

            if (storedShellScrollTop > 0 && shellContent instanceof HTMLElement) {
                shellContent.scrollTo({ top: storedShellScrollTop, left: 0, behavior: "auto" });

            }
            if (storedWindowScrollTop > 0) {
                window.scrollTo({ top: storedWindowScrollTop, left: 0, behavior: "auto" });

            }
            restoreAttempts += 1;

            const currentWindowScrollTop =
                window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
            const currentShellScrollTop = shellContent instanceof HTMLElement ? shellContent.scrollTop : 0;
            const windowDelta = Math.abs(currentWindowScrollTop - storedWindowScrollTop);
            const shellDelta = Math.abs(currentShellScrollTop - storedShellScrollTop);
            const isWindowRestored = storedWindowScrollTop <= 0 || windowDelta <= 2;
            const isShellRestored = storedShellScrollTop <= 0 || shellDelta <= 2;

            if ((isWindowRestored && isShellRestored) || restoreAttempts >= maxRestoreAttempts) {
                isRestoringGalleryScrollRef.current = false;
                return;

            }
            restoreRafId = window.requestAnimationFrame(restoreScrollPosition);
        };

        if (!loading && (storedWindowScrollTop > 0 || storedShellScrollTop > 0)) {
            isRestoringGalleryScrollRef.current = true;
            restoreRafId = window.requestAnimationFrame(restoreScrollPosition);
        } else {
            isRestoringGalleryScrollRef.current = false;

        }
        const handleScroll = () => {
            if (isRestoringGalleryScrollRef.current) {
                return;

            }
            if (galleryScrollSaveRafRef.current !== null) {
                return;

            }
            galleryScrollSaveRafRef.current = window.requestAnimationFrame(() => {
                galleryScrollSaveRafRef.current = null;
                saveGalleryScrollPosition();
            });
        };

        const cancelScrollRestore = () => {
            isRestoringGalleryScrollRef.current = false;

            if (restoreRafId !== null) {
                window.cancelAnimationFrame(restoreRafId);
                restoreRafId = null;
            }
        };

        const shellContent = document.querySelector(".tagged-shell-content");

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("wheel", cancelScrollRestore, { passive: true });
        window.addEventListener("touchstart", cancelScrollRestore, { passive: true });

        if (shellContent instanceof HTMLElement) {
            shellContent.addEventListener("scroll", handleScroll, { passive: true });

        }
        return () => {
            isCancelled = true;

            if (galleryScrollSaveRafRef.current !== null) {
                window.cancelAnimationFrame(galleryScrollSaveRafRef.current);
                galleryScrollSaveRafRef.current = null;

            }
            if (restoreRafId !== null) {
                window.cancelAnimationFrame(restoreRafId);

            }
            isRestoringGalleryScrollRef.current = false;

            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("wheel", cancelScrollRestore);
            window.removeEventListener("touchstart", cancelScrollRestore);

            if (shellContent instanceof HTMLElement) {
                shellContent.removeEventListener("scroll", handleScroll);
            }
        };
    }, [galleryScrollStorageKey, loading]);
    const uploadedCount = Math.max(0, uploadTotal - uploadRemaining);
    const normalizedUploadProgress = Number.isFinite(uploadProgressPercent)
        ? Math.max(0, Math.min(100, uploadProgressPercent))
        : 0;
    const selectedMediaCount = selectedMediaIds.size;
    const activeTagFilter = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("tag")?.trim() || "";
    }, [location.search]);
    const activeAuthorFilter = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("author")?.trim() || "";
    }, [location.search]);

    const orderedMediaItems = mediaItems;

    const filteredMediaItems = useMemo(() => {
        const normalizedFilter = activeTagFilter.toLowerCase();
        const normalizedAuthorFilter = activeAuthorFilter.toLowerCase();
        const normalizedIncludedTags = selectedIncludeFilterTags.map((tag) => tag.toLowerCase());
        const normalizedExcludedTags = selectedExcludeFilterTags.map((tag) => tag.toLowerCase());

        return orderedMediaItems.filter((media) => {
            if (onlyFavourites) {
                const isFavourite = media.is_favourite === 1 || media.is_favourite === true;

                if (!isFavourite) {
                    return false;

                }
            }
            if (mediaTypeFilter === "image" && isVideoOrGifMedia(media)) {
                return false;

            }
            if (mediaTypeFilter === "video" && !isVideoOrGifMedia(media)) {
                return false;

            }
            if (normalizedAuthorFilter) {
                const mediaAuthor = String(media.author || "").toLowerCase();
                if (mediaAuthor !== normalizedAuthorFilter) {
                    return false;

                }
            }
            const tagCandidates = media.tags || media.tag_names || media.mediaTags || media.relatedTags || [];
            const mediaTagNames = Array.isArray(tagCandidates)
                ? tagCandidates
                      .map((tag) => {
                          if (typeof tag === "string") {
                              return tag;

                          }
                          return tag?.tagname || tag?.name || "";
                      })
                      .filter(Boolean)
                      .map((tag) => String(tag).toLowerCase())
                : [];

            if (normalizedIncludedTags.length > 0) {
                const hasAllIncludedTags = normalizedIncludedTags.every((filterTag) =>
                    mediaTagNames.includes(filterTag),
                );

                if (!hasAllIncludedTags) {
                    return false;

                }
            }
            if (normalizedExcludedTags.length > 0) {
                const hasAnyExcludedTag = normalizedExcludedTags.some((filterTag) => mediaTagNames.includes(filterTag));

                if (hasAnyExcludedTag) {
                    return false;

                }
            }
            if (normalizedFilter) {
                return mediaTagNames.includes(normalizedFilter);

            }
            return matchesMediaFacetFilters(media, submittedGallerySearchQuery);
        });
    }, [
        orderedMediaItems,
        activeTagFilter,
        activeAuthorFilter,
        onlyFavourites,
        submittedGallerySearchQuery,
        selectedIncludeFilterTags,
        selectedExcludeFilterTags,
        mediaTypeFilter,
    ]);

    const totalFilteredMediaCount = mediaTotal;
    const totalPages = Math.max(1, Math.ceil(totalFilteredMediaCount / pageSize));
    const visibleMediaItems = filteredMediaItems;

    const hasActiveSearch = submittedGallerySearchQuery.trim().length > 0;
    const hasActiveFilterTags = selectedIncludeFilterTags.length > 0 || selectedExcludeFilterTags.length > 0;
    const hasVisibleMediaItems = visibleMediaItems.length > 0;
    const areAllVisibleMediaSelected =
        hasVisibleMediaItems && visibleMediaItems.every((media) => selectedMediaIds.has(media.id));

    const clearDownloadToastTimer = () => {
        if (downloadToastTimeoutRef.current) {
            window.clearTimeout(downloadToastTimeoutRef.current);
            downloadToastTimeoutRef.current = null;
    };

    }
    const showDownloadToast = (nextToast, autoCloseMs = 0) => {
        clearDownloadToastTimer();
        setDownloadToast(nextToast);

        if (autoCloseMs > 0) {
            downloadToastTimeoutRef.current = window.setTimeout(() => {
                setDownloadToast(null);
                downloadToastTimeoutRef.current = null;
            }, autoCloseMs);
    };

    }
    const hideDownloadToast = () => {
        clearDownloadToastTimer();
        setDownloadToast(null);
    };

    const clearSelectionActionToastTimer = () => {
        if (selectionActionToastTimeoutRef.current) {
            window.clearTimeout(selectionActionToastTimeoutRef.current);
            selectionActionToastTimeoutRef.current = null;
        }
    };

    const showSelectionActionToast = (nextToast, autoCloseMs = 0) => {
        clearSelectionActionToastTimer();
        setSelectionActionToast(nextToast);

        if (autoCloseMs > 0) {
            selectionActionToastTimeoutRef.current = window.setTimeout(() => {
                setSelectionActionToast(null);
                selectionActionToastTimeoutRef.current = null;
            }, autoCloseMs);
        }
    };

    const hideSelectionActionToast = () => {
        clearSelectionActionToastTimer();
        setSelectionActionToast(null);
    };
    const activeUploadToast = isUploadToastMode && isUploading
        ? {
              title: "Uploading…",
              message: `${uploadedCount} / ${uploadTotal} file${uploadTotal !== 1 ? "s" : ""}`,
              progress: normalizedUploadProgress,
              speedLabel: uploadSpeedLabel,
              dismissible: false,
          }
        : !isUploadToastMode
          ? uploadToast
          : null;
    const cancelUpload = () => uploadAbortControllerRef.current?.abort();
    useAppToast(activeUploadToast, {
        id: "gallery-upload",
        onDismiss: () => isUploadToastMode ? setIsUploadToastMode(false) : hideUploadToast(),
        onCancel: isUploadToastMode && isUploading ? cancelUpload : undefined,
    });
    useAppToast(selectionActionToast, { id: "gallery-selection-action", onDismiss: hideSelectionActionToast });
    useAppToast(downloadToast, { id: "gallery-download", onDismiss: hideDownloadToast });

    useEffect(() => {
        if (!isUploading) return undefined;

        const preventRefreshShortcut = (event) => {
            const isRefreshShortcut = event.key === "F5"
                || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r");

            if (isRefreshShortcut) event.preventDefault();
        };
        const confirmBeforeLeaving = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("keydown", preventRefreshShortcut, true);
        window.addEventListener("beforeunload", confirmBeforeLeaving);
        return () => {
            window.removeEventListener("keydown", preventRefreshShortcut, true);
            window.removeEventListener("beforeunload", confirmBeforeLeaving);
        };
    }, [isUploading]);

    useEffect(
        () => () => {
            if (selectionActionToastTimeoutRef.current) {
                window.clearTimeout(selectionActionToastTimeoutRef.current);
                selectionActionToastTimeoutRef.current = null;
            }
        },
        [],
    );

    const albumTagFilterCandidates = useMemo(() => {
        const uniqueTags = new Map();

        albumCandidates.forEach((album) => {
            const tags = Array.isArray(album.album_tag_names) ? album.album_tag_names : [];

            tags.forEach((tagName) => {
                const normalized = String(tagName || "")
                    .trim()
                    .toLowerCase();

                if (!normalized || uniqueTags.has(normalized)) {
                    return;

                }
                uniqueTags.set(normalized, String(tagName || "").trim());
            });
        });

        return Array.from(uniqueTags.values()).sort((a, b) => a.localeCompare(b));
    }, [albumCandidates]);

    const visibleAlbumTagFilterCandidates = useMemo(() => {
        const query = albumSelectionTagFilterSearch.trim().toLowerCase();

        if (!query) {
            return albumTagFilterCandidates;

        }
        return albumTagFilterCandidates.filter((tagName) => tagName.toLowerCase().includes(query));
    }, [albumTagFilterCandidates, albumSelectionTagFilterSearch]);

    const filteredAlbumCandidates = useMemo(() => {
        const normalizedSearch = albumSelectionSearch.trim().toLowerCase();
        const normalizedFilterTags = selectedAlbumFilterTags.map((tag) => tag.toLowerCase());

        return albumCandidates.filter((album) => {
            const albumDisplayName = String(album.displayname || album.albumname || "").toLowerCase();

            if (normalizedSearch && !albumDisplayName.includes(normalizedSearch)) {
                return false;

            }
            if (normalizedFilterTags.length > 0) {
                const albumTagNames = Array.isArray(album.album_tag_names)
                    ? album.album_tag_names.map((tag) => String(tag).toLowerCase())
                    : [];

                if (albumSelectionTagFilterMode === "exclude") {
                    const hasAnyExcludedTag = normalizedFilterTags.some((filterTag) =>
                        albumTagNames.includes(filterTag),
                    );
                    if (hasAnyExcludedTag) {
                        return false;
                } else {
                    }
                    const hasAllTags = normalizedFilterTags.every((filterTag) => albumTagNames.includes(filterTag));
                    if (!hasAllTags) {
                        return false;

                    }
                }
            }
            return true;
        });
    }, [albumCandidates, albumSelectionSearch, selectedAlbumFilterTags, albumSelectionTagFilterMode]);

    const applyTagFilter = (rawTag) => {
        const selectedTag = String(rawTag || "").trim();

        if (!selectedTag || isSelectionMode) {
            return;

        }
        navigate(`${basePath}?tag=${encodeURIComponent(selectedTag)}`);
    };

    const hasAnyActiveFilter =
        hasActiveSearch ||
        hasActiveFilterTags ||
        Boolean(activeTagFilter) ||
        Boolean(activeAuthorFilter) ||
        mediaTypeFilter !== "all" ||
        isRandomOrderEnabled;

    const showFavouritesNoResultsState =
        onlyFavourites && !loading && !error && visibleMediaItems.length === 0;

    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent(GENERAL_FILTER_STATE_EVENT, {
                detail: {
                    mediaTypeFilter,
                    isRandomOrderEnabled,
                    hasAnyActiveFilter,
                },
            }),
        );
    }, [mediaTypeFilter, isRandomOrderEnabled, hasAnyActiveFilter]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(GALLERY_SEARCH_STORAGE_KEY, submittedGallerySearchQuery);
        }
    }, [submittedGallerySearchQuery]);
    useEffect(() => {
        return () => {
            window.dispatchEvent(
                new CustomEvent(GENERAL_FILTER_STATE_EVENT, {
                    detail: {
                        mediaTypeFilter: "all",
                        isRandomOrderEnabled: false,
                        hasAnyActiveFilter: false,
                    },
                }),
            );
        };
    }, []);

    const submitGallerySearch = (value) => {
        const normalizedValue = String(value || "").trim();
        setSubmittedGallerySearchQuery(normalizedValue);
        setCurrentPage(1);
        localStorage.setItem(GALLERY_CURRENT_PAGE_STORAGE_KEY, "1");
    };

    const clearGallerySearch = () => {
        setSubmittedGallerySearchQuery("");
        setCurrentPage(1);
        localStorage.setItem(GALLERY_CURRENT_PAGE_STORAGE_KEY, "1");
    };

    const clearGalleryFilters = () => {
        clearGallerySearch();
        setMediaTypeFilter("all");
        setIsRandomOrderEnabled(false);
        setRandomOrderSeed(null);
        clearFilterTags();
        navigate(basePath);
    };

    const handleEnableMediaTypeFilter = (type) => {
        setMediaTypeFilter((previous) => (previous === type ? "all" : type));
    };

    const handleClearFiltersFromToolbar = () => {
        clearGalleryFilters();
        clearSelectionMode();
    };

    useEffect(() => {
        return () => {
            uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            uploadPreviewUrlsRef.current = [];
        };
    }, []);

    const handleRandomizeMediaOrder = () => {
        if (isGalleryShuffling) return;
        setGalleryShufflePreviewItems(visibleMediaItems.slice(0, 4));
        setIsGalleryShuffling(true);
        setIsRandomOrderEnabled(true);
        setRandomOrderSeed(Math.floor(Math.random() * 2147483647));
        setCurrentPage(1);
        galleryShuffleTimeoutRef.current = window.setTimeout(() => {
            setIsGalleryShuffling(false);
            galleryShuffleTimeoutRef.current = null;
        }, 950);
    };

    useEffect(() => () => {
        if (galleryShuffleTimeoutRef.current) window.clearTimeout(galleryShuffleTimeoutRef.current);
    }, []);

    useEffect(() => {
        const handleGeneralFilterCommand = (event) => {
            const detail = event?.detail || {};

            if (detail.type === "toggle-media-type") {
                const requestedType = detail.mediaType;

                if (requestedType === "all") {
                    setMediaTypeFilter("all");
                    return;
                }

                if (requestedType === "image" || requestedType === "video") {
                    handleEnableMediaTypeFilter(requestedType);
                }
                return;
            }
            if (detail.type === "randomize-order") {
                handleRandomizeMediaOrder();
                return;

            }
            if (detail.type === "clear-all-filters") {
                handleClearFiltersFromToolbar();
        };

        }
        window.addEventListener(GENERAL_FILTER_COMMAND_EVENT, handleGeneralFilterCommand);

        return () => {
            window.removeEventListener(GENERAL_FILTER_COMMAND_EVENT, handleGeneralFilterCommand);
        };
    }, [handleEnableMediaTypeFilter, handleRandomizeMediaOrder, handleClearFiltersFromToolbar]);

    const activateSelectionMode = (initialMediaId = null) => {
        setIsSelectionMode(true);
        setSelectionActionError(null);

        if (!initialMediaId) {
            return;

        }
        setSelectedMediaIds((previous) => {
            const next = new Set(previous);
            next.add(initialMediaId);
            return next;
        });
    };

    const { containerProps: mediaMarqueeProps, surfaceProps: mediaMarqueeSurfaceProps, selectionOverlay: mediaSelectionOverlay } = useMarqueeSelection({
        items: visibleMediaItems,
        selectedIds: selectedMediaIds,
        onSelectionChange: setSelectedMediaIds,
        onActivate: () => activateSelectionMode(),
    });

    const selectAllVisibleMedia = () => {
        if (!hasVisibleMediaItems) {
            return;

        }
        setIsSelectionMode(true);
        setSelectionActionError(null);

        setSelectedMediaIds((previous) => {
            const next = new Set(previous);

            if (areAllVisibleMediaSelected) {
                visibleMediaItems.forEach((media) => {
                    next.delete(media.id);
                });
            } else {
                visibleMediaItems.forEach((media) => {
                    next.add(media.id);
                });

            }
            return next;
        });
    };

    const clearSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedMediaIds(new Set());
        setIsDeleteConfirmOpen(false);
        setIsSingleDeleteFlow(false);
        setIsEditSelectedModalOpen(false);
        setSelectedEditError(null);
        setIsAddToAlbumModalOpen(false);
        setAddToAlbumError(null);
        setSelectedAlbumIdsForAdd(new Set());
        setSelectionActionError(null);
    };

    const closeEditSelectedModal = () => {
        if (isSavingSelectedEdit) {
            return;

        }
        setIsEditSelectedModalOpen(false);
        setSelectedEditError(null);
    };

    const openEditSelectedModal = () => {
        if (selectedMediaIds.size === 0 || isSavingSelectedEdit) {
            return;

        }
        const selectedItems = mediaItems.filter((media) => selectedMediaIds.has(media.id));

        if (selectedItems.length === 0) {
            setSelectionActionError("No media selected to edit.");
            return;

        }
        const commonTags =
            selectedItems.length === 1 ? mapTagsFromMedia(selectedItems[0]) : getCommonTagNames(selectedItems);

        const primaryItem = selectedItems[0];
        const allDisplayNamesEqual = selectedItems.every(
            (media) => String(media.displayname || "") === String(primaryItem.displayname || ""),
        );
        const allAuthorsEqual = selectedItems.every(
            (media) => String(media.author || "") === String(primaryItem.author || ""),
        );

        setSelectedEditInitialValues({
            displayname: allDisplayNamesEqual ? String(primaryItem.displayname || "") : "",
            author: allAuthorsEqual ? String(primaryItem.author || "") : "",
            tags: commonTags,
        });
        setSelectedEditError(null);
        setSelectionActionError(null);
        setIsEditSelectedModalOpen(true);
    };

    const handleSubmitSelectedEdit = async (inputPayload) => {
        if (isSavingSelectedEdit || selectedMediaIds.size === 0) {
            return;

        }
        const payloadInput = inputPayload || {};
        const { displayname, author, tags } = payloadInput;
        const hasDisplayNameInput = Object.prototype.hasOwnProperty.call(payloadInput, "displayname");
        const selectedItems = mediaItems.filter((media) => selectedMediaIds.has(media.id));

        if (selectedItems.length === 0) {
            setSelectedEditError("No media selected to edit.");
            return;

        }
        const trimmedDisplayName = String(displayname || "").trim();
        const trimmedAuthor = String(author || "").trim();
        const nextTags = Array.isArray(tags) ? tags : [];
        const isSingleEdit = selectedItems.length === 1;
        try {
            setIsSavingSelectedEdit(true);
            setSelectedEditError(null);

            const normalizeTag = (value) =>
                String(value || "")
                    .trim()
                    .toLowerCase();
            const commonTags = selectedItems.length > 1 ? getCommonTagNames(selectedItems) : [];
            const commonTagSet = new Set(commonTags.map((tag) => normalizeTag(tag)));
            const nextTagMap = new Map();

            nextTags.forEach((tag) => {
                const normalized = normalizeTag(tag);

                if (!normalized || nextTagMap.has(normalized)) {
                    return;

                }
                nextTagMap.set(normalized, String(tag).trim());
            });

            const tagsToAdd = Array.from(nextTagMap.entries())
                .filter(([normalized]) => !commonTagSet.has(normalized))
                .map(([, original]) => original);
            const tagsToRemove = commonTags.filter((tag) => !nextTagMap.has(normalizeTag(tag)));

            const results = await Promise.allSettled(
                selectedItems.map(async (media) => {
                    const payload = {
                        author: isSingleEdit ? trimmedAuthor : trimmedAuthor || String(media.author || ""),
                    };
                    if (isSingleEdit || hasDisplayNameInput) {
                        payload.displayname = trimmedDisplayName;
                    } else {
                        payload.displayname = String(media.displayname || "");
                    }

                    if (isSingleEdit) {
                        payload.tag_names = JSON.stringify(nextTags);
                    } else {
                        if (tagsToAdd.length > 0) {
                            payload.tags_to_add = JSON.stringify(tagsToAdd);
                        }
                        if (tagsToRemove.length > 0) {
                            payload.tags_to_remove = JSON.stringify(tagsToRemove);

                        }
                    }
                    const response = await fetchWithAuth(`${API_URL}/media/${media.id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                    });

                    const data = await parseApiResponse(response, "Could not update media");

                    if (!response.ok || !data.success || !data.data) {
                        throw new Error(data.message || "Could not update media");

                    }
                    return data.data;
                }),
            );

            const successfulUpdates = results
                .filter((result) => result.status === "fulfilled")
                .map((result) => result.value);

            if (successfulUpdates.length === 0) {
                throw new Error("Could not update selected media.");

            }
            const updatedById = new Map(successfulUpdates.map((item) => [String(item.id), item]));

            setMediaItems((previous) => previous.map((item) => updatedById.get(String(item.id)) || item));
            setDistinctDisplayNames((previous) =>
                mergeDistinctValues(
                    previous,
                    successfulUpdates.map((item) => item?.displayname),
                ),
            );
            setDistinctAuthors((previous) =>
                mergeDistinctValues(
                    previous,
                    successfulUpdates.map((item) => item?.author),
                ),
            );
            setDistinctTagNames((previous) =>
                mergeDistinctValues(previous, successfulUpdates.flatMap((item) => mapTagsFromMedia(item))),
            );

            if (successfulUpdates.length < selectedItems.length) {
                showSelectionActionToast(
                    {
                        status: "error",
                        title: "Partial update",
                        message: `Edited ${successfulUpdates.length} of ${selectedItems.length} selected media.`,
                    },
                    4200,
                );
            } else {
                showSelectionActionToast(
                    {
                        status: "success",
                        title: "Media updated",
                        message: `Edited ${successfulUpdates.length} selected media.`,
                    },
                    3200,
                );
            }
            setIsEditSelectedModalOpen(false);
            clearSelectionMode();
        } catch (requestError) {
            setSelectedEditError(requestError.message || "Could not update selected media.");
            showSelectionActionToast(
                {
                    status: "error",
                    title: "Update failed",
                    message: requestError.message || "Could not update selected media.",
                },
                4200,
            );
        } finally {
            setIsSavingSelectedEdit(false);
    };

    }
    const openDeleteSelectedConfirm = () => {
        if (selectedMediaIds.size === 0 || isDeletingSelected) {
            return;

        }
        setSelectionActionError(null);
        setIsSingleDeleteFlow(false);
        setIsDeleteConfirmOpen(true);
    };

    const requestDeleteSingleMedia = (mediaId) => {
        if (!mediaId || isDeletingSelected) {
            return;

        }
        setSelectionActionError(null);
        setIsSingleDeleteFlow(true);
        setIsSelectionMode(true);
        setSelectedMediaIds(new Set([mediaId]));
        setIsDeleteConfirmOpen(true);
    };

    const getDownloadFilenameForMedia = (media) => {
        const preferredName = String(media?.filename || media?.displayname || "").trim();

        if (preferredName) {
            return preferredName;

        }
        const extensionMatch = String(media?.filepath || "").match(/\.([a-z0-9]{2,8})(?:$|\?)/i);
        const extension = extensionMatch ? `.${extensionMatch[1]}` : "";

        return `media-${media?.id || Date.now()}${extension}`;
    };

    const triggerBlobDownload = (blob, filename) => {
        if (!(blob instanceof Blob) || blob.size <= 0) {
            throw new Error("Downloaded file is empty or invalid.");
        }

        const tempUrl = URL.createObjectURL(blob);
        const tempLink = document.createElement("a");

        tempLink.href = tempUrl;
        tempLink.download = filename || "download";
        document.body.appendChild(tempLink);
        tempLink.click();
        tempLink.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(tempUrl);
        }, 60_000);
    };

    const fetchMediaAsBlob = async (media, { onProgress } = {}) => {
        const fileUrl = getAssetUrl(media?.filepath || media?.thumbpath || "");

        if (!fileUrl) {
            throw new Error("Media file URL is not available");

        }
        const response = await fetch(fileUrl);

        if (!response.ok) {
            throw new Error("Could not download media file");

        }
        const responseBody = response.body;
        const contentLengthRaw = response.headers.get("content-length");
        const totalBytes = Number.parseInt(contentLengthRaw || "", 10);
        const hasTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0;
        let blob;

        if (!responseBody || typeof responseBody.getReader !== "function") {
            blob = await response.blob();

            if (onProgress) {
                onProgress({
                    loadedBytes: hasTotalBytes ? totalBytes : blob.size,
                    totalBytes: hasTotalBytes ? totalBytes : null,
                    percent: 100,
                });
            }
        } else {
            const reader = responseBody.getReader();
            const chunks = [];
            let loadedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;

                }
                if (value) {
                    chunks.push(value);
                    loadedBytes += value.length;

                    if (onProgress) {
                        onProgress({
                            loadedBytes,
                            totalBytes: hasTotalBytes ? totalBytes : null,
                            percent: hasTotalBytes ? Math.min(100, (loadedBytes / totalBytes) * 100) : null,
                        });

                    }
                }
            }
            blob = new Blob(chunks, {
                type: response.headers.get("content-type") || "application/octet-stream",
            });

            if (onProgress) {
                onProgress({
                    loadedBytes,
                    totalBytes: hasTotalBytes ? totalBytes : null,
                    percent: 100,
                });
            }
        }

        if (!(blob instanceof Blob) || blob.size <= 0) {
            throw new Error("Downloaded media file is empty.");
        }

        return {
            blob,
            filename: getDownloadFilenameForMedia(media),
        };
    };

    const handleDownloadSelectedMedia = async () => {
        if (selectedMediaIds.size === 0 || isDownloadingSelected) {
            return;

        }
        const selectedItems = mediaItems.filter((media) => selectedMediaIds.has(media.id));
        const getNowMs = () =>
            typeof window !== "undefined" && typeof window.performance?.now === "function"
                ? window.performance.now()
                : Date.now();
        let latestSpeedLabel = null;
        let sampledLoadedBytes = 0;
        let sampledAtMs = getNowMs();

        const sampleSpeedLabel = (absoluteLoadedBytes) => {
            const normalizedLoadedBytes = Number.isFinite(absoluteLoadedBytes)
                ? Math.max(0, absoluteLoadedBytes)
                : sampledLoadedBytes;
            const nowMs = getNowMs();
            const elapsedSeconds = (nowMs - sampledAtMs) / 1000;

            if (elapsedSeconds < 0.18) {
                return latestSpeedLabel;

            }
            const deltaBytes = Math.max(0, normalizedLoadedBytes - sampledLoadedBytes);
            sampledLoadedBytes = normalizedLoadedBytes;
            sampledAtMs = nowMs;

            const nextLabel = formatDownloadSpeed(deltaBytes / elapsedSeconds);

            if (nextLabel) {
                latestSpeedLabel = nextLabel;

            }
            return latestSpeedLabel;
        };

        if (selectedItems.length === 0) {
            setSelectionActionError("No media selected to download.");
            return;

        }
        try {
            setIsDownloadingSelected(true);
            setSelectionActionError(null);
            showDownloadToast({
                status: "info",
                title: "Preparing download",
                message: selectedItems.length > 1 ? "Collecting selected files..." : "Downloading selected file...",
                progress: 0,
                speedLabel: null,
            });

            if (selectedItems.length === 1) {
                const { blob, filename } = await fetchMediaAsBlob(selectedItems[0], {
                    onProgress: ({ loadedBytes, percent }) => {
                        const normalizedProgress =
                            typeof percent === "number" && Number.isFinite(percent)
                                ? Math.max(0, Math.min(100, Math.round(percent)))
                                : null;
                        const speedLabel = sampleSpeedLabel(loadedBytes);

                        showDownloadToast({
                            status: "info",
                            title: "Preparing download",
                            message: "Downloading selected file...",
                            progress: normalizedProgress,
                            speedLabel,
                        });
                    },
                });
                triggerBlobDownload(blob, filename);
                showDownloadToast(
                    {
                        status: "success",
                        title: "Download ready",
                        message: "The file download has started.",
                        progress: 100,
                        speedLabel: null,
                    },
                    2200,
                );
                return;

            }
            const zip = new JSZip();
            let addedFiles = 0;
            let completedLoadedBytes = 0;

            for (let index = 0; index < selectedItems.length; index += 1) {
                const media = selectedItems[index];
                let fileLoadedBytes = 0;

                try {
                    const { blob, filename } = await fetchMediaAsBlob(media, {
                        onProgress: ({ loadedBytes, percent }) => {
                            fileLoadedBytes = Number.isFinite(loadedBytes) ? Math.max(0, loadedBytes) : fileLoadedBytes;
                            const normalizedPercent =
                                typeof percent === "number" && Number.isFinite(percent)
                                    ? Math.max(0, Math.min(100, percent))
                                    : null;
                            const fileRatio = normalizedPercent === null ? 0 : normalizedPercent / 100;
                            const fetchingProgress = Math.round(((index + fileRatio) / selectedItems.length) * 85);
                            const speedLabel = sampleSpeedLabel(completedLoadedBytes + fileLoadedBytes);

                            showDownloadToast({
                                status: "info",
                                title: "Preparing download",
                                message: `Collecting files (${Math.min(index + 1, selectedItems.length)}/${selectedItems.length})...`,
                                progress: fetchingProgress,
                                speedLabel,
                            });
                        },
                    });

                    const safeName = filename || `media-${index + 1}`;
                    zip.file(safeName, blob);
                    addedFiles += 1;
                    completedLoadedBytes += Math.max(fileLoadedBytes, blob.size || 0);
                } catch {
                    // Skip files that fail to download and continue building the zip.

                }
                const completedFetchProgress = Math.round(((index + 1) / selectedItems.length) * 85);
                showDownloadToast({
                    status: "info",
                    title: "Preparing download",
                    message: `Collecting files (${index + 1}/${selectedItems.length})...`,
                    progress: completedFetchProgress,
                    speedLabel: latestSpeedLabel,
                });

            }
            if (addedFiles === 0) {
                throw new Error("Could not download selected media files.");

            }
            const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
                const zipProgress = Number.isFinite(metadata.percent) ? metadata.percent : 0;
                const totalProgress = Math.round(85 + (Math.max(0, Math.min(100, zipProgress)) * 15) / 100);

                showDownloadToast({
                    status: "info",
                    title: "Preparing download",
                    message: "Packing ZIP file...",
                    progress: totalProgress,
                    speedLabel: null,
                });
            });
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
            triggerBlobDownload(zipBlob, `tagged-media-${timestamp}.zip`);

            showDownloadToast(
                {
                    status: "success",
                    title: "Download ready",
                    message: "Your ZIP download has started.",
                    progress: 100,
                    speedLabel: null,
                },
                2400,
            );

            clearSelectionMode();

            if (addedFiles < selectedItems.length) {
                setSelectionActionError("Some files could not be downloaded and were not included in the ZIP.");
            }
        } catch (downloadError) {
            showDownloadToast(
                {
                    status: "error",
                    title: "Download failed",
                    message: downloadError.message || "Could not download selected media.",
                    progress: null,
                    speedLabel: null,
                },
                3600,
            );
            setSelectionActionError(downloadError.message || "Could not download selected media.");
        } finally {
            setIsDownloadingSelected(false);
        }
    };
    const closeDeleteSelectedConfirm = () => {
        if (isDeletingSelected) {
            return;
        }
        if (isSingleDeleteFlow) {
            clearSelectionMode();
            return;
        }
        setIsDeleteConfirmOpen(false);
    };

    const toggleMediaSelection = (mediaId) => {
        if (!mediaId) {
            return;

        }
        setSelectedMediaIds((previous) => {
            const next = new Set(previous);

            if (next.has(mediaId)) {
                next.delete(mediaId);
            } else {
                next.add(mediaId);

            }
            return next;
        });
    };

    const fetchAlbumList = async () => {
        const response = await fetchWithAuth(`${API_URL}/albums`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await parseApiResponse(response, "Could not load albums");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load albums");

        }
        return Array.isArray(data.data) ? data.data : [];
    };

    const fetchAlbumMedia = async (albumId) => {
        const response = await fetchWithAuth(`${API_URL}/albums/${albumId}/media`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await parseApiResponse(response, "Could not load album media");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load album media");

        }
        return Array.isArray(data.data) ? data.data : [];
    };

    const closeAddToAlbumModal = () => {
        if (isAddingSelectedToAlbums) {
            return;

        }
        setIsAddToAlbumModalOpen(false);
        setAddToAlbumError(null);
    };

    const toggleAlbumSelectionForAdd = (albumId) => {
        if (!albumId) {
            return;

        }
        setSelectedAlbumIdsForAdd((previous) => {
            const next = new Set(previous);

            if (next.has(albumId)) {
                next.delete(albumId);
            } else {
                next.add(albumId);

            }
            return next;
        });
    };

    const clearAlbumSelectionForAdd = () => {
        setSelectedAlbumIdsForAdd(new Set());
    };

    const toggleAlbumFilterTagForAdd = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;

        }
        setSelectedAlbumFilterTags((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === normalized.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase());

            }
            return [...previous, normalized];
        });
    };

    const openAddToAlbumModal = async () => {
        if (selectedMediaIds.size === 0 || isAddingSelectedToAlbums) {
            return;

        }
        try {
            setIsAddToAlbumModalOpen(true);
            setIsLoadingAlbumsForModal(true);
            setAddToAlbumError(null);
            setAlbumSelectionSearch("");
            setAlbumSelectionTagFilterSearch("");
            setAlbumSelectionTagFilterMode("include");
            setSelectedAlbumFilterTags([]);
            setSelectedAlbumIdsForAdd(new Set());

            const albums = await fetchAlbumList();
            const mediaById = new Map(mediaItems.map((media) => [String(media.id), media]));

            const albumData = await Promise.all(
                albums.map(async (album) => {
                    try {
                        const mediaInAlbum = await fetchAlbumMedia(album.id);
                        const tagSet = new Set();

                        mediaInAlbum.forEach((albumMedia) => {
                            const fullMedia = mediaById.get(String(albumMedia.id));

                            mapTagsFromMedia(fullMedia || albumMedia).forEach((tagName) => {
                                tagSet.add(tagName);
                            });
                        });

                        return {
                            ...album,
                            media_count: mediaInAlbum.length,
                            album_tag_names: Array.from(tagSet),
                        };
                    } catch {
                        return {
                            ...album,
                            album_tag_names: [],
                        };
                    }
                }),
            );

            setAlbumCandidates(albumData);
        } catch (requestError) {
            setAlbumCandidates([]);
            setAddToAlbumError(requestError.message || "Could not load albums");
        } finally {
            setIsLoadingAlbumsForModal(false);
        }
    };
    const handleAddSelectedMediaToAlbums = async (event) => {
        event.preventDefault();

        const mediaIds = Array.from(selectedMediaIds);
        const albumIds = Array.from(selectedAlbumIdsForAdd);

        if (mediaIds.length === 0) {
            setAddToAlbumError("Please choose at least one media element.");
            return;

        }
        if (albumIds.length === 0) {
            setAddToAlbumError("Please choose at least one album.");
            return;

        }
        try {
            setIsAddingSelectedToAlbums(true);
            setAddToAlbumError(null);

            const results = await Promise.allSettled(
                albumIds.map(async (albumId) => {
                    const response = await fetchWithAuth(`${API_URL}/albums/${albumId}/media/batch`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ media_ids: mediaIds }),
                    });

                    const data = await parseApiResponse(response, "Could not add media to album");

                    if (!response.ok || !data.success) {
                        throw new Error(data.message || "Could not add media to album");
                    }
                }),
            );

            const successfulAdds = results.filter((result) => result.status === "fulfilled").length;

            if (successfulAdds === 0) {
                throw new Error("Could not add selected media to the selected albums.");
            }
            if (successfulAdds < albumIds.length) {
                setAddToAlbumError(`Added to ${successfulAdds} album(s). Some albums could not be updated.`);
                return;
            }
            clearSelectionMode();
        } catch (requestError) {
            setAddToAlbumError(requestError.message || "Could not add selected media to albums");
        } finally {
            setIsAddingSelectedToAlbums(false);
    };

    }
    const handleDeleteSelectedMedia = async () => {
        if (selectedMediaIds.size === 0 || isDeletingSelected) {
            return;

        }
        const selectedIds = Array.from(selectedMediaIds);

        try {
            setSelectionActionError(null);
            setIsDeleteConfirmOpen(false);
            setIsDeletingSelected(true);

            const response = await fetchWithAuth(`${API_URL}/media`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ids: selectedIds }),
            });

            const data = await parseApiResponse(response, "Could not delete selected media");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not delete selected media");

            }
            const refreshedMedia = await fetchMediaList();
            setMediaItems(Array.isArray(refreshedMedia.data) ? refreshedMedia.data : []);
            setMediaTotal(Number(refreshedMedia.total) || 0);
            showSelectionActionToast(
                {
                    status: "success",
                    title: "Media deleted",
                    message: `Deleted ${selectedIds.length} selected media.`,
                },
                3200,
            );
            clearSelectionMode();
        } catch (requestError) {
            showSelectionActionToast(
                {
                    status: "error",
                    title: "Delete failed",
                    message: requestError.message || "Could not delete selected media",
                },
                4200,
            );
        } finally {
            setIsDeletingSelected(false);
    };

    }
    const visibleTagSuggestions = useMemo(() => {
        const normalizedSelected = new Set(selectedTags.map((tag) => tag.toLowerCase()));
        const currentInput = tagInput.trim().toLowerCase();

        return distinctTagNames.filter((tagName) => {
            const normalized = tagName.toLowerCase();

            if (normalizedSelected.has(normalized)) {
                return false;

            }
            if (!currentInput) {
                return true;

            }
            return normalized.includes(currentInput);
        });
    }, [distinctTagNames, selectedTags, tagInput]);

    const visibleDisplayNameSuggestions = useMemo(() => {
        const currentInput = displayNameInput.trim().toLowerCase();

        return distinctDisplayNames
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
    }, [distinctDisplayNames, displayNameInput]);

    const visibleAuthorSuggestions = useMemo(() => {
        const currentInput = authorInput.trim().toLowerCase();

        return distinctAuthors
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
    }, [distinctAuthors, authorInput]);

    const limitedTagSuggestions = useMemo(
        () => visibleTagSuggestions.slice(0, MAX_SUGGESTIONS),
        [visibleTagSuggestions],
    );

    const getActiveSuggestions = () => {
        if (activeSuggestionField === "displayname") {
            return visibleDisplayNameSuggestions;

        }
        if (activeSuggestionField === "author") {
            return visibleAuthorSuggestions;

        }
        if (activeSuggestionField === "tag") {
            return limitedTagSuggestions;

        }
        return [];
    };

    const fetchMediaList = async () => {
        if (!user || user.type === "admin") {
            return { data: [], total: 0 };
        }
        return galleryApi.getMedia(
            {
                page: currentPage,
                limit: pageSize,
                favourites: onlyFavourites || undefined,
                mediaType: mediaTypeFilter !== "all" ? mediaTypeFilter : undefined,
                author: activeAuthorFilter || undefined,
                tag: activeTagFilter || undefined,
                includeTag: selectedIncludeFilterTags,
                excludeTag: selectedExcludeFilterTags,
                search: submittedGallerySearchQuery.trim() || undefined,
                nameMatchMode: user?.media_name_match_mode === "strict" ? "strict" : "normal",
                randomSeed: isRandomOrderEnabled ? randomOrderSeed : undefined,
            },
            accessToken,
        );
    };

    const resetUploadForm = () => {
        uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        uploadPreviewUrlsRef.current = [];
        setUploadPreviewUrls([]);
        setSelectedFiles([]);
        setDisplayNameInput("");
        setAuthorInput("");
        setTagInput("");
        setSelectedTags([]);
        setUploadError(null);
        setUploadTotal(0);
        setUploadRemaining(0);
        setUploadProgressPercent(0);
        setUploadSpeedLabel(null);
        setActiveSuggestionField(null);
        setActiveSuggestionIndex(0);

        if (hiddenFileInputRef.current) {
            hiddenFileInputRef.current.value = "";
    };

    }
    const openSystemFilePicker = () => {
        setUploadError(null);
        hiddenFileInputRef.current?.click();
    };

    const openUploadWithFiles = (files) => {
        if (files.length === 0) {
            return;

        }
        const nextPreviewUrls = files.map((file) => URL.createObjectURL(file));

        uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        uploadPreviewUrlsRef.current = nextPreviewUrls;
        setUploadPreviewUrls(nextPreviewUrls);
        setSelectedFiles(files);
        setIsUploadModalOpen(true);
    };

    const handleFileSelectionChange = (event) => {
        openUploadWithFiles(Array.from(event.target.files || []));
    };

    const hasDraggedFiles = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");

    const handleUploadDragEnter = (event) => {
        if (basePath !== "/gallery" || !hasDraggedFiles(event)) return;
        event.preventDefault();
        uploadDragDepthRef.current += 1;
        setIsDraggingUploadFiles(true);
    };

    const handleUploadDragOver = (event) => {
        if (basePath !== "/gallery" || !hasDraggedFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    };

    const handleUploadDragLeave = (event) => {
        if (basePath !== "/gallery" || !isDraggingUploadFiles) return;
        event.preventDefault();
        uploadDragDepthRef.current = Math.max(0, uploadDragDepthRef.current - 1);
        if (uploadDragDepthRef.current === 0) setIsDraggingUploadFiles(false);
    };

    const handleUploadDrop = (event) => {
        if (basePath !== "/gallery" || !hasDraggedFiles(event)) return;
        event.preventDefault();
        uploadDragDepthRef.current = 0;
        setIsDraggingUploadFiles(false);
        const files = Array.from(event.dataTransfer.files || []).filter((file) =>
            /^(image|video)\//i.test(file.type) || /\.hei[cf]$/i.test(file.name),
        );
        openUploadWithFiles(files);
    };

    const handleOpenUpload = () => {
        if (user?.type === "admin") {
            return;

        }
        openSystemFilePicker();
    };

    const handleCloseUploadModal = () => {
        setIsUploadModalOpen(false);
        if (isUploading) {
            setIsUploadToastMode(true);
        } else {
            resetUploadForm();
    };

    }
    const addTag = (rawTag) => {
        const trimmed = String(rawTag || "").trim();

        if (!trimmed) {
            return;

        }
        setSelectedTags((previous) => {
            const exists = previous.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                return previous;

            }
            return [...previous, trimmed];
        });

        setTagInput("");
        setActiveSuggestionField(null);
        setActiveSuggestionIndex(0);
    };

    const removeTag = (tagToRemove) => {
        setSelectedTags((previous) => previous.filter((tag) => tag !== tagToRemove));
    };

    const handleUploadSubmit = async (event) => {
        event.preventDefault();

        if (selectedFiles.length === 0) {
            setUploadError("Please select at least one file.");
            return;

        }
        const finalDisplayName = displayNameInput.trim();
        const finalAuthor = authorInput.trim();
        setUploadError(null);
        setIsUploading(true);
        setUploadTotal(selectedFiles.length);
        setUploadRemaining(selectedFiles.length);
        setUploadProgressPercent(0);
        setUploadSpeedLabel(null);
        const uploadAbortController = new AbortController();
        uploadAbortControllerRef.current = uploadAbortController;
        // Mostrar toast al iniciar subida si el modal esta cerrado
        if (!isUploadModalOpen) {
            showUploadToast({
                status: "info",
                title: "Subiendo...",
                message: "La subida sigue en segundo plano.",
                progress: 0,
                speedLabel: null,
            });

        }
        try {
            const getNowMs = () =>
                typeof window !== "undefined" && typeof window.performance?.now === "function"
                    ? window.performance.now()
                    : Date.now();
            let sampledLoadedBytes = 0;
            let sampledAtMs = getNowMs();
            let latestSpeed = null;

            const sampleUploadSpeed = (loadedBytes) => {
                const nowMs = getNowMs();
                const elapsedSeconds = (nowMs - sampledAtMs) / 1000;

                if (elapsedSeconds < 0.18) {
                    return latestSpeed;

                }
                const deltaBytes = Math.max(0, loadedBytes - sampledLoadedBytes);
                sampledLoadedBytes = loadedBytes;
                sampledAtMs = nowMs;

                const nextSpeed = formatDownloadSpeed(deltaBytes / elapsedSeconds);

                if (nextSpeed) {
                    latestSpeed = nextSpeed;

                }
                return latestSpeed;
            };

            const data = await uploadMediaMutation.mutateAsync({
                files: selectedFiles,
                displayName: finalDisplayName,
                author: finalAuthor,
                tags: selectedTags,
                signal: uploadAbortController.signal,
                onUploadProgress: (progressEvent) => {
                    const totalBytes = progressEvent.total || null;
                    const loadedBytes = Number.isFinite(progressEvent.loaded)
                        ? Math.max(0, progressEvent.loaded)
                        : 0;
                    const percent =
                        totalBytes && totalBytes > 0
                            ? Math.max(0, Math.min(100, (loadedBytes / totalBytes) * 100))
                            : null;
                    const progressValue = percent ?? 0;
                    const estimatedUploadedFiles = Math.round((progressValue / 100) * selectedFiles.length);

                    setUploadProgressPercent(progressValue);
                    setUploadRemaining(Math.max(0, selectedFiles.length - estimatedUploadedFiles));
                    setUploadSpeedLabel(sampleUploadSpeed(loadedBytes));

                    if (!isUploadModalOpen) {
                        showUploadToast({
                            status: "info",
                            title: "Subiendo...",
                            message: "La subida sigue en segundo plano.",
                            progress: progressValue,
                            speedLabel: sampleUploadSpeed(loadedBytes),
                        });
                    }
                },
            });

            if (!data?.success) {
                throw new Error(data.message || "Error uploading files");

            }
            setUploadRemaining(0);
            setUploadProgressPercent(100);
            setUploadSpeedLabel(null);
            setDistinctDisplayNames((previous) => mergeDistinctValues(previous, [finalDisplayName]));
            setDistinctAuthors((previous) => mergeDistinctValues(previous, [finalAuthor]));
            setDistinctTagNames((previous) => mergeDistinctValues(previous, selectedTags));

            const refreshedMedia = await fetchMediaList();
            setMediaItems(Array.isArray(refreshedMedia.data) ? refreshedMedia.data : []);
            setMediaTotal(Number(refreshedMedia.total) || 0);
            setIsUploadModalOpen(false);
            setIsUploadToastMode(false);
            resetUploadForm();
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            showUploadToast(
                {
                    status: "success",
                    title: "Upload complete",
                    message: "Your files have been uploaded successfully.",
                    progress: 100,
                    speedLabel: null,
                },
                2200,
            );
        } catch (requestError) {
            const wasCancelled = uploadAbortController.signal.aborted || requestError?.code === "ERR_CANCELED";

            if (wasCancelled) {
                setUploadError(null);
                setIsUploadModalOpen(false);
                setIsUploadToastMode(false);
                hideUploadToast();
                resetUploadForm();
                const cancelledMessage = selectedFiles.length === 1
                    ? "The media upload was cancelled."
                    : "The batch upload was cancelled.";

                window.setTimeout(() => {
                    showUploadToast(
                        {
                            status: "info",
                            title: "Upload cancelled",
                            message: cancelledMessage,
                        },
                        2600,
                    );
                }, 450);
                return;
            }

            const requestMessage = requestError.response?.data?.message || requestError.message || "Error uploading files";
            setUploadError(requestMessage);
            setIsUploadToastMode(false);
            showUploadToast({
                status: "error",
                title: "Upload failed",
                message: requestMessage,
                progress: uploadProgressPercent,
                speedLabel: null,
            });
        } finally {
            if (uploadAbortControllerRef.current === uploadAbortController) {
                uploadAbortControllerRef.current = null;
            }
            setIsUploading(false);
    };

    }
    const handleOpenMediaDetail = (mediaId) => {
        if (!mediaId) {
            return;

        }
        if (isSelectionMode) {
            toggleMediaSelection(mediaId);
            return;

        }
        saveGalleryScrollPosition();

        navigate(`/gallery/${mediaId}${location.search || ""}`, {
            state: {
                mediaItems: visibleMediaItems,
            },
        });
    };

    const handleToggleFavourite = async (mediaId) => {
        if (!mediaId) {
            return;

        }
        if (togglingIds.has(mediaId)) {
            return;

        }
        setTogglingIds((previous) => {
            const next = new Set(previous);
            next.add(mediaId);
            return next;
        });

        try {
            const response = await fetchWithAuth(`${API_URL}/media/${mediaId}/toggle-favourite`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await parseApiResponse(response, "Could not update favourite");

            if (!response.ok || !data.success || !data.data) {
                throw new Error(data.message || "Could not update favourite");

            }
            setMediaItems((previous) =>
                previous.map((item) => (item.id === mediaId ? { ...item, ...data.data } : item)),
            );
        } catch (toggleError) {
            setError(toggleError.message || "Could not update favourite");
        } finally {
            setTogglingIds((previous) => {
                const next = new Set(previous);
                next.delete(mediaId);
                return next;
            });
    };

    }
    const handlePageSizeChange = (e) => {
        const value = Number(e.target.value);
        if (Number.isFinite(value) && value > 0) {
            setPageSize(value);
            setCurrentPage(1);
            localStorage.setItem(GALLERY_CURRENT_PAGE_STORAGE_KEY, "1");
            scrollGalleryToTop();
        }
    };
    const handlePageChange = (newPage) => {
        const clamped = Math.max(1, Math.min(totalPages, newPage));
        if (clamped === currentPage) {
            return;
        }

        setCurrentPage(clamped);
        localStorage.setItem(GALLERY_CURRENT_PAGE_STORAGE_KEY, String(clamped));
        scrollGalleryToTop();
    };

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
            localStorage.setItem(GALLERY_CURRENT_PAGE_STORAGE_KEY, String(totalPages));
        }
    }, [currentPage, totalPages]);

    const mediaQuery = useQuery({
        queryKey: [
            "gallery-media",
            user?.id,
            currentPage,
            pageSize,
            onlyFavourites,
            mediaTypeFilter,
            activeAuthorFilter,
            activeTagFilter,
            selectedIncludeFilterTags,
            selectedExcludeFilterTags,
            submittedGallerySearchQuery,
            user?.media_name_match_mode,
            isRandomOrderEnabled,
            randomOrderSeed,
        ],
        queryFn: fetchMediaList,
        enabled: Boolean(user && user.type !== "admin" && accessToken),
        placeholderData: (previousData) => previousData,
    });

    useEffect(() => {
        if (!user || user.type === "admin") {
            setMediaItems([]);
            setMediaTotal(0);
            setLoading(false);
            return;
        }

        setLoading(mediaQuery.isLoading);

        if (mediaQuery.error) {
            setError(mediaQuery.error.message || "Could not load gallery");
            setMediaItems([]);
            setMediaTotal(0);
            return;
        }

        if (mediaQuery.data) {
            setError(null);
            setMediaItems(Array.isArray(mediaQuery.data.data) ? mediaQuery.data.data : []);
            setMediaTotal(Number(mediaQuery.data.total) || 0);
        }
    }, [mediaQuery.data, mediaQuery.error, mediaQuery.isFetching, mediaQuery.isLoading, user]);

    useEffect(() => {
        const onOpenUpload = () => {
            handleOpenUpload();
        };

        window.addEventListener(OPEN_UPLOAD_EVENT, onOpenUpload);

        return () => {
            window.removeEventListener(OPEN_UPLOAD_EVENT, onOpenUpload);
        };
    }, [user]);

    useEffect(() => {
        if (!isUploadModalOpen) {
            return undefined;

        }
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const previousBodyTouchAction = document.body.style.touchAction;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.body.style.touchAction = "none";

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.touchAction = previousBodyTouchAction;
        };
    }, [isUploadModalOpen]);

    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
            const target = event.target;
            const isTypingElement =
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);

            if (event.key === "Control" && !isTypingElement) {
                setIsSelectionMode(true);
                setSelectionActionError(null);
                return;

            }
            if (event.key === "Escape" && isDeleteConfirmOpen) {
                closeDeleteSelectedConfirm();
                return;

            }
            if (event.key === "Escape" && isAddToAlbumModalOpen) {
                closeAddToAlbumModal();
                return;

            }
            if (event.key === "Escape") {
                clearSelectionMode();
        };

        }
        window.addEventListener("keydown", handleGlobalKeyDown);

        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [isDeleteConfirmOpen, isDeletingSelected, isAddToAlbumModalOpen, isAddingSelectedToAlbums]);

    useEffect(() => {
        if (user?.type === "admin") {
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
                setDistinctDisplayNames(
                    displayNamesResponse.ok && displayNamesData.success && Array.isArray(displayNamesData.data)
                        ? displayNamesData.data.filter(Boolean)
                        : [],
                );

                setDistinctAuthors(
                    authorsResponse.ok && authorsData.success && Array.isArray(authorsData.data)
                        ? authorsData.data.filter(Boolean)
                        : [],
                );

                if (tagsResponse.ok && tagsData.success && Array.isArray(tagsData.data)) {
                    const validTags = tagsData.data.filter(
                        (item) => item && typeof item.tagname === "string" && item.tagname.trim(),
                    );

                    setDistinctTagNames(validTags.map((item) => item.tagname.trim()));
                    setTagColorByName(
                        validTags.reduce((accumulator, item) => {
                            const normalizedName = String(item.tagname).trim().toLowerCase();
                            if (!normalizedName) {
                                return accumulator;

                            }
                            const normalizedColor = normalizeHexColor(item.tagcolor_hex);

                            return {
                                ...accumulator,
                                [normalizedName]: normalizedColor,
                            };
                        }, {}),
                    );
                    setTagTypeByName(
                        validTags.reduce((accumulator, item) => {
                            const normalizedName = String(item.tagname).trim().toLowerCase();
                            if (!normalizedName) return accumulator;

                            return {
                                ...accumulator,
                                [normalizedName]: item.type === "copyright" ? "copyright" : "default",
                            };
                        }, {}),
                    );
                } else {
                    setDistinctTagNames([]);
                    setTagColorByName({});
                    setTagTypeByName({});
                }
            } catch {
                if (!cancelled) {
                    setDistinctDisplayNames([]);
                    setDistinctAuthors([]);
                    setDistinctTagNames([]);
                    setTagColorByName({});
                    setTagTypeByName({});
                }
            }
        };
        loadDistinctData();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, user]);

    useEffect(() => {
        const activeSuggestions = getActiveSuggestions();

        if (activeSuggestions.length === 0) {
            setActiveSuggestionIndex(0);
            return;

        }
        setActiveSuggestionIndex((previous) => {
            if (previous < 0) {
                return 0;

            }
            if (previous >= activeSuggestions.length) {
                return activeSuggestions.length - 1;

            }
            return previous;
        });
    }, [activeSuggestionField, visibleDisplayNameSuggestions, visibleAuthorSuggestions, limitedTagSuggestions]);

    useEffect(() => {
        return () => {
            clearDownloadToastTimer();
        };
    }, []);

    const openSuggestions = (field) => {
        setActiveSuggestionField(field);
        setActiveSuggestionIndex(0);
    };

    const closeSuggestions = () => {
        setActiveSuggestionField(null);
        setActiveSuggestionIndex(0);
    };

    const handleSuggestionKeyboard = (event, field, suggestions, onSelect, onEnterFallback = null) => {
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            if (event.key === "Enter" && onEnterFallback) {
                onEnterFallback();
                closeSuggestions();
            }
            return;

        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (activeSuggestionField !== field) {
                openSuggestions(field);
                return;

            }
            setActiveSuggestionIndex((previous) => (previous + 1) % suggestions.length);
            return;

        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (activeSuggestionField !== field) {
                openSuggestions(field);
                return;

            }
            setActiveSuggestionIndex((previous) => (previous - 1 + suggestions.length) % suggestions.length);
            return;

        }
        if (event.key === "Enter") {
            if (activeSuggestionField === field) {
                event.preventDefault();
                onSelect(suggestions[activeSuggestionIndex] || suggestions[0]);
                return;

            }
            if (onEnterFallback) {
                onEnterFallback();
            }
            return;

        }
        if (event.key === "Escape" && activeSuggestionField === field) {
            event.preventDefault();
            closeSuggestions();
    };

    }
    if (user?.type === "admin") {
        return (
            <section className="tagged-app-page tagged-gallery-page tagged-gallery-page--centered">
                <article
                    className="tagged-app-page-card tagged-gallery-empty-card tagged-gallery-empty-card--no-media tagged-gallery-empty-card--admin"
                    aria-live="polite"
                >
                    <h2>Nothing to look at</h2>
                    <p>Use a regular user account to upload, browse and manage media.</p>
                    <img
                        className="tagged-gallery-empty-image-icon"
                        src="/icons/gallery.svg"
                        alt=""
                        aria-hidden="true"
                    />
                </article>
            </section>
        );

    }
    if (forceLoading) {
        return <section className="tagged-app-page tagged-gallery-page"><CollectionLoadingSkeleton itemType="media" viewMode={gridViewMode} gridColumns={gridColumns} ariaLabel="Forced gallery loading preview" /></section>;
    }
    return (
        <section
            className={`tagged-app-page tagged-gallery-page${gridViewMode === "list" ? " tagged-gallery-page--list-view" : ""}${pageSize === MIN_PAGE_SIZE ? " tagged-gallery-page--minimum-page" : ""}`}
            {...mediaMarqueeSurfaceProps}
            onDragEnter={handleUploadDragEnter}
            onDragOver={handleUploadDragOver}
            onDragLeave={handleUploadDragLeave}
            onDrop={handleUploadDrop}
        >
            <ResultsLoadingIndicator isVisible={mediaQuery.isFetching && !mediaQuery.isLoading && Boolean(mediaQuery.data)} />
            {isDraggingUploadFiles ? (
                <div className="tagged-gallery-drop-overlay" role="status" aria-live="polite">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <span className="grid h-14 w-14 place-items-center rounded-xl border border-neutral-300 bg-white text-xl text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                            <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden="true" />
                        </span>
                        <div>
                            <p className="text-lg font-black text-neutral-950 dark:text-neutral-100">Drop media here</p>
                            <p className="mt-1 text-sm font-semibold text-neutral-500 dark:text-neutral-400">Images and videos will open in the upload editor</p>
                        </div>
                    </div>
                </div>
            ) : null}
            <input
                ref={hiddenFileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="tagged-hidden-upload-input"
                onChange={handleFileSelectionChange}
            />

            {!loading && !error && !showFavouritesNoResultsState ? (
                <LibraryToolbar label="Search media" search={<MediaFacetSearch value={submittedGallerySearchQuery} onChange={submitGallerySearch} mediaItems={mediaItems} displayNames={distinctDisplayNames} authors={distinctAuthors} />} controls={<>
                            <div className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950 lg:h-12 lg:flex-none" aria-label="Filter by media type">
                                {[
                                    { type: "all", label: "All", icon: faTableCellsLarge },
                                    { type: "image", label: "Images", icon: faImage },
                                    { type: "video", label: "Videos", icon: faFilm },
                                ].map((filter) => (
                                    <button
                                        key={filter.type}
                                        type="button"
                                        className={`inline-flex! h-9! min-w-0! flex-1! items-center! justify-center! gap-2! rounded-xl! border-0! px-0! py-0! text-sm! font-bold! shadow-none! lg:h-10! lg:w-auto! lg:flex-none! lg:px-3! ${mediaTypeFilter === filter.type ? "bg-neutral-950! text-white! dark:bg-white! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-100! dark:text-neutral-400! dark:hover:bg-neutral-800!"}`}
                                        onClick={() => setMediaTypeFilter(filter.type)}
                                        aria-pressed={mediaTypeFilter === filter.type}
                                        title={filter.label}
                                    >
                                        <FontAwesomeIcon icon={filter.icon} aria-hidden="true" />
                                        <span className="hidden 2xl:inline">{filter.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950 [&>button]:h-9! [&>button]:min-w-0! [&>button]:flex-1! [&>button]:justify-center! [&>button]:rounded-xl! [&>button]:border-0! [&>button]:px-0! lg:contents lg:[&>button]:h-12! lg:[&>button]:flex-none! lg:[&>button]:border! lg:[&>button]:px-4!">
                            <button
                                type="button"
                                className={`${TOOLBAR_BUTTON_CLASSES} ${gridViewMode === "card" ? TOOLBAR_BUTTON_ACTIVE_CLASSES : TOOLBAR_BUTTON_INACTIVE_CLASSES}`}
                                onClick={() => setGridViewMode("card")}
                                aria-pressed={gridViewMode === "card"}
                                aria-label="Card view"
                                title="Card view"
                            >
                                <FontAwesomeIcon icon={faTableCellsLarge} aria-hidden="true" />
                                <span className="hidden lg:inline">Cards</span>
                            </button>

                            <button
                                type="button"
                                className={`${TOOLBAR_BUTTON_CLASSES} ${gridViewMode === "list" ? TOOLBAR_BUTTON_ACTIVE_CLASSES : TOOLBAR_BUTTON_INACTIVE_CLASSES}`}
                                onClick={() => setGridViewMode("list")}
                                aria-pressed={gridViewMode === "list"}
                                aria-label="List view"
                                title="List view"
                            >
                                <FontAwesomeIcon icon={faList} aria-hidden="true" />
                                <span className="hidden lg:inline">List</span>
                            </button>

                            <button
                                type="button"
                                className={`${TOOLBAR_BUTTON_CLASSES} ${TOOLBAR_BUTTON_INACTIVE_CLASSES}`}
                                onClick={handleRandomizeMediaOrder}
                                aria-label="Randomize media order"
                                title="Randomize media order"
                            >
                                <FontAwesomeIcon icon={faShuffle} aria-hidden="true" />
                                <span className="hidden lg:inline">Random</span>
                            </button>
                            </div>

                    {totalFilteredMediaCount > MIN_PAGE_SIZE && (
                        <label className="flex h-11 min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-1.5 text-sm font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 lg:ml-2 lg:h-12 lg:px-3">
                            <span className="hidden sm:inline">Per page</span>
                            <select
                                className="bg-transparent text-sm font-bold text-neutral-950 outline-none dark:text-neutral-100"
                                value={pageSize}
                                onChange={handlePageSizeChange}
                            >
                                {[10, 20, 40, 60, 100].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    </>} />
            ) : null}

            {isGalleryShuffling ? (
                <div className="tagged-gallery-shuffle-overlay" role="status" aria-live="polite" aria-label="Media order shuffled">
                    <div className="tagged-gallery-shuffle-stage" aria-hidden="true">
                        {galleryShufflePreviewItems.map((media, index) => {
                            const previewUrl = getAssetUrl(media.thumbpath || media.filepath || "");
                            return (
                                <span key={media.id} className={`tagged-gallery-shuffle-card tagged-gallery-shuffle-card--${index + 1}`}>
                                    {previewUrl ? <img src={previewUrl} alt="" /> : <FontAwesomeIcon icon={faImage} />}
                                </span>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {loading ? (
                <CollectionLoadingSkeleton
                    itemType="media"
                    viewMode={gridViewMode}
                    gridColumns={gridColumns}
                    ariaLabel="Loading media"
                />
            ) : null}

            {!loading && error ? (
                <article
                    className="tagged-app-page-card tagged-gallery-empty-card tagged-gallery-empty-card--error"
                    aria-live="assertive"
                >
                    <h2>Error al cargar</h2>
                    <p>{error}</p>
                </article>
            ) : null}

            {!loading && !error && mediaItems.length === 0 ? (
                <EmptyState
                    title="No media yet"
                    icon={faImage}
                    actionLabel="Upload media"
                    onAction={handleOpenUpload}
                />
            ) : null}

            {showFavouritesNoResultsState ? (
                <EmptyState
                    title="No favourites yet"
                    icon={faHeart}
                    actionLabel="Browse gallery"
                    onAction={() => navigate("/gallery")}
                />
            ) : null}

            {!showFavouritesNoResultsState &&
            !loading &&
            !error &&
            mediaItems.length > 0 &&
            visibleMediaItems.length === 0 ? (
                <EmptyState
                    title="No results"
                    icon={faMagnifyingGlass}
                    placement="section"
                    actionLabel={
                        hasActiveSearch
                            ? "Clear search"
                            : hasActiveFilterTags
                              ? "Clear tag filters"
                              : activeTagFilter || activeAuthorFilter
                                ? "Clear filter"
                                : "Clear media mode"
                    }
                    onAction={
                        hasActiveSearch
                            ? clearGallerySearch
                            : hasActiveFilterTags
                              ? clearFilterTags
                              : activeTagFilter || activeAuthorFilter
                                ? () => navigate(basePath)
                                : clearGalleryFilters
                    }
                />
            ) : null}

            {!loading && !error && visibleMediaItems.length > 0 ? (
                gridViewMode === "list" ? (
                    <div className="mx-auto grid w-full max-w-[92rem] select-none [&_img]:[-webkit-user-drag:none]" aria-label="User media compact list" {...mediaMarqueeProps}>
                        {visibleMediaItems.map((media) => (
                            <LazyViewportItem
                                key={media.id}
                                selectionId={media.id}
                                className="tagged-gallery-lazy-item--list"
                                placeholderClassName="tagged-gallery-lazy-placeholder--list"
                                minHeight="5.1rem"
                            >
                                <GalleryListItem
                                    media={media}
                                    onOpenMedia={handleOpenMediaDetail}
                                    onToggleFavourite={handleToggleFavourite}
                                    onRequestDelete={requestDeleteSingleMedia}
                                    onActivateSelectionMode={activateSelectionMode}
                                    isTogglingFavourite={togglingIds.has(media.id)}
                                    selectionMode={isSelectionMode}
                                    isSelected={selectedMediaIds.has(media.id)}
                                    onToggleSelect={toggleMediaSelection}
                                />
                            </LazyViewportItem>
                        ))}
                    </div>
                ) : (
                    <div className="tagged-gallery-grid select-none [&_img]:[-webkit-user-drag:none]" aria-label="User media gallery" style={{ "--tagged-grid-columns": gridColumns }} {...mediaMarqueeProps}>
                        {visibleMediaItems.map((media) => (
                            <LazyViewportItem
                                key={media.id}
                                selectionId={media.id}
                                className="tagged-gallery-lazy-item--card"
                                placeholderClassName="tagged-gallery-lazy-placeholder--card"
                                minHeight="0"
                            >
                                <MediaCard
                                    media={media}
                                    uploadsBaseUrl={UPLOADS_BASE_URL}
                                    onToggleFavourite={handleToggleFavourite}
                                    isTogglingFavourite={togglingIds.has(media.id)}
                                    onOpenMedia={handleOpenMediaDetail}
                                    onFilterByTag={applyTagFilter}
                                    selectionMode={isSelectionMode}
                                    isSelected={selectedMediaIds.has(media.id)}
                                    onToggleSelect={toggleMediaSelection}
                                    onActivateSelectionMode={activateSelectionMode}
                                />
                            </LazyViewportItem>
                        ))}
                    </div>
                )
            ) : null}

            {mediaSelectionOverlay}

            {isSelectionMode ? (
                <aside className="tagged-gallery-selection-toolbar" aria-label="Selection actions toolbar">
                    <span className="tagged-gallery-selection-count" aria-live="polite">
                        {selectedMediaCount}
                    </span>
                    <span className="tagged-gallery-selection-divider" aria-hidden="true" />
                    <button
                        type="button"
                        className={`tagged-gallery-selection-icon-button tagged-gallery-selection-icon-button--select-all${areAllVisibleMediaSelected ? " is-active" : ""}`}
                        disabled={!hasVisibleMediaItems}
                        onClick={selectAllVisibleMedia}
                        aria-label="Select all visible media"
                        aria-pressed={areAllVisibleMediaSelected}
                        title={
                            areAllVisibleMediaSelected
                                ? "All visible media already selected"
                                : "Select all visible media"
                }
                    >
                        <FontAwesomeIcon icon={faCheckDouble} aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-gallery-selection-icon-button tagged-gallery-selection-icon-button--album"
                        disabled={selectedMediaCount === 0 || isAddingSelectedToAlbums}
                        onClick={openAddToAlbumModal}
                        aria-label="Add selected media to album"
                        title="Add selected media to album"
                    >
                        <FontAwesomeIcon icon={faFolderPlus} aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-gallery-selection-icon-button tagged-gallery-selection-icon-button--download"
                        disabled={selectedMediaCount === 0 || isDownloadingSelected}
                        onClick={handleDownloadSelectedMedia}
                        aria-label={`Download ${selectedMediaCount} selected element${selectedMediaCount === 1 ? "" : "s"}`}
                        title={selectedMediaCount > 1 ? "Download selected media as ZIP" : "Download selected media"}
                    >
                        <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-gallery-selection-icon-button tagged-gallery-selection-icon-button--edit"
                        disabled={selectedMediaCount === 0 || isSavingSelectedEdit}
                        onClick={openEditSelectedModal}
                        aria-label={`Edit ${selectedMediaCount} selected element${selectedMediaCount === 1 ? "" : "s"}`}
                        title="Edit selected media"
                    >
                        <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-gallery-selection-icon-button tagged-gallery-selection-icon-button--delete"
                        disabled={selectedMediaCount === 0 || isDeletingSelected}
                        onClick={openDeleteSelectedConfirm}
                        aria-label={`Delete ${selectedMediaCount} selected element${selectedMediaCount === 1 ? "" : "s"}`}
                        title="Delete selected media"
                    >
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-gallery-selection-icon-button tagged-gallery-selection-icon-button--close"
                        onClick={clearSelectionMode}
                        aria-label="Close selection mode"
                        title="Close selection mode"
                    >
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </button>
                </aside>
            ) : null}

            {isSelectionMode && selectionActionError ? (
                <p className="tagged-gallery-selection-error" aria-live="assertive">
                    {selectionActionError}
                </p>
            ) : null}

            <DeleteConfirmationModal
                isOpen={isDeleteConfirmOpen}
                title={isSingleDeleteFlow ? "Delete this media?" : "Delete selected media?"}
                description={isSingleDeleteFlow
                    ? "The file and its metadata will be permanently removed. This action cannot be undone."
                    : `${selectedMediaCount} file${selectedMediaCount === 1 ? "" : "s"} and ${selectedMediaCount === 1 ? "its" : "their"} metadata will be permanently removed. This action cannot be undone.`}
                confirmLabel={isSingleDeleteFlow ? "Delete media" : "Delete selected"}
                isDeleting={isDeletingSelected}
                onConfirm={handleDeleteSelectedMedia}
                onClose={closeDeleteSelectedConfirm}
            />

            <AddToAlbumModal
                isOpen={isAddToAlbumModalOpen}
                onClose={closeAddToAlbumModal}
                onSubmit={handleAddSelectedMediaToAlbums}
                isSaving={isAddingSelectedToAlbums}
                isLoading={isLoadingAlbumsForModal}
                error={addToAlbumError}
                albumSearch={albumSelectionSearch}
                onAlbumSearchChange={setAlbumSelectionSearch}
                albums={albumCandidates}
                filteredAlbums={filteredAlbumCandidates}
                selectedAlbumIds={selectedAlbumIdsForAdd}
                onToggleAlbumSelection={toggleAlbumSelectionForAdd}
                onClearAlbumSelection={clearAlbumSelectionForAdd}
                tagFilterMode={albumSelectionTagFilterMode}
                onToggleTagFilterMode={() =>
                    setAlbumSelectionTagFilterMode((previous) => (previous === "include" ? "exclude" : "include"))
}
                selectedFilterTags={selectedAlbumFilterTags}
                onClearFilterTags={() => setSelectedAlbumFilterTags([])}
                tagFilterSearch={albumSelectionTagFilterSearch}
                onTagFilterSearchChange={setAlbumSelectionTagFilterSearch}
                visibleTagFilterCandidates={visibleAlbumTagFilterCandidates}
                onToggleFilterTag={toggleAlbumFilterTagForAdd}
                getAssetUrl={getAssetUrl}
                selectedMediaCount={selectedMediaCount}
            />

            <MediaEditModal
                isOpen={isEditSelectedModalOpen}
                mode={selectedMediaCount > 1 ? "multi" : "single"}
                selectedCount={selectedMediaCount}
                initialValues={selectedEditInitialValues}
                distinctDisplayNames={distinctDisplayNames}
                distinctAuthors={distinctAuthors}
                distinctTagNames={distinctTagNames}
                tagColorByName={tagColorByName}
                tagTypeByName={tagTypeByName}
                selectedMediaItems={mediaItems.filter((media) => selectedMediaIds.has(media.id))}
                getAssetUrl={getAssetUrl}
                isSaving={isSavingSelectedEdit}
                error={selectedEditError}
                onClose={closeEditSelectedModal}
                onSubmit={handleSubmitSelectedEdit}
            />

            {isUploadModalOpen ? (
                <UploadMediaModal
                    key={uploadPreviewUrls.join("|")}
                    files={selectedFiles}
                    previewUrls={uploadPreviewUrls}
                    displayNameInput={displayNameInput}
                    authorInput={authorInput}
                    tagInput={tagInput}
                    selectedTags={selectedTags}
                    tagColorByName={tagColorByName}
                    tagTypeByName={tagTypeByName}
                    existingTagNames={distinctTagNames}
                    activeSuggestionField={activeSuggestionField}
                    activeSuggestionIndex={activeSuggestionIndex}
                    displayNameSuggestions={visibleDisplayNameSuggestions}
                    authorSuggestions={visibleAuthorSuggestions}
                    tagSuggestions={limitedTagSuggestions}
                    isUploading={isUploading}
                    uploadedCount={uploadedCount}
                    uploadTotal={uploadTotal}
                    uploadProgress={normalizedUploadProgress}
                    uploadSpeedLabel={uploadSpeedLabel}
                    uploadError={uploadError}
                    onClose={handleCloseUploadModal}
                    onCancelUpload={cancelUpload}
                    onChangeFiles={openSystemFilePicker}
                    onSubmit={handleUploadSubmit}
                    onDisplayNameChange={(event) => {
                        setDisplayNameInput(event.target.value);
                        openSuggestions("displayname");
                    }}
                    onAuthorChange={(event) => {
                        setAuthorInput(event.target.value);
                        openSuggestions("author");
                    }}
                    onTagInputChange={(event) => {
                        setTagInput(event.target.value);
                        openSuggestions("tag");
                    }}
                    onOpenSuggestions={openSuggestions}
                    onCloseSuggestions={closeSuggestions}
                    onSuggestionKeyDown={(event, field) => {
                        if (field === "displayname") {
                            handleSuggestionKeyboard(
                                event,
                                field,
                                visibleDisplayNameSuggestions,
                                (selectedValue) => {
                                    setDisplayNameInput(selectedValue || "");
                                    closeSuggestions();
                                },
                            );
                            return;
                        }

                        if (field === "author") {
                            handleSuggestionKeyboard(
                                event,
                                field,
                                visibleAuthorSuggestions,
                                (selectedValue) => {
                                    setAuthorInput(selectedValue || "");
                                    closeSuggestions();
                                },
                            );
                            return;
                        }

                        handleSuggestionKeyboard(
                            event,
                            field,
                            limitedTagSuggestions,
                            (selectedValue) => addTag(selectedValue),
                            () => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    addTag(tagInput);
                                }
                            },
                        );
                    }}
                    onSelectDisplayName={(value) => {
                        setDisplayNameInput(value);
                        closeSuggestions();
                    }}
                    onSelectAuthor={(value) => {
                        setAuthorInput(value);
                        closeSuggestions();
                    }}
                    onAddTag={addTag}
                    onRemoveTag={removeTag}
                    getTagStyle={buildTagChipStyle}
                />
            ) : null}

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} label="Gallery pagination" />
        </section>
    );
};
