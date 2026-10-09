import { faCircleCheck, faCircleXmark, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { InlineNotice } from "../../../components/inline-notice/InlineNotice";
import { ProgressBar } from "../../../components/progress-bar/ProgressBar";
import { describeTagResult } from "../../../hooks/useAiAssistant";

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

const formatRemaining = (seconds) => {
    if (!seconds) return null;
    if (seconds < 60) return "less than a minute left";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `about ${minutes} min left`;
    return `about ${Math.floor(minutes / 60)} h ${minutes % 60} min left`;
};

const RUNNING_TITLES = { analyzing: "Analyzing media", tagging: "Adding tags" };

const skippedNote = (job) => (job.blockedCount > 0 ? ` ${formatNumber(job.blockedCount)} skipped by the safeguards.` : "");

// Resultado del último trabajo de este usuario (desaparece si se reinicia el servidor).
const FinishedJob = ({ job }) => {
    if (job.status === "failed") {
        return <InlineNotice tone="warning" icon={faTriangleExclamation} title="The assistant stopped because of an error" text={`${job.error || "Unexpected error"}. What it finished is kept; run it again to continue.`} />;
    }
    if (job.type === "analyze") {
        const text = job.processed > 0 ? `${formatNumber(job.processed)} media analyzed.${skippedNote(job)}` : "Every media was already analyzed.";
        return <InlineNotice icon={job.status === "cancelled" ? faCircleXmark : faCircleCheck} title={job.status === "cancelled" ? "Analysis stopped" : "Library analyzed"} text={text} />;
    }
    return (
        <InlineNotice
            icon={job.status === "cancelled" ? faCircleXmark : faCircleCheck}
            title={job.status === "cancelled" ? "Tagging stopped" : "Library tagged"}
            text={`${describeTagResult(job)}.${skippedNote(job)}`}
        />
    );
};

export const AssistantActivity = ({ job, isStopping, onStop }) => {
    if (job.status !== "running") return <FinishedJob job={job} />;

    const progress = job.total > 0 ? (job.processed / job.total) * 100 : 0;
    const remaining = formatRemaining(job.remainingSeconds);
    const title = job.type === "tag" ? `Step ${job.phase === "tagging" ? 2 : 1} of 2 · ${RUNNING_TITLES[job.phase] || "Working"}` : RUNNING_TITLES.analyzing;

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-neutral-500 dark:text-neutral-400" aria-live="polite">
                        {formatNumber(job.processed)} of {formatNumber(job.total)} media
                        {remaining ? ` · ${remaining}` : ""}
                        {job.type === "tag" && job.addedCount > 0 ? ` · ${formatNumber(job.addedCount)} tags added` : ""}
                    </p>
                </div>
                <button type="button" className={buttonClasses.secondary} onClick={onStop} disabled={isStopping}>
                    {isStopping ? "Stopping..." : "Stop"}
                </button>
            </div>
            <div className="mt-4">
                <ProgressBar value={progress} label={title} />
            </div>
        </div>
    );
};
