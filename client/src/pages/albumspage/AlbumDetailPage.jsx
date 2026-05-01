import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import JSZip from "jszip";
import { MediaCard } from "../../components/media-card/MediaCard";
import { CollectionLoadingSkeleton } from "../../components/loading-skeletons/CollectionLoadingSkeleton";
import { MediaEditModal } from "../../components/media-edit-modal/MediaEditModal";
import { GalleryListItem } from "../gallerypage/GalleryPage";
import { useAuth } from "../../hooks/useAuth";
import { useTagFilter } from "../../context/TagFilterContext";
import { useGridView } from "../../context/GridViewContext";
import { AlbumAddMediaModal } from "./components/AlbumAddMediaModal";
import { AlbumEditModal } from "./components/AlbumEditModal";
import "./AlbumPage.css";
import "./AlbumDetailPage.css";
import "../gallerypage/GalleryPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const UPLOADS_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");
const ALBUM_DETAIL_MEDIA_VIEW_STORAGE_KEY = "tagged_album_detail_media_view_mode";
const ALBUM_DETAIL_MONTAGE_SETTINGS_STORAGE_KEY = "tagged_album_detail_montage_settings";
const GENERAL_FILTER_COMMAND_EVENT = "tagged:general-filter-command";
const GENERAL_FILTER_STATE_EVENT = "tagged:general-filter-state";

const isVideoOrGifMedia = (media) => {
    const mediaType = String(media?.mediatype || "").toLowerCase();
    return mediaType.includes("video") || mediaType.includes("gif");
};

const isVideoMedia = (media) => {
    const mediaType = String(media?.mediatype || "").toLowerCase();
    return mediaType.includes("video");
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

const getMontageMediaUrl = (media) => getAssetUrl(media?.filepath || media?.thumbpath || "");
const getMontagePosterUrl = (media) => getAssetUrl(media?.thumbpath || "");
const getMontageBackgroundUrl = (media) => getAssetUrl(media?.thumbpath || media?.filepath || "");

const MONTAGE_IMAGE_DURATION_MS = 4200;
const MONTAGE_DEFAULT_IMAGE_DURATION_SECONDS = MONTAGE_IMAGE_DURATION_MS / 1000;
const MONTAGE_MIN_IMAGE_DURATION_SECONDS = 3;
const MONTAGE_MAX_IMAGE_DURATION_SECONDS = 60;
const MONTAGE_VIDEO_FALLBACK_DURATION_MS = 9000;
const MONTAGE_TRANSITION_DURATION_MS = 820;
const MONTAGE_DEFAULT_TAG_LIMIT = 6;
const MONTAGE_COPYRIGHT_TAG_LIMIT = 3;
const DEFAULT_NEW_TAG_COLOR = "#643aff";

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

const toHexChannel = (value) =>
    Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0");

const mixRgbWithWhite = (rgb, amount = 0.5) => {
    const ratio = Math.max(0, Math.min(1, amount));
    const mix = (channel) => channel + (255 - channel) * ratio;
    return `#${toHexChannel(mix(rgb.r))}${toHexChannel(mix(rgb.g))}${toHexChannel(mix(rgb.b))}`;
};

const isDefaultTagColor = (hexColor) => normalizeHexColor(hexColor)?.toLowerCase() === DEFAULT_NEW_TAG_COLOR;

const buildMontageTagStyle = (hexColor) => {
    const rgb = isDefaultTagColor(hexColor) ? null : getHexRgb(hexColor);

    if (!rgb) {
        const defaultTone = mixRgbWithWhite(getHexRgb(DEFAULT_NEW_TAG_COLOR), 0.56);

        return {
            backgroundColor: `${defaultTone}38`,
            color: defaultTone,
            "--tagged-album-montage-tag-hover-color": defaultTone,
            borderColor: `${defaultTone}BB`,
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.3)",
        };
    }

    const luminance = getRelativeLuminance(rgb);
    const isNearWhite = luminance > 0.88;
    const isDarkTone = luminance < 0.3;
    const isVeryDark = luminance < 0.12;
    let textColor = rgb.hex;

    if (isNearWhite) {
        textColor = "#f7f9ff";
    } else if (isDarkTone) {
        textColor = mixRgbWithWhite(rgb, isVeryDark ? 0.72 : 0.56);
    }

    return {
        backgroundColor: isNearWhite ? "rgba(255, 255, 255, 0.16)" : `${textColor}38`,
        color: textColor,
        "--tagged-album-montage-tag-hover-color": textColor,
        borderColor: isNearWhite ? "rgba(255, 255, 255, 0.72)" : `${textColor}BB`,
        boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.3)",
    };
};

