import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useGridView } from "../../context/GridViewContext";
import { AlbumCreateModal } from "./components/AlbumCreateModal";
import { AlbumEditModal } from "./components/AlbumEditModal";
import "./AlbumPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const UPLOADS_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");
const ALBUM_POINTER_MOVE_THRESHOLD_PX = 12;
const ALBUM_VIEW_STORAGE_KEY = "tagged:album-view-mode";
const ALBUM_SEARCH_STORAGE_KEY = "tagged:album-search-query";

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

const sanitizeZipPathSegment = (rawValue, fallbackValue) => {
    const baseValue = String(rawValue || "").trim() || fallbackValue;

    return baseValue
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/g, "")
        .trim();
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

const ALBUM_COVER_GRADIENTS = [
    ["#dff1ff", "#bcdcff"],
    ["#ffe3ef", "#ffd1de"],
    ["#e6f8ec", "#c9efd8"],
    ["#fff4dc", "#ffe6bb"],
    ["#ece8ff", "#d9d2ff"],
    ["#e5f5ff", "#cce6ff"],
    ["#ffe9dd", "#ffd9c5"],
    ["#eef3ff", "#d8e4ff"],
];

const hashAlbumSeed = (value) => {
    const normalized = String(value || "album");
    let hash = 0;

    for (let index = 0; index < normalized.length; index += 1) {
        hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
    }

    return hash;
};

const getAlbumCoverGradientStyle = (album) => {
    const seed = `${album?.id || ""}-${album?.displayname || album?.albumname || "album"}`;
    const [startColor, endColor] = ALBUM_COVER_GRADIENTS[hashAlbumSeed(seed) % ALBUM_COVER_GRADIENTS.length];

    return {
        background: `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`,
    };
};

const filterMediaByTagMode = (mediaList, selectedTags, mode) => {
    if (!selectedTags.length) {
        return mediaList;
    }

    const normalizedTags = selectedTags.map((tag) => String(tag).toLowerCase());

    return mediaList.filter((media) => {
        const mediaTags = mapTagsFromMedia(media).map((tag) => tag.toLowerCase());

        if (mode === "exclude") {
            return normalizedTags.every((filterTag) => !mediaTags.includes(filterTag));
        }

        return normalizedTags.every((filterTag) => mediaTags.includes(filterTag));
    });
};

const applyIncludeExcludeTagFilters = (mediaList, includeTags, excludeTags) => {
    const normalizedInclude = includeTags.map((tag) => String(tag).toLowerCase());
    const normalizedExclude = excludeTags.map((tag) => String(tag).toLowerCase());

    return mediaList.filter((media) => {
        const mediaTags = mapTagsFromMedia(media).map((tag) => tag.toLowerCase());

        if (normalizedInclude.length > 0) {
            const hasAllIncludedTags = normalizedInclude.every((tag) => mediaTags.includes(tag));
            if (!hasAllIncludedTags) {
                return false;
            }
        }

        if (normalizedExclude.length > 0) {
            const hasAnyExcludedTag = normalizedExclude.some((tag) => mediaTags.includes(tag));
            if (hasAnyExcludedTag) {
                return false;
            }
        }

        return true;
    });
};

