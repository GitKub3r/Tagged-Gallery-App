import { Navigate } from "react-router-dom";
import { CollectionLoadingSkeleton } from "../../components/loading-skeletons/CollectionLoadingSkeleton";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { Skeleton } from "../../components/loading-skeletons/Skeleton";
import { useAuth } from "../../hooks/useAuth";
import { useDevTools } from "../../hooks/useDevTools";

export const DeveloperPage = () => {
    const { user } = useAuth();
    const { forceLoading, setForceLoading } = useDevTools();
    if (user?.type !== "dev") return <Navigate to="/gallery" replace />;

    return <section className="mx-auto w-full max-w-[92rem] space-y-8">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800"><div><p className="text-xs font-black uppercase tracking-widest text-neutral-500">Developer tools</p><h1 className="mt-1 text-3xl font-bold text-neutral-950 dark:text-neutral-100">Loading states</h1><p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Preview the shared skeleton system or force it across the app.</p></div><label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold dark:border-neutral-700 dark:bg-neutral-900"><span>Force loading globally</span><input type="checkbox" className="peer sr-only" checked={forceLoading} onChange={(event) => setForceLoading(event.target.checked)} /><span className="relative h-7 w-12 rounded-full bg-neutral-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-neutral-950 peer-checked:after:translate-x-5 dark:bg-neutral-700 dark:peer-checked:bg-white dark:peer-checked:after:bg-neutral-950" /></label></header>
        <section><h2 className="mb-4 text-xl font-bold">Media cards</h2><CollectionLoadingSkeleton gridColumns={5} ariaLabel="Media card skeleton preview" /></section>
        <section><h2 className="mb-4 text-xl font-bold">Album cards</h2><CollectionLoadingSkeleton itemType="album" gridColumns={4} ariaLabel="Album card skeleton preview" /></section>
        <section><h2 className="mb-4 text-xl font-bold">List rows</h2><CollectionLoadingSkeleton viewMode="list" ariaLabel="List skeleton preview" /></section>
        <section><h2 className="mb-4 text-xl font-bold">Dashboard and tables</h2><PageLoadingSkeleton variant="dashboard" ariaLabel="Dashboard skeleton preview" /></section>
        <section><h2 className="mb-4 text-xl font-bold">Detail page</h2><PageLoadingSkeleton variant="detail" ariaLabel="Detail skeleton preview" /></section>
        <section className="pb-8"><h2 className="mb-4 text-xl font-bold">Primitives</h2><div className="flex flex-wrap items-center gap-3"><Skeleton className="h-12 w-12" /><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-24 rounded-full" /><Skeleton className="h-12 w-36" /></div></section>
    </section>;
};
