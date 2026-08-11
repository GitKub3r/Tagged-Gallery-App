import { faAnglesLeft, faAnglesRight, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const BUTTON_BASE_CLASSES =
    "flex! h-10! w-10! shrink-0! items-center! justify-center! rounded-xl! border! p-0! text-sm! font-semibold! leading-none! shadow-none! disabled:cursor-not-allowed! disabled:opacity-30! [&>svg]:block!";
const BUTTON_ACTIVE_CLASSES =
    "border-neutral-950! bg-neutral-950! text-white! hover:bg-neutral-800! dark:border-white! dark:bg-white! dark:text-neutral-950! dark:hover:bg-neutral-100!";
const BUTTON_INACTIVE_CLASSES =
    "border-neutral-300! bg-white! text-neutral-600! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-300! dark:hover:bg-neutral-800!";

export const Pagination = ({ currentPage, totalPages, onPageChange, label = "Pagination" }) => {
    if (totalPages <= 1) return null;

    const visibleCount = Math.min(3, totalPages);
    let startPage = Math.max(1, currentPage - 1);
    let endPage = startPage + visibleCount - 1;

    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - visibleCount + 1);
    }

    const pages = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
    const buttonClasses = (isActive = false) =>
        `${BUTTON_BASE_CLASSES} ${isActive ? BUTTON_ACTIVE_CLASSES : BUTTON_INACTIVE_CLASSES}`;

    return (
        <nav className="mx-auto flex w-full items-center justify-center pt-2" aria-label={label}>
            <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" className={buttonClasses()} onClick={() => onPageChange(1)} disabled={currentPage <= 1} aria-label="First page" title="First page">
                    <FontAwesomeIcon icon={faAnglesLeft} aria-hidden="true" />
                </button>
                <button type="button" className={buttonClasses()} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page" title="Previous page">
                    <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                </button>
                {pages.map((pageNumber) => (
                    <button key={pageNumber} type="button" className={buttonClasses(pageNumber === currentPage)} onClick={() => onPageChange(pageNumber)} aria-current={pageNumber === currentPage ? "page" : undefined}>
                        {pageNumber}
                    </button>
                ))}
                <button type="button" className={buttonClasses()} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page" title="Next page">
                    <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                </button>
                <button type="button" className={buttonClasses()} onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page" title="Last page">
                    <FontAwesomeIcon icon={faAnglesRight} aria-hidden="true" />
                </button>
            </div>
        </nav>
    );
};
