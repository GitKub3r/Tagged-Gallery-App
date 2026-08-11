export const ProgressToast = ({ data }) => {
    const progress = typeof data.progress === "number" ? Math.max(0, Math.min(100, data.progress)) : null;

    return (
        <div className="grid w-full min-w-0 gap-3 px-4 py-3 text-sm sm:px-5 sm:py-4">
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
            <div className="flex items-center justify-between gap-3 text-[0.7rem] font-semibold text-neutral-500 dark:text-neutral-400">
                <span>{data.indeterminate ? "Working…" : progress !== null ? `${Math.round(progress)}%` : ""}</span>
                <span>{data.speedLabel || ""}</span>
            </div>
        </div>
    );
};
