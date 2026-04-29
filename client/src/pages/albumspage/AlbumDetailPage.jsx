import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import JSZip from "jszip";
import { MediaCard } from "../../components/media-card/MediaCard";
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
const GENERAL_FILTER_COMMAND_EVENT = "tagged:general-filter-command";
const GENERAL_FILTER_STATE_EVENT = "tagged:general-filter-state";

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
    const normalizedRaw = String(rawQuery || "").trim().toLowerCase();

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

        const storedMode = String(window.localStorage.getItem(ALBUM_DETAIL_MEDIA_VIEW_STORAGE_KEY) || "card").toLowerCase();
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
    const downloadToastTimeoutRef = useRef(null);

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
            scopedSearch.authorTerms.length > 0 || scopedSearch.nameTerms.length > 0 || scopedSearch.freeTerms.length > 0;
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

    const canReorderAlbumMedia = !isAlbumSelectionMode && albumMediaItems.length > 1;
    const canUseDragReorder = canReorderAlbumMedia && isReorderMode && !isMobileViewport;
    const canUseTapReorder = canReorderAlbumMedia && isReorderMode && isMobileViewport;

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
    }, [
        availableMediaItems,
        addMediaSearch,
        selectedAddMediaIncludeFilterTags,
        selectedAddMediaExcludeFilterTags,
    ]);
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
            scopedSearch.authorTerms.length > 0 || scopedSearch.nameTerms.length > 0 || scopedSearch.freeTerms.length > 0;

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

    const closeRemoveSelectedConfirm = () => {
        if (isRemovingSelected) {
            return;
        }

        setIsRemoveConfirmOpen(false);
    };

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

    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
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
    }, [isRemoveConfirmOpen, isRemovingSelected, isReorderMode]);

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
            <section className="tagged-app-page tagged-album-page tagged-album-page--centered">
                <article className="tagged-app-page-card tagged-album-status-card" aria-live="polite">
                    <h2>Loading album detail</h2>
                    <p>Fetching album information and media items.</p>
                </article>
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
                            <span className="tagged-album-view-switch-icon tagged-album-view-switch-icon--list" />
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
                            <span className="tagged-album-create-icon tagged-album-create-icon--list" aria-hidden="true" />
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
                            <span className="tagged-album-create-icon tagged-album-create-icon--card" aria-hidden="true" />
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
