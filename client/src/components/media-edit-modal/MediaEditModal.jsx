import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDefaultTagStyle, isDefaultTagColor } from "../../utils/tagStyle";
import { faArrowLeft, faArrowRight, faFile, faFloppyDisk, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../icon-button/IconButton";
import { MediaFormModal, MediaMetadataFields } from "../media-form-modal/MediaFormModal";

const MAX_SUGGESTIONS = 8;
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

export const MediaEditModal = ({
    isOpen,
    mode = "single",
    selectedCount = 0,
    initialValues,
    distinctDisplayNames = [],
    distinctAuthors = [],
    distinctTagNames = [],
    tagColorByName = {},
    tagTypeByName = {},
    selectedMediaItems = [],
    getAssetUrl = (assetPath) => String(assetPath || ""),
    isSaving = false,
    error = null,
    closeOnSave,
    onCloseOnSaveChange,
    navigation = null,
    onClose,
    onSubmit,
}) => {
    const [displayNameInput, setDisplayNameInput] = useState("");
    const [authorInput, setAuthorInput] = useState("");
    const [isDisplayNameTouched, setIsDisplayNameTouched] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [activeSuggestionField, setActiveSuggestionField] = useState(null);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isPreviewLightboxOpen, setIsPreviewLightboxOpen] = useState(false);
    const previewTouchStartRef = useRef(null);
    const previewDidSwipeRef = useRef(false);
    const externalNavigationRef = useRef(navigation);
    const lastKeyboardNavigationRef = useRef(0);
    externalNavigationRef.current = navigation;
    const initialDisplayName = String(initialValues?.displayname || "");
    const initialAuthor = String(initialValues?.author || "");
    const initialTagsKey = JSON.stringify(Array.isArray(initialValues?.tags) ? initialValues.tags : []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setDisplayNameInput(initialDisplayName);
        setAuthorInput(initialAuthor);
        setIsDisplayNameTouched(false);
        setTagInput("");
        setSelectedTags(JSON.parse(initialTagsKey));
        setActiveSuggestionField(null);
        setActiveSuggestionIndex(0);
        setPreviewIndex(0);
        setIsPreviewLightboxOpen(false);
    }, [isOpen, initialDisplayName, initialAuthor, initialTagsKey]);

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
                const mediaIsVideo = isVideoLike(media);
                const previewPath = mediaIsVideo ? filePath || thumbPath : thumbPath || filePath;
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

                const posterUrl = thumbPath
                    ? thumbPath.startsWith("http://") || thumbPath.startsWith("https://")
                        ? thumbPath
                        : getAssetUrl(thumbPath)
                    : "";

                return {
                    id: media?.id || previewUrl,
                    url: previewUrl,
                    posterUrl,
                    isVideo: mediaIsVideo,
                    label: String(media?.displayname || media?.filename || media?.id || "Media").trim(),
                };
            })
            .filter(Boolean);
    }, [selectedMediaItems, getAssetUrl]);

    const normalizedPreviewIndex = Math.min(previewIndex, Math.max(previewItems.length - 1, 0));
    const activePreviewItem = previewItems[normalizedPreviewIndex] || null;
    const hasExternalNavigation = Boolean(navigation);
    const canGoPrevPreview = hasExternalNavigation ? Boolean(navigation?.hasPrevious) : normalizedPreviewIndex > 0;
    const canGoNextPreview = hasExternalNavigation ? Boolean(navigation?.hasNext) : normalizedPreviewIndex < previewItems.length - 1;
    const navigationCount = hasExternalNavigation ? Number(navigation?.total || 0) : previewItems.length;
    const navigationPosition = hasExternalNavigation ? Number(navigation?.current || 0) : normalizedPreviewIndex + 1;

    const goToPreviousPreview = useCallback(() => {
        if (!canGoPrevPreview) {
            return;
        }

        if (hasExternalNavigation) {
            navigation.onPrevious?.();
            return;
        }

        setPreviewIndex((previous) => Math.max(previous - 1, 0));
    }, [canGoPrevPreview, hasExternalNavigation, navigation]);

    const goToNextPreview = useCallback(() => {
        if (!canGoNextPreview) {
            return;
        }

        if (hasExternalNavigation) {
            navigation.onNext?.();
            return;
        }

        setPreviewIndex((previous) => Math.min(previous + 1, previewItems.length - 1));
    }, [canGoNextPreview, hasExternalNavigation, navigation, previewItems.length]);

    const handlePreviewPointerDown = (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        previewTouchStartRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: Date.now(),
        };
        previewDidSwipeRef.current = false;
    };

    const handlePreviewPointerUp = (event) => {
        const start = previewTouchStartRef.current;

        previewTouchStartRef.current = null;

        if (!start || start.pointerId !== event.pointerId || navigationCount < 2) {
            return;
        }

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        const elapsed = Date.now() - start.time;

        if (elapsed > 700 || Math.abs(deltaX) < 45 || Math.abs(deltaY) > 80) {
            return;
        }

        previewDidSwipeRef.current = true;

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

        if (!isMultiMode || isDisplayNameTouched || displayNameInput.trim() !== "") {
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
        if (!isOpen || navigationCount < 2) {
            return undefined;
        }

        const handleWindowKeyDown = (event) => {
            if (isSaving || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
                return;
            }

            if (hasExternalNavigation) {
                event.preventDefault();
                event.stopPropagation();

                const now = Date.now();
                if (event.repeat && now - lastKeyboardNavigationRef.current < 90) return;
                lastKeyboardNavigationRef.current = now;

                const currentNavigation = externalNavigationRef.current;
                if (event.key === "ArrowLeft" && currentNavigation?.hasPrevious) {
                    currentNavigation.onPrevious?.();
                } else if (event.key === "ArrowRight" && currentNavigation?.hasNext) {
                    currentNavigation.onNext?.();
                }
                return;
            }

            if (activeSuggestionField) return;

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

        window.addEventListener("keydown", handleWindowKeyDown, true);

        return () => {
            window.removeEventListener("keydown", handleWindowKeyDown, true);
        };
    }, [isOpen, hasExternalNavigation, navigationCount, isSaving, activeSuggestionField, canGoPrevPreview, canGoNextPreview, goToPreviousPreview, goToNextPreview]);

    if (!isOpen) {
        return null;
    }

    const submitLabel = isSaving ? "Saving..." : isMultiMode ? "Save selected media" : "Save changes";
    const subtitle = isMultiMode
        ? String(selectedCount) + " media selected"
        : activePreviewItem?.label || "Selected media";

    const handleFieldKeyDown = (event, field) => {
        if (field === "displayname") {
            handleSuggestionKeyboard(event, field, visibleDisplayNameSuggestions, (value) => {
                setIsDisplayNameTouched(true);
                setDisplayNameInput(value || "");
                closeSuggestions();
            });
            return;
        }

        if (field === "author") {
            handleSuggestionKeyboard(event, field, visibleAuthorSuggestions, (value) => {
                setAuthorInput(value || "");
                closeSuggestions();
            });
            return;
        }

        handleSuggestionKeyboard(
            event,
            field,
            visibleTagSuggestions,
            addTag,
            () => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addTag(tagInput);
                }
            },
        );
    };

    const renderActivePreview = ({ lightbox = false } = {}) => {
        if (!activePreviewItem) {
            return (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500">
                    <FontAwesomeIcon icon={faFile} className="text-4xl" aria-hidden="true" />
                    <span className="text-xs font-semibold">Preview unavailable</span>
                </div>
            );
        }

        const mediaClassName = lightbox
            ? "max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-xl object-contain"
            : "h-full w-full object-contain";

        return activePreviewItem.isVideo ? (
            <video
                className={mediaClassName}
                src={activePreviewItem.url}
                poster={activePreviewItem.posterUrl || undefined}
                muted={!lightbox}
                controls={lightbox}
                playsInline
                preload="metadata"
            />
        ) : (
            <img className={mediaClassName} src={activePreviewItem.url} alt={activePreviewItem.label} />
        );
    };

    return (
        <MediaFormModal
            titleId="edit-media-title"
            title="Edit media"
            subtitle={subtitle}
            onClose={handleCloseModal}
            closeDisabled={isSaving}
        >
            <form className="flex min-h-0 flex-1 flex-col" id="tagged-media-edit-form" onSubmit={handleSubmit}>
                <div className="grid min-h-0 flex-1 grid-rows-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] md:grid-rows-1 md:p-6">
                    <div className="order-2 min-h-0 md:order-1">
                        <MediaMetadataFields
                            displayNameInput={displayNameInput}
                            authorInput={authorInput}
                            tagInput={tagInput}
                            selectedTags={selectedTags}
                            tagColorByName={tagColorByName}
                            tagTypeByName={tagTypeByName}
                            activeSuggestionField={activeSuggestionField}
                            activeSuggestionIndex={activeSuggestionIndex}
                            displayNameSuggestions={visibleDisplayNameSuggestions}
                            authorSuggestions={visibleAuthorSuggestions}
                            tagSuggestions={visibleTagSuggestions}
                            displayNamePlaceholder={isMultiMode ? "Keep existing values" : "Undefined"}
                            authorPlaceholder={isMultiMode ? "Keep existing values" : "Optional"}
                            error={error}
                            onDisplayNameChange={(event) => {
                                setIsDisplayNameTouched(true);
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
                            onSuggestionKeyDown={handleFieldKeyDown}
                            onSelectDisplayName={(value) => {
                                setIsDisplayNameTouched(true);
                                setDisplayNameInput(value || "");
                                closeSuggestions();
                            }}
                            onSelectAuthor={(value) => {
                                setAuthorInput(value || "");
                                closeSuggestions();
                            }}
                            onAddTag={addTag}
                            onRemoveTag={removeTag}
                            getTagStyle={buildTagStyle}
                        />

                        {isMultiMode && (tagsToAddPreview.length > 0 || tagsToRemovePreview.length > 0) ? (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                {tagsToAddPreview.length > 0 ? <span>Add {tagsToAddPreview.length} tag(s)</span> : null}
                                {tagsToRemovePreview.length > 0 ? <span>Remove {tagsToRemovePreview.length} tag(s)</span> : null}
                            </div>
                        ) : null}
                    </div>

                    <div
                        className="relative order-1 min-h-0 touch-pan-y overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-950 md:order-2"
                        onPointerDown={handlePreviewPointerDown}
                        onPointerUp={handlePreviewPointerUp}
                        onPointerCancel={() => { previewTouchStartRef.current = null; }}
                    >
                        <button
                            type="button"
                            className="h-full! w-full! rounded-xl! border-0! bg-transparent! p-0! shadow-none! hover:bg-transparent!"
                            onClick={() => {
                                if (previewDidSwipeRef.current) {
                                    previewDidSwipeRef.current = false;
                                    return;
                                }
                                if (activePreviewItem) setIsPreviewLightboxOpen(true);
                            }}
                            aria-label="Open selected media preview"
                        >
                            {renderActivePreview()}
                        </button>

                        {activePreviewItem ? (
                            <span className="pointer-events-none absolute left-2 top-2 max-w-[65%] truncate rounded-xl bg-black/65 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                                {activePreviewItem.label}
                            </span>
                        ) : null}

                        {navigationCount > 1 ? (
                            <>
                                <IconButton className="absolute left-2 top-1/2 -translate-y-1/2 border-white/20 bg-black/65 text-white hover:bg-black/80 disabled:opacity-30" onClick={goToPreviousPreview} disabled={!canGoPrevPreview} aria-label="Previous media">
                                    <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                                </IconButton>
                                <IconButton className="absolute right-2 top-1/2 -translate-y-1/2 border-white/20 bg-black/65 text-white hover:bg-black/80 disabled:opacity-30" onClick={goToNextPreview} disabled={!canGoNextPreview} aria-label="Next media">
                                    <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                                </IconButton>
                                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-xl bg-black/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                    {navigationPosition} / {navigationCount}
                                </span>
                            </>
                        ) : null}
                    </div>
                </div>

                <footer className="flex h-16 shrink-0 items-center justify-between gap-2 border-t border-neutral-200 px-3 dark:border-neutral-800 sm:gap-3 sm:px-6">
                    {typeof onCloseOnSaveChange === "function" ? (
                        <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-neutral-950 dark:accent-neutral-100"
                                checked={Boolean(closeOnSave)}
                                onChange={(event) => onCloseOnSaveChange(event.target.checked)}
                                disabled={isSaving}
                            />
                            <span>Close on save</span>
                        </label>
                    ) : <span />}

                    <div className="ml-auto flex items-center gap-2">
                        <button type="button" className="h-10! w-auto! whitespace-nowrap! rounded-xl! border! border-neutral-300! bg-transparent! px-3! py-2! text-sm! font-semibold! text-neutral-600! shadow-none! hover:bg-neutral-100! sm:px-4! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!" onClick={handleCloseModal} disabled={isSaving}>
                            Cancel
                        </button>
                        <button type="submit" className="inline-flex! h-10! w-auto! items-center! gap-2! whitespace-nowrap! rounded-xl! border-0! bg-neutral-950! px-3! py-2! text-sm! font-semibold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! sm:px-4! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white!" disabled={isSaving}>
                            <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                            <span>{submitLabel}</span>
                        </button>
                    </div>
                </footer>
            </form>

            {isPreviewLightboxOpen && activePreviewItem ? (
                <div
                    className="fixed inset-0 z-[1300] flex items-center justify-center overflow-hidden bg-black/90 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Selected media preview"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsPreviewLightboxOpen(false);
                    }}
                    onPointerDown={handlePreviewPointerDown}
                    onPointerUp={handlePreviewPointerUp}
                    onPointerCancel={() => { previewTouchStartRef.current = null; }}
                >
                    <IconButton className="absolute right-4 top-4 border-white/30 bg-black/60 text-white hover:bg-black/80" onClick={() => setIsPreviewLightboxOpen(false)} aria-label="Close selected media preview">
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </IconButton>
                    {navigationCount > 1 ? (
                        <>
                            <IconButton className="absolute left-4 top-1/2 -translate-y-1/2 border-white/30 bg-black/60 text-white hover:bg-black/80 disabled:opacity-30" onClick={goToPreviousPreview} disabled={!canGoPrevPreview} aria-label="Previous media">
                                <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                            </IconButton>
                            <IconButton className="absolute right-4 top-1/2 -translate-y-1/2 border-white/30 bg-black/60 text-white hover:bg-black/80 disabled:opacity-30" onClick={goToNextPreview} disabled={!canGoNextPreview} aria-label="Next media">
                                <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                            </IconButton>
                        </>
                    ) : null}
                    {renderActivePreview({ lightbox: true })}
                </div>
            ) : null}
        </MediaFormModal>
    );
};
