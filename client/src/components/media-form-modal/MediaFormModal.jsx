import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faLock, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getTagIcon } from "../../utils/tagIcon";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../icon-button/IconButton";
import { ErrorToast } from "../toast/ErrorToast";
import { TemplateSelector } from "../template-selector/TemplateSelector";
import { mediaFormInputClasses } from "./mediaFormStyles";

const MediaSuggestionList = ({ items, activeIndex, onSelect }) => {
    if (!items.length) return null;

    return (
        <ul className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 grid gap-1 rounded-xl border border-neutral-300 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="listbox">
            {items.slice(0, 8).map((item, index) => (
                <li key={item}>
                    <button
                        type="button"
                        className={`min-h-9! w-full! rounded-xl! border-0! bg-transparent! px-3! py-1.5! text-left! text-sm! font-medium! text-neutral-700! shadow-none! hover:bg-neutral-100! dark:text-neutral-200! dark:hover:bg-neutral-800! ${index === activeIndex ? "bg-neutral-100! dark:bg-neutral-800!" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onSelect(item)}
                    >
                        {item}
                    </button>
                </li>
            ))}
        </ul>
    );
};

// layer="nested": modal abierto desde otro modal (z-[1300]). Atiende Escape antes que el modal de debajo
// (fase de captura) y lo marca como gestionado para que solo se cierre el de arriba.
export const MediaFormModal = ({ titleId, title, subtitle, onClose, closeDisabled = false, compact = false, layer = "base", children }) => {
    const isNested = layer === "nested";

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            if (isNested) event.preventDefault();
            if (!closeDisabled) onClose();
        };

        window.addEventListener("keydown", handleKeyDown, isNested);
        return () => window.removeEventListener("keydown", handleKeyDown, isNested);
    }, [closeDisabled, isNested, onClose]);

    return createPortal(
        <div
        className={`fixed inset-0 ${isNested ? "z-[1300]" : "z-[1200]"} flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => {
            if (event.target === event.currentTarget && !closeDisabled) onClose();
        }}
    >
        <section className={`flex w-full flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 ${compact ? "max-h-[calc(100dvh-1rem)] max-w-2xl sm:max-h-[calc(100dvh-2rem)]" : "h-[calc(100dvh-1rem)] max-w-5xl sm:h-[min(44rem,calc(100dvh-2rem))]"}`}>
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                <div className="min-w-0">
                    <h2 id={titleId} className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
                    {subtitle ? <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p> : null}
                </div>
                <IconButton onClick={onClose} disabled={closeDisabled} aria-label={`Close ${title.toLowerCase()} modal`}>
                    <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </IconButton>
            </header>
            {children}
        </section>
        </div>,
        document.body,
    );
};

// Campo de texto con sugerencias (nombre de media, autor...). field identifica la lista de sugerencias activa.
export const MetadataSuggestionField = ({
    label,
    field,
    value,
    maxLength,
    placeholder,
    autoFocus = false,
    suggestions = [],
    activeSuggestionField,
    activeSuggestionIndex,
    onChange,
    onSelect,
    onOpenSuggestions,
    onCloseSuggestions,
    onSuggestionKeyDown,
}) => (
    <label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span className="mb-1.5 block">{label}</span>
        <div className="relative">
            <input className={mediaFormInputClasses} type="text" maxLength={maxLength} value={value} onChange={onChange} onFocus={() => onOpenSuggestions(field)} onBlur={onCloseSuggestions} onKeyDown={(event) => onSuggestionKeyDown(event, field)} placeholder={placeholder} autoFocus={autoFocus} />
            {activeSuggestionField === field ? <MediaSuggestionList items={suggestions} activeIndex={activeSuggestionIndex} onSelect={onSelect} /> : null}
        </div>
    </label>
);

// Campo de tags con sugerencias y la lista de tags elegidas (se quitan con un clic).
export const MediaTagsField = ({
    label = "Tags",
    tagInput,
    selectedTags,
    tagColorByName = {},
    tagTypeByName = {},
    existingTagNames = [],
    activeSuggestionField,
    activeSuggestionIndex,
    tagSuggestions = [],
    tagPlaceholder = "Type a tag and press Enter",
    autoFocus = false,
    onTagInputChange,
    onOpenSuggestions,
    onCloseSuggestions,
    onSuggestionKeyDown,
    onAddTag,
    onRemoveTag,
    getTagStyle,
    // Tags que no se pueden quitar (p. ej. "Google Drive" en medias de Drive). Se muestran primero, con candado.
    lockedTags = [],
    compact = false,
}) => {
    const lockedTagKeys = new Set(lockedTags.map((tag) => String(tag).trim().toLowerCase()));
    const removableTags = selectedTags.filter((tag) => !lockedTagKeys.has(String(tag).trim().toLowerCase()));
    const selectedTagCount = lockedTags.length + removableTags.length;
    const selectedTagsContainerRef = useRef(null);
    const existingTagNameSet = new Set(existingTagNames.map((tag) => String(tag).trim().toLowerCase()));

    useEffect(() => {
        const container = selectedTagsContainerRef.current;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }, [selectedTags.length]);

    return (
        <>
            <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                <span className="mb-1.5 flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <span className="font-medium tabular-nums text-neutral-400 dark:text-neutral-500">
                        {selectedTagCount} selected
                    </span>
                </span>
                <div className="relative">
                    <input className={mediaFormInputClasses} type="text" maxLength={100} value={tagInput} onChange={onTagInputChange} onFocus={() => onOpenSuggestions("tag")} onBlur={onCloseSuggestions} onKeyDown={(event) => onSuggestionKeyDown(event, "tag")} placeholder={tagPlaceholder} autoFocus={autoFocus} />
                    {activeSuggestionField === "tag" ? <MediaSuggestionList items={tagSuggestions} activeIndex={activeSuggestionIndex} onSelect={onAddTag} /> : null}
                </div>
            </label>

            <div
                ref={selectedTagsContainerRef}
                className={`flex min-h-9 max-h-28 touch-pan-y flex-wrap content-start items-center gap-2 overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-neutral-100/60 p-2 pr-1 [scrollbar-gutter:stable] dark:border-neutral-800 dark:bg-neutral-950/50 ${compact ? "" : "md:min-h-32 md:max-h-none md:flex-1"}`}
                aria-label={`Selected tags, ${selectedTagCount} selected`}
            >
                {lockedTags.map((tag) => (
                    <span
                        key={tag}
                        className="inline-flex h-8 max-w-36 shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1 text-xs font-semibold"
                        style={getTagStyle(tagColorByName[String(tag).trim().toLowerCase()])}
                        title="Added automatically to media from Google Drive"
                    >
                        <FontAwesomeIcon icon={faGoogleDrive} aria-hidden="true" />
                        <span className="truncate">{tag}</span>
                        <FontAwesomeIcon icon={faLock} className="opacity-70" aria-hidden="true" />
                        <span className="sr-only">(can't be removed)</span>
                    </span>
                ))}
                {removableTags.map((tag) => (
                    <button key={tag} type="button" className="inline-flex! h-8! w-auto! max-w-36! shrink-0! items-center! gap-2! rounded-xl! border! px-2.5! py-1! text-xs! font-semibold! shadow-none! hover:opacity-80!" style={getTagStyle(tagColorByName[String(tag).trim().toLowerCase()])} onClick={() => onRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>
                        <FontAwesomeIcon icon={getTagIcon(existingTagNameSet.has(String(tag).trim().toLowerCase()), tagTypeByName[String(tag).trim().toLowerCase()])} aria-hidden="true" />
                        <span className="truncate">{tag}</span>
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </button>
                ))}
                {selectedTagCount === 0 ? <span className="text-xs text-neutral-400 dark:text-neutral-600">No tags selected</span> : null}
            </div>
        </>
    );
};

export const MediaMetadataFields = ({
    displayNameInput,
    authorInput,
    displayNameSuggestions = [],
    authorSuggestions = [],
    displayNamePlaceholder = "Undefined",
    authorPlaceholder = "Optional",
    autoFocusDisplayName = false,
    error,
    onDisplayNameChange,
    onAuthorChange,
    onSelectDisplayName,
    onSelectAuthor,
    onApplyTemplate,
    templateResetKey,
    compact = false,
    ...tagFieldProps
}) => {
    const suggestionProps = {
        activeSuggestionField: tagFieldProps.activeSuggestionField,
        activeSuggestionIndex: tagFieldProps.activeSuggestionIndex,
        onOpenSuggestions: tagFieldProps.onOpenSuggestions,
        onCloseSuggestions: tagFieldProps.onCloseSuggestions,
        onSuggestionKeyDown: tagFieldProps.onSuggestionKeyDown,
    };

    return (
    <div className={`flex flex-col justify-start gap-3 ${compact ? "" : "min-h-full"}`}>
        {onApplyTemplate ? <TemplateSelector key={templateResetKey} onApply={onApplyTemplate} /> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetadataSuggestionField {...suggestionProps} label="Media name" field="displayname" value={displayNameInput} maxLength={255} placeholder={displayNamePlaceholder} autoFocus={autoFocusDisplayName} suggestions={displayNameSuggestions} onChange={onDisplayNameChange} onSelect={onSelectDisplayName} />
            <MetadataSuggestionField {...suggestionProps} label="Author" field="author" value={authorInput} maxLength={100} placeholder={authorPlaceholder} suggestions={authorSuggestions} onChange={onAuthorChange} onSelect={onSelectAuthor} />
        </div>

        <MediaTagsField {...tagFieldProps} compact={compact} />

        <ErrorToast message={error} />
    </div>
    );
};
