import { useState } from "react";
import { UploadMediaModal } from "../../../components/upload-media-modal/UploadMediaModal";
import { useDrivePreviews, useLinkDriveFiles } from "../../../hooks/useGoogleDrive";
import { useMediaMetadataForm } from "../../../hooks/useMediaMetadataForm";
import { useMetadata } from "../../../hooks/useMetadata";
import { useScrollLock } from "../../../hooks/useScrollLock";
import { applyTemplate } from "../../../utils/applyTemplate";
import { buildTagChipStyle } from "../../../utils/tagStyle";

// Añadir archivos de Drive con el mismo modal que la subida desde el equipo.
export const DriveUploadModal = ({ files, onChangeFiles, onClose }) => {
    const { metadata, tagNames, tagColorByName, tagTypeByName } = useMetadata();
    const form = useMediaMetadataForm({ metadata, tagNames });
    const [markFavourite, setMarkFavourite] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const previewQueries = useDrivePreviews(files.map((file) => file.id), activeIndex);
    const linkMutation = useLinkDriveFiles();
    useScrollLock();
    const { processed, total } = linkMutation.progress;

    const modalFiles = files.map((file, index) => {
        const preview = previewQueries[index]?.data;
        return {
            name: preview?.name || file.name,
            type: preview?.mimeType || file.mimeType,
            size: preview?.size || file.sizeBytes,
            dimensions: preview?.dimensions || null,
        };
    });
    // undefined mientras carga (o aún no se ha pedido), "" si Drive no tiene vista previa.
    const previewUrls = previewQueries.map((query) => (query.isSuccess ? query.data?.thumbnail || "" : query.isError ? "" : undefined));

    const handleSubmit = (event) => {
        event.preventDefault();
        linkMutation.mutate(
            {
                fileIds: files.map((file) => file.id),
                details: {
                    displayname: form.displayName.trim(),
                    author: form.author.trim(),
                    tag_names: form.getTagsWithPending(),
                    is_favourite: markFavourite,
                },
            },
            { onSuccess: onClose },
        );
    };

    return (
        <UploadMediaModal
            variant="drive"
            files={modalFiles}
            previewUrls={previewUrls}
            {...form.fieldProps}
            tagColorByName={tagColorByName}
            tagTypeByName={tagTypeByName}
            getTagStyle={buildTagChipStyle}
            isUploading={linkMutation.isPending}
            uploadedCount={processed}
            uploadTotal={total || files.length}
            uploadProgress={total ? (processed / total) * 100 : 0}
            onClose={() => !linkMutation.isPending && onClose()}
            onCancelUpload={linkMutation.stop}
            onChangeFiles={onChangeFiles}
            onActiveIndexChange={setActiveIndex}
            onSubmit={handleSubmit}
            onApplyTemplate={(template) => {
                const applied = applyTemplate(template, { displayname: form.displayName, author: form.author, tags: form.tags });
                form.setValues(applied);
                setMarkFavourite(applied.markFavourite);
            }}
        />
    );
};
