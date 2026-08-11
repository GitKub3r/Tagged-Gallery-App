import { Skeleton } from "./Skeleton";

const rows = Array.from({ length: 7 }, (_, index) => index);

export const PageLoadingSkeleton = ({ variant = "admin", ariaLabel = "Loading page" }) => (
    <div className="w-full" role="status" aria-live="polite" aria-label={ariaLabel}>
        {variant === "detail" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Skeleton className="aspect-[4/3] min-h-72 w-full" />
                <div className="space-y-5 py-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-px w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-28 w-full" /></div>
            </div>
        ) : (
            <div className="space-y-4">
                {variant !== "list" ? <div className={`grid gap-3 ${variant === "dashboard" ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>
                    {Array.from({ length: variant === "dashboard" ? 4 : 3 }, (_, index) => <div key={index} className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-9 w-16" /><Skeleton className="mt-3 h-3 w-36" /></div>)}
                </div> : null}
                <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 flex gap-2"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 w-28" /><Skeleton className="h-11 w-24" /></div>
                    <div className="space-y-1">{rows.map((row) => <div key={row} className="flex items-center gap-4 border-b border-neutral-200/70 py-4 last:border-0 dark:border-neutral-800/70"><Skeleton className="h-9 w-9 shrink-0" /><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-7 w-20 rounded-full" /></div>)}</div>
                </div>
            </div>
        )}
        <span className="sr-only">{ariaLabel}</span>
    </div>
);
