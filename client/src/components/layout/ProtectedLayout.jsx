import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "../sidebar/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { useAccessControl } from "../../hooks/useAccessControl";
import { TagFilterProvider } from "../../context/TagFilterContext";
import { GridViewProvider } from "../../context/GridViewContext";
import { Skeleton } from "../loading-skeletons/Skeleton";

export const ProtectedLayout = () => {
    const { loading, isAuthenticated } = useAuth();

    // Enforce role-based access control
    useAccessControl();

    if (loading) {
        return <main className="grid min-h-dvh place-items-center bg-neutral-100 p-6 dark:bg-neutral-950" role="status" aria-label="Restoring session"><div className="w-full max-w-sm space-y-4"><Skeleton className="mx-auto h-14 w-14" /><Skeleton className="mx-auto h-5 w-36" /><Skeleton className="h-12 w-full" /></div><span className="sr-only">Restoring session</span></main>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return (
        <TagFilterProvider>
            <GridViewProvider>
                <div className="flex min-h-dvh bg-neutral-100 dark:bg-neutral-950">
                    <Sidebar />
                    <main className="tagged-shell-content min-w-0 flex-1 px-4 pb-4 pt-20 xl:p-8">
                        <Outlet />
                    </main>
                </div>
            </GridViewProvider>
        </TagFilterProvider>
    );
};
