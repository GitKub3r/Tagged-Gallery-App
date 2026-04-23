import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import "./TagsPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const DEFAULT_TAG_COLOR = "#643aff";

const MANAGER_CONFIG = {
    tags: {
        title: "Tags",
        subtitle: "Manage your tag collection.",
        createLabel: "Create tag",
        emptyTitle: "Thats not very 'Tagged' of you...",
        emptySubtitle: "Create your first tag to start organizing media.",
        loadingTitle: "Loading tags",
        loadingSubtitle: "Fetching your tag collection.",
        errorTitle: "Could not load tags",
        editorCreateTitle: "Create Tag",
        editorEditTitle: "Edit Tag",
        editorCreateSubmit: "Create Tag",
        editorEditSubmit: "Save Changes",
        sectionAria: "Tags grouped from A to Z",
        itemLabel: "tag(s)",
        deleteEntityLabel: "tag",
    },
    displaynames: {
        title: "Media Names",
        subtitle: "Manage display names used in your media.",
        createLabel: "Create media name",
        emptyTitle: "You don't have a name?",
        emptySubtitle: "Create your first media name to keep naming consistent.",
        loadingTitle: "Loading media names",
        loadingSubtitle: "Fetching your media names.",
        errorTitle: "Could not load media names",
        editorCreateTitle: "Create Media Name",
        editorEditTitle: "Edit Media Name",
        editorCreateSubmit: "Create Media Name",
        editorEditSubmit: "Save Changes",
        sectionAria: "Media names grouped from A to Z",
        itemLabel: "name(s)",
        deleteEntityLabel: "media name",
    },
    authors: {
        title: "Authors",
        subtitle: "Manage author names used in your media.",
        createLabel: "Create author",
        emptyTitle: "Keep those names rolling",
        emptySubtitle: "Create your first author to keep your library clean.",
        loadingTitle: "Loading authors",
        loadingSubtitle: "Fetching your authors.",
        errorTitle: "Could not load authors",
        editorCreateTitle: "Create Author",
        editorEditTitle: "Edit Author",
        editorCreateSubmit: "Create Author",
        editorEditSubmit: "Save Changes",
        sectionAria: "Authors grouped from A to Z",
        itemLabel: "author(s)",
        deleteEntityLabel: "author",
    },
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

const normalizeHexColor = (rawColor) => {
    const color = String(rawColor || "").trim();

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return DEFAULT_TAG_COLOR;
    }

    return color.toLowerCase();
};

const normalizeValuesList = (list, fieldName) => {
    if (!Array.isArray(list)) {
        return [];
    }

    const deduped = new Set();

    return list
        .map((entry) => {
            if (typeof entry === "string") {
                return entry;
            }

            return String(entry?.[fieldName] || "");
        })
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .filter((value) => {
            const key = value.toLowerCase();
            if (deduped.has(key)) {
                return false;
            }
            deduped.add(key);
            return true;
        })
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

const sortTags = (tagList) =>
    [...tagList].sort((a, b) =>
        String(a.tagname || "").localeCompare(String(b.tagname || ""), undefined, {
            sensitivity: "base",
            numeric: true,
        }),
    );

const truncateLabel = (value, maxChars = 15) => {
    const text = String(value || "").trim();

    if (text.length <= maxChars) {
        return text;
    }

    return `${text.slice(0, maxChars)}...`;
};

const EMPTY_STATE_CONFIG = {
    tags: {
        title: "Thats not very 'Tagged' of you...",
        subtitle: "Create your first tag to organize your gallery faster.",
        actionLabel: "create a tag",
        iconSrc: "/icons/tags.svg",
    },
    displaynames: {
        title: "You don't have a name?",
        subtitle: "Save a media name preset to keep naming consistent.",
        actionLabel: "create a media name",
        iconSrc: "/icons/image.svg",
    },
    authors: {
        title: "Keep those names rolling",
        subtitle: "Create your first author to keep your library clean.",
        actionLabel: "create an author",
        iconSrc: "/icons/users.svg",
    },
};

const NO_RESULTS_STATE_CONFIG = {
    tags: {
        title: "No matching tags",
        subtitle: "Try another term or",
        actionLabel: "clear search",
        iconSrc: "/icons/tags.svg",
    },
    displaynames: {
        title: "No matching media names",
        subtitle: "Try another term or",
        actionLabel: "clear search",
        iconSrc: "/icons/image.svg",
    },
    authors: {
        title: "No matching authors",
        subtitle: "Try another term or",
        actionLabel: "clear search",
        iconSrc: "/icons/users.svg",
    },
};

const groupByFirstLetter = (items, getLabel) => {
    const grouped = new Map();

    for (const item of items) {
        const firstChar = String(getLabel(item) || "")
            .trim()
            .charAt(0)
            .toUpperCase();

        const groupKey = /^[A-Z]$/.test(firstChar) ? firstChar : "#";

        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, []);
        }

        grouped.get(groupKey).push(item);
    }

    return [...grouped.entries()].sort((a, b) => {
        if (a[0] === "#") {
            return 1;
        }

        if (b[0] === "#") {
            return -1;
        }

        return a[0].localeCompare(b[0]);
    });
};

