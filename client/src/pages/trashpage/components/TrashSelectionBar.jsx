import { faRotateLeft, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { IconButton } from "../../../components/icon-button/IconButton";

// Acciones sobre la selección, fijas abajo mientras se recorre la papelera.
export const TrashSelectionBar = ({ count, isRestoring, isBusy, onRestore, onDelete, onClear }) => (
    <div className="sticky bottom-4 z-30 mt-8 flex justify-center">
        <div
            className="flex w-full flex-col gap-2 rounded-xl border border-neutral-300 bg-white/95 p-2 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 sm:w-auto sm:flex-row sm:items-center sm:pl-4"
            role="region"
            aria-label="Selected media"
        >
            <div className="flex items-center justify-between gap-3 pl-2 sm:pl-0">
                <span className="text-sm font-semibold tabular-nums" aria-live="polite">{count} selected</span>
                <IconButton onClick={onClear} aria-label="Clear selection" title="Clear selection">
                    <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </IconButton>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
                <button type="button" className={buttonClasses.primary} onClick={onRestore} disabled={isBusy}>
                    <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
                    {isRestoring ? "Restoring..." : "Restore"}
                </button>
                <button type="button" className={buttonClasses.dangerOutline} onClick={onDelete} disabled={isBusy}>
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    Delete forever
                </button>
            </div>
        </div>
    </div>
);