const parseScopedCoverSearchQuery = (rawQuery) => {
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

export const AlbumPage = () => {
    const navigate = useNavigate();
    const { user, fetchWithAuth } = useAuth();
    const { gridColumns } = useGridView();

    const [albums, setAlbums] = useState([]);
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [albumSearch, setAlbumSearch] = useState(() => {
        if (typeof window === "undefined") {
            return "";
        }

        return String(window.localStorage.getItem(ALBUM_SEARCH_STORAGE_KEY) || "");
    });
    const [albumViewMode, setAlbumViewMode] = useState(() => {
        if (typeof window === "undefined") {
            return "card";
        }

        const storedMode = String(window.localStorage.getItem(ALBUM_VIEW_STORAGE_KEY) || "card").toLowerCase();
        return storedMode === "list" ? "list" : "card";
    });

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
    const [albumName, setAlbumName] = useState("");
    const [selectedCoverMediaId, setSelectedCoverMediaId] = useState(null);
    const [coverSearch, setCoverSearch] = useState("");
    const [createCoverMediaViewMode, setCreateCoverMediaViewMode] = useState("card");
    const [createTagFilterSearch, setCreateTagFilterSearch] = useState("");
    const [selectedCreateIncludeFilterTags, setSelectedCreateIncludeFilterTags] = useState([]);
    const [selectedCreateExcludeFilterTags, setSelectedCreateExcludeFilterTags] = useState([]);
    const [createError, setCreateError] = useState(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editingAlbumId, setEditingAlbumId] = useState(null);
    const [editingAlbumName, setEditingAlbumName] = useState("");
    const [editCoverSearch, setEditCoverSearch] = useState("");
    const [selectedEditCoverMediaId, setSelectedEditCoverMediaId] = useState(null);
    const [editCoverMediaViewMode, setEditCoverMediaViewMode] = useState("card");
    const [editTagFilterSearch, setEditTagFilterSearch] = useState("");
    const [editTagFilterMode, setEditTagFilterMode] = useState("include");
    const [selectedEditFilterTags, setSelectedEditFilterTags] = useState([]);
    const [editError, setEditError] = useState(null);

    const [isAlbumSelectionMode, setIsAlbumSelectionMode] = useState(false);
    const [selectedAlbumIds, setSelectedAlbumIds] = useState(new Set());
    const [isDeletingSelected, setIsDeletingSelected] = useState(false);
    const [isDownloadingSelectedAlbums, setIsDownloadingSelectedAlbums] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [selectionActionError, setSelectionActionError] = useState(null);

    const longPressTimerRef = useRef(null);
    const longPressPointerStartRef = useRef(null);
    const longPressPointerMovedRef = useRef(false);
    const longPressConsumedAlbumIdRef = useRef(null);

    const imageMediaItems = useMemo(
        () =>
            mediaItems.filter(
                (media) =>
                    !String(media?.mediatype || "")
                        .toLowerCase()
                        .includes("video"),
            ),
        [mediaItems],
    );

    const createCoverMediaItems = useMemo(() => imageMediaItems, [imageMediaItems]);

    const editTagFilterCandidates = useMemo(() => {
        const tagSet = new Set();

        imageMediaItems.forEach((media) => {
            mapTagsFromMedia(media).forEach((tag) => {
                const normalized = String(tag || "").trim();
                if (normalized) {
                    tagSet.add(normalized);
                }
            });
        });

        return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    }, [imageMediaItems]);

    const visibleEditTagFilterCandidates = useMemo(() => {
        const normalizedSearch = editTagFilterSearch.trim().toLowerCase();

        if (!normalizedSearch) {
            return editTagFilterCandidates;
        }

        return editTagFilterCandidates.filter((tagName) => tagName.toLowerCase().includes(normalizedSearch));
    }, [editTagFilterCandidates, editTagFilterSearch]);

    const createTagFilterCandidates = useMemo(() => {
        const tagSet = new Set();
        createCoverMediaItems.forEach((media) => {
            mapTagsFromMedia(media).forEach((tag) => {
                const normalized = String(tag || "").trim();
                if (normalized) {
                    tagSet.add(normalized);
                }
            });
        });

        const normalizedSearch = createTagFilterSearch.trim().toLowerCase();
        const allTagCandidates = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

        if (!normalizedSearch) {
            return allTagCandidates;
        }

        return allTagCandidates.filter((tagName) => tagName.toLowerCase().includes(normalizedSearch));
    }, [createCoverMediaItems, createTagFilterSearch]);

    const filteredCreateCoverMediaItems = useMemo(() => {
        const filteredByTags = applyIncludeExcludeTagFilters(
            createCoverMediaItems,
            selectedCreateIncludeFilterTags,
            selectedCreateExcludeFilterTags,
        );
        const scopedSearch = parseScopedCoverSearchQuery(coverSearch);
        const hasScopedSearch =
            scopedSearch.authorTerms.length > 0 || scopedSearch.nameTerms.length > 0 || scopedSearch.freeTerms.length > 0;

        if (!hasScopedSearch) {
            return filteredByTags;
        }

        return filteredByTags.filter((media) => {
            const displayName = String(media?.displayname || media?.filename || "").toLowerCase();
            const authorName = String(media?.author || "").toLowerCase();
            const combinedSearchHaystack = `${displayName} ${authorName}`.trim();

            const matchesAuthorTerms = scopedSearch.authorTerms.every((term) => authorName.includes(term));
            if (!matchesAuthorTerms) {
                return false;
            }

            const matchesNameTerms = scopedSearch.nameTerms.every((term) => displayName.includes(term));
            if (!matchesNameTerms) {
                return false;
            }

            return scopedSearch.freeTerms.every((term) => combinedSearchHaystack.includes(term));
        });
    }, [createCoverMediaItems, selectedCreateIncludeFilterTags, selectedCreateExcludeFilterTags, coverSearch]);

    const filteredEditImageMediaItems = useMemo(() => {
        const filteredByTags = filterMediaByTagMode(imageMediaItems, selectedEditFilterTags, editTagFilterMode);
        const scopedSearch = parseScopedCoverSearchQuery(editCoverSearch);
        const hasScopedSearch =
            scopedSearch.authorTerms.length > 0 || scopedSearch.nameTerms.length > 0 || scopedSearch.freeTerms.length > 0;

        if (!hasScopedSearch) {
            return filteredByTags;
        }

        return filteredByTags.filter((media) => {
            const displayName = String(media?.displayname || media?.filename || "").toLowerCase();
            const authorName = String(media?.author || "").toLowerCase();
            const combinedSearchHaystack = `${displayName} ${authorName}`.trim();

            const matchesAuthorTerms = scopedSearch.authorTerms.every((term) => authorName.includes(term));
            if (!matchesAuthorTerms) {
                return false;
            }

            const matchesNameTerms = scopedSearch.nameTerms.every((term) => displayName.includes(term));
            if (!matchesNameTerms) {
                return false;
            }

            return scopedSearch.freeTerms.every((term) => combinedSearchHaystack.includes(term));
        });
    }, [imageMediaItems, selectedEditFilterTags, editTagFilterMode, editCoverSearch]);

    const hasActiveAlbumFilter = albumSearch.trim().length > 0;

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(ALBUM_VIEW_STORAGE_KEY, albumViewMode);
        }
    }, [albumViewMode]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(ALBUM_SEARCH_STORAGE_KEY, albumSearch);
        }
    }, [albumSearch]);

    const visibleAlbums = useMemo(() => {
        const normalizedSearch = albumSearch.trim().toLowerCase();

        if (!normalizedSearch) {
            return albums;
        }

        return albums.filter((album) => {
            const albumName = String(album?.displayname || album?.albumname || "").toLowerCase();
            const createdAt = formatAlbumDate(album?.created_at).toLowerCase();
            return albumName.includes(normalizedSearch) || createdAt.includes(normalizedSearch);
        });
    }, [albums, albumSearch]);

    const fetchAlbums = async () => {
        const response = await fetchWithAuth(`${API_URL}/albums`, { method: "GET" });
        const data = await parseApiResponse(response, "Could not load albums");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load albums");
        }

        return Array.isArray(data.data) ? data.data : [];
    };

    const fetchMedia = async () => {
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
            const data = await parseApiResponse(response, "Could not load media");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not load media");
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
    };

    const refreshAlbums = async () => {
        const nextAlbums = await fetchAlbums();
        setAlbums(nextAlbums);
    };

    useEffect(() => {
        let cancelled = false;

        const loadPageData = async () => {
            if (!user) {
                setAlbums([]);
                setMediaItems([]);
                setLoading(false);
                return;
            }

            if (user.type === "admin") {
                setAlbums([]);
                setMediaItems([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const [nextAlbums, nextMedia] = await Promise.all([fetchAlbums(), fetchMedia()]);

                if (cancelled) {
                    return;
                }

                setAlbums(nextAlbums);
                setMediaItems(nextMedia);
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load albums");
                    setAlbums([]);
                    setMediaItems([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPageData();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, user]);

    const resetCreateForm = () => {
        setAlbumName("");
        setSelectedCoverMediaId(null);
        setCoverSearch("");
        setCreateCoverMediaViewMode("card");
        setCreateTagFilterSearch("");
        setSelectedCreateIncludeFilterTags([]);
        setSelectedCreateExcludeFilterTags([]);
        setCreateError(null);
    };

    const handleOpenCreateModal = () => {
        resetCreateForm();
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        if (isCreatingAlbum) {
            return;
        }

        setIsCreateModalOpen(false);
        resetCreateForm();
    };

    const toggleCreateIncludeFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedCreateIncludeFilterTags((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === normalized.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase());
            }

            return [...previous, normalized];
        });
        setSelectedCreateExcludeFilterTags((previous) =>
            previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase()),
        );
    };

    const toggleCreateExcludeFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedCreateExcludeFilterTags((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === normalized.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase());
            }

            return [...previous, normalized];
        });
        setSelectedCreateIncludeFilterTags((previous) =>
            previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase()),
        );
    };

    const clearCreateFilterTags = () => {
        setSelectedCreateIncludeFilterTags([]);
        setSelectedCreateExcludeFilterTags([]);
    };

    const handleCreateAlbum = async (event) => {
        event.preventDefault();

        const trimmedAlbumName = albumName.trim();

        if (!trimmedAlbumName) {
            setCreateError("Album name is required.");
            return;
        }

        if (!selectedCoverMediaId) {
            setCreateError("Please choose a media item from your library as album cover.");
            return;
        }

        setIsCreatingAlbum(true);
        setCreateError(null);

        let createdAlbumId = null;

        try {
            const createAlbumResponse = await fetchWithAuth(`${API_URL}/albums`, {
                method: "POST",
                body: JSON.stringify({ albumname: trimmedAlbumName }),
            });

            const createAlbumData = await parseApiResponse(createAlbumResponse, "Could not create album");

            if (!createAlbumResponse.ok || !createAlbumData.success || !createAlbumData.data?.id) {
                throw new Error(createAlbumData.message || "Could not create album");
            }

            createdAlbumId = createAlbumData.data.id;

            const assignCoverResponse = await fetchWithAuth(`${API_URL}/albums/${createdAlbumId}/cover`, {
                method: "POST",
                body: JSON.stringify({ media_id: selectedCoverMediaId }),
            });

            const assignCoverData = await parseApiResponse(assignCoverResponse, "Could not assign album cover");

            if (!assignCoverResponse.ok || !assignCoverData.success) {
                throw new Error(assignCoverData.message || "Could not assign album cover");
            }

            await refreshAlbums();
            setIsCreateModalOpen(false);
            resetCreateForm();
        } catch (requestError) {
            if (createdAlbumId) {
                try {
                    await fetchWithAuth(`${API_URL}/albums/${createdAlbumId}`, { method: "DELETE" });
                } catch {
                    // Best-effort rollback for partially created albums.
                }
            }

            setCreateError(requestError.message || "Could not create album");
        } finally {
            setIsCreatingAlbum(false);
        }
    };

    const openEditAlbumModal = (album) => {
        if (!album?.id) {
            return;
        }

        setEditingAlbumId(album.id);
        setEditingAlbumName(album.displayname || album.albumname || "");
        setEditCoverSearch("");
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
        setEditingAlbumId(null);
        setEditingAlbumName("");
        setEditCoverSearch("");
        setSelectedEditCoverMediaId(null);
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

    const handleEditAlbum = async (event) => {
        event.preventDefault();

        const trimmedAlbumName = editingAlbumName.trim();
        const albumBeingEdited = albums.find((album) => String(album.id) === String(editingAlbumId));
        const currentAlbumName = String(albumBeingEdited?.displayname || albumBeingEdited?.albumname || "").trim();
        const hasNameChange = trimmedAlbumName !== currentAlbumName;
        const hasCoverChange = selectedEditCoverMediaId !== null;

        if (!editingAlbumId) {
            return;
        }

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
                const response = await fetchWithAuth(`${API_URL}/albums/${editingAlbumId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ albumname: trimmedAlbumName }),
                });

                const data = await parseApiResponse(response, "Could not rename album");

                if (!response.ok || !data.success || !data.data) {
                    throw new Error(data.message || "Could not rename album");
                }
            }

            if (hasCoverChange) {
                const coverResponse = await fetchWithAuth(`${API_URL}/albums/${editingAlbumId}/cover`, {
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

            await refreshAlbums();

            closeEditAlbumModal();
        } catch (requestError) {
            setEditError(requestError.message || "Could not save album changes");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleOpenAlbumDetail = (albumId) => {
        if (!albumId) {
            return;
        }

        if (isAlbumSelectionMode) {
            setSelectedAlbumIds((previous) => {
                const next = new Set(previous);
                if (next.has(albumId)) {
                    next.delete(albumId);
                } else {
                    next.add(albumId);
                }
                return next;
            });
            return;
        }

        navigate(`/albums/${albumId}`);
    };

    const activateAlbumSelectionMode = (initialAlbumId = null) => {
        setIsAlbumSelectionMode(true);
        setSelectionActionError(null);

        if (!initialAlbumId) {
            return;
        }

        setSelectedAlbumIds((previous) => {
            const next = new Set(previous);
            next.add(initialAlbumId);
            return next;
        });
    };

    const clearAlbumSelectionMode = () => {
        setIsAlbumSelectionMode(false);
        setSelectedAlbumIds(new Set());
        setIsDeleteConfirmOpen(false);
        setSelectionActionError(null);
    };

    const clearAlbumFilters = () => {
        setAlbumSearch("");
    };

    const handleClearFiltersFromToolbar = () => {
        clearAlbumFilters();
        clearAlbumSelectionMode();
    };

    const openDeleteSelectedConfirm = () => {
        if (selectedAlbumIds.size === 0 || isDeletingSelected) {
            return;
        }

        setSelectionActionError(null);
        setIsDeleteConfirmOpen(true);
    };

    const closeDeleteSelectedConfirm = () => {
        if (isDeletingSelected) {
            return;
        }

        setIsDeleteConfirmOpen(false);
    };

    const handleDeleteSelectedAlbums = async () => {
        if (selectedAlbumIds.size === 0 || isDeletingSelected) {
            return;
        }

        try {
            setIsDeletingSelected(true);
            setSelectionActionError(null);
            setIsDeleteConfirmOpen(false);

            const deleteResults = await Promise.allSettled(
                Array.from(selectedAlbumIds).map(async (albumIdToDelete) => {
                    const response = await fetchWithAuth(`${API_URL}/albums/${albumIdToDelete}`, {
                        method: "DELETE",
                    });
                    const data = await parseApiResponse(response, "Could not delete selected albums");

                    if (!response.ok || !data.success) {
                        throw new Error(data.message || "Could not delete selected albums");
                    }
                }),
            );

            const successfulDeletes = deleteResults.filter((result) => result.status === "fulfilled").length;

            if (successfulDeletes === 0) {
                throw new Error("Could not delete selected albums");
            }

            await refreshAlbums();
            clearAlbumSelectionMode();
        } catch (requestError) {
            setSelectionActionError(requestError.message || "Could not delete selected albums");
        } finally {
            setIsDeletingSelected(false);
        }
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

    const fetchMediaAsBlob = async (media) => {
        const fileUrl = getAssetUrl(media?.filepath || media?.thumbpath || "");

        if (!fileUrl) {
            throw new Error("Media file URL is not available");
        }

        const response = await fetchWithAuth(fileUrl, { method: "GET" });

        if (!response.ok) {
            throw new Error("Could not download media file");
        }

        const blob = await response.blob();

        if (!blob || blob.size <= 0) {
            throw new Error("Downloaded media file is empty");
        }

        return {
            blob,
            filename: getDownloadFilenameForMedia(media),
        };
    };

    const handleDownloadSelectedAlbums = async () => {
        if (selectedAlbumIds.size === 0 || isDownloadingSelectedAlbums) {
            return;
        }

        const selectedAlbums = albums.filter((album) => selectedAlbumIds.has(album.id));

        if (selectedAlbums.length === 0) {
            setSelectionActionError("No albums selected to download.");
            return;
        }

        try {
            setIsDownloadingSelectedAlbums(true);
            setSelectionActionError(null);

            const zip = new JSZip();
            let addedFiles = 0;

            for (let index = 0; index < selectedAlbums.length; index += 1) {
                const album = selectedAlbums[index];
                const albumId = album?.id;

                if (!albumId) {
                    continue;
                }

                const mediaResponse = await fetchWithAuth(`${API_URL}/albums/${albumId}/media`, {
                    method: "GET",
                });
                const mediaData = await parseApiResponse(mediaResponse, "Could not load album media");

                if (!mediaResponse.ok || !mediaData.success) {
                    continue;
                }

                const albumMediaItems = Array.isArray(mediaData.data) ? mediaData.data : [];

                if (albumMediaItems.length === 0) {
                    continue;
                }

                const albumDisplayName =
                    String(album?.displayname || album?.albumname || `album-${albumId}`).trim() || `album-${albumId}`;
                const folderBaseName =
                    sanitizeZipPathSegment(albumDisplayName, `album-${albumId}`) || `album-${albumId}`;
                const folderName = selectedAlbums.length === 1 ? folderBaseName : `${folderBaseName}-${albumId}`;
                const albumFolder = zip.folder(folderName);

                if (!albumFolder) {
                    continue;
                }

                const usedFileNames = new Map();

                for (let mediaIndex = 0; mediaIndex < albumMediaItems.length; mediaIndex += 1) {
                    const media = albumMediaItems[mediaIndex];

                    try {
                        const { blob, filename } = await fetchMediaAsBlob(media);
                        const rawFileName = sanitizeZipPathSegment(filename, `media-${media?.id || mediaIndex + 1}`);
                        const safeFileName = rawFileName || `media-${media?.id || mediaIndex + 1}`;
                        const duplicateCount = usedFileNames.get(safeFileName) || 0;

                        if (duplicateCount === 0) {
                            albumFolder.file(safeFileName, blob);
                        } else {
                            const extensionMatch = safeFileName.match(/(\.[a-z0-9]{2,8})$/i);
                            const extension = extensionMatch ? extensionMatch[1] : "";
                            const nameWithoutExtension = extension
                                ? safeFileName.slice(0, -extension.length)
                                : safeFileName;
                            const dedupedName = `${nameWithoutExtension} (${duplicateCount + 1})${extension}`;

                            albumFolder.file(dedupedName, blob);
                        }

                        usedFileNames.set(safeFileName, duplicateCount + 1);
                        addedFiles += 1;
                    } catch {
                        // Keep building the ZIP even if a media file fails.
                    }
                }
            }

            if (addedFiles === 0) {
                throw new Error("Could not download selected album media.");
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
            const zipBaseName =
                selectedAlbums.length === 1
                    ? sanitizeZipPathSegment(
                          String(selectedAlbums[0]?.displayname || selectedAlbums[0]?.albumname || "album"),
                          `album-${selectedAlbums[0]?.id || "download"}`,
                      )
                    : `albums-${selectedAlbums.length}`;

            triggerBlobDownload(zipBlob, `tagged-${zipBaseName || "albums"}-${timestamp}.zip`);
            clearAlbumSelectionMode();
        } catch (downloadError) {
            setSelectionActionError(downloadError.message || "Could not download selected albums.");
        } finally {
            setIsDownloadingSelectedAlbums(false);
        }
    };

    const clearAlbumLongPressTimer = () => {
        if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleAlbumPointerDown = (albumId, event) => {
        if (!albumId || isDeleteConfirmOpen) {
            return;
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        longPressPointerMovedRef.current = false;
        longPressPointerStartRef.current = {
            albumId,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
        };

        clearAlbumLongPressTimer();

        longPressTimerRef.current = window.setTimeout(() => {
            activateAlbumSelectionMode(albumId);
            longPressConsumedAlbumIdRef.current = albumId;
            clearAlbumLongPressTimer();
        }, 380);
    };

    const handleAlbumPointerMove = (event) => {
        const pointerStart = longPressPointerStartRef.current;

        if (!pointerStart || pointerStart.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = Math.abs(event.clientX - pointerStart.x);
        const deltaY = Math.abs(event.clientY - pointerStart.y);

        if (deltaX > ALBUM_POINTER_MOVE_THRESHOLD_PX || deltaY > ALBUM_POINTER_MOVE_THRESHOLD_PX) {
            longPressPointerMovedRef.current = true;
            clearAlbumLongPressTimer();
        }
    };

    const handleAlbumPointerUpOrCancel = (albumId) => {
        if (longPressPointerMovedRef.current && albumId) {
            longPressConsumedAlbumIdRef.current = albumId;
        }

        longPressPointerStartRef.current = null;
        longPressPointerMovedRef.current = false;
        clearAlbumLongPressTimer();
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

            if (event.key === "Control" && !isTypingElement) {
                setIsAlbumSelectionMode(true);
                setSelectionActionError(null);
                return;
            }

            if (event.key === "Escape" && isDeleteConfirmOpen) {
                closeDeleteSelectedConfirm();
                return;
            }

            if (event.key === "Escape") {
                clearAlbumSelectionMode();
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);

        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
            clearAlbumLongPressTimer();
        };
    }, [isDeleteConfirmOpen, isDeletingSelected]);

    if (user?.type === "admin") {
        return (
            <section className="tagged-app-page tagged-album-page tagged-album-page--centered">
                <article
                    className="tagged-app-page-card tagged-album-empty-card tagged-album-empty-card--no-albums tagged-album-empty-card--admin"
                    aria-live="polite"
                >
                    <h2>Lost in the woods</h2>
                    <p>Use a regular user account to create and organize albums.</p>
                    <img className="tagged-album-empty-icon" src="/icons/album.svg" alt="" aria-hidden="true" />
                </article>
            </section>
        );
    }

    return (
        <section className="tagged-app-page tagged-album-page">
            {!loading && !error && albums.length > 0 ? (
                <div className="tagged-album-search" aria-label="Search albums">
                    <div className="tagged-album-search-wrap tagged-album-search-field">
                        <span>Search albums</span>

                        <div className="tagged-album-search-input-wrap">
                            <input
                                type="search"
                                className="tagged-album-search-input"
                                value={albumSearch}
                                onChange={(event) => setAlbumSearch(event.target.value)}
                                placeholder="Search albums by name or date..."
                                aria-label="Search albums"
                            />

                            {hasActiveAlbumFilter ? (
                                <button
                                    type="button"
                                    className="tagged-album-search-inline-clear"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => setAlbumSearch("")}
                                    aria-label="Clear search"
                                    title="Clear search"
                                >
                                    <span className="tagged-album-search-inline-clear-icon" aria-hidden="true" />
                                </button>
                            ) : null}
                        </div>

                        <div className="tagged-album-view-switch" aria-label="Album view mode">
                            <button
                                type="button"
                                className={`tagged-album-view-switch-button${albumViewMode === "card" ? " is-active" : ""}`}
                                onClick={() => setAlbumViewMode("card")}
                                aria-pressed={albumViewMode === "card"}
                                aria-label="Card view"
                                title="Card view"
                            >
                                <span className="tagged-album-view-switch-icon tagged-album-view-switch-icon--card" />
                                <span className="tagged-album-view-switch-label">Card</span>
                            </button>

                            <button
                                type="button"
                                className={`tagged-album-view-switch-button${albumViewMode === "list" ? " is-active" : ""}`}
                                onClick={() => setAlbumViewMode("list")}
                                aria-pressed={albumViewMode === "list"}
                                aria-label="List view"
                                title="List view"
                            >
                                <span className="tagged-album-view-switch-icon tagged-album-view-switch-icon--list" />
                                <span className="tagged-album-view-switch-label">List</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <article
                    className="tagged-app-page-card tagged-album-empty-card tagged-album-empty-card--no-albums tagged-album-empty-card--loading"
                    aria-live="polite"
                >
                    <span className="tagged-album-loading-spinner" aria-hidden="true" />
                    <h2>Loading albums</h2>
                    <p>Fetching albums and available cover media.</p>
                </article>
            ) : null}

            {!loading && error ? (
                <article
                    className="tagged-app-page-card tagged-album-status-card tagged-album-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Error loading albums</h2>
                    <p>Please try again.</p>
                </article>
            ) : !loading && !error ? (
                albums.length === 0 ? (
                    <article
                        className="tagged-app-page-card tagged-album-empty-card tagged-album-empty-card--no-albums"
                        aria-live="polite"
                    >
                        <h2>Kinda lonely</h2>
                        {mediaItems.length === 0 ? (
                            <p>
                                You need media before creating albums. Let&apos;s{" "}
                                <button
                                    type="button"
                                    className="tagged-album-empty-action"
                                    onClick={() => navigate("/gallery")}
                                >
                                    go to gallery
                                </button>
                                .
                            </p>
                        ) : (
                            <p>
                                Start organizing your media and{" "}
                                <button
                                    type="button"
                                    className="tagged-album-empty-action"
                                    onClick={handleOpenCreateModal}
                                >
                                    create your first album
                                </button>
                                .
                            </p>
                        )}
                    </article>
                ) : albumViewMode === "list" ? (
                    <div className="tagged-album-list" aria-label="Albums list">
                        <button
                            type="button"
                            className="tagged-album-list-create-tile"
                            onClick={handleOpenCreateModal}
                            aria-label="Add new album"
                        >
                            <span
                                className="tagged-album-create-icon tagged-album-create-icon--list"
                                aria-hidden="true"
                            />
                            <span>Add new album</span>
                        </button>

                        {visibleAlbums.map((album) => {
                            const coverUrl = getAssetUrl(album.albumthumbpath || album.albumcoverpath);
                            const createdLabel = formatAlbumDate(album.created_at);
                            const albumDisplayName = album.displayname || album.albumname || "Untitled album";
                            const isSelected = selectedAlbumIds.has(album.id);

                            return (
                                <article
                                    key={album.id}
                                    className={`tagged-album-list-item${isAlbumSelectionMode ? " is-selection-mode" : ""}${isSelected ? " is-selected" : ""}`}
                                >
                                    <div
                                        className={`tagged-album-list-preview${isAlbumSelectionMode ? " is-selection-mode" : ""}${isSelected ? " is-selected" : ""}`}
                                        aria-hidden="true"
                                        onClick={() => {
                                            if (longPressConsumedAlbumIdRef.current === album.id) {
                                                longPressConsumedAlbumIdRef.current = null;
                                                return;
                                            }

                                            handleOpenAlbumDetail(album.id);
                                        }}
                                        onPointerDown={(event) => handleAlbumPointerDown(album.id, event)}
                                        onPointerMove={handleAlbumPointerMove}
                                        onPointerUp={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onPointerLeave={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onPointerCancel={() => handleAlbumPointerUpOrCancel(album.id)}
                                    >
                                        {coverUrl ? (
                                            <img
                                                src={coverUrl}
                                                alt=""
                                                onError={(event) => {
                                                    event.currentTarget.onerror = null;
                                                    event.currentTarget.style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <div
                                                className="tagged-album-cover-fallback tagged-album-cover-fallback--list"
                                                style={getAlbumCoverGradientStyle(album)}
                                                aria-hidden="true"
                                            />
                                        )}

                                        {isAlbumSelectionMode ? (
                                            <span
                                                className={`tagged-album-list-selection-check${isSelected ? " is-selected" : ""}`}
                                            >
                                                {isSelected ? "\u2713" : ""}
                                            </span>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        className="tagged-album-list-main"
                                        onClick={() => {
                                            if (longPressConsumedAlbumIdRef.current === album.id) {
                                                longPressConsumedAlbumIdRef.current = null;
                                                return;
                                            }

                                            handleOpenAlbumDetail(album.id);
                                        }}
                                        onPointerDown={(event) => handleAlbumPointerDown(album.id, event)}
                                        onPointerMove={handleAlbumPointerMove}
                                        onPointerUp={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onPointerLeave={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onPointerCancel={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onContextMenu={(event) => event.preventDefault()}
                                        aria-pressed={isAlbumSelectionMode ? isSelected : undefined}
                                        aria-label={`Open album ${albumDisplayName}`}
                                    >
                                        <h2 title={albumDisplayName}>{albumDisplayName}</h2>
                                        {createdLabel ? <p className="tagged-album-list-date">{createdLabel}</p> : null}
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="tagged-album-grid" aria-label="Albums grid" style={{ "--tagged-grid-columns": gridColumns }}>
                        <button
                            type="button"
                            className="tagged-album-card tagged-album-create-tile"
                            onClick={handleOpenCreateModal}
                            aria-label="Add new album"
                        >
                            <span
                                className="tagged-album-create-icon tagged-album-create-icon--card"
                                aria-hidden="true"
                            />
                            <span>Add new album</span>
                        </button>

                        {visibleAlbums.map((album) => {
                            const coverUrl = getAssetUrl(album.albumthumbpath || album.albumcoverpath);
                            const createdLabel = formatAlbumDate(album.created_at);
                            const albumDisplayName = album.displayname || album.albumname || "Untitled album";
                            const isSelected = selectedAlbumIds.has(album.id);

                            return (
                                <article
                                    key={album.id}
                                    className={`tagged-album-card${isAlbumSelectionMode && isSelected ? " is-selected" : ""}`}
                                >
                                    {isAlbumSelectionMode ? (
                                        <span
                                            className={`tagged-album-card-select-indicator${isSelected ? " is-selected" : ""}`}
                                            aria-hidden="true"
                                        >
                                            <img src="/icons/check.svg" alt="" aria-hidden="true" />
                                        </span>
                                    ) : null}

                                    <button
                                        type="button"
                                        className="tagged-album-card-button"
                                        onClick={() => {
                                            if (longPressConsumedAlbumIdRef.current === album.id) {
                                                longPressConsumedAlbumIdRef.current = null;
                                                return;
                                            }

                                            handleOpenAlbumDetail(album.id);
                                        }}
                                        onPointerDown={(event) => handleAlbumPointerDown(album.id, event)}
                                        onPointerMove={handleAlbumPointerMove}
                                        onPointerUp={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onPointerLeave={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onPointerCancel={() => handleAlbumPointerUpOrCancel(album.id)}
                                        onContextMenu={(event) => event.preventDefault()}
                                        aria-pressed={isAlbumSelectionMode ? isSelected : undefined}
                                        aria-label={`Open album ${albumDisplayName}`}
                                    >
                                        <div className="tagged-album-card-preview-wrap">
                                            {coverUrl ? (
                                                <img
                                                    className="tagged-album-card-preview"
                                                    src={coverUrl}
                                                    alt={albumDisplayName || "Album cover"}
                                                    onError={(event) => {
                                                        event.currentTarget.onerror = null;
                                                        event.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="tagged-album-card-preview tagged-album-card-preview--empty">
                                                    <div
                                                        className="tagged-album-card-cover-fallback"
                                                        aria-hidden="true"
                                                    >
                                                        <img src="/icons/album.svg" alt="" aria-hidden="true" />
                                                    </div>
                                                </div>
                                            )}

                                            {coverUrl ? (
                                                <div className="tagged-album-card-cover-fallback" aria-hidden="true">
                                                    <img src="/icons/album.svg" alt="" aria-hidden="true" />
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="tagged-album-card-body">
                                            <div className="tagged-album-card-main-meta">
                                                <h2 title={albumDisplayName}>{albumDisplayName}</h2>
                                                {createdLabel ? (
                                                    <p className="tagged-album-card-date">{createdLabel}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                )
            ) : null}

            {isAlbumSelectionMode ? (
                <aside className="tagged-album-selection-toolbar" aria-label="Album selection actions toolbar">
                    <button
                        type="button"
                        className={`tagged-album-selection-icon-button tagged-album-selection-icon-button--clear-filter${
                            hasActiveAlbumFilter ? " is-active" : ""
                        }`}
                        disabled={!hasActiveAlbumFilter}
                        onClick={handleClearFiltersFromToolbar}
                        aria-label="Clear active filters"
                        title="Clear active filters"
                    >
                        <img src="/icons/clear_filters.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-album-selection-icon-button tagged-album-selection-icon-button--download"
                        disabled={selectedAlbumIds.size === 0 || isDownloadingSelectedAlbums}
                        onClick={handleDownloadSelectedAlbums}
                        aria-label={`Download ${selectedAlbumIds.size} selected album${selectedAlbumIds.size === 1 ? "" : "s"}`}
                        title={
                            selectedAlbumIds.size > 1 ? "Download selected albums as ZIP" : "Download selected album"
                        }
                    >
                        <img src="/icons/download.svg" alt="" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="tagged-album-selection-icon-button tagged-album-selection-icon-button--delete"
                        disabled={selectedAlbumIds.size === 0 || isDeletingSelected}
                        onClick={openDeleteSelectedConfirm}
                        aria-label={`Delete ${selectedAlbumIds.size} selected album${selectedAlbumIds.size === 1 ? "" : "s"}`}
                        title="Delete selected albums"
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

            {!loading && !error && albums.length > 0 && visibleAlbums.length === 0 ? (
                <article className="tagged-app-page-card tagged-album-status-card" aria-live="polite">
                    <h2>No albums found</h2>
                    <p>
                        <button type="button" className="tagged-album-empty-action" onClick={clearAlbumFilters}>
                            Clear filter
                        </button>
                    </p>
                </article>
            ) : null}

            {isDeleteConfirmOpen ? (
                <div
                    className="tagged-album-confirm-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-album-delete-confirm-title"
                    aria-describedby="tagged-album-delete-confirm-description"
                    onClick={closeDeleteSelectedConfirm}
                >
                    <div className="tagged-album-confirm-modal-content" onClick={(event) => event.stopPropagation()}>
                        <h2 id="tagged-album-delete-confirm-title">
                            Delete <span className="tagged-album-confirm-count">{selectedAlbumIds.size}</span> album
                            {selectedAlbumIds.size === 1 ? "" : "s"}
                        </h2>
                        <p id="tagged-album-delete-confirm-description">
                            This action deletes the selected albums and their links, but not your original media files.
                        </p>
                        <div className="tagged-album-confirm-actions">
                            <button
                                type="button"
                                className="tagged-album-confirm-continue"
                                onClick={handleDeleteSelectedAlbums}
                                disabled={isDeletingSelected}
                            >
                                Continue
                            </button>
                            <button
                                type="button"
                                className="tagged-album-confirm-cancel"
                                onClick={closeDeleteSelectedConfirm}
                                disabled={isDeletingSelected}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <AlbumCreateModal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
                onSubmit={handleCreateAlbum}
                isSaving={isCreatingAlbum}
                albumName={albumName}
                onAlbumNameChange={setAlbumName}
                coverSearch={coverSearch}
                onCoverSearchChange={setCoverSearch}
                mediaViewMode={createCoverMediaViewMode}
                onMediaViewModeChange={setCreateCoverMediaViewMode}
                mediaItems={createCoverMediaItems}
                filteredCoverCandidates={filteredCreateCoverMediaItems}
                selectedCoverMediaId={selectedCoverMediaId}
                onSelectCoverMedia={setSelectedCoverMediaId}
                getAssetUrl={getAssetUrl}
                mapTagsFromMedia={mapTagsFromMedia}
                selectedIncludeFilterTags={selectedCreateIncludeFilterTags}
                selectedExcludeFilterTags={selectedCreateExcludeFilterTags}
                onToggleIncludeFilterTag={toggleCreateIncludeFilterTag}
                onToggleExcludeFilterTag={toggleCreateExcludeFilterTag}
                onClearFilterTags={clearCreateFilterTags}
                tagFilterSearch={createTagFilterSearch}
                onTagFilterSearchChange={setCreateTagFilterSearch}
                visibleTagFilterCandidates={createTagFilterCandidates}
                error={createError}
            />

            <AlbumEditModal
                isOpen={isEditModalOpen}
                onClose={closeEditAlbumModal}
                onSubmit={handleEditAlbum}
                isSaving={isSavingEdit}
                albumName={editingAlbumName}
                onAlbumNameChange={setEditingAlbumName}
                coverSearch={editCoverSearch}
                onCoverSearchChange={setEditCoverSearch}
                mediaViewMode={editCoverMediaViewMode}
                onMediaViewModeChange={setEditCoverMediaViewMode}
                imageMediaItems={imageMediaItems}
                filteredCoverCandidates={filteredEditImageMediaItems}
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
