import { Skeleton } from "../../../components/loading-skeletons/Skeleton";

const PANEL_CLASSES = "rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6";

// Esqueleto con la forma del panel: cabecera con la tira de película, espacio de trabajo y actividad.
export const DashboardSkeleton = ({ label = "Loading dashboard" }) => (
    <div className="grid gap-4" role="status" aria-label={label}>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="grid gap-6 p-4 sm:p-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] 2xl:items-end">
                <div className="space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-16 w-48" /><Skeleton className="h-3 w-56" /></div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div>
            </div>
            <Skeleton className="h-44" />
        </div>
        <div className={PANEL_CLASSES}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-48" />
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div>
        </div>
        <div className={PANEL_CLASSES}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-48" />
            <Skeleton className="mt-5 h-40" />
        </div>
        <span className="sr-only">{label}</span>
    </div>
);
