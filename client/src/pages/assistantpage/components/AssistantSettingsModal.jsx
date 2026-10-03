import { useState } from "react";
import { faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { MediaFormModal, MediaTagsField } from "../../../components/media-form-modal/MediaFormModal";
import { SegmentedControl } from "../../../components/segmented-control/SegmentedControl";
import { useUpdateAiSettings } from "../../../hooks/useAiAssistant";
import { useMediaMetadataForm } from "../../../hooks/useMediaMetadataForm";
import { useMetadata } from "../../../hooks/useMetadata";
import { useScrollLock } from "../../../hooks/useScrollLock";
import { buildTagChipStyle } from "../../../utils/tagStyle";
import { STRICTNESS_LEVELS, getStrictnessLevel } from "./strictnessLevels";

export const AssistantSettingsModal = ({ settings, onClose }) => {
    const { metadata, tagNames, tagColorByName, tagTypeByName } = useMetadata();
    const [strictness, setStrictness] = useState(settings.strictness);
    const form = useMediaMetadataForm({ metadata, tagNames, initialValues: { tags: settings.excludedTags } });
    const updateMutation = useUpdateAiSettings();
    useScrollLock();

    const handleSubmit = (event) => {
        event.preventDefault();
        updateMutation.mutate({ strictness, excludedTags: form.getTagsWithPending() }, { onSuccess: onClose });
    };

    return (
        <MediaFormModal titleId="ai-settings-title" title="AI settings" subtitle="Used every time the assistant adds tags" onClose={onClose} closeDisabled={updateMutation.isPending} compact>
            <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
                <div className="grid min-h-0 content-start gap-5 overflow-y-auto p-4 sm:p-6">
                    <div>
                        <p className="mb-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">Confidence</p>
                        <SegmentedControl ariaLabel="Confidence" options={STRICTNESS_LEVELS} value={strictness} onChange={setStrictness} />
                        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400" aria-live="polite">
                            <span className="font-semibold text-neutral-600 dark:text-neutral-300">{getStrictnessLevel(strictness).label}:</span> {getStrictnessLevel(strictness).description}
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <MediaTagsField
                            {...form.fieldProps}
                            label="Never add these tags"
                            existingTagNames={tagNames}
                            tagColorByName={tagColorByName}
                            tagTypeByName={tagTypeByName}
                            getTagStyle={buildTagChipStyle}
                            compact
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">For tags that depend on things the image can&apos;t show, like where or when it was taken.</p>
                    </div>
                </div>
                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" className={buttonClasses.secondary} onClick={onClose} disabled={updateMutation.isPending}>Cancel</button>
                    <button type="submit" className={buttonClasses.primary} disabled={updateMutation.isPending}>
                        <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                        {updateMutation.isPending ? "Saving..." : "Save settings"}
                    </button>
                </footer>
            </form>
        </MediaFormModal>
    );
};
