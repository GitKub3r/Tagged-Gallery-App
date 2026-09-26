import { useState } from "react";
import { faEraser, faRotate, faSpinner, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { InlineNotice } from "../../../components/inline-notice/InlineNotice";
import { useMetadataMediaCount, useRemoveFromAllMedia } from "../../../hooks/useMetadata";

// Textos de cada tipo: una tag se conserva en la biblioteca; un nombre de media o un autor desaparece de la lista.
const COPY = {
    tags: {
        noun: "tag",
        text: "Takes the tag off every media that has it. The tag itself stays in your library.",
        consequences: ["The tag stays in your library, ready to use again.", "Filters and rules that use this tag stop matching these media."],
    },
    displaynames: {
        noun: "media name",
        text: "Clears it from every media that uses it, so it also disappears from this list.",
        consequences: ["Those media are left without a media name; everything else stays.", "It disappears from this list and from the suggestions."],
    },
    authors: {
        noun: "author",
        text: "Clears it from every media that uses it, so it also disappears from this list.",
        consequences: ["Those media are left without an author; everything else stays.", "It disappears from this list and from the suggestions."],
    },
};

const COMMON_CONSEQUENCES = ["Media in the trash keep it.", "This can't be undone."];

const CountSummary = ({ countQuery, copy }) => {
    if (countQuery.isPending) {
        return (
            <p className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300" role="status">
                <FontAwesomeIcon icon={faSpinner} spin className="motion-reduce:animate-none" aria-hidden="true" />
                Counting the media that use this {copy.noun}.
            </p>
        );
    }
    if (countQuery.isError) {
        return (
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-red-600 dark:text-red-400">Could not count the media.</span>
                <button type="button" className={buttonClasses.text} onClick={() => countQuery.refetch()}>
                    <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
                    Retry
                </button>
            </div>
        );
    }
    if (countQuery.data.mediaCount === 0) return <p className="text-sm font-semibold">No media use this {copy.noun}.</p>;

    return (
        <>
            <dl>
                <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950">
                    <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Media affected</dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{countQuery.data.mediaCount} media</dd>
                </div>
            </dl>
            <ul className="grid list-disc gap-1 pl-4 text-xs text-neutral-600 dark:text-neutral-300">
                {[...copy.consequences, ...COMMON_CONSEQUENCES].map((text) => <li key={text}>{text}</li>)}
            </ul>
        </>
    );
};

// "Remove from all": quita una tag, un nombre de media o un autor de todas las medias. Es una acción de gran
// alcance, igual que "Add all" en Google Drive: aviso rojo, recuento antes de confirmar y frase obligatoria.
export const RemoveFromAllMedia = ({ managerType, value, onRemoved }) => {
    const copy = COPY[managerType];
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const countQuery = useMetadataMediaCount(managerType, value, isConfirmOpen);
    const removeMutation = useRemoveFromAllMedia();
    const mediaCount = countQuery.data?.mediaCount || 0;

    const confirm = () =>
        removeMutation.mutate(
            { managerType, value, label: `“${value}”` },
            {
                onSuccess: () => {
                    setIsConfirmOpen(false);
                    onRemoved();
                },
            },
        );

    return (
        <>
            <InlineNotice
                tone="danger"
                icon={faTriangleExclamation}
                title={`Remove this ${copy.noun} from all media`}
                text={copy.text}
                action={
                    <button type="button" className={buttonClasses.dangerOutline} onClick={() => setIsConfirmOpen(true)} disabled={removeMutation.isPending}>
                        <FontAwesomeIcon icon={removeMutation.isPending ? faSpinner : faEraser} spin={removeMutation.isPending} aria-hidden="true" />
                        {removeMutation.isPending ? "Removing..." : "Remove from all"}
                    </button>
                }
            />

            <DeleteConfirmationModal
                isOpen={isConfirmOpen}
                title={`Remove “${value}” from all media?`}
                description={`This takes the ${copy.noun} off every media that uses it. Check the number before you continue.`}
                confirmLabel={mediaCount ? `Remove from ${mediaCount} media` : "Remove from all"}
                pendingLabel="Removing..."
                confirmIcon={faEraser}
                requireText={mediaCount ? `remove from ${mediaCount} media` : ""}
                confirmDisabled={!mediaCount}
                isDeleting={removeMutation.isPending}
                onConfirm={confirm}
                onClose={() => setIsConfirmOpen(false)}
            >
                <CountSummary countQuery={countQuery} copy={copy} />
            </DeleteConfirmationModal>
        </>
    );
};
