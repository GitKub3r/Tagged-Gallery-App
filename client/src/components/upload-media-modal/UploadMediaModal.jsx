import { useEffect, useMemo, useRef, useState } from "react";
import {
    faArrowLeft,
    faArrowRight,
    faCloudArrowUp,
    faFile,
    faImages,
    faRotate,
    faSpinner,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../icon-button/IconButton";
import { MediaFormModal, MediaMetadataFields } from "../media-form-modal/MediaFormModal";

const getFileLabel = (file, fallbackIndex) => String(file?.name || `Media ${fallbackIndex + 1}`);
const isHeicFile = (file) => {
    const mimeType = String(file?.type || "").toLowerCase();
    const fileName = String(file?.name || "");

    return mimeType === "image/heic" || mimeType === "image/heif" || /\.hei[cf]$/i.test(fileName);
};

export const UploadMediaModal = ({
    files,
    previewUrls,
    displayNameInput,
    authorInput,
    tagInput,
    selectedTags,
    tagColorByName = {},
    tagTypeByName = {},
    activeSuggestionField,
    activeSuggestionIndex,
    displayNameSuggestions,
    authorSuggestions,
    tagSuggestions,
    isUploading,
    uploadedCount,
    uploadTotal,
    uploadProgress,
    uploadSpeedLabel,
    uploadError,
    onClose,
    onCancelUpload,
    onChangeFiles,
    onSubmit,
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
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [brokenPreviewUrl, setBrokenPreviewUrl] = useState("");
    const [convertedPreviewUrls, setConvertedPreviewUrls] = useState({});
    const [failedConversions, setFailedConversions] = useState({});
    const convertedPreviewUrlsRef = useRef(new Set());
    const touchStartRef = useRef({ x: 0, y: 0 });

    const totalFiles = files.length;
    const safePreviewIndex = Math.min(previewIndex, Math.max(totalFiles - 1, 0));
    const activeFile = files[safePreviewIndex] || null;
    const sourcePreviewUrl = previewUrls[safePreviewIndex] || "";
    const requiresPreviewConversion = isHeicFile(activeFile);
    const activePreviewUrl = requiresPreviewConversion
        ? convertedPreviewUrls[safePreviewIndex] || ""
        : sourcePreviewUrl;
    const isPreparingPreview = requiresPreviewConversion && !activePreviewUrl && !failedConversions[safePreviewIndex];
    const isPreviewBroken = Boolean(activePreviewUrl) && brokenPreviewUrl === activePreviewUrl;
    const isVideo = String(activeFile?.type || "").toLowerCase().startsWith("video/");

    const fileSummary = useMemo(() => {
        if (totalFiles === 1) {
            return getFileLabel(files[0], 0);
        }

        return `${totalFiles} files selected`;
    }, [files, totalFiles]);

    const goToPreviousPreview = () => {
        setPreviewIndex((current) => Math.max(0, current - 1));
    };

    const goToNextPreview = () => {
        setPreviewIndex((current) => Math.min(totalFiles - 1, current + 1));
    };

    useEffect(() => {
        if (!requiresPreviewConversion || convertedPreviewUrls[safePreviewIndex] || failedConversions[safePreviewIndex]) {
            return undefined;
        }

        let isCancelled = false;

        import("heic2any")
            .then(({ default: convertHeic }) => convertHeic({ blob: activeFile, toType: "image/jpeg", quality: 0.88 }))
            .then((conversionResult) => {
                const previewBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
                const convertedUrl = URL.createObjectURL(previewBlob);

                if (isCancelled) {
                    URL.revokeObjectURL(convertedUrl);
                    return;
                }

                convertedPreviewUrlsRef.current.add(convertedUrl);
                setConvertedPreviewUrls((current) => ({ ...current, [safePreviewIndex]: convertedUrl }));
            })
            .catch(() => {
                if (!isCancelled) {
                    setFailedConversions((current) => ({ ...current, [safePreviewIndex]: true }));
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [activeFile, convertedPreviewUrls, failedConversions, requiresPreviewConversion, safePreviewIndex]);

    useEffect(() => {
        const generatedUrls = convertedPreviewUrlsRef.current;

        return () => {
            generatedUrls.forEach((url) => URL.revokeObjectURL(url));
            generatedUrls.clear();
        };
    }, []);

    useEffect(() => {
        if (!isPreviewOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setIsPreviewOpen(false);
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPreviewIndex((current) => Math.max(0, current - 1));
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setPreviewIndex((current) => Math.min(totalFiles - 1, current + 1));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPreviewOpen, totalFiles]);

    const renderPreviewMedia = ({ lightbox = false } = {}) => {
        const mediaClasses = lightbox
            ? "max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-xl object-contain"
            : "h-full w-full object-contain";

        if (isPreparingPreview) {
            return (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-500">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-3xl" aria-hidden="true" />
                    <span className="text-xs font-semibold">Preparing preview</span>
                </div>
            );
        }

        if (!activePreviewUrl || isPreviewBroken) {
            return (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-500">
                    <FontAwesomeIcon icon={faFile} className="text-4xl" aria-hidden="true" />
                    <span className="max-w-[80%] truncate text-xs font-semibold">Preview unavailable</span>
                </div>
            );
        }

        if (isVideo) {
            return (
                <video
                    className={mediaClasses}
                    src={activePreviewUrl}
                    controls={lightbox}
                    muted={!lightbox}
                    playsInline
                    preload="metadata"
                    onError={() => setBrokenPreviewUrl(activePreviewUrl)}
                />
            );
        }

        return (
            <img
                className={mediaClasses}
                src={activePreviewUrl}
                alt={getFileLabel(activeFile, safePreviewIndex)}
                onError={() => setBrokenPreviewUrl(activePreviewUrl)}
            />
        );
    };

    return (
        <MediaFormModal
            titleId="upload-media-title"
            title="Upload media"
            subtitle={!isUploading ? fileSummary : ""}
            onClose={onClose}
        >
                {isUploading ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center" aria-live="polite">
                        <FontAwesomeIcon icon={faCloudArrowUp} className="text-5xl text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                        <div>
                            <p className="text-lg font-semibold">Uploading {uploadTotal === 1 ? "media" : "files"}</p>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                                {uploadedCount} of {uploadTotal} processed
                            </p>
                        </div>
                        <div className="w-full max-w-md">
                            <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                                <span className="block h-full rounded-full bg-neutral-950 transition-[width] duration-150 dark:bg-neutral-100" style={{ width: `${uploadProgress}%` }} />
                            </div>
                            <div className="mt-2 flex justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                <span>{Math.round(uploadProgress)}%</span>
                                <span>{uploadSpeedLabel || ""}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="h-10! w-auto! rounded-xl! border! border-red-500/40! bg-transparent! px-4! py-2! text-sm! font-semibold! text-red-600! shadow-none! hover:bg-red-500/10! dark:text-red-400! dark:hover:bg-red-500/10!"
                            onClick={onCancelUpload}
                        >
                            Cancel upload
                        </button>
                    </div>
                ) : (
                    <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
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
                                    displayNameSuggestions={displayNameSuggestions}
                                    authorSuggestions={authorSuggestions}
                                    tagSuggestions={tagSuggestions}
                                    error={uploadError}
                                    onDisplayNameChange={onDisplayNameChange}
                                    onAuthorChange={onAuthorChange}
                                    onTagInputChange={onTagInputChange}
                                    onOpenSuggestions={onOpenSuggestions}
                                    onCloseSuggestions={onCloseSuggestions}
                                    onSuggestionKeyDown={onSuggestionKeyDown}
                                    onSelectDisplayName={onSelectDisplayName}
                                    onSelectAuthor={onSelectAuthor}
                                    onAddTag={onAddTag}
                                    onRemoveTag={onRemoveTag}
                                    getTagStyle={getTagStyle}
                                />
                            </div>

                            <div className="relative order-1 min-h-0 overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-950 md:order-2">
                                <button
                                    type="button"
                                    className="h-full! w-full! rounded-xl! border-0! bg-transparent! p-0! shadow-none! hover:bg-transparent!"
                                    onClick={() => activePreviewUrl && setIsPreviewOpen(true)}
                                    aria-label="Open selected media preview"
                                >
                                    {renderPreviewMedia()}
                                </button>

                                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2">
                                    <span className="max-w-[65%] truncate rounded-xl bg-black/65 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                                        {getFileLabel(activeFile, safePreviewIndex)}
                                    </span>
                                    <button
                                        type="button"
                                        className="pointer-events-auto inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border-0! bg-black/65! px-3! py-1.5! text-xs! font-semibold! text-white! shadow-none! backdrop-blur-sm! hover:bg-black/80!"
                                        onClick={onChangeFiles}
                                    >
                                        <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
                                        <span>Change</span>
                                    </button>
                                </div>

                                {totalFiles > 1 ? (
                                    <>
                                        <button
                                            type="button"
                                            className="absolute! left-2! top-1/2! flex! h-10! w-10! -translate-y-1/2! items-center! justify-center! rounded-xl! border-0! bg-black/65! p-0! text-white! shadow-none! hover:bg-black/80! disabled:opacity-30!"
                                            onClick={goToPreviousPreview}
                                            disabled={safePreviewIndex === 0}
                                            aria-label="Previous selected file"
                                        >
                                            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className="absolute! right-2! top-1/2! flex! h-10! w-10! -translate-y-1/2! items-center! justify-center! rounded-xl! border-0! bg-black/65! p-0! text-white! shadow-none! hover:bg-black/80! disabled:opacity-30!"
                                            onClick={goToNextPreview}
                                            disabled={safePreviewIndex === totalFiles - 1}
                                            aria-label="Next selected file"
                                        >
                                            <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                                        </button>
                                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-xl bg-black/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                            {safePreviewIndex + 1} / {totalFiles}
                                        </span>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <footer className="flex h-16 shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 dark:border-neutral-800 sm:px-6">
                            <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex dark:text-neutral-400">
                                <FontAwesomeIcon icon={totalFiles > 1 ? faImages : faFile} aria-hidden="true" />
                                <span>{totalFiles > 1 ? "Shared metadata will apply to every file" : "Ready to upload"}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    type="button"
                                    className="h-10! w-auto! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-2! text-sm! font-semibold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!"
                                    onClick={onClose}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! py-2! text-sm! font-semibold! text-white! shadow-none! hover:bg-neutral-800! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white!"
                                >
                                    <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden="true" />
                                    <span>Upload</span>
                                </button>
                            </div>
                        </footer>
                    </form>
                )}
            {isPreviewOpen && activePreviewUrl ? (
                <div
                    className="fixed inset-0 z-[1300] flex items-center justify-center overflow-hidden bg-black/90 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Selected media preview"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setIsPreviewOpen(false);
                        }
                    }}
                    onTouchStart={(event) => {
                        const touch = event.touches?.[0];
                        if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                    }}
                    onTouchEnd={(event) => {
                        const touch = event.changedTouches?.[0];
                        if (!touch) return;
                        const deltaX = touch.clientX - touchStartRef.current.x;
                        const deltaY = touch.clientY - touchStartRef.current.y;
                        if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY)) return;
                        if (deltaX < 0) goToNextPreview();
                        else goToPreviousPreview();
                    }}
                >
                    <IconButton className="absolute! right-4! top-4! border-white/30! bg-black/70! text-white! hover:bg-black/90!" onClick={() => setIsPreviewOpen(false)} aria-label="Close selected media preview">
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </IconButton>

                    {totalFiles > 1 ? (
                        <>
                            <IconButton className="absolute! left-4! top-1/2! -translate-y-1/2! border-white/30! bg-black/70! text-white! hover:bg-black/90! disabled:opacity-30!" onClick={goToPreviousPreview} disabled={safePreviewIndex === 0} aria-label="Previous selected file">
                                <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                            </IconButton>
                            <IconButton className="absolute! right-4! top-1/2! -translate-y-1/2! border-white/30! bg-black/70! text-white! hover:bg-black/90! disabled:opacity-30!" onClick={goToNextPreview} disabled={safePreviewIndex === totalFiles - 1} aria-label="Next selected file">
                                <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                            </IconButton>
                            <span className="absolute left-4 top-4 rounded-xl bg-black/60 px-3 py-2 text-xs font-semibold text-white">
                                {safePreviewIndex + 1} / {totalFiles}
                            </span>
                        </>
                    ) : null}

                    {renderPreviewMedia({ lightbox: true })}
                </div>
            ) : null}
        </MediaFormModal>
    );
};
