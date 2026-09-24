import { useEffect, useState } from "react";
import { faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createPortal } from "react-dom";
import { IconButton } from "../icon-button/IconButton";
import { mediaFormInputClasses } from "../media-form-modal/mediaFormStyles";

// Botones compactos (h-10) de DESIGN.md §4.2 para el pie de una confirmación.
const FOOTER_BUTTON_BASE =
    "inline-flex h-10 w-auto items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const CANCEL_BUTTON_CLASSES = `${FOOTER_BUTTON_BASE} border border-neutral-300 bg-transparent text-neutral-600 hover:bg-neutral-100 focus-visible:outline-neutral-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800`;
const CONFIRM_BUTTON_CLASSES = {
    danger: `${FOOTER_BUTTON_BASE} border-0 bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-500 disabled:hover:bg-red-600`,
    neutral: `${FOOTER_BUTTON_BASE} border-0 bg-neutral-950 font-bold text-white hover:bg-neutral-800 focus-visible:outline-neutral-500 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white`,
};

// Confirmación de acciones destructivas o irreversibles (DESIGN.md §7.5).
// tone="neutral" para acciones que no borran nada. requireText obliga a escribir un texto antes de confirmar,
// para acciones de gran alcance que no deben lanzarse con un clic accidental. children añade contenido
// (p. ej. un resumen) entre la descripción y el pie.
export const DeleteConfirmationModal = ({ isOpen, ...props }) => (isOpen ? <ConfirmationDialog {...props} /> : null);

// Se monta solo mientras está abierto, así cada apertura empieza sin texto escrito.
const ConfirmationDialog = ({
    title = "Delete this item?",
    description = "This action cannot be undone.",
    confirmLabel = "Delete",
    pendingLabel = "Deleting...",
    confirmIcon = faTrash,
    tone = "danger",
    requireText = "",
    confirmDisabled = false,
    isDeleting = false,
    onConfirm,
    onClose,
    children,
}) => {
    const [typedText, setTypedText] = useState("");
    const isTextConfirmed = !requireText || typedText.trim().toLowerCase() === requireText.toLowerCase();

    // Es la capa superior: atiende Escape antes que cualquier modal de debajo.
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            event.preventDefault();
            if (!isDeleting) onClose();
        };
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [isDeleting, onClose]);

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
                    <IconButton onClick={onClose} disabled={isDeleting} aria-label="Close confirmation">
                        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                    </IconButton>
                </header>

                {children || requireText ? (
                    <div className="grid gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                        {children}
                        {requireText ? (
                            <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                <span className="mb-1.5 block">
                                    Type <span className="font-bold text-neutral-950 dark:text-neutral-100">{requireText}</span> to confirm
                                </span>
                                <input
                                    className={mediaFormInputClasses}
                                    type="text"
                                    value={typedText}
                                    onChange={(event) => setTypedText(event.target.value)}
                                    disabled={isDeleting}
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                            </label>
                        ) : null}
                    </div>
                ) : null}

                <footer className="flex items-center justify-end gap-2 px-5 py-4">
                    <button type="button" className={CANCEL_BUTTON_CLASSES} onClick={onClose} disabled={isDeleting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={CONFIRM_BUTTON_CLASSES[tone] || CONFIRM_BUTTON_CLASSES.danger}
                        onClick={onConfirm}
                        disabled={isDeleting || confirmDisabled || !isTextConfirmed}
                    >
                        <FontAwesomeIcon icon={confirmIcon} aria-hidden="true" />
                        <span>{isDeleting ? pendingLabel : confirmLabel}</span>
                    </button>
                </footer>
            </section>
        </div>,
        document.body,
    );
};