export const MetadataPage = () => {
    const { fetchWithAuth } = useAuth();
    const [managerType, setManagerType] = useState("tags");
    const [tags, setTags] = useState([]);
    const [displayNames, setDisplayNames] = useState([]);
    const [authors, setAuthors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isSavingItem, setIsSavingItem] = useState(false);
    const [editorError, setEditorError] = useState(null);
    const [tagNameInput, setTagNameInput] = useState("");
    const [tagColorInput, setTagColorInput] = useState(DEFAULT_TAG_COLOR);
    const [tagTypeInput, setTagTypeInput] = useState("default");
    const [valueInput, setValueInput] = useState("");
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemPendingDelete, setItemPendingDelete] = useState(null);
    const [isDeletingItem, setIsDeletingItem] = useState(false);
    const [expandedSections, setExpandedSections] = useState({});
    const [quickSearchInput, setQuickSearchInput] = useState("");

    const activeConfig = MANAGER_CONFIG[managerType];
    const emptyStateConfig = EMPTY_STATE_CONFIG[managerType];
    const noResultsStateConfig = NO_RESULTS_STATE_CONFIG[managerType];
    const hasAnyManagedItems = tags.length > 0 || displayNames.length > 0 || authors.length > 0;

    const currentItems = useMemo(() => {
        if (managerType === "tags") {
            return sortTags(tags);
        }

        if (managerType === "displaynames") {
            return displayNames.map((value) => ({ id: value, value }));
        }

        return authors.map((value) => ({ id: value, value }));
    }, [managerType, tags, displayNames, authors]);

    const filteredItems = useMemo(() => {
        const normalizedQuery = quickSearchInput.trim().toLowerCase();

        if (!normalizedQuery) {
            return currentItems;
        }

        return currentItems.filter((item) => {
            const label = managerType === "tags" ? item.tagname : item.value;
            return String(label || "")
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [currentItems, quickSearchInput, managerType]);

    const groupedItems = useMemo(() => {
        return groupByFirstLetter(filteredItems, (item) => (managerType === "tags" ? item.tagname : item.value));
    }, [filteredItems, managerType]);

    const fetchTags = async () => {
        const response = await fetchWithAuth(`${API_URL}/tags`, { method: "GET" });
        const data = await parseApiResponse(response, "Could not load tags");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load tags");
        }

        return Array.isArray(data.data) ? sortTags(data.data) : [];
    };

    const fetchDisplayNames = async () => {
        const response = await fetchWithAuth(`${API_URL}/media/displaynames`, { method: "GET" });
        const data = await parseApiResponse(response, "Could not load media names");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load media names");
        }

        return normalizeValuesList(data.data, "displayname");
    };

    const fetchAuthors = async () => {
        const response = await fetchWithAuth(`${API_URL}/media/authors`, { method: "GET" });
        const data = await parseApiResponse(response, "Could not load authors");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load authors");
        }

        return normalizeValuesList(data.data, "author");
    };

    useEffect(() => {
        let cancelled = false;

        const loadAll = async () => {
            try {
                setLoading(true);
                setError(null);

                const [loadedTags, loadedDisplayNames, loadedAuthors] = await Promise.all([
                    fetchTags(),
                    fetchDisplayNames(),
                    fetchAuthors(),
                ]);

                if (!cancelled) {
                    setTags(loadedTags);
                    setDisplayNames(loadedDisplayNames);
                    setAuthors(loadedAuthors);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load data");
                    setTags([]);
                    setDisplayNames([]);
                    setAuthors([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadAll();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth]);

    useEffect(() => {
        setExpandedSections({});
    }, [managerType]);

    const closeEditorModal = () => {
        if (isSavingItem) {
            return;
        }

        setIsEditorModalOpen(false);
        setEditingItem(null);
        setEditorError(null);
    };

    const openCreateModal = () => {
        setEditingItem(null);
        setTagNameInput("");
        setTagColorInput(DEFAULT_TAG_COLOR);
        setTagTypeInput("default");
        setValueInput("");
        setEditorError(null);
        setIsEditorModalOpen(true);
    };

    const openEditModal = (item) => {
        if (!item) {
            return;
        }

        setEditingItem(item);

        if (managerType === "tags") {
            setTagNameInput(String(item.tagname || ""));
            setTagColorInput(normalizeHexColor(item.tagcolor_hex));
            setTagTypeInput(item.type === "copyright" ? "copyright" : "default");
        } else {
            setValueInput(String(item.value || ""));
        }

        setEditorError(null);
        setIsEditorModalOpen(true);
    };

    const openDeleteConfirm = (item) => {
        if (!item) {
            return;
        }

        setItemPendingDelete(item);
        setIsDeleteConfirmOpen(true);
    };

    const closeDeleteConfirm = () => {
        if (isDeletingItem) {
            return;
        }

        setIsDeleteConfirmOpen(false);
        setItemPendingDelete(null);
    };

    const handleTagSave = async () => {
        const trimmedTagName = tagNameInput.trim();

        if (!trimmedTagName) {
            setEditorError("Tag name is required");
            return false;
        }

        const normalizedColor = normalizeHexColor(tagColorInput);
        const payload = {
            tagname: trimmedTagName,
            tagcolor_hex: normalizedColor,
            type: tagTypeInput === "copyright" ? "copyright" : "default",
        };

        const isEditMode = Boolean(editingItem?.id);
        const response = await fetchWithAuth(isEditMode ? `${API_URL}/tags/${editingItem.id}` : `${API_URL}/tags`, {
            method: isEditMode ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await parseApiResponse(response, "Could not save tag");

        if (!response.ok || !data.success || !data.data) {
            throw new Error(data.message || "Could not save tag");
        }

        setTags((previous) => {
            if (isEditMode) {
                return sortTags(previous.map((tag) => (String(tag.id) === String(editingItem.id) ? data.data : tag)));
            }

            return sortTags([...previous, data.data]);
        });

        return true;
    };

    const handleValueSave = async () => {
        const trimmedValue = valueInput.trim();

        if (!trimmedValue) {
            setEditorError("Value is required");
            return false;
        }

        const isDisplayNameManager = managerType === "displaynames";
        const isEditMode = Boolean(editingItem?.value);
        const endpoint = isDisplayNameManager ? `${API_URL}/media/displaynames` : `${API_URL}/media/authors`;

        const payload = isEditMode
            ? {
                  previousValue: editingItem.value,
                  nextValue: trimmedValue,
              }
            : isDisplayNameManager
              ? { displayname: trimmedValue }
              : { author: trimmedValue };

        const response = await fetchWithAuth(endpoint, {
            method: isEditMode ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await parseApiResponse(response, "Could not save value");

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not save value");
        }

        if (isDisplayNameManager) {
            setDisplayNames((previous) => {
                const nextSet = new Set(previous.map((entry) => entry.trim()));

                if (isEditMode) {
                    nextSet.delete(editingItem.value.trim());
                }

                nextSet.add(trimmedValue);

                return [...nextSet].sort((a, b) =>
                    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
                );
            });
        } else {
            setAuthors((previous) => {
                const nextSet = new Set(previous.map((entry) => entry.trim()));

                if (isEditMode) {
                    nextSet.delete(editingItem.value.trim());
                }

                nextSet.add(trimmedValue);

                return [...nextSet].sort((a, b) =>
                    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
                );
            });
        }

        return true;
    };

    const handleItemSave = async (event) => {
        event.preventDefault();

        if (isSavingItem) {
            return;
        }

        try {
            setIsSavingItem(true);
            setEditorError(null);

            const didSave = managerType === "tags" ? await handleTagSave() : await handleValueSave();

            if (didSave) {
                closeEditorModal();
            }
        } catch (requestError) {
            setEditorError(requestError.message || "Could not save value");
        } finally {
            setIsSavingItem(false);
        }
    };

    const handleDeleteItem = async () => {
        if (!itemPendingDelete || isDeletingItem) {
            return;
        }

        try {
            setIsDeletingItem(true);

            if (managerType === "tags") {
                const response = await fetchWithAuth(`${API_URL}/tags/${itemPendingDelete.id}`, {
                    method: "DELETE",
                });
                const data = await parseApiResponse(response, "Could not delete tag");

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Could not delete tag");
                }

                setTags((previous) => previous.filter((tag) => String(tag.id) !== String(itemPendingDelete.id)));
            } else {
                const isDisplayNameManager = managerType === "displaynames";
                const endpoint = isDisplayNameManager ? `${API_URL}/media/displaynames` : `${API_URL}/media/authors`;
                const response = await fetchWithAuth(endpoint, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ value: itemPendingDelete.value }),
                });
                const data = await parseApiResponse(response, "Could not delete value");

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Could not delete value");
                }

                if (isDisplayNameManager) {
                    setDisplayNames((previous) =>
                        previous.filter((value) => value.toLowerCase() !== itemPendingDelete.value.toLowerCase()),
                    );
                } else {
                    setAuthors((previous) =>
                        previous.filter((value) => value.toLowerCase() !== itemPendingDelete.value.toLowerCase()),
                    );
                }
            }

            closeDeleteConfirm();
        } catch (requestError) {
            setError(requestError.message || "Could not delete value");
        } finally {
            setIsDeletingItem(false);
        }
    };

    const toggleSectionExpansion = (sectionKey) => {
        setExpandedSections((previous) => ({
            ...previous,
            [sectionKey]: !previous[sectionKey],
        }));
    };

    return (
        <section
            className={`tagged-app-page tagged-tags-page${!loading && !error && !hasAnyManagedItems ? " tagged-tags-page--global-empty" : ""}`}
        >
            {!loading && !error && hasAnyManagedItems ? (
                <header className="tagged-tags-page-header tagged-tags-page-header--actions-only">
                    <button type="button" className="tagged-tags-create-button" onClick={openCreateModal}>
                        <img src="/icons/add.svg" alt="" aria-hidden="true" />
                        <span>{activeConfig.createLabel}</span>
                    </button>
                </header>
            ) : null}

            {!loading && !error && hasAnyManagedItems ? (
                <label className="tagged-tags-quick-search" aria-label="Search items">
                    <input
                        type="search"
                        value={quickSearchInput}
                        onChange={(event) => setQuickSearchInput(event.target.value)}
                        placeholder="Search tags, media names or authors..."
                    />
                </label>
            ) : null}

            <div
                className={`tagged-tags-manager-switch${!loading && !error && !hasAnyManagedItems ? " tagged-tags-manager-switch--floating" : ""}`}
                role="tablist"
                aria-label="Tag managers"
            >
                <button
                    type="button"
                    role="tab"
                    className={managerType === "tags" ? "is-active" : ""}
                    onClick={() => setManagerType("tags")}
                    aria-selected={managerType === "tags"}
                >
                    Tags
                </button>
                <button
                    type="button"
                    role="tab"
                    className={managerType === "displaynames" ? "is-active" : ""}
                    onClick={() => setManagerType("displaynames")}
                    aria-selected={managerType === "displaynames"}
                >
                    Media Names
                </button>
                <button
                    type="button"
                    role="tab"
                    className={managerType === "authors" ? "is-active" : ""}
                    onClick={() => setManagerType("authors")}
                    aria-selected={managerType === "authors"}
                >
                    Authors
                </button>
            </div>

            {loading ? (
                <article className="tagged-app-page-card tagged-tags-status-card" aria-live="polite">
                    <h2>{activeConfig.loadingTitle}</h2>
                    <p>{activeConfig.loadingSubtitle}</p>
                </article>
            ) : null}

            {!loading && error ? (
                <article
                    className="tagged-app-page-card tagged-tags-status-card tagged-tags-status-card--error"
                    aria-live="assertive"
                >
                    <h2>{activeConfig.errorTitle}</h2>
                    <p>{error}</p>
                </article>
            ) : null}

            {!loading && !error && currentItems.length === 0 ? (
                <article
                    className="tagged-app-page-card tagged-tags-empty-card tagged-tags-empty-card--no-items"
                    aria-live="polite"
                >
                    <h2>{emptyStateConfig.title}</h2>
                    <p>
                        {emptyStateConfig.subtitle} Let&apos;s{" "}
                        <button type="button" className="tagged-tags-empty-action" onClick={openCreateModal}>
                            {emptyStateConfig.actionLabel}
                        </button>
                        .
                    </p>
                    <img className="tagged-tags-empty-icon" src={emptyStateConfig.iconSrc} alt="" aria-hidden="true" />
                </article>
            ) : null}

            {!loading && !error && currentItems.length > 0 && filteredItems.length === 0 ? (
                <article
                    className="tagged-app-page-card tagged-tags-empty-card tagged-tags-empty-card--no-results"
                    aria-live="polite"
                >
                    <h2>{noResultsStateConfig.title}</h2>
                    <p>
                        {noResultsStateConfig.subtitle}{" "}
                        <button
                            type="button"
                            className="tagged-tags-empty-action"
                            onClick={() => setQuickSearchInput("")}
                        >
                            {noResultsStateConfig.actionLabel}
                        </button>
                        .
                    </p>
                    <img
                        className="tagged-tags-empty-icon"
                        src={noResultsStateConfig.iconSrc}
                        alt=""
                        aria-hidden="true"
                    />
                </article>
            ) : null}

            {!loading && !error && filteredItems.length > 0 ? (
                <div className="tagged-tags-sections" aria-label={activeConfig.sectionAria}>
                    {groupedItems.map(([letter, sectionItems]) => {
                        const isExpanded = Boolean(expandedSections[letter]);
                        const hasOverflow = sectionItems.length > 3;
                        const visibleItems = isExpanded ? sectionItems : sectionItems.slice(0, 3);

                        return (
                            <section key={letter} className="tagged-tags-section" aria-label={`Section ${letter}`}>
                                <header className="tagged-tags-section-header">
                                    <h2>{letter}</h2>
                                    <div className="tagged-tags-section-header-actions">
                                        <span>
                                            {sectionItems.length} {activeConfig.itemLabel}
                                        </span>
                                        {hasOverflow ? (
                                            <button
                                                type="button"
                                                className="tagged-tags-expand-button"
                                                onClick={() => toggleSectionExpansion(letter)}
                                                aria-label={
                                                    isExpanded
                                                        ? `Collapse section ${letter}`
                                                        : `Expand section ${letter}`
                                                }
                                            >
                                                <span aria-hidden="true">{isExpanded ? "▲" : "▼"}</span>
                                            </button>
                                        ) : null}
                                    </div>
                                </header>

                                <ul className={`tagged-tags-list${isExpanded ? " is-expanded" : ""}`}>
                                    {visibleItems.map((item) => {
                                        const isTagManager = managerType === "tags";
                                        const mainLabel = isTagManager ? item.tagname : item.value;
                                        const compactLabel = truncateLabel(mainLabel, 15);

                                        return (
                                            <li key={item.id} className="tagged-tags-item">
                                                <button
                                                    type="button"
                                                    className="tagged-tags-item-button"
                                                    onClick={() => openEditModal(item)}
                                                    aria-label={`Edit ${mainLabel}`}
                                                    title={mainLabel}
                                                >
                                                    {isTagManager ? (
                                                        <span
                                                            className="tagged-tags-item-color"
                                                            style={{
                                                                backgroundColor: normalizeHexColor(item.tagcolor_hex),
                                                            }}
                                                            aria-hidden="true"
                                                        />
                                                    ) : null}

                                                    <span className="tagged-tags-item-name">{compactLabel}</span>

                                                    {isTagManager && item.type === "copyright" ? (
                                                        <span
                                                            className="tagged-tags-item-kind-indicator tagged-tags-item-kind-indicator--copyright"
                                                            title="Copyright tag"
                                                            aria-hidden="true"
                                                        >
                                                            <img src="/icons/copyright.svg" alt="" aria-hidden="true" />
                                                        </span>
                                                    ) : null}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="tagged-tags-delete-button"
                                                    onClick={() => openDeleteConfirm(item)}
                                                    aria-label={`Delete ${mainLabel}`}
                                                >
                                                    <img src="/icons/delete.svg" alt="" aria-hidden="true" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            ) : null}

            {isEditorModalOpen ? (
                <div
                    className="tagged-tags-editor-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={editingItem ? activeConfig.editorEditTitle : activeConfig.editorCreateTitle}
                    onClick={closeEditorModal}
                >
                    <div className="tagged-tags-editor-modal-content" onClick={(event) => event.stopPropagation()}>
                        <header className="tagged-tags-editor-header">
                            <h2>{editingItem ? activeConfig.editorEditTitle : activeConfig.editorCreateTitle}</h2>
                            <button
                                type="button"
                                className="tagged-tags-editor-close"
                                onClick={closeEditorModal}
                                disabled={isSavingItem}
                                aria-label="Close editor"
                            >
                                ×
                            </button>
                        </header>

                        <form className="tagged-tags-editor-form" onSubmit={handleItemSave}>
                            {managerType === "tags" ? (
                                <>
                                    <label className="tagged-tags-editor-field">
                                        <span>Tag Name</span>
                                        <input
                                            type="text"
                                            value={tagNameInput}
                                            onChange={(event) => setTagNameInput(event.target.value)}
                                            placeholder="Write tag name"
                                            required
                                        />
                                    </label>

                                    <label className="tagged-tags-editor-field">
                                        <span>Tag Color</span>
                                        <input
                                            className="tagged-tags-color-picker"
                                            type="color"
                                            value={normalizeHexColor(tagColorInput)}
                                            onChange={(event) => setTagColorInput(event.target.value)}
                                        />
                                    </label>

                                    <label className="tagged-tags-editor-field">
                                        <span>Type</span>
                                        <select
                                            value={tagTypeInput}
                                            onChange={(event) => setTagTypeInput(event.target.value)}
                                        >
                                            <option value="default">Default</option>
                                            <option value="copyright">Copyright</option>
                                        </select>
                                    </label>
                                </>
                            ) : (
                                <label className="tagged-tags-editor-field">
                                    <span>{managerType === "displaynames" ? "Media Name" : "Author"}</span>
                                    <input
                                        type="text"
                                        value={valueInput}
                                        onChange={(event) => setValueInput(event.target.value)}
                                        placeholder={
                                            managerType === "displaynames" ? "Write media name" : "Write author name"
                                        }
                                        required
                                    />
                                </label>
                            )}

                            {editorError ? <p className="tagged-tags-editor-error">{editorError}</p> : null}

                            <button type="submit" className="tagged-tags-editor-submit" disabled={isSavingItem}>
                                {isSavingItem
                                    ? "Saving..."
                                    : editingItem
                                      ? activeConfig.editorEditSubmit
                                      : activeConfig.editorCreateSubmit}
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}

            {isDeleteConfirmOpen ? (
                <div
                    className="tagged-gallery-confirm-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-tags-delete-title"
                    aria-describedby="tagged-tags-delete-description"
                    onClick={closeDeleteConfirm}
                >
                    <div className="tagged-gallery-confirm-modal-content" onClick={(event) => event.stopPropagation()}>
                        <h2 id="tagged-tags-delete-title">
                            Are you sure you want delete <span className="tagged-gallery-confirm-count">1</span>{" "}
                            {activeConfig.deleteEntityLabel}?
                        </h2>
                        <p id="tagged-tags-delete-description">This action can not be undone</p>
                        <div className="tagged-gallery-confirm-actions">
                            <button
                                type="button"
                                className="tagged-gallery-confirm-continue"
                                onClick={handleDeleteItem}
                                disabled={isDeletingItem}
                            >
                                Continue
                            </button>
                            <button
                                type="button"
                                className="tagged-gallery-confirm-cancel"
                                onClick={closeDeleteConfirm}
                                disabled={isDeletingItem}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};
