export const MEDIA_PICKER_PAGE_SIZE = 24;

export const MediaPickerPagination = ({
    currentPage,
    totalPages,
    totalItems,
    pageStart,
    pageEnd,
    onPreviousPage,
    onNextPage,
    disabled = false,
    className = "",
}) => {
    if (totalItems <= MEDIA_PICKER_PAGE_SIZE) {
        return null;
    }

    const safeCurrentPage = Math.min(currentPage, totalPages);

    return (
        <div className={`tagged-album-cover-pagination ${className}`.trim()}>
            <span className="tagged-album-cover-pagination-summary">
                {pageStart}-{pageEnd} of {totalItems}
            </span>
            <div className="tagged-album-cover-pagination-actions">
                <button
                    type="button"
                    className="tagged-album-cover-pagination-button"
                    onClick={onPreviousPage}
                    disabled={disabled || safeCurrentPage <= 1}
                    aria-label="Previous media page"
                    title="Previous page"
                >
                    <img src="/icons/arrow_back.svg" alt="" aria-hidden="true" />
                </button>
                <span className="tagged-album-cover-pagination-page">
                    Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                    type="button"
                    className="tagged-album-cover-pagination-button"
                    onClick={onNextPage}
                    disabled={disabled || safeCurrentPage >= totalPages}
                    aria-label="Next media page"
                    title="Next page"
                >
                    <img src="/icons/arrow_forward.svg" alt="" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};
