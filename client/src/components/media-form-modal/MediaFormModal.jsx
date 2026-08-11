import { faCopyright, faTag, faWandMagicSparkles, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../icon-button/IconButton";
import { ErrorToast } from "../toast/ErrorToast";

export const mediaFormInputClasses =
    "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-neutral-500";

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

export const MediaFormModal = ({ titleId, title, subtitle, onClose, closeDisabled = false, children }) => {
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !closeDisabled) onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [closeDisabled, onClose]);

    return createPortal(
        <div
        className="fixed inset-0 z-[1200] flex items-center justify-center overflow-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => {
            if (event.target === event.currentTarget && !closeDisabled) onClose();
        }}
    >
        <section className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl sm:h-[min(44rem,calc(100dvh-2rem))] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
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

export const MediaMetadataFields = ({
    displayNameInput,
    authorInput,
    tagInput,
    selectedTags,
    tagColorByName = {},
    tagTypeByName = {},
    existingTagNames = [],
    activeSuggestionField,
    activeSuggestionIndex,
    displayNameSuggestions = [],
    authorSuggestions = [],
    tagSuggestions = [],
    displayNamePlaceholder = "Undefined",
    authorPlaceholder = "Optional",
    tagPlaceholder = "Type a tag and press Enter",
    error,
    onDisplayNameChange,
    onAuthorChange,
    onTagInputChange,
    onOpenSuggestions,
    onCloseSuggestions,
    onSuggestionKeyDown,
    onSelectDisplayName,
    onSelectAuthor,
    onAddTag,
    onRemoveTag,
    getTagStyle,
}) => {
    const selectedTagsContainerRef = useRef(null);
    const existingTagNameSet = new Set(existingTagNames.map((tag) => String(tag).trim().toLowerCase()));

    useEffect(() => {
        const container = selectedTagsContainerRef.current;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }, [selectedTags.length]);

    return (
    <div className="flex h-full min-h-0 flex-col justify-start gap-3">
        <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                <span className="mb-1.5 block">Media name</span>
                <div className="relative">
                    <input className={mediaFormInputClasses} type="text" value={displayNameInput} onChange={onDisplayNameChange} onFocus={() => onOpenSuggestions("displayname")} onBlur={onCloseSuggestions} onKeyDown={(event) => onSuggestionKeyDown(event, "displayname")} placeholder={displayNamePlaceholder} />
                    {activeSuggestionField === "displayname" ? <MediaSuggestionList items={displayNameSuggestions} activeIndex={activeSuggestionIndex} onSelect={onSelectDisplayName} /> : null}
                </div>
            </label>

            <label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                <span className="mb-1.5 block">Author</span>
                <div className="relative">
                    <input className={mediaFormInputClasses} type="text" value={authorInput} onChange={onAuthorChange} onFocus={() => onOpenSuggestions("author")} onBlur={onCloseSuggestions} onKeyDown={(event) => onSuggestionKeyDown(event, "author")} placeholder={authorPlaceholder} />
                    {activeSuggestionField === "author" ? <MediaSuggestionList items={authorSuggestions} activeIndex={activeSuggestionIndex} onSelect={onSelectAuthor} /> : null}
                </div>
            </label>
        </div>

        <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            <span className="mb-1.5 flex items-center justify-between gap-3">
                <span>Tags</span>
                <span className="font-medium tabular-nums text-neutral-400 dark:text-neutral-500">
                    {selectedTags.length} selected
                </span>
            </span>
            <div className="relative">
                <input className={mediaFormInputClasses} type="text" value={tagInput} onChange={onTagInputChange} onFocus={() => onOpenSuggestions("tag")} onBlur={onCloseSuggestions} onKeyDown={(event) => onSuggestionKeyDown(event, "tag")} placeholder={tagPlaceholder} />
                {activeSuggestionField === "tag" ? <MediaSuggestionList items={tagSuggestions} activeIndex={activeSuggestionIndex} onSelect={onAddTag} /> : null}
            </div>
        </label>

        <div
            ref={selectedTagsContainerRef}
            className="flex min-h-9 max-h-28 touch-pan-y flex-wrap content-start items-center gap-2 overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-neutral-100/60 p-2 pr-1 [scrollbar-gutter:stable] md:min-h-32 md:max-h-none md:flex-1 dark:border-neutral-800 dark:bg-neutral-950/50"
            aria-label={`Selected tags, ${selectedTags.length} selected`}
        >
            {selectedTags.map((tag) => (
                <button key={tag} type="button" className="inline-flex! h-8! w-auto! max-w-36! shrink-0! items-center! gap-2! rounded-xl! border! px-2.5! py-1! text-xs! font-semibold! shadow-none! hover:opacity-80!" style={getTagStyle(tagColorByName[String(tag).trim().toLowerCase()])} onClick={() => onRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>
                    <FontAwesomeIcon icon={!existingTagNameSet.has(String(tag).trim().toLowerCase()) ? faWandMagicSparkles : tagTypeByName[String(tag).trim().toLowerCase()] === "copyright" ? faCopyright : faTag} aria-hidden="true" />
                    <span className="truncate">{tag}</span>
                    <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
            ))}
            {selectedTags.length === 0 ? <span className="text-xs text-neutral-400 dark:text-neutral-600">No tags selected</span> : null}
        </div>

        <ErrorToast message={error} />
    </div>
    );
};
