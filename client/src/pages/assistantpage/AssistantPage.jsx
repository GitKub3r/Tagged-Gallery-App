import { useState } from "react";
import { faCircleCheck, faDownload, faImages, faLock, faPen, faSpinner, faTags, faTrash, faTriangleExclamation, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { FeatureList } from "../../components/feature-list/FeatureList";
import { InlineNotice } from "../../components/inline-notice/InlineNotice";
import { IntegrationHero } from "../../components/integration-hero/IntegrationHero";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { PageSection } from "../../components/page-section/PageSection";
import { ProgressBar } from "../../components/progress-bar/ProgressBar";
import { useAiStatus, useCancelAiLibraryRun, useRemoveAiModels, useSetupAi, useStartAiLibraryRun } from "../../hooks/useAiAssistant";
import { useDevTools } from "../../hooks/useDevTools";
import { formatMediaSize } from "../../utils/mediaFormat";
import { AssistantActivity } from "./components/AssistantActivity";
import { AssistantModels } from "./components/AssistantModels";
import { AssistantSafeguards } from "./components/AssistantSafeguards";
import { AssistantSettings } from "./components/AssistantSettings";
import { AssistantSettingsModal } from "./components/AssistantSettingsModal";
import { AssistantStats } from "./components/AssistantStats";
import { getStrictnessLevel } from "./components/strictnessLevels";

const HOW_IT_WORKS = [
    { icon: faImages, title: "Learns from your tags", text: "It compares each media with the rest of your library and adds the tags you used on the most similar ones. It only uses tags you already have." },
    { icon: faLock, title: "Private and free", text: "It runs on this server with open models, downloaded once. Your media never leave it and there's no subscription or API cost." },
    { icon: faTags, title: "Only adds tags", text: "It never removes a tag. If you remove one it added, it won't add it again." },
];

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");
const getDownloadPercent = (models) => Math.floor((models.downloadedBytes / models.totalBytes) * 100);

// Estado en la línea bajo el título (DESIGN.md §4.3). Sin modelos ni descarga, se muestra la descripción.
const getStatusLine = ({ models, library, job }) => {
    if (models.state === "downloading") return { icon: faSpinner, spin: true, content: `Downloading models · ${getDownloadPercent(models)}%` };
    if (models.state === "error") return { icon: faTriangleExclamation, iconClassName: "text-amber-600 dark:text-amber-400", content: "The model download didn't finish" };
    if (models.state !== "ready") return null;
    if (job?.status === "running") return { icon: faSpinner, spin: true, content: job.phase === "tagging" ? "Tagging your library..." : "Analyzing your library..." };
    return {
        icon: faCircleCheck,
        iconClassName: "text-green-600 dark:text-green-400",
        content: (
            <>
                Ready · <span className="font-semibold text-neutral-700 dark:text-neutral-200">{formatNumber(library.ready)} of {formatNumber(library.total)}</span> media analyzed
            </>
        ),
    };
};

export const AssistantPage = () => {
    const { forceLoading } = useDevTools();
    const statusQuery = useAiStatus();
    const setupMutation = useSetupAi();
    const startRunMutation = useStartAiLibraryRun();
    const cancelRunMutation = useCancelAiLibraryRun();
    const removeMutation = useRemoveAiModels();
    const [isRunConfirmOpen, setIsRunConfirmOpen] = useState(false);
    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (forceLoading || statusQuery.isPending) {
        return <section className="tagged-app-page"><PageLoadingSkeleton variant="detail" ariaLabel="Loading AI assistant" /></section>;
    }
    if (statusQuery.isError) {
        return <section className="tagged-app-page"><LoadErrorState title="Could not load the AI assistant" onRetry={() => statusQuery.refetch()} /></section>;
    }

    const status = statusQuery.data;
    const { models, library, aiTags, settings, job } = status;
    const isInstalled = models.state === "ready";
    const isDownloading = models.state === "downloading";
    const isJobRunning = job?.status === "running";
    const isTaggingLibrary = isJobRunning && job.type === "tag";

    const heroAction = isInstalled ? (
        <button type="button" className={buttonClasses.primary} onClick={() => setIsRunConfirmOpen(true)} disabled={isTaggingLibrary || library.total === 0}>
            <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
            {isTaggingLibrary ? "Tagging library..." : "Tag library"}
        </button>
    ) : (
        <button type="button" className={buttonClasses.primary} onClick={() => setupMutation.mutate()} disabled={isDownloading || setupMutation.isPending}>
            <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
            {isDownloading ? "Downloading..." : models.state === "error" ? "Try again" : "Set up assistant"}
        </button>
    );

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <IntegrationHero
                icon={faWandMagicSparkles}
                eyebrow="Library tools"
                title="AI assistant"
                isActive={isInstalled}
                statusLine={getStatusLine(status)}
                description="Tags your media with the tags you already use on similar ones, when you upload them, from any selection or across your whole library."
                action={heroAction}
            />

            <div className="mx-auto max-w-5xl">
                {models.state === "error" ? (
                    <div className="mt-6">
                        <InlineNotice tone="warning" icon={faTriangleExclamation} title="Could not download the models" text={models.error} />
                    </div>
                ) : null}

                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {isDownloading ? (
                        <PageSection id="ai-download-title" title="Downloading models" description="This happens once. You can leave this page: the download continues on the server.">
                            <ProgressBar value={getDownloadPercent(models)} label="Model download" />
                            <p className="mt-2 flex justify-between gap-3 text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                                <span>{formatMediaSize(models.downloadedBytes)} of {formatMediaSize(models.totalBytes)}</span>
                                <span>{getDownloadPercent(models)}%</span>
                            </p>
                        </PageSection>
                    ) : null}

                    {isInstalled ? (
                        <>
                            <PageSection id="ai-overview-title" title="Overview" description="Each media is analyzed once on this server so the assistant can compare it with the rest of your library.">
                                <AssistantStats library={library} aiTags={aiTags} />
                            </PageSection>

                            {job ? (
                                <PageSection id="ai-activity-title" title="Activity" description="It keeps working on the server if you leave this page.">
                                    <AssistantActivity job={job} isStopping={cancelRunMutation.isPending} onStop={() => cancelRunMutation.mutate()} />
                                </PageSection>
                            ) : null}

                            <PageSection
                                id="ai-settings-title"
                                title="Settings"
                                description="How sure the assistant must be before adding a tag, and tags it must never add."
                                aside={
                                    <button type="button" className={buttonClasses.secondary} onClick={() => setIsSettingsOpen(true)}>
                                        <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                                        Edit settings
                                    </button>
                                }
                            >
                                <AssistantSettings settings={settings} />
                            </PageSection>
                        </>
                    ) : (
                        <PageSection id="ai-how-title" title="How it works" description={`Setting it up downloads about ${formatMediaSize(models.totalBytes)} of open models to this server.`}>
                            <FeatureList items={HOW_IT_WORKS} />
                        </PageSection>
                    )}

                    <PageSection id="ai-safeguards-title" title="Safeguards" description="Every media is checked on this server before the assistant tags it.">
                        <AssistantSafeguards library={isInstalled ? library : null} />
                    </PageSection>

                    {isInstalled ? (
                        <PageSection id="ai-models-title" title="Models" description="What the assistant runs and what it stores.">
                            <AssistantModels totalBytes={models.totalBytes} isBusy={isJobRunning} isRemoving={removeMutation.isPending} onRemove={() => setIsRemoveConfirmOpen(true)} />
                        </PageSection>
                    ) : null}
                </div>
            </div>

            {isSettingsOpen ? <AssistantSettingsModal settings={settings} onClose={() => setIsSettingsOpen(false)} /> : null}

            <DeleteConfirmationModal
                isOpen={isRunConfirmOpen}
                title="Tag your whole library?"
                description={`The assistant checks ${formatNumber(library.total)} media and adds the tags it is confident about (${getStrictnessLevel(settings.strictness).label.toLowerCase()}). It never removes tags, and you can stop it at any time.`}
                confirmLabel="Tag library"
                pendingLabel="Starting..."
                confirmIcon={faWandMagicSparkles}
                tone="neutral"
                isDeleting={startRunMutation.isPending}
                onConfirm={() => startRunMutation.mutate(undefined, { onSettled: () => setIsRunConfirmOpen(false) })}
                onClose={() => !startRunMutation.isPending && setIsRunConfirmOpen(false)}
            />

            <DeleteConfirmationModal
                isOpen={isRemoveConfirmOpen}
                title="Remove the AI models?"
                description={`This frees ${formatMediaSize(models.totalBytes)} on the server for every account. Tags already added stay on your media; set the assistant up again to keep using it.`}
                confirmLabel="Remove models"
                pendingLabel="Removing..."
                confirmIcon={faTrash}
                isDeleting={removeMutation.isPending}
                onConfirm={() => removeMutation.mutate(undefined, { onSettled: () => setIsRemoveConfirmOpen(false) })}
                onClose={() => !removeMutation.isPending && setIsRemoveConfirmOpen(false)}
            />
        </section>
    );
};
