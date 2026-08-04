import { faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createPortal } from "react-dom";
import { IconButton } from "../icon-button/IconButton";

export const DeleteConfirmationModal = ({
    isOpen,
    title = "Delete this item?",
    description = "This action cannot be undone.",
    confirmLabel = "Delete",
    isDeleting = false,
    onConfirm,
    onClose,
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            aria-describedby="delete-confirmation-description"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isDeleting) onClose();
            }}
        >
            <section className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                    <div className="min-w-0">
                        <h2 id="delete-confirmation-title" className="text-lg font-semibold tracking-tight">{title}</h2>
                        <p id="delete-confirmation-description" className="mt-1 text-sm leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
                    </div>
                    <IconButton onClick={onClose} disabled={isDeleting} aria-label="Close delete confirmation">
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </IconButton>
                </header>

                <footer className="flex items-center justify-end gap-2 px-5 py-4">
                    <button type="button" className="h-10! w-auto! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-2! text-sm! font-semibold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!" onClick={onClose} disabled={isDeleting}>
                        Cancel
                    </button>
                    <button type="button" className="inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border-0! bg-red-600! px-4! py-2! text-sm! font-semibold! text-white! shadow-none! hover:bg-red-500! disabled:opacity-50!" onClick={onConfirm} disabled={isDeleting}>
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        <span>{isDeleting ? "Deleting..." : confirmLabel}</span>
                    </button>
                </footer>
            </section>
        </div>,
        document.body,
    );
};
