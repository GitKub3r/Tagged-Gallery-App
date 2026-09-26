import { useNavigate, useParams } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { Skeleton } from "../../components/loading-skeletons/Skeleton";
import { useDevTools } from "../../hooks/useDevTools";
import { useRule } from "../../hooks/useRules";
import { RuleEditor } from "./components/RuleEditor";

const EditorSkeleton = () => (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[34rem] flex-col gap-4 xl:h-[calc(100dvh-4rem)]" role="status" aria-label="Loading rule">
        <div className="flex items-center gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-9 w-64 max-w-full" /></div>
            <Skeleton className="hidden h-11 w-56 sm:block" />
        </div>
        <div className="flex min-h-0 flex-1 gap-4">
            <Skeleton className="hidden w-72 lg:block" />
            <Skeleton className="flex-1" />
        </div>
        <span className="sr-only">Loading rule</span>
    </div>
);

export const RuleEditorPage = () => {
    const { ruleId } = useParams();
    const navigate = useNavigate();
    const { forceLoading } = useDevTools();
    const ruleQuery = useRule(ruleId);

    if (forceLoading || ruleQuery.isPending) return <EditorSkeleton />;
    if (ruleQuery.isError) {
        return ruleQuery.error?.response?.status === 404
            ? <EmptyState title="This rule doesn't exist" icon={faDiagramProject} actionLabel="Back to rules" onAction={() => navigate("/rules")} />
            : <LoadErrorState title="Could not load this rule" onRetry={() => ruleQuery.refetch()} />;
    }

    return (
        <ReactFlowProvider>
            <RuleEditor key={ruleQuery.data.id} rule={ruleQuery.data} />
        </ReactFlowProvider>
    );
};
