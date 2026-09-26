import { useState } from "react";
import { faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { MediaFormModal } from "../../../components/media-form-modal/MediaFormModal";
import { mediaFormInputClasses } from "../../../components/media-form-modal/mediaFormStyles";

// Nombre de una regla: al crearla (initialName vacío) o al renombrarla desde el editor.
export const RuleNameModal = ({ initialName = "", isSaving = false, onSubmit, onClose }) => {
    const [name, setName] = useState(initialName);
    const isNew = !initialName;

    return (
        <MediaFormModal titleId="rule-name-title" title={isNew ? "New rule" : "Rename rule"} subtitle="Rules tag and organise media automatically" onClose={onClose} closeDisabled={isSaving} compact>
            <form
                className="flex min-h-0 flex-col"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (name.trim()) onSubmit(name.trim());
                }}
            >
                <div className="p-4 sm:p-6">
                    <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                        <span className="mb-1.5 block">Rule name</span>
                        <input className={mediaFormInputClasses} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="For example: Tag large videos" required autoFocus />
                    </label>
                </div>
                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" className={buttonClasses.secondary} onClick={onClose} disabled={isSaving}>Cancel</button>
                    <button type="submit" className={buttonClasses.primary} disabled={isSaving || !name.trim()}>
                        <FontAwesomeIcon icon={isNew ? faPlus : faCheck} aria-hidden="true" />
                        {isNew ? (isSaving ? "Creating..." : "Create rule") : "Rename"}
                    </button>
                </footer>
            </form>
        </MediaFormModal>
    );
};
