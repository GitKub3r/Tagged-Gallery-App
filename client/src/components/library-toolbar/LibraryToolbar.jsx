export const LibraryToolbar = ({ label, search, controls, maxWidth = "max-w-[92rem]" }) => (
    <div className={`mx-auto flex w-full ${maxWidth} flex-col gap-3 lg:flex-row lg:items-end`} aria-label={label}>
        <div className="min-w-0 flex-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            <span className="mb-2 block">{label}</span>
            {search}
        </div>
        <div className="flex w-full min-w-0 items-center gap-1.5 lg:w-auto lg:flex-wrap lg:gap-2">
            {controls}
        </div>
    </div>
);
