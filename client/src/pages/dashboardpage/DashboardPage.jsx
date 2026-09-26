import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { faChartColumn } from "@fortawesome/free-solid-svg-icons";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { useDashboard } from "../../hooks/useDashboard";
import { useDevTools } from "../../hooks/useDevTools";
import { ActivitySection } from "./components/ActivitySection";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { DescriptionSection } from "./components/DescriptionSection";
import { FormatsSection } from "./components/FormatsSection";
import { HighlightsSection } from "./components/HighlightsSection";
import { LibraryHero } from "./components/LibraryHero";
import { VocabularySection } from "./components/VocabularySection";
import { WorkspaceSection } from "./components/WorkspaceSection";

// Panel de la biblioteca como una hoja de contactos: cada sección es un fotograma numerado
// y la cabecera lleva una tira de película con las últimas subidas.
export const DashboardPage = () => {
    const navigate = useNavigate();
    const { forceLoading } = useDevTools();
    // null: el servidor elige el año (el actual o el último con subidas).
    const [year, setYear] = useState(null);
    const dashboardQuery = useDashboard(year);
    const dashboard = dashboardQuery.data;
    const isChangingYear = dashboardQuery.isPlaceholderData && dashboardQuery.isFetching;

    const renderContent = () => {
        if (forceLoading || dashboardQuery.isPending) return <DashboardSkeleton label={forceLoading ? "Forced dashboard loading preview" : "Loading dashboard"} />;
        if (dashboardQuery.isError) return <LoadErrorState title="Could not load the dashboard" onRetry={() => dashboardQuery.refetch()} placement="section" />;
        if (dashboard.totalMedia === 0) {
            return <EmptyState title="No media to analyse yet" icon={faChartColumn} placement="section" actionLabel="Go to gallery" onAction={() => navigate("/gallery")} />;
        }

        return (
            <div className="grid gap-4">
                <LibraryHero dashboard={dashboard} />
                <WorkspaceSection dashboard={dashboard} />
                <ActivitySection
                    year={dashboard.selectedYear}
                    controlYear={year ?? dashboard.selectedYear}
                    availableYears={dashboard.availableYears}
                    dailyUploads={dashboard.dailyUploads}
                    monthlyUploads={dashboard.monthlyUploads}
                    isUpdating={isChangingYear}
                    onYearChange={setYear}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                    <FormatsSection dashboard={dashboard} />
                    <DescriptionSection dashboard={dashboard} />
                </div>
                <VocabularySection dashboard={dashboard} />
                <HighlightsSection media={dashboard.featuredMedia} />
            </div>
        );
    };

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Your library</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Dashboard</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                        Everything in your library at a glance: what you keep, how you describe it and how it grows.
                    </p>
                </div>
            </header>
            {renderContent()}
        </section>
    );
};
