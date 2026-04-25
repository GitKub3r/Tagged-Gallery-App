import { useEffect, useMemo, useRef, useState } from "react";
import "./MediaEditModal.css";

const MAX_SUGGESTIONS = 8;
const DEFAULT_NEW_TAG_COLOR = "#643aff";

const isVideoLike = (media) => {
    const mediaType = String(media?.mediatype || "").toLowerCase();
    return mediaType.includes("video") || mediaType.includes("gif");
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

const toHexChannel = (value) =>
    Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0");

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

const buildTagStyle = (hexColor) => {
    const rgb = getHexRgb(hexColor);
    const darkTheme = isDarkThemeActive();

    if (!rgb) {
        return {
            backgroundColor: `${DEFAULT_NEW_TAG_COLOR}22`,
            color: DEFAULT_NEW_TAG_COLOR,
            borderColor: `${DEFAULT_NEW_TAG_COLOR}66`,
            borderWidth: "2px",
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.22)",
        };
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

export const MediaEditModal = ({
    isOpen,
    mode = "single",
    selectedCount = 0,
    initialValues,
    distinctDisplayNames = [],
    distinctAuthors = [],
    distinctTagNames = [],
    tagColorByName = {},
    selectedMediaItems = [],
    getAssetUrl = (assetPath) => String(assetPath || ""),
    isSaving = false,
    error = null,
    onClose,
    onSubmit,
}) => {
    const [displayNameInput, setDisplayNameInput] = useState("");
    const [authorInput, setAuthorInput] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [activeSuggestionField, setActiveSuggestionField] = useState(null);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isPreviewLightboxOpen, setIsPreviewLightboxOpen] = useState(false);
    const previewTouchStartRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setDisplayNameInput(String(initialValues?.displayname || ""));
        setAuthorInput(String(initialValues?.author || ""));
        setTagInput("");
        setSelectedTags(Array.isArray(initialValues?.tags) ? initialValues.tags : []);
        setActiveSuggestionField(null);
        setActiveSuggestionIndex(0);
        setPreviewIndex(0);
        setIsPreviewLightboxOpen(false);
    }, [isOpen, initialValues]);

    const isMultiMode = mode === "multi";
    const normalizeTag = (value) =>
        String(value || "")
            .trim()
            .toLowerCase();

    const baseCommonTagMap = useMemo(() => {
        const map = new Map();
        const initialTags = Array.isArray(initialValues?.tags) ? initialValues.tags : [];

        initialTags.forEach((tag) => {
            const normalized = normalizeTag(tag);

            if (!normalized || map.has(normalized)) {
                return;
            }

            map.set(normalized, String(tag).trim());
        });

        return map;
    }, [initialValues]);

    const selectedTagMap = useMemo(() => {
        const map = new Map();

        selectedTags.forEach((tag) => {
            const normalized = normalizeTag(tag);

            if (!normalized || map.has(normalized)) {
                return;
            }

            map.set(normalized, String(tag).trim());
        });

        return map;
    }, [selectedTags]);

    const tagsToAddPreview = useMemo(
        () =>
            Array.from(selectedTagMap.entries())
                .filter(([normalized]) => !baseCommonTagMap.has(normalized))
                .map(([, original]) => original),
        [selectedTagMap, baseCommonTagMap],
    );

    const tagsToRemovePreview = useMemo(
        () =>
            Array.from(baseCommonTagMap.entries())
                .filter(([normalized]) => !selectedTagMap.has(normalized))
                .map(([, original]) => original),
        [baseCommonTagMap, selectedTagMap],
    );

    const previewItems = useMemo(() => {
        if (!Array.isArray(selectedMediaItems)) {
            return [];
        }

        return selectedMediaItems
            .map((media) => {
                const thumbPath = String(media?.thumbpath || "").trim();
                const filePath = String(media?.filepath || "").trim();

                const previewPath = thumbPath || filePath;
                if (!previewPath) {
                    return null;
                }

                const previewUrl =
                    previewPath.startsWith("http://") || previewPath.startsWith("https://")
                        ? previewPath
                        : getAssetUrl(previewPath);

                if (!previewUrl) {
                    return null;
                }

                return {
                    id: media?.id || previewUrl,
                    url: previewUrl,
                    isVideo: !thumbPath && isVideoLike(media),
                    label: String(media?.displayname || media?.filename || media?.id || "Media").trim(),
                };
            })
            .filter(Boolean);
    }, [selectedMediaItems, getAssetUrl]);

    const normalizedPreviewIndex = Math.min(previewIndex, Math.max(previewItems.length - 1, 0));
    const activePreviewItem = previewItems[normalizedPreviewIndex] || null;
    const canGoPrevPreview = normalizedPreviewIndex > 0;
    const canGoNextPreview = normalizedPreviewIndex < previewItems.length - 1;

    const goToPreviousPreview = () => {
        if (!canGoPrevPreview) {
            return;
        }

        setPreviewIndex((previous) => Math.max(previous - 1, 0));
    };

    const goToNextPreview = () => {
        if (!canGoNextPreview) {
            return;
        }

        setPreviewIndex((previous) => Math.min(previous + 1, previewItems.length - 1));
    };

    const handlePreviewTouchStart = (event) => {
        const touch = event.touches?.[0];

        if (!touch) {
            return;
        }

        previewTouchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
    };

    const handlePreviewTouchEnd = (event) => {
        const start = previewTouchStartRef.current;
        const touch = event.changedTouches?.[0];

        previewTouchStartRef.current = null;

        if (!start || !touch || previewItems.length < 2) {
            return;
        }

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        const elapsed = Date.now() - start.time;

        if (elapsed > 700 || Math.abs(deltaX) < 45 || Math.abs(deltaY) > 80) {
            return;
        }

        if (deltaX < 0) {
            goToNextPreview();
        } else {
            goToPreviousPreview();
        }
    };

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

    const visibleTagSuggestions = useMemo(() => {
        const currentInput = tagInput.trim().toLowerCase();
        const selectedSet = new Set(selectedTags.map((tag) => tag.toLowerCase()));

        return distinctTagNames
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
    }, [distinctTagNames, selectedTags, tagInput]);

    useEffect(() => {
        const activeSuggestions =
            activeSuggestionField === "displayname"
                ? visibleDisplayNameSuggestions
                : activeSuggestionField === "author"
                  ? visibleAuthorSuggestions
                  : activeSuggestionField === "tag"
                    ? visibleTagSuggestions
                    : [];

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
    }, [activeSuggestionField, visibleDisplayNameSuggestions, visibleAuthorSuggestions, visibleTagSuggestions]);

    const openSuggestions = (field) => {
        setActiveSuggestionField(field);
        setActiveSuggestionIndex(0);
    };

    const closeSuggestions = () => {
        setActiveSuggestionField(null);
        setActiveSuggestionIndex(0);
    };

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
        closeSuggestions();
    };

    const removeTag = (tagToRemove) => {
        setSelectedTags((previous) => previous.filter((tag) => tag !== tagToRemove));
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
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        let payload = { tags: selectedTags };

        if (!isMultiMode || displayNameInput.trim() !== "") {
            payload.displayname = displayNameInput;
        }
        if (!isMultiMode || authorInput.trim() !== "") {
            payload.author = authorInput;
        }

        await onSubmit?.(payload);
    };

    const handleCloseModal = () => {
        if (isSaving) {
            return;
        }

        setIsPreviewLightboxOpen(false);
        onClose?.();
    };

    useEffect(() => {
        if (!isOpen || previewItems.length < 2) {
            return undefined;
        }

        const handleWindowKeyDown = (event) => {
            if (isSaving || activeSuggestionField) {
                return;
            }

            const target = event.target;
            const isTypingField =
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

            if (isTypingField) {
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                goToPreviousPreview();
                return;
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();
                goToNextPreview();
            }
        };

        window.addEventListener("keydown", handleWindowKeyDown);

        return () => {
            window.removeEventListener("keydown", handleWindowKeyDown);
        };
    }, [isOpen, previewItems.length, isSaving, activeSuggestionField, canGoPrevPreview, canGoNextPreview]);

    if (!isOpen) {
        return null;
    }

    const submitLabel = isSaving ? "Saving..." : isMultiMode ? "Save selected media" : "Save Changes";

    return (
        <div
            className="tagged-media-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit selected media"
            onClick={handleCloseModal}
        >
            <div className="tagged-media-edit-modal-content" onClick={(event) => event.stopPropagation()}>
                <header className="tagged-media-edit-modal-header">
                    <h2>Edit media</h2>
                    <button
                        type="button"
                        className="tagged-media-edit-modal-close"
                        onClick={handleCloseModal}
                        disabled={isSaving}
                        aria-label="Close edit modal"
                    >
                        ×
                    </button>
                </header>

                <form className="tagged-media-edit-form" id="tagged-media-edit-form" onSubmit={handleSubmit}>
                    <div className="tagged-media-edit-form-layout">
                        <div className="tagged-media-edit-form-main-column">
                            {activePreviewItem ? (
                                <button
                                    type="button"
                                    className="tagged-media-edit-preview-inline tagged-media-edit-preview-inline--mobile"
                                    aria-label="Open selected media preview"
                                    onClick={() => setIsPreviewLightboxOpen(true)}
                                    onTouchStart={handlePreviewTouchStart}
                                    onTouchEnd={handlePreviewTouchEnd}
                                >
                                    {activePreviewItem.isVideo ? (
                                        <video src={activePreviewItem.url} muted playsInline preload="metadata" />
                                    ) : (
                                        <img src={activePreviewItem.url} alt="" />
                                    )}
                                </button>
                            ) : null}

                            <div className="tagged-media-edit-row tagged-media-edit-row--two-columns">
                                <label className="tagged-media-edit-field">
                                    <span>Media Name</span>
                                    <div className="tagged-media-edit-autocomplete">
                                        <input
                                            type="text"
                                            value={displayNameInput}
                                            onChange={(event) => {
                                                setDisplayNameInput(event.target.value);
                                                openSuggestions("displayname");
                                            }}
                                            onFocus={() => openSuggestions("displayname")}
                                            onBlur={closeSuggestions}
                                            onKeyDown={(event) =>
                                                handleSuggestionKeyboard(
                                                    event,
                                                    "displayname",
                                                    visibleDisplayNameSuggestions,
                                                    (selectedValue) => {
                                                        setDisplayNameInput(selectedValue || "");
                                                        closeSuggestions();
                                                    },
                                                )
                                            }
                                            placeholder={isMultiMode ? "Keep existing values" : "Undefined"}
                                            required={!isMultiMode}
                                        />

                                        {activeSuggestionField === "displayname" &&
                                        visibleDisplayNameSuggestions.length > 0 ? (
                                            <ul className="tagged-media-edit-suggestion-list" role="listbox">
                                                {visibleDisplayNameSuggestions.map((value, index) => (
                                                    <li key={value}>
                                                        <button
                                                            type="button"
                                                            className={`tagged-media-edit-suggestion-item${index === activeSuggestionIndex ? " is-active" : ""}`}
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                setDisplayNameInput(value);
                                                                closeSuggestions();
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
                                            value={authorInput}
                                            onChange={(event) => {
                                                setAuthorInput(event.target.value);
                                                openSuggestions("author");
                                            }}
                                            onFocus={() => openSuggestions("author")}
                                            onBlur={closeSuggestions}
                                            onKeyDown={(event) =>
                                                handleSuggestionKeyboard(
                                                    event,
                                                    "author",
                                                    visibleAuthorSuggestions,
                                                    (selectedValue) => {
                                                        setAuthorInput(selectedValue || "");
                                                        closeSuggestions();
                                                    },
                                                )
                                            }
                                            placeholder={isMultiMode ? "Keep existing values" : "Optional"}
                                        />

                                        {activeSuggestionField === "author" && visibleAuthorSuggestions.length > 0 ? (
                                            <ul className="tagged-media-edit-suggestion-list" role="listbox">
                                                {visibleAuthorSuggestions.map((value, index) => (
                                                    <li key={value}>
                                                        <button
                                                            type="button"
                                                            className={`tagged-media-edit-suggestion-item${index === activeSuggestionIndex ? " is-active" : ""}`}
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                setAuthorInput(value);
                                                                closeSuggestions();
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
                                        value={tagInput}
                                        onChange={(event) => {
                                            setTagInput(event.target.value);
                                            openSuggestions("tag");
                                        }}
                                        onFocus={() => openSuggestions("tag")}
                                        onBlur={closeSuggestions}
                                        placeholder="Write tag name and press Enter"
                                        onKeyDown={(event) =>
                                            handleSuggestionKeyboard(
                                                event,
                                                "tag",
                                                visibleTagSuggestions,
                                                (selectedValue) => addTag(selectedValue),
                                                () => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        addTag(tagInput);
                                                    }
                                                },
                                            )
                                        }
                                    />

                                    {activeSuggestionField === "tag" && visibleTagSuggestions.length > 0 ? (
                                        <ul className="tagged-media-edit-suggestion-list" role="listbox">
                                            {visibleTagSuggestions.map((value, index) => (
                                                <li key={value}>
                                                    <button
                                                        type="button"
                                                        className={`tagged-media-edit-suggestion-item${index === activeSuggestionIndex ? " is-active" : ""}`}
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => addTag(value)}
                                                    >
                                                        {value}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            </label>

                            {selectedTags.length > 0 ? (
                                <div className="tagged-media-edit-tag-preview" aria-label="Selected tags">
                                    {selectedTags.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            className="tagged-media-edit-tag-chip"
                                            style={buildTagStyle(
                                                tagColorByName[String(tag).trim().toLowerCase()],
                                                "light",
                                            )}
                                            onClick={() => removeTag(tag)}
                                            aria-label={`Remove tag ${tag}`}
                                        >
                                            <span>{tag}</span>
                                            <span aria-hidden="true">×</span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {error ? (
                                <p className="tagged-media-edit-error" aria-live="assertive">
                                    {error}
                                </p>
                            ) : null}

                            <footer className="tagged-media-edit-modal-footer">
                                <div className="tagged-media-edit-modal-actions">
                                    <button
                                        type="button"
                                        className="tagged-media-edit-modal-cancel"
                                        onClick={handleCloseModal}
                                        disabled={isSaving}
                                        aria-label="Cancel editing"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="tagged-media-edit-submit"
                                        disabled={isSaving}
                                        form="tagged-media-edit-form"
                                    >
                                        {submitLabel}
                                    </button>
                                </div>
                            </footer>
                        </div>

                        <aside className="tagged-media-edit-preview-panel" aria-label="Selected media preview">
                            {activePreviewItem ? (
                                <div className="tagged-media-edit-preview-panel-wrap">
                                    <button
                                        type="button"
                                        className="tagged-media-edit-preview-inline tagged-media-edit-preview-inline--panel"
                                        aria-label="Open selected media preview"
                                        onClick={() => setIsPreviewLightboxOpen(true)}
                                    >
                                        {activePreviewItem.isVideo ? (
                                            <video src={activePreviewItem.url} muted playsInline preload="metadata" />
                                        ) : (
                                            <img src={activePreviewItem.url} alt="" />
                                        )}
                                    </button>

                                    {previewItems.length > 1 ? (
                                        <div
                                            className="tagged-media-edit-preview-nav"
                                            aria-label="Selected media preview navigation"
                                        >
                                            <button
                                                type="button"
                                                className="tagged-media-edit-preview-nav-button"
                                                onClick={goToPreviousPreview}
                                                disabled={!canGoPrevPreview}
                                                aria-label="Previous selected media preview"
                                                onTouchStart={handlePreviewTouchStart}
                                                onTouchEnd={handlePreviewTouchEnd}
                                            >
                                                <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                                            </button>

                                            <p className="tagged-media-edit-preview-counter" aria-live="polite">
                                                <strong>{normalizedPreviewIndex + 1}</strong> / {previewItems.length}
                                            </p>

                                            <button
                                                type="button"
                                                className="tagged-media-edit-preview-nav-button"
                                                onClick={goToNextPreview}
                                                disabled={!canGoNextPreview}
                                                aria-label="Next selected media preview"
                                                onTouchStart={handlePreviewTouchStart}
                                                onTouchEnd={handlePreviewTouchEnd}
                                            >
                                                <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="tagged-media-edit-preview-placeholder" aria-hidden="true">
                                    <span>No preview</span>
                                </div>
                            )}
                        </aside>
                    </div>
                </form>

                {isPreviewLightboxOpen && activePreviewItem ? (
                    <div
                        className="tagged-media-edit-preview-lightbox"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Selected media preview"
                        onClick={() => setIsPreviewLightboxOpen(false)}
                    >
                        <div className="tagged-media-edit-preview-lightbox-content">
                            <button
                                type="button"
                                className="tagged-media-edit-preview-lightbox-close"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setIsPreviewLightboxOpen(false);
                                }}
                                aria-label="Close selected media preview"
                            >
                                ×
                            </button>

                            {activePreviewItem.isVideo ? (
                                <video
                                    className="tagged-media-edit-preview-lightbox-media"
                                    src={activePreviewItem.url}
                                    controls
                                    playsInline
                                    onClick={(event) => event.stopPropagation()}
                                />
                            ) : (
                                <img
                                    className="tagged-media-edit-preview-lightbox-media"
                                    src={activePreviewItem.url}
                                    alt={activePreviewItem.label}
                                />
                            )}

                            {previewItems.length > 1 ? (
                                <div
                                    className="tagged-media-edit-preview-lightbox-nav"
                                    aria-label="Selected media preview navigation"
                                >
                                    <button
                                        type="button"
                                        className="tagged-media-edit-preview-lightbox-nav-button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            goToPreviousPreview();
                                        }}
                                        disabled={!canGoPrevPreview}
                                        aria-label="Previous selected media preview"
                                        onTouchStart={handlePreviewTouchStart}
                                        onTouchEnd={handlePreviewTouchEnd}
                                    >
                                        <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                                    </button>
                                    <p className="tagged-media-edit-preview-lightbox-counter" aria-live="polite">
                                        <strong>{normalizedPreviewIndex + 1}</strong> / {previewItems.length}
                                    </p>
                                    <button
                                        type="button"
                                        className="tagged-media-edit-preview-lightbox-nav-button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            goToNextPreview();
                                        }}
                                        disabled={!canGoNextPreview}
                                        aria-label="Next selected media preview"
                                        onTouchStart={handlePreviewTouchStart}
                                        onTouchEnd={handlePreviewTouchEnd}
                                    >
                                        <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
