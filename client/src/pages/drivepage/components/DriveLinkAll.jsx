import { useState } from "react";
import { faPlus, faRotate, faSpinner, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { useLinkAllDriveFiles, useLinkAllPreview } from "../../../hooks/useGoogleDrive";
import { formatMediaSize } from "../../../utils/mediaFormat";
import { DriveNotice } from "./DriveNotice";

const pluralFiles = (count) => `${count.toLocaleString("en-US")} ${count === 1 ? "file" : "files"}`;

const CONSEQUENCES = [
    "Only My Drive is included: files shared with you and computer backups are left out.",
    "Each file gets only the Google Drive tag, with no name, author or other tags.",
    "Originals stay in Drive; Tagged only keeps their thumbnails.",
    "It can take a long time. Keep this tab open; if you stop, run Add all again to continue.",
];

const SummaryValue = ({ label, value, detail }) => (
    <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950">
        <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</dd>
        {detail ? <dd className="truncate text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{detail}</dd> : null}
    </div>
);

const LinkAllSummary = ({ previewQuery }) => {
    if (previewQuery.isPending) {
        return (
            <p className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300" role="status">
                <FontAwesomeIcon icon={faSpinner} spin className="motion-reduce:animate-none" aria-hidden="true" />
                Counting the photos and videos in your Drive. This can take a minute.
            </p>
        );
    }
    if (previewQuery.isError) {
        return (
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-red-600 dark:text-red-400">Could not count your Drive media.</span>
                <button type="button" className={buttonClasses.text} onClick={() => previewQuery.refetch()}>
                    <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
                    Retry
                </button>
            </div>
        );
    }

    const preview = previewQuery.data;
    const alreadyInTagged = preview.alreadyLinked + preview.localDuplicates;
    return (
        <>
            <dl className="grid grid-cols-2 gap-2">
                <SummaryValue label="To add" value={pluralFiles(preview.pendingCount)} detail={formatMediaSize(preview.pendingBytes)} />
                <SummaryValue label="Already in Tagged" value={pluralFiles(alreadyInTagged)} detail="Skipped" />
            </dl>
            {preview.truncated ? (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Only the first {preview.limit.toLocaleString("en-US")} photos and videos were counted. Run Add all again afterwards for the rest.
                </p>
            ) : null}
            <ul className="grid list-disc gap-1 pl-4 text-xs text-neutral-600 dark:text-neutral-300">
                {CONSEQUENCES.map((text) => <li key={text}>{text}</li>)}
            </ul>
        </>
    );
};

// "Add all": vincula todas las fotos y vídeos de Mi unidad. Es una acción de gran alcance, así que se muestra
// en rojo, enseña antes el número de archivos y su tamaño, y exige escribir una frase para confirmar.
export const DriveLinkAll = () => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const previewQuery = useLinkAllPreview(isConfirmOpen);
    const linkAllMutation = useLinkAllDriveFiles();
    const pendingCount = previewQuery.data?.pendingCount || 0;
    const { processed, total } = linkAllMutation.progress;

    const startLinking = () => {
        linkAllMutation.mutate({ fileIds: previewQuery.data.fileIds });
        setIsConfirmOpen(false);
    };

    return (
        <>
            <DriveNotice
                tone="danger"
                icon={faTriangleExclamation}
                title="Add every photo and video in My Drive"
                text="Links all of them to your library in one go, which can mean thousands of files. Use it only if you want your whole Drive in Tagged."
                action={
                    <button type="button" className={buttonClasses.dangerOutline} onClick={() => setIsConfirmOpen(true)} disabled={linkAllMutation.isPending}>
                        <FontAwesomeIcon icon={linkAllMutation.isPending ? faSpinner : faPlus} spin={linkAllMutation.isPending} aria-hidden="true" />
                        {linkAllMutation.isPending ? `Adding ${processed} of ${total}...` : "Add all"}
                    </button>
                }
            />

            <DeleteConfirmationModal
                isOpen={isConfirmOpen}
                title="Add all your Drive media?"
                description="This links every photo and video in My Drive to your library. Check the numbers before you continue."
                confirmLabel={pendingCount ? `Add ${pluralFiles(pendingCount)}` : "Add all"}
                pendingLabel="Adding..."
                confirmIcon={faPlus}
                requireText={pendingCount ? `add ${pendingCount} files` : ""}
                confirmDisabled={!pendingCount}
                onConfirm={startLinking}
                onClose={() => setIsConfirmOpen(false)}
            >
                {previewQuery.isSuccess && pendingCount === 0 ? (
                    <p className="text-sm font-semibold">Everything in My Drive is already in Tagged.</p>
                ) : (
                    <LinkAllSummary previewQuery={previewQuery} />
                )}
            </DeleteConfirmationModal>
        </>
    );
};
