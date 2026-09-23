import { useState } from "react";
import { Link } from "react-router-dom";
import { faFilm, faImage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CheckboxOption } from "../../../components/checkbox-control/CheckboxOption";
import { MediaFormModal, MediaMetadataFields } from "../../../components/media-form-modal/MediaFormModal";
import { useDrivePreviews, useLinkDriveFiles } from "../../../hooks/useGoogleDrive";
import { DriveSelectionGrid } from "./DriveSelectionGrid";
import { useMediaMetadataForm } from "../../../hooks/useMediaMetadataForm";
import { useMetadata } from "../../../hooks/useMetadata";
import { applyTemplate } from "../../../utils/applyTemplate";
import { formatMediaSize } from "../../../utils/mediaFormat";
import { buildTagChipStyle } from "../../../utils/tagStyle";

const PRIMARY_BUTTON_CLASSES =
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-0 bg-neutral-950 px-5 text-sm font-bold text-white shadow-none transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white sm:w-auto";
const SECONDARY_BUTTON_CLASSES =
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-transparent px-4 text-sm font-semibold text-neutral-700 shadow-none transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:w-auto";
const FOOTER_CLASSES = "flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6";

const pluralize = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

const SKIP_REASONS = {
    not_accessible: "Tagged could not access this file",
    trashed: "The file is in the Drive trash",
    unsupported_type: "Only photos and videos can be added",
};

const DriveFileList = ({ files }) => (
    <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-neutral-200 p-1 dark:border-neutral-800" aria-label="Selected Drive files">
        {files.map((file) => (
            <li key={file.id} className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
                <FontAwesomeIcon icon={file.mimeType?.startsWith("video/") ? faFilm : faImage} className="w-4 shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file.name}>{file.name}</span>
                {file.sizeBytes ? <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">{formatMediaSize(file.sizeBytes)}</span> : null}
            </li>
        ))}
    </ul>
);

const ResultSection = ({ title, description, children }) => (
    <section className="border-t border-neutral-200 pt-4 first:border-t-0 first:pt-0 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{description}</p> : null}
        {children ? <div className="mt-3">{children}</div> : null}
    </section>
);

const DriveLinkResult = ({ result, filesById }) => (
    <div className="grid gap-4">
        <ResultSection
            title={result.linked.length > 0 ? `${pluralize(result.linked.length, "file")} added to your library` : "No new files were added"}
            description={result.linked.length > 0 ? "They stay in Google Drive. Tagged keeps a reference with your tags, albums and favourites." : null}
        />
        {result.alreadyLinked.length > 0 ? (
            <ResultSection title={`${pluralize(result.alreadyLinked.length, "file")} already in your library`} description="These Drive files were added before, so they were skipped." />
        ) : null}
        {result.duplicates.length > 0 ? (
            <ResultSection title={`${pluralize(result.duplicates.length, "file")} already uploaded to Tagged`} description="The same file exists in your library as an upload, so it was not added again.">
                <DriveFileList files={result.duplicates.map(({ driveFile }) => ({ ...driveFile, sizeBytes: driveFile.size }))} />
            </ResultSection>
        ) : null}
        {result.skipped.length > 0 ? (
            <ResultSection title={`${pluralize(result.skipped.length, "file")} could not be added`}>
                <ul className="grid gap-1 text-sm">
                    {result.skipped.map((item) => (
                        <li key={item.fileId} className="min-w-0">
                            <span className="block truncate font-semibold" title={item.name || filesById[item.fileId]?.name}>{item.name || filesById[item.fileId]?.name || "Unknown file"}</span>
                            <span className="block text-xs text-neutral-500 dark:text-neutral-400">{SKIP_REASONS[item.reason] || "Unknown reason"}</span>
                        </li>
                    ))}
                </ul>
            </ResultSection>
        ) : null}
    </div>
);

export const DriveLinkModal = ({ files, onClose }) => {
    const { metadata, tagNames, tagColorByName, tagTypeByName } = useMetadata();
    const form = useMediaMetadataForm({ metadata, tagNames });
    const [markFavourite, setMarkFavourite] = useState(false);
    const [pickedFileIds] = useState(() => files.map((file) => file.id));
    const [selectedIds, setSelectedIds] = useState(pickedFileIds);
    const previewsQuery = useDrivePreviews(pickedFileIds);
    const linkMutation = useLinkDriveFiles();
    const result = linkMutation.data;
    const filesById = Object.fromEntries(files.map((file) => [file.id, file]));
    const previewsById = Object.fromEntries((previewsQuery.data || []).map((preview) => [preview.id, preview]));
    const selectedFiles = files.filter((file) => selectedIds.includes(file.id));
    const isLinking = linkMutation.isPending;

    const removeFile = (fileId) => {
        const nextIds = selectedIds.filter((id) => id !== fileId);
        if (nextIds.length === 0) onClose();
        else setSelectedIds(nextIds);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        linkMutation.mutate({
            fileIds: selectedIds,
            displayname: form.displayName.trim(),
            author: form.author.trim(),
            tag_names: form.getTagsWithPending(),
            is_favourite: markFavourite,
        });
    };

    return (
        <MediaFormModal
            titleId="drive-link-title"
            title={result ? "Added from Google Drive" : "Add from Google Drive"}
            subtitle={`${pluralize(selectedFiles.length, "file")} selected`}
            onClose={onClose}
            closeDisabled={isLinking}
            compact
        >
            {result ? (
                <>
                    <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
                        <DriveLinkResult result={result} filesById={filesById} />
                    </div>
                    <footer className={FOOTER_CLASSES}>
                        <button type="button" className={SECONDARY_BUTTON_CLASSES} onClick={onClose}>Done</button>
                        {result.linked.length > 0 ? <Link to="/gallery" className={PRIMARY_BUTTON_CLASSES}>Go to gallery</Link> : null}
                    </footer>
                </>
            ) : (
                <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
                    <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
                        <DriveSelectionGrid
                            files={selectedFiles}
                            previewsById={previewsById}
                            isLoadingPreviews={previewsQuery.isPending}
                            disabled={isLinking}
                            onRemove={removeFile}
                        />
                        <div className="mb-4 mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                            <p className="text-sm font-semibold">Media details</p>
                            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Applied to every selected file. You can edit each one later.</p>
                        </div>
                        <MediaMetadataFields
                            {...form.fieldProps}
                            compact
                            tagColorByName={tagColorByName}
                            tagTypeByName={tagTypeByName}
                            getTagStyle={buildTagChipStyle}
                            onApplyTemplate={(template) => {
                                const applied = applyTemplate(template, { displayname: form.displayName, author: form.author, tags: form.tags });
                                form.setValues(applied);
                                setMarkFavourite(applied.markFavourite);
                            }}
                        />
                        <div className="mt-4">
                            <CheckboxOption checked={markFavourite} onChange={setMarkFavourite} disabled={isLinking} title="Mark as favourite" description="Add the selected files to your favourites." />
                        </div>
                    </div>
                    <footer className={FOOTER_CLASSES}>
                        <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASSES}
                            onClick={onClose}
                            disabled={isLinking}
                        >
                            Cancel
                        </button>
                        <button type="submit" className={PRIMARY_BUTTON_CLASSES} disabled={isLinking}>
                            {isLinking ? "Adding..." : `Add ${pluralize(selectedFiles.length, "file")}`}
                        </button>
                    </footer>
                </form>
            )}
        </MediaFormModal>
    );
};
