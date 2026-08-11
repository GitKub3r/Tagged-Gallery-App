export const ProgressToast = ({ data, onCancel }) => {
    const progress = typeof data.progress === "number" ? Math.max(0, Math.min(100, data.progress)) : null;

    return (
        <div className="grid w-[min(24rem,calc(100vw-2rem))] min-w-0 gap-3 px-4 py-3 text-sm sm:px-5 sm:py-4">
            <div>
                <strong className="block font-bold text-neutral-950 dark:text-neutral-100">{data.title}</strong>
                {data.message ? <p className="mt-1 break-words text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.message}</p> : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" aria-hidden="true">
                <span
                    className={`block h-full rounded-full bg-neutral-950 transition-[width] dark:bg-white ${data.indeterminate ? "w-1/3 animate-pulse" : ""}`}
                    style={data.indeterminate ? undefined : { width: `${progress ?? 0}%` }}
                />
            </div>
            <div className="flex items-center gap-3 text-[0.7rem] font-semibold text-neutral-500 dark:text-neutral-400">
                <span>{data.indeterminate ? "Working…" : progress !== null ? `${Math.round(progress)}%` : ""}</span>
                <span className="ml-auto">{data.speedLabel || ""}</span>
                {onCancel ? (
                    <button
                        type="button"
                        className="h-7! w-auto! rounded-xl! border! border-neutral-300! bg-transparent! px-2.5! py-0! text-[0.7rem]! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                ) : null}
            </div>
        </div>
    );
};