const formatMontageMediaSize = (sizeInBytes) => {
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

const formatMontageUploadDate = (dateValue) => {
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

const formatAlbumDate = (rawDate) => {
    if (!rawDate) {
        return "";
    }

    const parsedDate = new Date(rawDate);

    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(parsedDate);
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

const normalizeMontageTags = (media) => {
    const candidates = media?.tags || media?.tag_names || media?.mediaTags || media?.relatedTags || [];

    if (!Array.isArray(candidates)) {
        return [];
    }

    return candidates
        .map((tag, index) => {
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
        })
        .filter((tag) => String(tag.tagname || "").trim());
};

const clampMontageImageDurationSeconds = (value) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return MONTAGE_DEFAULT_IMAGE_DURATION_SECONDS;
    }

    return Math.min(MONTAGE_MAX_IMAGE_DURATION_SECONDS, Math.max(MONTAGE_MIN_IMAGE_DURATION_SECONDS, numericValue));
};

const normalizeMontageAnimationType = (value) => {
    const normalizedValue = String(value || "").toLowerCase();
    const allowedTypes = new Set(["slide", "fade", "drop", "none"]);
    return allowedTypes.has(normalizedValue) ? normalizedValue : "slide";
};

const getInitialMontageSettings = () => {
    if (typeof window === "undefined") {
        return {
            imageDurationSeconds: MONTAGE_DEFAULT_IMAGE_DURATION_SECONDS,
            animationType: "slide",
        };
    }

    try {
        const storedSettings = JSON.parse(
            window.localStorage.getItem(ALBUM_DETAIL_MONTAGE_SETTINGS_STORAGE_KEY) || "{}",
        );

        return {
            imageDurationSeconds: clampMontageImageDurationSeconds(storedSettings.imageDurationSeconds),
            animationType: normalizeMontageAnimationType(storedSettings.animationType),
        };
    } catch {
        return {
            imageDurationSeconds: MONTAGE_DEFAULT_IMAGE_DURATION_SECONDS,
            animationType: "slide",
        };
    }
};

const getMontageTransitionClass = (animationType) =>
    `tagged-album-montage-frame--${normalizeMontageAnimationType(animationType)}`;

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

const formatDownloadSpeed = (bytesPerSecond) => {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
        return null;
    }

    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let value = bytesPerSecond;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const parseScopedMediaSearchQuery = (rawQuery) => {
    const normalizedRaw = String(rawQuery || "")
        .trim()
        .toLowerCase();

    if (!normalizedRaw) {
        return {
            authorTerms: [],
            nameTerms: [],
            freeTerms: [],
        };
    }

    const tokens = normalizedRaw.split(/\s+/).filter(Boolean);
    const authorTerms = [];
    const nameTerms = [];
    const freeTerms = [];

    tokens.forEach((token) => {
        if (token.startsWith("a:") || token.startsWith("author:")) {
            const value = token.includes(":") ? token.slice(token.indexOf(":") + 1).trim() : "";
            if (value) {
                authorTerms.push(value);
            }
            return;
        }

        if (token.startsWith("n:") || token.startsWith("name:")) {
            const value = token.includes(":") ? token.slice(token.indexOf(":") + 1).trim() : "";
            if (value) {
                nameTerms.push(value);
            }
            return;
        }

        freeTerms.push(token);
    });

    return {
        authorTerms,
        nameTerms,
        freeTerms,
    };
};

export const AlbumDetailPage = () => {
    const { albumId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, fetchWithAuth } = useAuth();
    const { selectedIncludeFilterTags, selectedExcludeFilterTags, clearFilterTags } = useTagFilter();
    const { gridColumns } = useGridView();

    const [album, setAlbum] = useState(null);
    const [albumMediaItems, setAlbumMediaItems] = useState([]);
    const [libraryMediaItems, setLibraryMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [togglingIds, setTogglingIds] = useState(new Set());

    const [isAddMediaModalOpen, setIsAddMediaModalOpen] = useState(false);
    const [addMediaSearch, setAddMediaSearch] = useState("");
    const [addMediaPickerViewMode, setAddMediaPickerViewMode] = useState("card");
    const [addMediaTagFilterSearch, setAddMediaTagFilterSearch] = useState("");
    const [selectedAddMediaIncludeFilterTags, setSelectedAddMediaIncludeFilterTags] = useState([]);
    const [selectedAddMediaExcludeFilterTags, setSelectedAddMediaExcludeFilterTags] = useState([]);
    const [selectedMediaToAddIds, setSelectedMediaToAddIds] = useState(new Set());
    const [isAddSelectionMode, setIsAddSelectionMode] = useState(false);
    const [isAddingMedia, setIsAddingMedia] = useState(false);
    const [addMediaError, setAddMediaError] = useState(null);
    const [activeAlbumTagFilter, setActiveAlbumTagFilter] = useState("");
    const [albumMediaSearch, setAlbumMediaSearch] = useState("");
    const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
    const [isAlbumSelectionMode, setIsAlbumSelectionMode] = useState(false);
    const [selectedAlbumMediaIds, setSelectedAlbumMediaIds] = useState(new Set());
    const [albumMediaViewMode, setAlbumMediaViewMode] = useState(() => {
        if (typeof window === "undefined") {
            return "card";
        }

        const storedMode = String(
            window.localStorage.getItem(ALBUM_DETAIL_MEDIA_VIEW_STORAGE_KEY) || "card",
        ).toLowerCase();
        return storedMode === "list" ? "list" : "card";
    });
    const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
    const [isRemovingSelected, setIsRemovingSelected] = useState(false);
    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
    const [selectionActionError, setSelectionActionError] = useState(null);
    const [downloadToast, setDownloadToast] = useState(null);
    const [isEditSelectedModalOpen, setIsEditSelectedModalOpen] = useState(false);
    const [isSavingSelectedEdit, setIsSavingSelectedEdit] = useState(false);
    const [selectedEditError, setSelectedEditError] = useState(null);
    const [selectedEditInitialValues, setSelectedEditInitialValues] = useState({
        displayname: "",
        author: "",
        tags: [],
    });
    const [draggingMediaId, setDraggingMediaId] = useState(null);
    const [dragOverMediaId, setDragOverMediaId] = useState(null);
    const [isReorderingMedia, setIsReorderingMedia] = useState(false);
    const [reorderError, setReorderError] = useState(null);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [mobileReorderSourceId, setMobileReorderSourceId] = useState(null);
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }
        return window.matchMedia("(max-width: 900px)").matches;
    });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingAlbumName, setEditingAlbumName] = useState("");
    const [coverSearch, setCoverSearch] = useState("");
    const [selectedEditCoverMediaId, setSelectedEditCoverMediaId] = useState(null);
    const [editCoverMediaViewMode, setEditCoverMediaViewMode] = useState("card");
    const [editTagFilterSearch, setEditTagFilterSearch] = useState("");
    const [editTagFilterMode, setEditTagFilterMode] = useState("include");
    const [selectedEditFilterTags, setSelectedEditFilterTags] = useState([]);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState(null);
    const [isHeroCoverBroken, setIsHeroCoverBroken] = useState(false);
    const [isMontageSettingsOpen, setIsMontageSettingsOpen] = useState(false);
    const [montageSettings, setMontageSettings] = useState(getInitialMontageSettings);
    const [isMontageOpen, setIsMontageOpen] = useState(false);
    const [montageIndex, setMontageIndex] = useState(0);
    const [isMontagePlaying, setIsMontagePlaying] = useState(true);
    const [montagePreviousFrame, setMontagePreviousFrame] = useState(null);
    const [montageDirection, setMontageDirection] = useState("next");
    const [isMontageTransitionFromVideo, setIsMontageTransitionFromVideo] = useState(false);
    const [montageProgressRatio, setMontageProgressRatio] = useState(0);
    const [currentMontageDurationMs, setCurrentMontageDurationMs] = useState(MONTAGE_IMAGE_DURATION_MS);
    const [montageRemainingSeconds, setMontageRemainingSeconds] = useState(Math.ceil(MONTAGE_IMAGE_DURATION_MS / 1000));
    const [montageSeekRevision, setMontageSeekRevision] = useState(0);
    const [areMontageVideoControlsVisible, setAreMontageVideoControlsVisible] = useState(false);
    const downloadToastTimeoutRef = useRef(null);
    const montageVideoRef = useRef(null);
    const montageProgressTrackRef = useRef(null);
    const montageProgressBarRef = useRef(null);
    const montagePreviousFrameTimeoutRef = useRef(null);
    const montageTimerStartedAtRef = useRef(0);
    const montageTimerDurationMsRef = useRef(MONTAGE_IMAGE_DURATION_MS);
    const montageRemainingMsRef = useRef(MONTAGE_IMAGE_DURATION_MS);
    const montageTimerStartRemainingMsRef = useRef(MONTAGE_IMAGE_DURATION_MS);
    const montageLastRenderedSecondRef = useRef(Math.ceil(MONTAGE_IMAGE_DURATION_MS / 1000));
    const skipNextMontageTimerCleanupRef = useRef(false);
    const montageAdvanceLockedRef = useRef(false);
    const isMontageSeekingRef = useRef(false);
    const suppressMontageRestoreRef = useRef(false);
    const montagePreloadedImagesRef = useRef(new Map());

    const albumDisplayName = album?.displayname || album?.albumname || "Untitled album";
    const albumCreatedLabel = formatAlbumDate(album?.created_at);
    const albumCoverUrl = getAssetUrl(album?.albumcoverpath || album?.albumthumbpath);

    useEffect(() => {
        setIsHeroCoverBroken(false);
    }, [albumCoverUrl]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(ALBUM_DETAIL_MEDIA_VIEW_STORAGE_KEY, albumMediaViewMode);
    }, [albumMediaViewMode]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            ALBUM_DETAIL_MONTAGE_SETTINGS_STORAGE_KEY,
            JSON.stringify({
                imageDurationSeconds: montageSettings.imageDurationSeconds,
                animationType: montageSettings.animationType,
            }),
        );
    }, [montageSettings]);

    const mediaTypeSummary = useMemo(() => {
        const imageCount = albumMediaItems.filter(
            (item) =>
                !String(item.mediatype || "")
                    .toLowerCase()
                    .includes("video"),
        ).length;
        const videoCount = albumMediaItems.filter((item) =>
            String(item.mediatype || "")
                .toLowerCase()
                .includes("video"),
        ).length;

        return {
            imageCount,
            videoCount,
            isMixed: imageCount > 0 && videoCount > 0,
            total: albumMediaItems.length,
        };
    }, [albumMediaItems]);

    const activeAlbumMediaItems = useMemo(() => {
        const scopedSearch = parseScopedMediaSearchQuery(albumMediaSearch);
        const hasScopedSearch =
            scopedSearch.authorTerms.length > 0 ||
            scopedSearch.nameTerms.length > 0 ||
            scopedSearch.freeTerms.length > 0;
        const normalizedFilter = activeAlbumTagFilter.trim().toLowerCase();
        const normalizedIncludedSidebarTags = selectedIncludeFilterTags.map((tag) => tag.toLowerCase());
        const normalizedExcludedSidebarTags = selectedExcludeFilterTags.map((tag) => tag.toLowerCase());

        return albumMediaItems.filter((media) => {
            if (mediaTypeFilter === "image" && isVideoOrGifMedia(media)) {
                return false;
            }

            if (mediaTypeFilter === "video" && !isVideoOrGifMedia(media)) {
                return false;
            }

            const mediaTagNames = mapTagsFromMedia(media).map((t) => t.toLowerCase());

            if (normalizedIncludedSidebarTags.length > 0) {
                const hasAllIncludedSidebarTags = normalizedIncludedSidebarTags.every((filterTag) =>
                    mediaTagNames.includes(filterTag),
                );

                if (!hasAllIncludedSidebarTags) {
                    return false;
                }
            }

            if (normalizedExcludedSidebarTags.length > 0) {
                const hasAnyExcludedTag = normalizedExcludedSidebarTags.some((filterTag) =>
                    mediaTagNames.includes(filterTag),
                );

                if (hasAnyExcludedTag) {
                    return false;
                }
            }

            if (normalizedFilter && !mediaTagNames.includes(normalizedFilter)) {
                return false;
            }

            if (hasScopedSearch) {
                const displayName = String(media.displayname || media.filename || "").toLowerCase();
                const authorName = String(media.author || "").toLowerCase();
                const combinedSearchHaystack = `${displayName} ${authorName}`.trim();

                const matchesAuthorTerms = scopedSearch.authorTerms.every((term) => authorName.includes(term));
                if (!matchesAuthorTerms) {
                    return false;
                }

                const matchesNameTerms = scopedSearch.nameTerms.every((term) => displayName.includes(term));
                if (!matchesNameTerms) {
                    return false;
                }

                const matchesFreeTerms = scopedSearch.freeTerms.every((term) => combinedSearchHaystack.includes(term));
                if (!matchesFreeTerms) {
                    return false;
                }
            }

            return true;
        });
    }, [
        albumMediaItems,
        albumMediaSearch,
        activeAlbumTagFilter,
        selectedIncludeFilterTags,
        selectedExcludeFilterTags,
        mediaTypeFilter,
    ]);

    const hasAnyActiveFilter =
        mediaTypeFilter !== "all" ||
        Boolean(activeAlbumTagFilter) ||
        selectedIncludeFilterTags.length > 0 ||
        selectedExcludeFilterTags.length > 0;
    const hasActiveAlbumMediaSearch = albumMediaSearch.trim().length > 0;

    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent(GENERAL_FILTER_STATE_EVENT, {
                detail: {
                    mediaTypeFilter,
                    hasAnyActiveFilter,
                },
            }),
        );
    }, [mediaTypeFilter, hasAnyActiveFilter]);

    useEffect(() => {
        return () => {
            window.dispatchEvent(
                new CustomEvent(GENERAL_FILTER_STATE_EVENT, {
                    detail: {
                        mediaTypeFilter: "all",
                        hasAnyActiveFilter: false,
                    },
                }),
            );
        };
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
                    setMediaTypeFilter((previous) => (previous === requestedType ? "all" : requestedType));
                }
                return;
            }

            if (detail.type === "clear-all-filters") {
                setMediaTypeFilter("all");
                setActiveAlbumTagFilter("");
                clearFilterTags();
            }
        };

        window.addEventListener(GENERAL_FILTER_COMMAND_EVENT, handleGeneralFilterCommand);

        return () => {
            window.removeEventListener(GENERAL_FILTER_COMMAND_EVENT, handleGeneralFilterCommand);
        };
    }, [clearFilterTags]);

    const hasVisibleAlbumMediaItems = activeAlbumMediaItems.length > 0;
    const areAllVisibleAlbumMediaSelected =
        hasVisibleAlbumMediaItems && activeAlbumMediaItems.every((media) => selectedAlbumMediaIds.has(media.id));
    const montageMediaItems = activeAlbumMediaItems;
    const currentMontageMedia = montageMediaItems[montageIndex] || null;
    const currentMontageMediaUrl = getMontageMediaUrl(currentMontageMedia);
    const currentMontagePosterUrl = getMontagePosterUrl(currentMontageMedia);
    const currentMontageBackgroundUrl = getMontageBackgroundUrl(currentMontageMedia);
    const currentMontageIsVideo = isVideoMedia(currentMontageMedia);
    const currentMontageTitle =
        String(currentMontageMedia?.displayname || currentMontageMedia?.filename || "").trim() || "Untitled media";
    const currentMontageAuthor = String(currentMontageMedia?.author || "").trim() || "Unknown";
    const montageImageDurationMs = montageSettings.imageDurationSeconds * 1000;
    const currentMontageTransitionClass = getMontageTransitionClass(montageSettings.animationType);
    const currentMontageElapsedSeconds = Math.max(
        0,
        Math.floor((montageProgressRatio * currentMontageDurationMs) / 1000),
    );
    const currentMontageRemainingSeconds = currentMontageIsVideo ? montageRemainingSeconds : 0;
    const currentMontageRemainingLabel = `${String(Math.floor(currentMontageRemainingSeconds / 60)).padStart(
        2,
        "0",
    )}:${String(currentMontageRemainingSeconds % 60).padStart(2, "0")}`;
    const currentMontageSizeLabel = formatMontageMediaSize(currentMontageMedia?.size);
    const currentMontageDateLabel = formatMontageUploadDate(
        currentMontageMedia?.updatedAt ||
            currentMontageMedia?.updated_at ||
            currentMontageMedia?.createdAt ||
            currentMontageMedia?.created_at,
    );
    const currentMontageTags = useMemo(() => normalizeMontageTags(currentMontageMedia), [currentMontageMedia]);
    const currentMontageDefaultTags = currentMontageTags.filter((tag) => String(tag.type).toLowerCase() === "default");
    const currentMontageCopyrightTags = currentMontageTags.filter(
        (tag) => String(tag.type).toLowerCase() === "copyright",
    );
    const visibleMontageDefaultTags = currentMontageDefaultTags.slice(0, MONTAGE_DEFAULT_TAG_LIMIT);
    const visibleMontageCopyrightTags = currentMontageCopyrightTags.slice(0, MONTAGE_COPYRIGHT_TAG_LIMIT);
    const hiddenMontageDefaultTagCount = Math.max(0, currentMontageDefaultTags.length - MONTAGE_DEFAULT_TAG_LIMIT);
    const hiddenMontageCopyrightTagCount = Math.max(
        0,
        currentMontageCopyrightTags.length - MONTAGE_COPYRIGHT_TAG_LIMIT,
    );

    const canReorderAlbumMedia = !isAlbumSelectionMode && albumMediaItems.length > 1;
    const canUseDragReorder = canReorderAlbumMedia && isReorderMode && !isMobileViewport;
    const canUseTapReorder = canReorderAlbumMedia && isReorderMode && isMobileViewport;

    const replaceAlbumHistoryState = useCallback(
        (nextAlbumState) => {
            const currentState = location.state && typeof location.state === "object" ? location.state : {};
            const nextState = { ...currentState };

            if (nextAlbumState) {
                nextState.albumMontageReturn = nextAlbumState;
            } else {
                delete nextState.albumMontageReturn;
            }

            navigate(".", {
                replace: true,
                state: nextState,
            });
        },
        [location.state, navigate],
    );

    const clearDownloadToastTimer = () => {
        if (downloadToastTimeoutRef.current) {
            window.clearTimeout(downloadToastTimeoutRef.current);
            downloadToastTimeoutRef.current = null;
        }
    };

    const showDownloadToast = (nextToast, autoCloseMs = 0) => {
        clearDownloadToastTimer();
        setDownloadToast(nextToast);

        if (autoCloseMs > 0) {
            downloadToastTimeoutRef.current = window.setTimeout(() => {
                setDownloadToast(null);
                downloadToastTimeoutRef.current = null;
            }, autoCloseMs);
        }
    };

    const hideDownloadToast = () => {
        clearDownloadToastTimer();
        setDownloadToast(null);
    };

    const fetchAllUserMedia = useCallback(async () => {
        const pageSize = 500;
        const maxPages = 200;
        let page = 1;
        let expectedTotal = null;
        const collected = [];

        while (page <= maxPages) {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pageSize),
            });

            const response = await fetchWithAuth(`${API_URL}/media?${params.toString()}`, { method: "GET" });
            const data = await parseApiResponse(response, "Could not load media library");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not load media library");
            }

            const pageItems = Array.isArray(data.data) ? data.data : [];
            collected.push(...pageItems);

            const parsedTotal = Number.parseInt(data.total, 10);
            if (Number.isFinite(parsedTotal) && parsedTotal >= 0) {
                expectedTotal = parsedTotal;
            }

            if (pageItems.length < pageSize) {
                break;
            }

            if (expectedTotal !== null && collected.length >= expectedTotal) {
                break;
            }

            page += 1;
        }

        const dedupedById = new Map();
        collected.forEach((item) => {
            if (item?.id !== undefined && item?.id !== null) {
                dedupedById.set(item.id, item);
            }
        });

        return Array.from(dedupedById.values());
    }, [fetchWithAuth]);

    const loadPageData = useCallback(async () => {
        const [albumResponse, albumMediaResponse, libraryMediaResponse] = await Promise.all([
            fetchWithAuth(`${API_URL}/albums/${albumId}`, { method: "GET" }),
            fetchWithAuth(`${API_URL}/albums/${albumId}/media`, { method: "GET" }),
            fetchAllUserMedia(),
        ]);

        const [albumData, albumMediaData, libraryMediaData] = await Promise.all([
            parseApiResponse(albumResponse, "Could not load album detail"),
            parseApiResponse(albumMediaResponse, "Could not load album media"),
            Promise.resolve({ success: true, data: libraryMediaResponse }),
        ]);

        if (!albumResponse.ok || !albumData.success || !albumData.data) {
            throw new Error(albumData.message || "Could not load album detail");
        }

        if (!albumMediaResponse.ok || !albumMediaData.success) {
            throw new Error(albumMediaData.message || "Could not load album media");
        }

        if (!libraryMediaData.success) {
            throw new Error(libraryMediaData.message || "Could not load media library");
        }

        const nextAlbum = albumData.data;
        const nextAlbumMedia = Array.isArray(albumMediaData.data) ? albumMediaData.data : [];
        const nextLibraryMedia = Array.isArray(libraryMediaData.data) ? libraryMediaData.data : [];

        const mediaById = new Map(nextLibraryMedia.map((media) => [String(media.id), media]));
        const enrichedAlbumMedia = nextAlbumMedia.map((media) => {
            const enriched = mediaById.get(String(media.id));
            return enriched ? { ...media, ...enriched } : media;
        });

        setAlbum(nextAlbum);
        setAlbumMediaItems(enrichedAlbumMedia);
        setLibraryMediaItems(nextLibraryMedia);
    }, [albumId, fetchAllUserMedia, fetchWithAuth]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!user || user.type === "admin") {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                await loadPageData();
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load album detail");
                    setAlbum(null);
                    setAlbumMediaItems([]);
                    setLibraryMediaItems([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [user, loadPageData]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const mediaQuery = window.matchMedia("(max-width: 900px)");
        const updateViewportFlag = () => setIsMobileViewport(mediaQuery.matches);

        updateViewportFlag();
        mediaQuery.addEventListener("change", updateViewportFlag);

        return () => {
            mediaQuery.removeEventListener("change", updateViewportFlag);
        };
    }, []);

    useEffect(() => {
        return () => {
            clearDownloadToastTimer();
        };
    }, []);

    const availableMediaItems = useMemo(() => {
        const selectedInAlbum = new Set(albumMediaItems.map((item) => String(item.id)));

        return libraryMediaItems.filter((item) => !selectedInAlbum.has(String(item.id)));
    }, [libraryMediaItems, albumMediaItems]);

    const filteredAvailableMediaItems = useMemo(() => {
        const scopedSearch = parseScopedMediaSearchQuery(addMediaSearch);
        const normalizedIncludeTags = selectedAddMediaIncludeFilterTags.map((tag) => tag.toLowerCase());
        const normalizedExcludeTags = selectedAddMediaExcludeFilterTags.map((tag) => tag.toLowerCase());

        if (
            scopedSearch.authorTerms.length === 0 &&
            scopedSearch.nameTerms.length === 0 &&
            scopedSearch.freeTerms.length === 0
        ) {
            return availableMediaItems.filter((item) => {
                const mediaTagNames = mapTagsFromMedia(item).map((tagName) => tagName.toLowerCase());

                if (normalizedIncludeTags.length > 0) {
                    const hasAllIncludedTags = normalizedIncludeTags.every((filterTag) =>
                        mediaTagNames.includes(filterTag),
                    );
                    if (!hasAllIncludedTags) {
                        return false;
                    }
                }

                if (normalizedExcludeTags.length > 0) {
                    const hasAnyExcludedTag = normalizedExcludeTags.some((filterTag) =>
                        mediaTagNames.includes(filterTag),
                    );
                    if (hasAnyExcludedTag) {
                        return false;
                    }
                }

                return true;
            });
        }

        return availableMediaItems.filter((item) => {
            const mediaTagNames = mapTagsFromMedia(item).map((tagName) => tagName.toLowerCase());
            const displayName = String(item.displayname || item.filename || "").toLowerCase();
            const authorName = String(item.author || "").toLowerCase();
            const combinedSearchHaystack = `${displayName} ${authorName}`.trim();

            if (scopedSearch.authorTerms.length > 0) {
                const matchesAuthorTerms = scopedSearch.authorTerms.every((term) => authorName.includes(term));
                if (!matchesAuthorTerms) {
                    return false;
                }
            }

            if (scopedSearch.nameTerms.length > 0) {
                const matchesNameTerms = scopedSearch.nameTerms.every((term) => displayName.includes(term));
                if (!matchesNameTerms) {
                    return false;
                }
            }

            if (scopedSearch.freeTerms.length > 0) {
                const matchesFreeTerms = scopedSearch.freeTerms.every((term) => combinedSearchHaystack.includes(term));
                if (!matchesFreeTerms) {
                    return false;
                }
            }

            if (normalizedIncludeTags.length > 0) {
                const hasAllIncludedTags = normalizedIncludeTags.every((filterTag) =>
                    mediaTagNames.includes(filterTag),
                );
                if (!hasAllIncludedTags) {
                    return false;
                }
            }

            if (normalizedExcludeTags.length > 0) {
                const hasAnyExcludedTag = normalizedExcludeTags.some((filterTag) => mediaTagNames.includes(filterTag));
                if (hasAnyExcludedTag) {
                    return false;
                }
            }

            return true;
        });
    }, [availableMediaItems, addMediaSearch, selectedAddMediaIncludeFilterTags, selectedAddMediaExcludeFilterTags]);
    const areAllVisibleAddMediaSelected =
        filteredAvailableMediaItems.length > 0 &&
        filteredAvailableMediaItems.every((media) => selectedMediaToAddIds.has(media.id));

    const distinctAlbumEditDisplayNames = useMemo(() => {
        return Array.from(
            new Set(
                libraryMediaItems
                    .map((item) => String(item?.displayname || "").trim())
                    .filter((value) => value.length > 0),
            ),
        ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
    }, [libraryMediaItems]);

    const distinctAlbumEditAuthors = useMemo(() => {
        return Array.from(
            new Set(
                libraryMediaItems.map((item) => String(item?.author || "").trim()).filter((value) => value.length > 0),
            ),
        ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
    }, [libraryMediaItems]);

    const { distinctAlbumEditTagNames, albumEditTagColorByName } = useMemo(() => {
        const tagsMap = new Map();
        const colorMap = {};

        libraryMediaItems.forEach((item) => {
            const candidates = item?.tags || item?.tag_names || item?.mediaTags || item?.relatedTags || [];

            if (!Array.isArray(candidates)) {
                return;
            }

            candidates.forEach((tag) => {
                const tagName =
                    typeof tag === "string" ? String(tag || "").trim() : String(tag?.tagname || tag?.name || "").trim();

                if (!tagName) {
                    return;
                }

                const normalized = tagName.toLowerCase();

                if (!tagsMap.has(normalized)) {
                    tagsMap.set(normalized, tagName);
                }

                const tagColor = typeof tag === "string" ? null : String(tag?.tagcolor_hex || "").trim();

                if (tagColor && !colorMap[normalized]) {
                    colorMap[normalized] = tagColor;
                }
            });
        });

        return {
            distinctAlbumEditTagNames: Array.from(tagsMap.values()).sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
            ),
            albumEditTagColorByName: colorMap,
        };
    }, [libraryMediaItems]);

    const addMediaTagFilterCandidates = useMemo(() => {
        const uniqueTags = new Map();

        availableMediaItems.forEach((item) => {
            mapTagsFromMedia(item).forEach((tagName) => {
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
    }, [availableMediaItems]);

    const visibleAddMediaTagFilterCandidates = useMemo(() => {
        const query = addMediaTagFilterSearch.trim().toLowerCase();

        if (!query) {
            return addMediaTagFilterCandidates;
        }

        return addMediaTagFilterCandidates.filter((tagName) => tagName.toLowerCase().includes(query));
    }, [addMediaTagFilterCandidates, addMediaTagFilterSearch]);

    const imageLibraryMediaItems = useMemo(
        () =>
            libraryMediaItems.filter(
                (item) => String(item.mediatype || "").toLowerCase() === "image" || !item.mediatype,
            ),
        [libraryMediaItems],
    );

    const filteredCoverCandidates = useMemo(() => {
        const scopedSearch = parseScopedMediaSearchQuery(coverSearch);
        const normalizedFilterTags = selectedEditFilterTags.map((tag) => tag.toLowerCase());
        const hasScopedSearch =
            scopedSearch.authorTerms.length > 0 ||
            scopedSearch.nameTerms.length > 0 ||
            scopedSearch.freeTerms.length > 0;

        return imageLibraryMediaItems.filter((item) => {
            const displayName = String(item.displayname || item.filename || "").toLowerCase();
            const authorName = String(item.author || "").toLowerCase();
            const combinedSearchHaystack = `${displayName} ${authorName}`.trim();

            if (hasScopedSearch) {
                const matchesAuthorTerms = scopedSearch.authorTerms.every((term) => authorName.includes(term));
                if (!matchesAuthorTerms) {
                    return false;
                }

                const matchesNameTerms = scopedSearch.nameTerms.every((term) => displayName.includes(term));
                if (!matchesNameTerms) {
                    return false;
                }

                const matchesFreeTerms = scopedSearch.freeTerms.every((term) => combinedSearchHaystack.includes(term));
                if (!matchesFreeTerms) {
                    return false;
                }
            }

            if (normalizedFilterTags.length > 0) {
                const mediaTagNames = mapTagsFromMedia(item).map((tagName) => tagName.toLowerCase());

                if (editTagFilterMode === "exclude") {
                    const hasAnyExcludedTag = normalizedFilterTags.some((filterTag) =>
                        mediaTagNames.includes(filterTag),
                    );
                    if (hasAnyExcludedTag) {
                        return false;
                    }
                } else {
                    const hasAllTags = normalizedFilterTags.every((filterTag) => mediaTagNames.includes(filterTag));
                    if (!hasAllTags) {
                        return false;
                    }
                }
            }

            return true;
        });
    }, [imageLibraryMediaItems, coverSearch, selectedEditFilterTags, editTagFilterMode]);

    const editTagFilterCandidates = useMemo(() => {
        const uniqueTags = new Map();

        imageLibraryMediaItems.forEach((item) => {
            mapTagsFromMedia(item).forEach((tagName) => {
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
    }, [imageLibraryMediaItems]);

    const visibleEditTagFilterCandidates = useMemo(() => {
        const query = editTagFilterSearch.trim().toLowerCase();

        if (!query) {
            return editTagFilterCandidates;
        }

        return editTagFilterCandidates.filter((tagName) => tagName.toLowerCase().includes(query));
    }, [editTagFilterCandidates, editTagFilterSearch]);

    const openAddMediaModal = () => {
        setAddMediaSearch("");
        setAddMediaPickerViewMode("card");
        setAddMediaTagFilterSearch("");
        setSelectedAddMediaIncludeFilterTags([]);
        setSelectedAddMediaExcludeFilterTags([]);
        setSelectedMediaToAddIds(new Set());
        setIsAddSelectionMode(false);
        setAddMediaError(null);
        setIsAddMediaModalOpen(true);
    };

    const closeAddMediaModal = () => {
        if (isAddingMedia) {
            return;
        }

        setIsAddMediaModalOpen(false);
        setAddMediaSearch("");
        setAddMediaPickerViewMode("card");
        setAddMediaTagFilterSearch("");
        setSelectedAddMediaIncludeFilterTags([]);
        setSelectedAddMediaExcludeFilterTags([]);
        setSelectedMediaToAddIds(new Set());
        setIsAddSelectionMode(false);
        setAddMediaError(null);
    };

    const clearAddSelection = () => {
        setSelectedMediaToAddIds(new Set());
        setIsAddSelectionMode(false);
    };
    const selectAllVisibleAddMedia = () => {
        if (isAddingMedia || filteredAvailableMediaItems.length === 0) {
            return;
        }

        if (areAllVisibleAddMediaSelected) {
            setSelectedMediaToAddIds(new Set());
            setIsAddSelectionMode(false);
            setAddMediaError(null);
            return;
        }

        setSelectedMediaToAddIds(new Set(filteredAvailableMediaItems.map((media) => media.id)));
        setIsAddSelectionMode(true);
        setAddMediaError(null);
    };

    const toggleAddMediaIncludeFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedAddMediaIncludeFilterTags((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === normalized.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase());
            }

            return [...previous, normalized];
        });

        setSelectedAddMediaExcludeFilterTags((previous) =>
            previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase()),
        );
    };

    const toggleAddMediaExcludeFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedAddMediaExcludeFilterTags((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === normalized.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase());
            }

            return [...previous, normalized];
        });

        setSelectedAddMediaIncludeFilterTags((previous) =>
            previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase()),
        );
    };

    const clearAddMediaFilterTags = () => {
        setSelectedAddMediaIncludeFilterTags([]);
        setSelectedAddMediaExcludeFilterTags([]);
    };

    const handleAddPickerSelection = (mediaId, event) => {
        if (!mediaId || isAddingMedia) {
            return;
        }

        const useMultiSelection = Boolean(event?.ctrlKey || event?.metaKey || isAddSelectionMode);

        setSelectedMediaToAddIds((previous) => {
            const next = new Set(previous);

            if (!useMultiSelection) {
                next.clear();
                next.add(mediaId);
                return next;
            }

            if (next.has(mediaId)) {
                next.delete(mediaId);
            } else {
                next.add(mediaId);
            }

            return next;
        });

        setIsAddSelectionMode(true);
        setAddMediaError(null);
    };

    const activateAlbumSelectionMode = (initialMediaId = null) => {
        setIsAlbumSelectionMode(true);
        setSelectionActionError(null);

        if (!initialMediaId) {
            return;
        }

        setSelectedAlbumMediaIds((previous) => {
            const next = new Set(previous);
            next.add(initialMediaId);
            return next;
        });
    };

    const clearAlbumSelectionMode = () => {
        setIsAlbumSelectionMode(false);
        setSelectedAlbumMediaIds(new Set());
        setIsRemoveConfirmOpen(false);
        setIsEditSelectedModalOpen(false);
        setSelectedEditError(null);
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
        if (selectedAlbumMediaIds.size === 0 || isSavingSelectedEdit) {
            return;
        }

        const selectedItems = albumMediaItems.filter((media) => selectedAlbumMediaIds.has(media.id));

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
        if (isSavingSelectedEdit || selectedAlbumMediaIds.size === 0) {
            return;
        }
        const payloadInput = inputPayload || {};
        const { displayname, author, tags } = payloadInput;
        const hasDisplayNameInput = Object.prototype.hasOwnProperty.call(payloadInput, "displayname");

        const selectedItems = albumMediaItems.filter((media) => selectedAlbumMediaIds.has(media.id));

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

            setAlbumMediaItems((previous) => previous.map((item) => updatedById.get(String(item.id)) || item));

            setLibraryMediaItems((previous) => previous.map((item) => updatedById.get(String(item.id)) || item));

            if (successfulUpdates.length < selectedItems.length) {
                setSelectionActionError(
                    `Updated ${successfulUpdates.length} item(s). Some media could not be updated.`,
                );
            }

            setIsEditSelectedModalOpen(false);
            clearAlbumSelectionMode();
        } catch (requestError) {
            setSelectedEditError(requestError.message || "Could not update selected media.");
        } finally {
            setIsSavingSelectedEdit(false);
        }
    };

    const toggleAlbumMediaSelection = (mediaId) => {
        if (!mediaId) {
            return;
        }

        setSelectedAlbumMediaIds((previous) => {
            const next = new Set(previous);

            if (next.has(mediaId)) {
                next.delete(mediaId);
            } else {
                next.add(mediaId);
            }

            return next;
        });
    };

    const selectAllVisibleAlbumMedia = () => {
        if (!hasVisibleAlbumMediaItems) {
            return;
        }

        setIsAlbumSelectionMode(true);
        setSelectionActionError(null);

        setSelectedAlbumMediaIds((previous) => {
            const next = new Set(previous);

            if (areAllVisibleAlbumMediaSelected) {
                activeAlbumMediaItems.forEach((media) => {
                    next.delete(media.id);
                });
            } else {
                activeAlbumMediaItems.forEach((media) => {
                    next.add(media.id);
                });
            }

            return next;
        });
    };

    const openRemoveSelectedConfirm = () => {
        if (selectedAlbumMediaIds.size === 0 || isRemovingSelected) {
            return;
        }

        setSelectionActionError(null);
        setIsRemoveConfirmOpen(true);
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
        const tempUrl = URL.createObjectURL(blob);
        const tempLink = document.createElement("a");

        tempLink.href = tempUrl;
        tempLink.download = filename || true;
        document.body.appendChild(tempLink);
        tempLink.click();
        tempLink.remove();

        URL.revokeObjectURL(tempUrl);
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

        return {
            blob,
            filename: getDownloadFilenameForMedia(media),
        };
    };

    const handleDownloadSelectedMedia = async () => {
        if (selectedAlbumMediaIds.size === 0 || isDownloadingSelected) {
            return;
        }

        const selectedItems = albumMediaItems.filter((media) => selectedAlbumMediaIds.has(media.id));
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
                clearAlbumSelectionMode();
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

            clearAlbumSelectionMode();

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

    const closeRemoveSelectedConfirm = useCallback(() => {
        if (isRemovingSelected) {
            return;
        }

        setIsRemoveConfirmOpen(false);
    }, [isRemovingSelected]);

    const handleRemoveSelectedMedia = async () => {
        if (selectedAlbumMediaIds.size === 0 || isRemovingSelected) {
            return;
        }

        try {
            setIsRemovingSelected(true);
            setSelectionActionError(null);
            setIsRemoveConfirmOpen(false);

            const response = await fetchWithAuth(`${API_URL}/albums/${albumId}/media`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ media_ids: Array.from(selectedAlbumMediaIds) }),
            });

            const data = await parseApiResponse(response, "Could not remove selected media from album");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not remove selected media from album");
            }

            await loadPageData();
            clearAlbumSelectionMode();
        } catch (requestError) {
            setSelectionActionError(requestError.message || "Could not remove selected media from album");
        } finally {
            setIsRemovingSelected(false);
        }
    };

    const applyAlbumTagFilter = (rawTag) => {
        const selectedTag = String(rawTag || "").trim();

        if (!selectedTag || isAlbumSelectionMode) {
            return;
        }

        setActiveAlbumTagFilter(selectedTag);
    };

    const clearAlbumTagFilter = () => {
        setActiveAlbumTagFilter("");
    };

    const handleClearTagFilterFromToolbar = () => {
        clearAlbumTagFilter();
        clearAlbumSelectionMode();
    };

    const reorderMediaList = (items, sourceMediaId, targetMediaId) => {
        const sourceIndex = items.findIndex((item) => String(item.id) === String(sourceMediaId));
        const targetIndex = items.findIndex((item) => String(item.id) === String(targetMediaId));

        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
            return items;
        }

        const next = [...items];
        const [movedItem] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedItem);
        return next;
    };

    const toggleReorderMode = () => {
        setIsReorderMode((previous) => {
            const next = !previous;
            if (next) {
                clearAlbumTagFilter();
                clearFilterTags();
                clearAlbumSelectionMode();
                setReorderError(null);
            } else {
                setMobileReorderSourceId(null);
                clearDragState();
            }
            return next;
        });
    };

    const applyReorderAndPersist = async (sourceMediaId, targetMediaId) => {
        const previousOrder = [...albumMediaItems];
        const reordered = reorderMediaList(previousOrder, sourceMediaId, targetMediaId);

        if (reordered === previousOrder) {
            return;
        }

        setAlbumMediaItems(reordered);

        try {
            setIsReorderingMedia(true);
            setReorderError(null);

            const response = await fetchWithAuth(`${API_URL}/albums/${albumId}/media/order`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ media_ids: reordered.map((item) => item.id) }),
            });

            const data = await parseApiResponse(response, "Could not reorder album media");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not reorder album media");
            }
        } catch (requestError) {
            setAlbumMediaItems(previousOrder);
            setReorderError(requestError.message || "Could not reorder album media");
        } finally {
            setIsReorderingMedia(false);
        }
    };

    const handleDragStart = (mediaId, event) => {
        if (!canUseDragReorder || isReorderingMedia) {
            event.preventDefault();
            return;
        }

        setReorderError(null);
        setDraggingMediaId(mediaId);
        setDragOverMediaId(mediaId);

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(mediaId));
        }
    };

    const handleDragOver = (targetMediaId, event) => {
        if (!canUseDragReorder || draggingMediaId === null || isReorderingMedia) {
            return;
        }

        event.preventDefault();
        setDragOverMediaId(targetMediaId);
    };

    const clearDragState = () => {
        setDraggingMediaId(null);
        setDragOverMediaId(null);
    };

    const handleDrop = async (targetMediaId, event) => {
        if (!canUseDragReorder || draggingMediaId === null || isReorderingMedia) {
            return;
        }

        event.preventDefault();

        const sourceMediaId = draggingMediaId;

        clearDragState();

        await applyReorderAndPersist(sourceMediaId, targetMediaId);
    };

    useEffect(() => {
        clearDragState();
        setMobileReorderSourceId(null);
        setReorderError(null);
    }, [
        albumId,
        activeAlbumTagFilter,
        selectedIncludeFilterTags,
        selectedExcludeFilterTags,
        isAlbumSelectionMode,
        isReorderMode,
    ]);

    const openMontage = () => {
        if (montageMediaItems.length === 0) {
            return;
        }

        suppressMontageRestoreRef.current = false;
        setIsReorderMode(false);
        setMobileReorderSourceId(null);
        setIsAlbumSelectionMode(false);
        setSelectedAlbumMediaIds(new Set());
        setMontageIndex(0);
        setIsMontagePlaying(true);
        setMontagePreviousFrame(null);
        setMontageDirection("next");
        setIsMontageTransitionFromVideo(false);
        setMontageProgressRatio(0);
        setMontageRemainingSeconds(Math.ceil(montageImageDurationMs / 1000));
        setAreMontageVideoControlsVisible(false);
        if (montageProgressBarRef.current) {
            montageProgressBarRef.current.style.transform = "scaleX(0)";
        }
        setIsMontageOpen(true);
    };

    useEffect(() => {
        const returnState = location.state?.albumMontageReturn;

        if (
            !returnState ||
            String(returnState.albumId) !== String(albumId) ||
            montageMediaItems.length === 0 ||
            isMontageOpen
        ) {
            if (!returnState || String(returnState.albumId) !== String(albumId)) {
                suppressMontageRestoreRef.current = false;
            }
            return;
        }

        if (suppressMontageRestoreRef.current) {
            return;
        }

        const restoredIndex = Math.max(
            0,
            Math.min(Number.parseInt(returnState.index, 10) || 0, montageMediaItems.length - 1),
        );

        setIsReorderMode(false);
        setMobileReorderSourceId(null);
        setIsAlbumSelectionMode(false);
        setSelectedAlbumMediaIds(new Set());
        setMontageIndex(restoredIndex);
        setIsMontagePlaying(true);
        setMontagePreviousFrame(null);
        setMontageDirection("next");
        setIsMontageTransitionFromVideo(false);
        setMontageProgressRatio(0);
        setMontageRemainingSeconds(Math.ceil(montageImageDurationMs / 1000));
        setAreMontageVideoControlsVisible(false);
        if (montageProgressBarRef.current) {
            montageProgressBarRef.current.style.transform = "scaleX(0)";
        }
        setIsMontageOpen(true);
    }, [albumId, isMontageOpen, location.state, montageImageDurationMs, montageMediaItems.length]);

    const closeMontage = useCallback(() => {
        suppressMontageRestoreRef.current = true;
        replaceAlbumHistoryState(null);
        setIsMontageOpen(false);
        setMontagePreviousFrame(null);
    }, [replaceAlbumHistoryState]);

    const openMontageSettings = () => {
        setIsMontageSettingsOpen(true);
    };

    const closeMontageSettings = () => {
        setIsMontageSettingsOpen(false);
    };

    const updateMontageImageDurationSeconds = (value) => {
        setMontageSettings((previous) => ({
            ...previous,
            imageDurationSeconds: clampMontageImageDurationSeconds(value),
        }));
    };

    const updateMontageAnimationType = (value) => {
        setMontageSettings((previous) => ({
            ...previous,
            animationType: normalizeMontageAnimationType(value),
        }));
    };

    const queuePreviousMontageFrame = useCallback(
        (direction = "next") => {
            if (!currentMontageMedia) {
                return;
            }

            if (montagePreviousFrameTimeoutRef.current) {
                window.clearTimeout(montagePreviousFrameTimeoutRef.current);
            }

            setMontageDirection(direction);

            if (currentMontageIsVideo) {
                const video = montageVideoRef.current;
                if (video) {
                    video.pause();
                    video.removeAttribute("src");
                    video.load();
                }

                setIsMontageTransitionFromVideo(true);
                setMontagePreviousFrame(null);
                montagePreviousFrameTimeoutRef.current = null;
                return;
            }

            setIsMontageTransitionFromVideo(false);
            setMontagePreviousFrame({
                media: currentMontageMedia,
                index: montageIndex,
                mediaUrl: currentMontageMediaUrl,
                posterUrl: currentMontagePosterUrl,
                backgroundUrl: currentMontageBackgroundUrl,
                isVideo: currentMontageIsVideo,
                title: currentMontageTitle,
                transitionClass: currentMontageTransitionClass,
            });

            montagePreviousFrameTimeoutRef.current = window.setTimeout(() => {
                setMontagePreviousFrame(null);
                montagePreviousFrameTimeoutRef.current = null;
            }, MONTAGE_TRANSITION_DURATION_MS);
        },
        [
            currentMontageIsVideo,
            currentMontageMedia,
            currentMontageMediaUrl,
            currentMontagePosterUrl,
            currentMontageBackgroundUrl,
            currentMontageTitle,
            currentMontageTransitionClass,
            montageIndex,
        ],
    );

    const showNextMontageMedia = useCallback(() => {
        if (isMontageSeekingRef.current) {
            return;
        }

        if (montageAdvanceLockedRef.current) {
            return;
        }

        montageAdvanceLockedRef.current = true;
        queuePreviousMontageFrame("next");
        setMontageIndex((previous) => {
            if (montageMediaItems.length <= 1) {
                return 0;
            }

            return (previous + 1) % montageMediaItems.length;
        });
    }, [montageMediaItems.length, queuePreviousMontageFrame]);

    const showPreviousMontageMedia = useCallback(() => {
        if (isMontageSeekingRef.current) {
            return;
        }

        if (montageAdvanceLockedRef.current) {
            return;
        }

        montageAdvanceLockedRef.current = true;
        queuePreviousMontageFrame("previous");
        setMontageIndex((previous) => {
            if (montageMediaItems.length <= 1) {
                return 0;
            }

            return (previous - 1 + montageMediaItems.length) % montageMediaItems.length;
        });
    }, [montageMediaItems.length, queuePreviousMontageFrame]);

    const seekMontageProgress = useCallback(
        (clientX) => {
            const track = montageProgressTrackRef.current;

            if (!track) {
                return;
            }

            const bounds = track.getBoundingClientRect();
            const rawRatio = bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0;
            const nextRatio = Math.max(0, Math.min(0.995, rawRatio));
            const totalDuration = Math.max(1, montageTimerDurationMsRef.current || currentMontageDurationMs);
            const nextRemainingMs = Math.max(0, totalDuration * (1 - nextRatio));
            const nextRemainingSeconds = Math.max(0, Math.ceil(nextRemainingMs / 1000));

            montageTimerStartedAtRef.current = performance.now();
            montageTimerStartRemainingMsRef.current = nextRemainingMs;
            montageRemainingMsRef.current = nextRemainingMs;
            montageLastRenderedSecondRef.current = nextRemainingSeconds;
            setMontageRemainingSeconds(nextRemainingSeconds);
            setMontageProgressRatio(nextRatio);

            if (montageProgressBarRef.current) {
                montageProgressBarRef.current.style.transform = `scaleX(${nextRatio})`;
            }

            const video = montageVideoRef.current;
            if (currentMontageIsVideo && video && Number.isFinite(video.duration) && video.duration > 0) {
                video.currentTime = Math.min(video.duration - 0.05, Math.max(0, video.duration * nextRatio));
            }
        },
        [currentMontageDurationMs, currentMontageIsVideo],
    );

    const handleMontageProgressPointerDown = useCallback(
        (event) => {
            event.preventDefault();
            isMontageSeekingRef.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            seekMontageProgress(event.clientX);
        },
        [seekMontageProgress],
    );

    const handleMontageProgressPointerMove = useCallback(
        (event) => {
            if (!isMontageSeekingRef.current) {
                return;
            }

            event.preventDefault();
            seekMontageProgress(event.clientX);
        },
        [seekMontageProgress],
    );

    const handleMontageProgressPointerEnd = useCallback((event) => {
        if (!isMontageSeekingRef.current) {
            return;
        }

        isMontageSeekingRef.current = false;
        setMontageSeekRevision((previous) => previous + 1);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);

    const handleMontageProgressKeyDown = useCallback(
        (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
            }

            event.preventDefault();
            const step = event.key === "ArrowRight" ? 0.05 : -0.05;
            const nextRatio = Math.max(0, Math.min(0.995, montageProgressRatio + step));
            const track = montageProgressTrackRef.current;

            if (!track) {
                return;
            }

            const bounds = track.getBoundingClientRect();
            seekMontageProgress(bounds.left + bounds.width * nextRatio);
            setMontageSeekRevision((previous) => previous + 1);
        },
        [montageProgressRatio, seekMontageProgress],
    );

    useEffect(() => {
        if (!isMontageOpen) {
            return;
        }

        if (montageMediaItems.length === 0) {
            closeMontage();
            return;
        }

        setMontageIndex((previous) => Math.min(previous, montageMediaItems.length - 1));
    }, [closeMontage, isMontageOpen, montageMediaItems.length]);

    useEffect(() => {
        if (!isMontageOpen || !currentMontageMedia) {
            return undefined;
        }

        const nextDuration = currentMontageIsVideo ? MONTAGE_VIDEO_FALLBACK_DURATION_MS : montageImageDurationMs;
        montageAdvanceLockedRef.current = false;
        setCurrentMontageDurationMs(nextDuration);
        montageTimerDurationMsRef.current = nextDuration;
        montageRemainingMsRef.current = nextDuration;
        montageTimerStartRemainingMsRef.current = nextDuration;
        montageLastRenderedSecondRef.current = Math.ceil(nextDuration / 1000);
        setMontageProgressRatio(0);
        setMontageRemainingSeconds(Math.ceil(nextDuration / 1000));
        setAreMontageVideoControlsVisible(false);
        if (montageProgressBarRef.current) {
            montageProgressBarRef.current.style.transform = "scaleX(0)";
        }

        return undefined;
    }, [currentMontageIsVideo, currentMontageMedia, isMontageOpen, montageImageDurationMs, montageIndex]);

    useEffect(() => {
        if (!isMontageOpen || !isMontagePlaying || montageMediaItems.length <= 1) {
            return undefined;
        }

        const duration = Math.max(300, montageRemainingMsRef.current || currentMontageDurationMs);
        montageTimerStartedAtRef.current = performance.now();
        montageTimerStartRemainingMsRef.current = duration;

        const timeout = window.setTimeout(showNextMontageMedia, duration);

        return () => {
            if (skipNextMontageTimerCleanupRef.current) {
                skipNextMontageTimerCleanupRef.current = false;
            } else {
                const elapsed = performance.now() - montageTimerStartedAtRef.current;
                montageRemainingMsRef.current = Math.max(0, montageTimerStartRemainingMsRef.current - elapsed);
            }
            window.clearTimeout(timeout);
        };
    }, [
        currentMontageDurationMs,
        isMontageOpen,
        isMontagePlaying,
        montageIndex,
        montageMediaItems.length,
        montageSeekRevision,
        showNextMontageMedia,
    ]);

    useEffect(() => {
        if (!isMontageOpen) {
            return undefined;
        }

        let frameId = 0;

        const updateProgress = () => {
            if (isMontagePlaying) {
                const elapsed = performance.now() - montageTimerStartedAtRef.current;
                const remaining = Math.max(0, montageTimerStartRemainingMsRef.current - elapsed);
                montageRemainingMsRef.current = remaining;
                const totalDuration = Math.max(1, montageTimerDurationMsRef.current);
                const ratio = 1 - remaining / totalDuration;
                const nextRatio = Math.max(0, Math.min(1, ratio));
                const nextRemainingSecond = Math.max(0, Math.ceil(remaining / 1000));

                if (montageProgressBarRef.current) {
                    montageProgressBarRef.current.style.transform = `scaleX(${nextRatio})`;
                }

                if (nextRemainingSecond !== montageLastRenderedSecondRef.current) {
                    montageLastRenderedSecondRef.current = nextRemainingSecond;
                    setMontageRemainingSeconds(nextRemainingSecond);
                }
            }

            frameId = window.requestAnimationFrame(updateProgress);
        };

        frameId = window.requestAnimationFrame(updateProgress);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [isMontageOpen, isMontagePlaying, montageIndex]);

    useEffect(() => {
        const video = montageVideoRef.current;

        if (!isMontageOpen || !currentMontageIsVideo || !video) {
            return;
        }

        if (!isMontagePlaying) {
            video.pause();
            return;
        }

        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {
                setIsMontagePlaying(false);
            });
        }
    }, [currentMontageIsVideo, isMontageOpen, isMontagePlaying, montageIndex]);

    useEffect(() => {
        if (!isMontageOpen) {
            return undefined;
        }

        if (typeof window === "undefined") {
            return undefined;
        }

        montageMediaItems.forEach((media) => {
            if (isVideoMedia(media)) {
                return;
            }

            const mediaUrl = getMontageMediaUrl(media);

            if (!mediaUrl || montagePreloadedImagesRef.current.has(mediaUrl)) {
                return;
            }

            const image = new Image();
            image.decoding = "async";
            image.src = mediaUrl;
            montagePreloadedImagesRef.current.set(mediaUrl, image);
        });

        return undefined;
    }, [isMontageOpen, montageMediaItems]);

    useEffect(() => {
        if (!isMontageOpen) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleMontageKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeMontage();
                return;
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();
                showNextMontageMedia();
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                showPreviousMontageMedia();
                return;
            }

            if (event.key === " ") {
                event.preventDefault();
                setIsMontagePlaying((previous) => !previous);
            }
        };

        window.addEventListener("keydown", handleMontageKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleMontageKeyDown);
        };
    }, [closeMontage, isMontageOpen, showNextMontageMedia, showPreviousMontageMedia]);

    useEffect(() => {
        return () => {
            if (montagePreviousFrameTimeoutRef.current) {
                window.clearTimeout(montagePreviousFrameTimeoutRef.current);
                montagePreviousFrameTimeoutRef.current = null;
            }
        };
    }, []);

    const openEditAlbumModal = () => {
        setEditingAlbumName(albumDisplayName);
        setCoverSearch("");
        setSelectedEditCoverMediaId(null);
        setEditCoverMediaViewMode("card");
        setEditTagFilterSearch("");
        setEditTagFilterMode("include");
        setSelectedEditFilterTags([]);
        setEditError(null);
        setIsEditModalOpen(true);
    };

    const closeEditAlbumModal = () => {
        if (isSavingEdit) {
            return;
        }

        setIsEditModalOpen(false);
        setEditCoverMediaViewMode("card");
        setEditTagFilterSearch("");
        setEditTagFilterMode("include");
        setSelectedEditFilterTags([]);
        setEditError(null);
    };

    const toggleEditFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedEditFilterTags((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === normalized.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase());
            }

            return [...previous, normalized];
        });
    };

    const clearEditFilterTags = () => setSelectedEditFilterTags([]);

    const handleSaveAlbumEdit = async (event) => {
        event.preventDefault();

        if (isSavingEdit) {
            return;
        }

        const trimmedAlbumName = editingAlbumName.trim();
        const currentAlbumName = String(albumDisplayName || "").trim();
        const hasNameChange = trimmedAlbumName !== currentAlbumName;
        const hasCoverChange = selectedEditCoverMediaId !== null;

        if (!trimmedAlbumName) {
            setEditError("Album name is required.");
            return;
        }

        if (!hasNameChange && !hasCoverChange) {
            closeEditAlbumModal();
            return;
        }

        try {
            setIsSavingEdit(true);
            setEditError(null);

            if (hasNameChange) {
                const renameResponse = await fetchWithAuth(`${API_URL}/albums/${albumId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ albumname: trimmedAlbumName }),
                });

                const renameData = await parseApiResponse(renameResponse, "Could not rename album");

                if (!renameResponse.ok || !renameData.success || !renameData.data) {
                    throw new Error(renameData.message || "Could not rename album");
                }
            }

            if (hasCoverChange) {
                const coverResponse = await fetchWithAuth(`${API_URL}/albums/${albumId}/cover`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ media_id: selectedEditCoverMediaId }),
                });

                const coverData = await parseApiResponse(coverResponse, "Could not change album cover");

                if (!coverResponse.ok || !coverData.success) {
                    throw new Error(coverData.message || "Could not change album cover");
                }
            }

            await loadPageData();
            closeEditAlbumModal();
        } catch (requestError) {
            setEditError(requestError.message || "Could not save album changes");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleAddMediaToAlbum = async (event) => {
        event.preventDefault();

        const mediaIds = Array.from(selectedMediaToAddIds);

        if (mediaIds.length === 0) {
            setAddMediaError("Please choose at least one media file to add.");
            return;
        }

        try {
            setIsAddingMedia(true);
            setAddMediaError(null);

            let addedWithBatch = false;

            try {
                const response = await fetchWithAuth(`${API_URL}/albums/${albumId}/media/batch`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ media_ids: mediaIds }),
                });

                const data = await parseApiResponse(response, "Could not add media to album");
                addedWithBatch = response.ok && data.success;
            } catch {
                addedWithBatch = false;
            }

            if (!addedWithBatch) {
                let addedCount = 0;

                for (const mediaId of mediaIds) {
                    const response = await fetchWithAuth(`${API_URL}/albums/${albumId}/media`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ media_id: mediaId }),
                    });

                    const data = await parseApiResponse(response, "Could not add media to album");

                    if (response.ok && data.success) {
                        addedCount += 1;
                    }
                }

                if (addedCount === 0) {
                    throw new Error("Could not add media to album");
                }
            }

            await loadPageData();
            setIsAddMediaModalOpen(false);
            setAddMediaSearch("");
            setAddMediaTagFilterSearch("");
            setSelectedAddMediaIncludeFilterTags([]);
            setSelectedAddMediaExcludeFilterTags([]);
            clearAddSelection();
        } catch (requestError) {
            setAddMediaError(requestError.message || "Could not add media to album");
        } finally {
            setIsAddingMedia(false);
        }
    };

    const handleOpenMediaDetail = (mediaId) => {
        if (!mediaId) {
            return;
        }

        if (canUseTapReorder) {
            if (isReorderingMedia) {
                return;
            }

            setReorderError(null);

            if (mobileReorderSourceId === null) {
                setMobileReorderSourceId(mediaId);
                return;
            }

            if (String(mobileReorderSourceId) === String(mediaId)) {
                setMobileReorderSourceId(null);
                return;
            }

            const sourceMediaId = mobileReorderSourceId;
            setMobileReorderSourceId(null);
            void applyReorderAndPersist(sourceMediaId, mediaId);
            return;
        }

        if (isAlbumSelectionMode) {
            toggleAlbumMediaSelection(mediaId);
            return;
        }

        navigate(`/gallery/${mediaId}`, {
            state: {
                mediaItems: activeAlbumMediaItems,
                mediaScope: "album",
            },
        });
    };

    const handleOpenMontageMediaDetail = () => {
        if (!currentMontageMedia?.id) {
            return;
        }

        setIsMontageOpen(false);
        setMontagePreviousFrame(null);
        replaceAlbumHistoryState({
            albumId,
            index: montageIndex,
        });

        navigate(`/gallery/${currentMontageMedia.id}`, {
            state: {
                mediaItems: activeAlbumMediaItems,
                mediaScope: "album",
            },
        });
    };

    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
            if (isMontageOpen) {
                return;
            }

            const target = event.target;
            const isTypingElement =
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);

            if (event.key === "Control" && !isTypingElement && !isReorderMode) {
                setIsAlbumSelectionMode(true);
                setSelectionActionError(null);
                return;
            }

            if (event.key === "Escape" && isRemoveConfirmOpen) {
                closeRemoveSelectedConfirm();
                return;
            }

            if (event.key === "Escape") {
                clearAlbumSelectionMode();
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);

        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [closeRemoveSelectedConfirm, isMontageOpen, isRemoveConfirmOpen, isReorderMode]);

    const handleToggleFavourite = async (mediaId) => {
        if (!mediaId || togglingIds.has(mediaId)) {
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

            setAlbumMediaItems((previous) =>
                previous.map((item) => (String(item.id) === String(mediaId) ? { ...item, ...data.data } : item)),
            );

            setLibraryMediaItems((previous) =>
                previous.map((item) => (String(item.id) === String(mediaId) ? { ...item, ...data.data } : item)),
            );
        } catch (toggleError) {
            setError(toggleError.message || "Could not update favourite");
        } finally {
            setTogglingIds((previous) => {
                const next = new Set(previous);
                next.delete(mediaId);
                return next;
            });
        }
    };

    if (user?.type === "admin") {
        return (
            <section className="tagged-app-page tagged-album-page tagged-album-page--centered">
                <article className="tagged-app-page-card tagged-album-status-card" aria-live="polite">
                    <h2>Albums not available for admin</h2>
                    <p>The administrator account cannot browse personal album detail pages.</p>
                </article>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="tagged-app-page tagged-album-detail-page" aria-label="Loading album detail">
                <header className="tagged-album-detail-hero tagged-loading-skeleton-hero" aria-hidden="true">
                    <div className="tagged-album-detail-hero-overlay" />
                    <span className="tagged-loading-skeleton-hero-button tagged-loading-skeleton-hero-button--left" />
                    <span className="tagged-loading-skeleton-hero-button tagged-loading-skeleton-hero-button--right" />
                    <div className="tagged-album-detail-hero-content">
                        <div className="tagged-loading-skeleton-hero-copy">
                            <span className="tagged-loading-skeleton-hero-block tagged-loading-skeleton-hero-title" />
                            <span className="tagged-loading-skeleton-hero-block tagged-loading-skeleton-hero-subtitle" />
                        </div>
                        <span className="tagged-loading-skeleton-hero-block tagged-loading-skeleton-hero-metric" />
                    </div>
                </header>

                <div className="tagged-album-detail-grid-wrap" aria-live="polite">
                    <CollectionLoadingSkeleton
                        itemType="media"
                        viewMode={albumMediaViewMode}
                        gridColumns={gridColumns}
                        context="album-detail"
                        ariaLabel="Loading album media"
                    />
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="tagged-app-page tagged-album-page tagged-album-page--centered">
                <article
                    className="tagged-app-page-card tagged-album-status-card tagged-album-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Error loading album</h2>
                    <p>{error}</p>
                </article>
            </section>
        );
    }

    if (!album) {
        return (
            <section className="tagged-app-page tagged-album-page tagged-album-page--centered">
                <article className="tagged-app-page-card tagged-album-status-card" aria-live="polite">
                    <h2>Album not found</h2>
                    <p>The selected album does not exist in your library.</p>
                </article>
            </section>
        );
    }

    return (
        <section className="tagged-app-page tagged-album-detail-page">
            <header className="tagged-album-detail-hero" aria-label="Album cover header">
                {albumCoverUrl && !isHeroCoverBroken ? (
                    <img
                        className="tagged-album-detail-hero-cover"
                        src={albumCoverUrl}
                        alt={albumDisplayName}
                        onError={() => setIsHeroCoverBroken(true)}
                    />
                ) : (
                    <div
                        className="tagged-album-detail-hero-cover tagged-album-detail-hero-cover--empty"
                        aria-hidden="true"
                    >
                        <img src="/icons/album.svg" alt="" />
                    </div>
                )}

                <div className="tagged-album-detail-hero-overlay" />

                <button
                    type="button"
                    className="tagged-album-detail-back-button"
                    onClick={() => navigate("/albums")}
                    aria-label="Back to albums"
                >
                    <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                </button>

                <button
                    type="button"
                    className="tagged-album-detail-change-cover-button"
                    onClick={openEditAlbumModal}
                    aria-label="Edit album"
                >
                    <img src="/icons/edit.svg" alt="" aria-hidden="true" />
                    <span>Edit</span>
                </button>

                {!isAlbumSelectionMode && activeAlbumMediaItems.length > 0 ? (
                    <div className="tagged-album-detail-montage-actions" aria-label="Montage actions">
                        <button
                            type="button"
                            className="tagged-album-detail-montage-button"
                            disabled={isReorderingMedia}
                            onClick={openMontage}
                            aria-label="Open montage"
                            title="Montage"
                        >
                            <img src="/icons/montage.svg" alt="" aria-hidden="true" />
                            <span>Montage</span>
                        </button>

                        <button
                            type="button"
                            className="tagged-album-detail-montage-settings-button"
                            onClick={openMontageSettings}
                            aria-label="Configure montage"
                            title="Montage settings"
                        >
                            <img src="/icons/settings.svg" alt="" aria-hidden="true" />
                        </button>
                    </div>
                ) : null}

                <div className="tagged-album-detail-hero-content">
                    <div className="tagged-album-detail-hero-text">
                        <h1 title={albumDisplayName}>{albumDisplayName}</h1>
                        <p>{albumCreatedLabel ? `Created ${albumCreatedLabel}` : "Creation date unavailable"}</p>
                    </div>

                    <div className="tagged-album-detail-hero-metrics">
                        {mediaTypeSummary.isMixed ? (
                            <div className="tagged-album-detail-hero-media-types" aria-label="Album media type summary">
                                <span>
                                    <img src="/icons/image.svg" alt="" aria-hidden="true" />
                                    {mediaTypeSummary.imageCount} images
                                </span>
                                <span className="tagged-album-detail-hero-media-dot" aria-hidden="true">
                                    ·
                                </span>
                                <span>
                                    <img src="/icons/video.svg" alt="" aria-hidden="true" />
                                    {mediaTypeSummary.videoCount} videos
                                </span>
                            </div>
                        ) : (
                            <p className="tagged-album-detail-hero-total-media">{mediaTypeSummary.total} media</p>
                        )}
                    </div>
                </div>
            </header>

            <div
                className={`tagged-album-detail-top-controls${albumMediaViewMode === "list" ? " is-list-mode" : ""}`}
                aria-label="Album media controls"
            >
                {albumMediaItems.length > 0 ? (
                    <div className="tagged-album-detail-top-search" aria-label="Search album media">
                        <div className="tagged-album-search-wrap tagged-album-search-field">
                            <div className="tagged-album-search-input-wrap">
                                <input
                                    type="text"
                                    inputMode="search"
                                    enterKeyHint="search"
                                    className="tagged-album-search-input"
                                    value={albumMediaSearch}
                                    onChange={(event) => setAlbumMediaSearch(event.target.value)}
                                    placeholder="Search media... (tip: a:author n:name)"
                                    aria-label="Search media by name or author. Supports a:author and n:name."
                                />

                                {hasActiveAlbumMediaSearch ? (
                                    <button
                                        type="button"
                                        className="tagged-album-search-inline-clear"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => setAlbumMediaSearch("")}
                                        aria-label="Clear search"
                                        title="Clear search"
                                    >
                                        <span className="tagged-album-search-inline-clear-icon" aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="tagged-album-reorder-controls-spacer" aria-hidden="true" />
                )}

                <div
                    className={`tagged-album-detail-view-switch${
                        !isAlbumSelectionMode && activeAlbumMediaItems.length > 0 ? " has-reorder" : ""
                    }`}
                    aria-label="Album media view mode"
                >
                    {!isAlbumSelectionMode && activeAlbumMediaItems.length > 0 ? (
                        <button
                            type="button"
                            className={`tagged-album-view-switch-button${isReorderMode ? " is-active" : ""}`}
                            disabled={!canReorderAlbumMedia || isReorderingMedia}
                            onClick={toggleReorderMode}
                            aria-pressed={isReorderMode}
                            aria-label="Reorder media"
                            title={isReorderMode ? "Done reordering" : "Reorder media"}
                        >
                            <img
                                src="/icons/reorder.svg"
                                alt=""
                                aria-hidden="true"
                                className="tagged-album-view-switch-icon-image"
                            />
                            <span className="tagged-album-view-switch-label">
                                {isReorderMode ? "Done reordering" : "Reorder media"}
                            </span>
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className={`tagged-album-view-switch-button${albumMediaViewMode === "card" ? " is-active" : ""}`}
                        onClick={() => setAlbumMediaViewMode("card")}
                        aria-pressed={albumMediaViewMode === "card"}
                        aria-label="Card view"
                        title="Card view"
                    >
                        <span className="tagged-album-view-switch-icon tagged-album-view-switch-icon--card" />
                        <span className="tagged-album-view-switch-label">Card</span>
                    </button>

                    <button
                        type="button"
                        className={`tagged-album-view-switch-button${albumMediaViewMode === "list" ? " is-active" : ""}`}
                        onClick={() => setAlbumMediaViewMode("list")}
                        aria-pressed={albumMediaViewMode === "list"}
                        aria-label="List view"
                        title="List view"
                    >
                        <span className="tagged-album-view-switch-icon tagged-album-view-switch-icon--list" />
                        <span className="tagged-album-view-switch-label">List</span>
                    </button>
                </div>
            </div>

            {!isAlbumSelectionMode && isReorderMode && isMobileViewport ? (
                <p className="tagged-album-reorder-hint" aria-live="polite">
                    {mobileReorderSourceId
                        ? "Now tap the destination media to move it there."
                        : "Tap one media, then tap another to move it."}
                </p>
            ) : null}

            {isAlbumSelectionMode ? (
                <aside className="tagged-album-selection-toolbar" aria-label="Album selection actions toolbar">
                    <button
                        type="button"
                        className={`tagged-album-selection-icon-button tagged-album-selection-icon-button--select-all${areAllVisibleAlbumMediaSelected ? " is-active" : ""}`}
                        disabled={!hasVisibleAlbumMediaItems}
                        onClick={selectAllVisibleAlbumMedia}
                        aria-label="Select all visible media"
                        aria-pressed={areAllVisibleAlbumMediaSelected}
                        title={
                            areAllVisibleAlbumMediaSelected
                                ? "All visible media already selected"
                                : "Select all visible media"
                        }
                    >
                        <img src="/icons/select-all.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className={`tagged-album-selection-icon-button tagged-album-selection-icon-button--clear-filter${
                            activeAlbumTagFilter ? " is-active" : ""
                        }`}
                        disabled={!activeAlbumTagFilter}
                        onClick={handleClearTagFilterFromToolbar}
                        aria-label="Clear active tag filter"
                        title="Clear active tag filter"
                    >
                        <img src="/icons/clear_filters.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-album-selection-icon-button tagged-album-selection-icon-button--download"
                        disabled={selectedAlbumMediaIds.size === 0 || isDownloadingSelected}
                        onClick={handleDownloadSelectedMedia}
                        aria-label={`Download ${selectedAlbumMediaIds.size} selected element${selectedAlbumMediaIds.size === 1 ? "" : "s"}`}
                        title={
                            selectedAlbumMediaIds.size > 1
                                ? "Download selected media as ZIP"
                                : "Download selected media"
                        }
                    >
                        <img src="/icons/download.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-album-selection-icon-button tagged-album-selection-icon-button--edit"
                        disabled={selectedAlbumMediaIds.size === 0 || isSavingSelectedEdit}
                        onClick={openEditSelectedModal}
                        aria-label={`Edit ${selectedAlbumMediaIds.size} selected element${selectedAlbumMediaIds.size === 1 ? "" : "s"}`}
                        title="Edit selected media"
                    >
                        <img src="/icons/edit.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-album-selection-icon-button tagged-album-selection-icon-button--delete"
                        disabled={selectedAlbumMediaIds.size === 0 || isRemovingSelected}
                        onClick={openRemoveSelectedConfirm}
                        aria-label={`Remove ${selectedAlbumMediaIds.size} selected element${selectedAlbumMediaIds.size === 1 ? "" : "s"} from album`}
                        title="Remove selected media from album"
                    >
                        <img src="/icons/delete.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-album-selection-icon-button tagged-album-selection-icon-button--close"
                        onClick={clearAlbumSelectionMode}
                        aria-label="Close selection mode"
                        title="Close selection mode"
                    >
                        <img src="/icons/close.svg" alt="" aria-hidden="true" />
                    </button>
                </aside>
            ) : null}

            {isAlbumSelectionMode && selectionActionError ? (
                <p className="tagged-album-selection-error" aria-live="assertive">
                    {selectionActionError}
                </p>
            ) : null}

            {downloadToast ? (
                <aside
                    className={`tagged-gallery-download-toast tagged-gallery-download-toast--${downloadToast.status || "info"}`}
                    role={downloadToast.status === "error" ? "alert" : "status"}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <header className="tagged-gallery-download-toast-header">
                        <strong>{downloadToast.title}</strong>
                        <button
                            type="button"
                            className="tagged-gallery-download-toast-close"
                            onClick={hideDownloadToast}
                            aria-label="Close download status"
                        >
                            ×
                        </button>
                    </header>
                    <p>{downloadToast.message}</p>
                    {typeof downloadToast.progress === "number" ? (
                        <div className="tagged-gallery-download-toast-progress" aria-hidden="true">
                            <span style={{ width: `${Math.max(0, Math.min(100, downloadToast.progress))}%` }} />
                        </div>
                    ) : null}
                    {typeof downloadToast.progress === "number" || downloadToast.speedLabel ? (
                        <div className="tagged-gallery-download-toast-meta">
                            <small className="tagged-gallery-download-toast-percent">
                                {typeof downloadToast.progress === "number"
                                    ? `${Math.max(0, Math.min(100, Math.round(downloadToast.progress)))}%`
                                    : ""}
                            </small>
                            <small className="tagged-gallery-download-toast-speed">
                                {downloadToast.speedLabel || ""}
                            </small>
                        </div>
                    ) : null}
                </aside>
            ) : null}

            {isMontageSettingsOpen ? (
                <div className="tagged-album-montage-settings-modal" role="dialog" aria-modal="true">
                    <div
                        className="tagged-album-montage-settings-backdrop"
                        onClick={closeMontageSettings}
                        aria-hidden="true"
                    />
                    <section className="tagged-album-montage-settings-panel" aria-labelledby="montage-settings-title">
                        <header className="tagged-album-montage-settings-header">
                            <div>
                                <h2 id="montage-settings-title">Montage settings</h2>
                                <p>Videos always use their own duration.</p>
                            </div>
                            <button
                                type="button"
                                className="tagged-album-montage-settings-close"
                                onClick={closeMontageSettings}
                                aria-label="Close montage settings"
                            >
                                <img src="/icons/close.svg" alt="" aria-hidden="true" />
                            </button>
                        </header>

                        <section className="tagged-album-montage-settings-field">
                            <div className="tagged-album-montage-settings-field-heading">
                                <span>Image duration</span>
                            </div>
                            <div className="tagged-album-montage-settings-duration">
                                <div className="tagged-album-montage-settings-duration-row">
                                    <span className="tagged-album-montage-settings-duration-copy">
                                        Time before the next image:{" "}
                                        <strong>{Math.round(montageSettings.imageDurationSeconds)} seconds</strong>
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={MONTAGE_MIN_IMAGE_DURATION_SECONDS}
                                    max={MONTAGE_MAX_IMAGE_DURATION_SECONDS}
                                    step="1"
                                    value={Math.round(montageSettings.imageDurationSeconds)}
                                    onChange={(event) => updateMontageImageDurationSeconds(event.target.value)}
                                />
                                <div className="tagged-album-montage-settings-duration-scale" aria-hidden="true">
                                    <span>{MONTAGE_MIN_IMAGE_DURATION_SECONDS}s</span>
                                    <span>{MONTAGE_MAX_IMAGE_DURATION_SECONDS}s</span>
                                </div>
                            </div>
                        </section>

                        <label className="tagged-album-montage-settings-field">
                            <span>Animation</span>
                            <select
                                value={montageSettings.animationType}
                                onChange={(event) => updateMontageAnimationType(event.target.value)}
                            >
                                <option value="slide">Slide in/out</option>
                                <option value="fade">Fade in/out</option>
                                <option value="drop">Drop</option>
                                <option value="none">No animation</option>
                            </select>
                        </label>
                    </section>
                </div>
            ) : null}

            {isMontageOpen && currentMontageMedia ? (
                <div className="tagged-album-montage" role="dialog" aria-modal="true" aria-label="Album montage">
                    <div className="tagged-album-montage-backdrop" aria-hidden="true" />

                    <div className="tagged-album-montage-topbar">
                        <div className="tagged-album-montage-title-block">
                            <div className="tagged-album-montage-title-line">
                                <strong title={currentMontageTitle}>{currentMontageTitle}</strong>
                                {currentMontageIsVideo ? (
                                    <span className="tagged-album-montage-countdown">
                                        {currentMontageRemainingLabel}
                                    </span>
                                ) : null}
                            </div>
                            <span className="tagged-album-montage-count">
                                {montageIndex + 1} / {montageMediaItems.length}
                                <span className="tagged-album-montage-meta-dot" aria-hidden="true">
                                    ·
                                </span>
                                {currentMontageAuthor}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="tagged-album-montage-icon-button"
                            onClick={closeMontage}
                            aria-label="Close montage"
                            title="Close"
                        >
                            <img src="/icons/close.svg" alt="" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="tagged-album-montage-stage">
                        {montagePreviousFrame ? (
                            <div
                                key={`previous-${montagePreviousFrame.media.id}-${montagePreviousFrame.index}`}
                                className={`tagged-album-montage-frame tagged-album-montage-frame--previous ${montagePreviousFrame.transitionClass} is-${montageDirection}${
                                    montagePreviousFrame.isVideo ? " tagged-album-montage-frame--previous-video" : ""
                                }`}
                            >
                                {montagePreviousFrame.mediaUrl ? (
                                    <div className="tagged-album-montage-frame-inner">
                                        {montagePreviousFrame.backgroundUrl ? (
                                            <div
                                                className="tagged-album-montage-blur-bg"
                                                style={{
                                                    backgroundImage: `url(${montagePreviousFrame.backgroundUrl})`,
                                                }}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        {montagePreviousFrame.isVideo && !montagePreviousFrame.posterUrl ? (
                                            <video
                                                className="tagged-album-montage-media"
                                                src={montagePreviousFrame.mediaUrl}
                                                muted
                                                playsInline
                                                style={{ objectFit: "contain" }}
                                            />
                                        ) : (
                                            <img
                                                className="tagged-album-montage-media"
                                                src={
                                                    montagePreviousFrame.isVideo
                                                        ? montagePreviousFrame.posterUrl
                                                        : montagePreviousFrame.mediaUrl
                                                }
                                                alt={montagePreviousFrame.title}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="tagged-album-montage-empty">No preview</div>
                                )}
                            </div>
                        ) : null}

                        <div
                            key={`${currentMontageMedia.id}-${montageIndex}`}
                            className={`tagged-album-montage-frame tagged-album-montage-frame--current ${currentMontageTransitionClass} is-${montageDirection}${
                                isMontageTransitionFromVideo ? " tagged-album-montage-frame--after-video" : ""
                            }`}
                        >
                            {currentMontageMediaUrl ? (
                                <div className="tagged-album-montage-frame-inner">
                                    {currentMontageBackgroundUrl ? (
                                        <div
                                            className="tagged-album-montage-blur-bg"
                                            style={{ backgroundImage: `url(${currentMontageBackgroundUrl})` }}
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {currentMontageIsVideo ? (
                                        <video
                                            ref={montageVideoRef}
                                            className="tagged-album-montage-media"
                                            src={currentMontageMediaUrl}
                                            poster={currentMontagePosterUrl || undefined}
                                            autoPlay={isMontagePlaying}
                                            muted
                                            playsInline
                                            controls={areMontageVideoControlsVisible}
                                            style={{ objectFit: "contain" }}
                                            onPointerDown={() => setAreMontageVideoControlsVisible(true)}
                                            onFocus={() => setAreMontageVideoControlsVisible(true)}
                                            onLoadedMetadata={(event) => {
                                                const durationMs = event.currentTarget.duration * 1000;

                                                if (!Number.isFinite(durationMs) || durationMs <= 0) {
                                                    return;
                                                }

                                                skipNextMontageTimerCleanupRef.current = true;
                                                setCurrentMontageDurationMs(durationMs);
                                                montageTimerDurationMsRef.current = durationMs;
                                                montageRemainingMsRef.current = durationMs;
                                                montageTimerStartRemainingMsRef.current = durationMs;
                                                montageLastRenderedSecondRef.current = Math.ceil(durationMs / 1000);
                                                setMontageProgressRatio(0);
                                                setMontageRemainingSeconds(Math.ceil(durationMs / 1000));
                                                if (montageProgressBarRef.current) {
                                                    montageProgressBarRef.current.style.transform = "scaleX(0)";
                                                }
                                            }}
                                            onTimeUpdate={(event) => {
                                                const video = event.currentTarget;
                                                if (
                                                    Number.isFinite(video.duration) &&
                                                    video.duration > 0 &&
                                                    video.duration - video.currentTime <= 0.45
                                                ) {
                                                    showNextMontageMedia();
                                                }
                                            }}
                                            onEnded={showNextMontageMedia}
                                        />
                                    ) : (
                                        <img
                                            className="tagged-album-montage-media"
                                            src={currentMontageMediaUrl}
                                            alt={currentMontageTitle}
                                        />
                                    )}

                                    <button
                                        type="button"
                                        className="tagged-album-montage-media-hitbox"
                                        onClick={handleOpenMontageMediaDetail}
                                        aria-label={`Open ${currentMontageTitle} detail`}
                                    />

                                    <div className="tagged-album-montage-media-info" aria-hidden="true">
                                        <div className="tagged-album-montage-media-info-top">
                                            <div className="tagged-album-montage-media-info-top-main">
                                                <span className="tagged-album-montage-media-info-pill">
                                                    {currentMontageAuthor}
                                                </span>
                                                <span className="tagged-album-montage-media-info-pill">
                                                    {currentMontageSizeLabel}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="tagged-album-montage-media-info-bottom">
                                            <h2 title={currentMontageTitle}>{currentMontageTitle}</h2>
                                            <p className="tagged-album-montage-media-info-date">
                                                {currentMontageDateLabel}
                                            </p>
                                            {visibleMontageCopyrightTags.length > 0 ? (
                                                <div
                                                    className="tagged-album-montage-media-info-tag-row"
                                                    aria-label="Copyright tags"
                                                >
                                                    {visibleMontageCopyrightTags.map((tag) => (
                                                        <span
                                                            key={`montage-copyright-${tag.id}`}
                                                            className="tagged-album-montage-media-info-tag tagged-album-montage-media-info-tag--copyright"
                                                            style={buildMontageTagStyle(tag.tagcolor_hex)}
                                                        >
                                                            {tag.tagname}
                                                        </span>
                                                    ))}
                                                    {hiddenMontageCopyrightTagCount > 0 ? (
                                                        <span className="tagged-album-montage-media-info-tag tagged-album-montage-media-info-tag--more">
                                                            +{hiddenMontageCopyrightTagCount}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            {visibleMontageDefaultTags.length > 0 ? (
                                                <div
                                                    className="tagged-album-montage-media-info-tag-row"
                                                    aria-label="Tags"
                                                >
                                                    {visibleMontageDefaultTags.map((tag) => (
                                                        <span
                                                            key={`montage-default-${tag.id}`}
                                                            className="tagged-album-montage-media-info-tag"
                                                            style={buildMontageTagStyle(tag.tagcolor_hex)}
                                                        >
                                                            {tag.tagname}
                                                        </span>
                                                    ))}
                                                    {hiddenMontageDefaultTagCount > 0 ? (
                                                        <span className="tagged-album-montage-media-info-tag tagged-album-montage-media-info-tag--more">
                                                            +{hiddenMontageDefaultTagCount}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="tagged-album-montage-empty">No preview</div>
                            )}
                        </div>
                    </div>

                    <div className="tagged-album-montage-bottom">
                        <div
                            ref={montageProgressTrackRef}
                            className="tagged-album-montage-progress"
                            role="slider"
                            tabIndex={0}
                            aria-label="Montage progress"
                            aria-valuemin={0}
                            aria-valuemax={Math.max(1, Math.round(currentMontageDurationMs / 1000))}
                            aria-valuenow={currentMontageElapsedSeconds}
                            onPointerDown={handleMontageProgressPointerDown}
                            onPointerMove={handleMontageProgressPointerMove}
                            onPointerUp={handleMontageProgressPointerEnd}
                            onPointerCancel={handleMontageProgressPointerEnd}
                            onLostPointerCapture={handleMontageProgressPointerEnd}
                            onKeyDown={handleMontageProgressKeyDown}
                        >
                            <span
                                ref={montageProgressBarRef}
                                style={{ transform: `scaleX(${montageProgressRatio})` }}
                            />
                        </div>

                        <div className="tagged-album-montage-controls" aria-label="Montage controls">
                            <button
                                type="button"
                                className="tagged-album-montage-icon-button"
                                onClick={showPreviousMontageMedia}
                                disabled={montageMediaItems.length <= 1}
                                aria-label="Previous media"
                                title="Previous"
                            >
                                <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                            </button>

                            <button
                                type="button"
                                className="tagged-album-montage-icon-button tagged-album-montage-play-button"
                                onClick={() => setIsMontagePlaying((previous) => !previous)}
                                aria-label={isMontagePlaying ? "Pause montage" : "Play montage"}
                                title={isMontagePlaying ? "Pause" : "Play"}
                            >
                                <span
                                    className={`tagged-album-montage-play-icon${isMontagePlaying ? " is-playing" : ""}`}
                                    aria-hidden="true"
                                />
                            </button>

                            <button
                                type="button"
                                className="tagged-album-montage-icon-button"
                                onClick={showNextMontageMedia}
                                disabled={montageMediaItems.length <= 1}
                                aria-label="Next media"
                                title="Next"
                            >
                                <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <MediaEditModal
                isOpen={isEditSelectedModalOpen}
                mode={selectedAlbumMediaIds.size > 1 ? "multi" : "single"}
                selectedCount={selectedAlbumMediaIds.size}
                initialValues={selectedEditInitialValues}
                distinctDisplayNames={distinctAlbumEditDisplayNames}
                distinctAuthors={distinctAlbumEditAuthors}
                distinctTagNames={distinctAlbumEditTagNames}
                tagColorByName={albumEditTagColorByName}
                selectedMediaItems={albumMediaItems.filter((media) => selectedAlbumMediaIds.has(media.id))}
                getAssetUrl={getAssetUrl}
                isSaving={isSavingSelectedEdit}
                error={selectedEditError}
                onClose={closeEditSelectedModal}
                onSubmit={handleSubmitSelectedEdit}
            />

            <div className="tagged-album-detail-grid-wrap" aria-label="Album media grid">
                {albumMediaViewMode === "list" ? (
                    <div className="tagged-album-detail-list">
                        <button
                            type="button"
                            className="tagged-album-list-create-tile"
                            onClick={openAddMediaModal}
                            aria-label="Add new media to album"
                        >
                            <span
                                className="tagged-album-create-icon tagged-album-create-icon--list"
                                aria-hidden="true"
                            />
                            <span>Add new media</span>
                        </button>

                        {activeAlbumMediaItems.map((media) => (
                            <GalleryListItem
                                key={media.id}
                                media={media}
                                uploadsBaseUrl={UPLOADS_BASE_URL}
                                onToggleFavourite={handleToggleFavourite}
                                isTogglingFavourite={togglingIds.has(media.id)}
                                onOpenMedia={handleOpenMediaDetail}
                                onFilterByTag={applyAlbumTagFilter}
                                selectionMode={isAlbumSelectionMode}
                                isSelected={selectedAlbumMediaIds.has(media.id)}
                                onToggleSelect={toggleAlbumMediaSelection}
                                onActivateSelectionMode={activateAlbumSelectionMode}
                                showDelete={false}
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        className={`tagged-gallery-grid tagged-album-detail-grid${
                            activeAlbumMediaItems.length === 0 ? " tagged-album-detail-grid--empty" : ""
                        }`}
                        style={{ "--tagged-grid-columns": gridColumns }}
                    >
                        <button
                            type="button"
                            className="tagged-album-card tagged-album-create-tile tagged-album-detail-add-tile"
                            onClick={openAddMediaModal}
                            aria-label="Add new media to album"
                        >
                            <span
                                className="tagged-album-create-icon tagged-album-create-icon--card"
                                aria-hidden="true"
                            />
                            <span>Add new media</span>
                        </button>

                        {activeAlbumMediaItems.map((media) => (
                            <div
                                key={media.id}
                                className={`tagged-album-draggable-item${
                                    draggingMediaId === media.id ? " is-dragging" : ""
                                }${dragOverMediaId === media.id || mobileReorderSourceId === media.id ? " is-drag-over" : ""}`}
                                draggable={canUseDragReorder && !isReorderingMedia}
                                onDragStart={(event) => handleDragStart(media.id, event)}
                                onDragOver={(event) => handleDragOver(media.id, event)}
                                onDrop={(event) => handleDrop(media.id, event)}
                                onDragEnd={clearDragState}
                            >
                                <MediaCard
                                    media={media}
                                    uploadsBaseUrl={UPLOADS_BASE_URL}
                                    onToggleFavourite={handleToggleFavourite}
                                    isTogglingFavourite={togglingIds.has(media.id)}
                                    onOpenMedia={handleOpenMediaDetail}
                                    onFilterByTag={applyAlbumTagFilter}
                                    selectionMode={isAlbumSelectionMode}
                                    isSelected={selectedAlbumMediaIds.has(media.id)}
                                    onToggleSelect={toggleAlbumMediaSelection}
                                    onActivateSelectionMode={activateAlbumSelectionMode}
                                    disableLongPressSelection={isReorderMode}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {reorderError ? (
                <article
                    className="tagged-app-page-card tagged-album-status-card tagged-album-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Could not reorder media</h2>
                    <p>{reorderError}</p>
                </article>
            ) : null}

            {isRemoveConfirmOpen ? (
                <div
                    className="tagged-album-confirm-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-album-confirm-title"
                    aria-describedby="tagged-album-confirm-description"
                    onClick={closeRemoveSelectedConfirm}
                >
                    <div className="tagged-album-confirm-modal-content" onClick={(event) => event.stopPropagation()}>
                        <h2 id="tagged-album-confirm-title">
                            Remove <span className="tagged-album-confirm-count">{selectedAlbumMediaIds.size}</span>{" "}
                            media
                        </h2>
                        <p id="tagged-album-confirm-description">
                            This only removes media from this album. Files remain in your gallery.
                        </p>
                        <div className="tagged-album-confirm-actions">
                            <button
                                type="button"
                                className="tagged-album-confirm-continue"
                                onClick={handleRemoveSelectedMedia}
                                disabled={isRemovingSelected}
                            >
                                Continue
                            </button>
                            <button
                                type="button"
                                className="tagged-album-confirm-cancel"
                                onClick={closeRemoveSelectedConfirm}
                                disabled={isRemovingSelected}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <AlbumAddMediaModal
                isOpen={isAddMediaModalOpen}
                onClose={closeAddMediaModal}
                onSubmit={handleAddMediaToAlbum}
                isSaving={isAddingMedia}
                searchValue={addMediaSearch}
                onSearchChange={setAddMediaSearch}
                mediaViewMode={addMediaPickerViewMode}
                onMediaViewModeChange={setAddMediaPickerViewMode}
                availableMediaItems={availableMediaItems}
                filteredMediaCandidates={filteredAvailableMediaItems}
                visibleMediaCount={filteredAvailableMediaItems.length}
                selectedMediaIds={selectedMediaToAddIds}
                isAllVisibleMediaSelected={areAllVisibleAddMediaSelected}
                onSelectAllVisibleMedia={selectAllVisibleAddMedia}
                onToggleMediaSelection={handleAddPickerSelection}
                onClearSelection={clearAddSelection}
                getAssetUrl={getAssetUrl}
                mapTagsFromMedia={mapTagsFromMedia}
                selectedIncludeFilterTags={selectedAddMediaIncludeFilterTags}
                selectedExcludeFilterTags={selectedAddMediaExcludeFilterTags}
                onToggleIncludeFilterTag={toggleAddMediaIncludeFilterTag}
                onToggleExcludeFilterTag={toggleAddMediaExcludeFilterTag}
                onClearFilterTags={clearAddMediaFilterTags}
                tagFilterSearch={addMediaTagFilterSearch}
                onTagFilterSearchChange={setAddMediaTagFilterSearch}
                visibleTagFilterCandidates={visibleAddMediaTagFilterCandidates}
                error={addMediaError}
            />

            <AlbumEditModal
                isOpen={isEditModalOpen}
                onClose={closeEditAlbumModal}
                onSubmit={handleSaveAlbumEdit}
                isSaving={isSavingEdit}
                albumName={editingAlbumName}
                onAlbumNameChange={setEditingAlbumName}
                coverSearch={coverSearch}
                onCoverSearchChange={setCoverSearch}
                mediaViewMode={editCoverMediaViewMode}
                onMediaViewModeChange={setEditCoverMediaViewMode}
                imageMediaItems={imageLibraryMediaItems}
                filteredCoverCandidates={filteredCoverCandidates}
                selectedCoverMediaId={selectedEditCoverMediaId}
                onSelectCoverMedia={setSelectedEditCoverMediaId}
                getAssetUrl={getAssetUrl}
                mapTagsFromMedia={mapTagsFromMedia}
                editTagFilterMode={editTagFilterMode}
                onToggleEditTagFilterMode={() =>
                    setEditTagFilterMode((previous) => (previous === "exclude" ? "include" : "exclude"))
                }
                selectedEditFilterTags={selectedEditFilterTags}
                onClearEditFilterTags={clearEditFilterTags}
                editTagFilterSearch={editTagFilterSearch}
                onEditTagFilterSearchChange={setEditTagFilterSearch}
                visibleEditTagFilterCandidates={visibleEditTagFilterCandidates}
                onToggleEditFilterTag={toggleEditFilterTag}
                error={editError}
            />
        </section>
    );
};
