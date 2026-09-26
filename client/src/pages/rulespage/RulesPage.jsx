import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { faDiagramProject, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { SearchField } from "../../components/search-field/SearchField";
import { useAlbums } from "../../hooks/useAlbums";
import { useDevTools } from "../../hooks/useDevTools";
import { useCreateRule, useDeleteRule, useRules, useUpdateRule } from "../../hooks/useRules";
import { getRuleIssues, toFlowEdges, toFlowNodes } from "../../utils/ruleGraph";
import { RuleCard } from "./components/RuleCard";
import { RuleNameModal } from "./components/RuleNameModal";

export const RulesPage = () => {
    const navigate = useNavigate();
    const { forceLoading } = useDevTools();
    const rulesQuery = useRules();
    const albumsQuery = useAlbums();
    const createRule = useCreateRule();
    const updateRule = useUpdateRule();
    const deleteRule = useDeleteRule();
    const [isCreating, setIsCreating] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [search, setSearch] = useState("");

    const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
    const searchTerm = search.trim().toLowerCase();
    const filteredRules = searchTerm ? rules.filter((rule) => rule.name.toLowerCase().includes(searchTerm)) : rules;
    // Primer problema de cada regla (el mismo cálculo que en el editor).
    const issueByRuleId = useMemo(() => {
        const context = { albumsById: albumsQuery.data ? new Map(albumsQuery.data.map((album) => [album.id, album])) : null };
        return new Map(rules.map((rule) => [rule.id, getRuleIssues(toFlowNodes(rule.graph), toFlowEdges(rule.graph), context)[0]?.message || null]));
    }, [rules, albumsQuery.data]);

    const toggleActive = (rule, isActive) =>
        updateRule.mutate({ changes: { id: rule.id, is_active: isActive }, successMessage: isActive ? "Rule turned on" : "Rule turned off" });

    if (forceLoading) return <section className="tagged-app-page"><PageLoadingSkeleton variant="list" ariaLabel="Forced rules loading preview" /></section>;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Library settings</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Rules</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                        Build workflows that tag, favourite and organise media automatically when they are added, edited or restored.
                    </p>
                </div>
                <button type="button" className={buttonClasses.primary} onClick={() => setIsCreating(true)}>
                    <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                    New rule
                </button>
            </header>

            {!rulesQuery.isPending && !rulesQuery.isError && rules.length > 0 ? (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <SearchField className="w-full max-w-sm" label="Search rules" value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder="Search rules by name" />
                    <p className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400" aria-live="polite">
                        {filteredRules.length} {filteredRules.length === 1 ? "rule" : "rules"}
                    </p>
                </div>
            ) : null}

            {rulesQuery.isPending ? <PageLoadingSkeleton variant="list" ariaLabel="Loading rules" /> : null}
            {rulesQuery.isError ? <LoadErrorState title="Could not load rules" onRetry={() => rulesQuery.refetch()} placement="section" /> : null}
            {!rulesQuery.isPending && !rulesQuery.isError && filteredRules.length === 0 ? (
                <EmptyState
                    title={search ? "No matching rules" : "No rules yet"}
                    icon={faDiagramProject}
                    placement="section"
                    actionLabel={search ? "Clear search" : "Create rule"}
                    onAction={() => (search ? setSearch("") : setIsCreating(true))}
                />
            ) : null}
            {filteredRules.length > 0 ? (
                <ul className="grid items-start gap-3 lg:grid-cols-2" aria-label="Rules">
                    {filteredRules.map((rule) => (
                        <RuleCard
                            key={rule.id}
                            rule={rule}
                            issue={issueByRuleId.get(rule.id)}
                            isToggling={updateRule.isPending && updateRule.variables?.changes.id === rule.id}
                            onToggleActive={toggleActive}
                            onDelete={setPendingDelete}
                        />
                    ))}
                </ul>
            ) : null}

            {isCreating ? (
                <RuleNameModal
                    isSaving={createRule.isPending}
                    onSubmit={(name) => createRule.mutate({ name }, { onSuccess: (rule) => navigate(`/rules/${rule.id}`) })}
                    onClose={() => setIsCreating(false)}
                />
            ) : null}
            <DeleteConfirmationModal
                isOpen={Boolean(pendingDelete)}
                title="Delete this rule?"
                description="The workflow will be removed. Media it already changed keep their tags, favourites and albums."
                confirmLabel="Delete rule"
                isDeleting={deleteRule.isPending}
                onConfirm={() => deleteRule.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) })}
                onClose={() => setPendingDelete(null)}
            />
        </section>
    );
};
