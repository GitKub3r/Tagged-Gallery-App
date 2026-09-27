import { useState } from "react";
import { Link } from "react-router-dom";
import { faChartColumn, faFlask, faImages, faRotateLeft, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { Switch } from "../../../components/switch/Switch";
import { useDemoStatus, useResetDemo, useSetDemoMode } from "../../../hooks/useDemoMode";

const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const describeSummary = (summary) =>
    `${summary.media} media, ${summary.trash} in the trash, ${plural(summary.tags, "tag")}, ${plural(summary.albums, "album")}, ${plural(summary.templates, "template")} and ${plural(summary.rules, "rule")}`;

const describeStatus = (status) => {
    if (!status) return "Checking demo mode...";
    if (status.enabled) return `On · ${describeSummary(status.summary)}`;
    return status.ready ? "Off · Your demo library is kept for next time" : "Off";
};

// Modo demo de las cuentas admin: una biblioteca de ejemplo completa (medias, tags, álbumes, plantillas, reglas y
// papelera) que solo ve este admin. Activarla abre las páginas de biblioteca; resetearla la devuelve a su estado inicial.
export const DemoModeSection = () => {
    const statusQuery = useDemoStatus();
    const setDemoMode = useSetDemoMode();
    const resetDemo = useResetDemo();
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const status = statusQuery.data;
    const isBusy = setDemoMode.isPending || resetDemo.isPending;
    // La primera activación (o un reset) genera la biblioteca y puede tardar.
    const isPreparing = resetDemo.isPending || (setDemoMode.isPending && setDemoMode.variables === true && !status?.ready);

    return (
        <section className="border-t border-neutral-200 py-8 dark:border-neutral-800" aria-labelledby="demo-title">
            <div className="mb-4">
                <h2 id="demo-title" className="text-xl font-bold">Demo mode</h2>
                <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                    Explore Tagged with a complete sample library: media, tags, albums, templates, rules and trash. Only your admin account sees it, and it never touches real libraries.
                </p>
            </div>

            <div className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <FontAwesomeIcon icon={faFlask} className="mt-1 text-neutral-400" aria-hidden="true" />
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold">Demo library</h3>
                            <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${status?.enabled ? "bg-green-500" : "bg-neutral-400 dark:bg-neutral-600"}`} aria-hidden="true" />
                                {describeStatus(status)}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={Boolean(status?.enabled)}
                        onChange={(enabled) => setDemoMode.mutate(enabled)}
                        label="Demo mode"
                        disabled={!status || isBusy}
                    />
                </div>

                {isPreparing ? (
                    <p className="flex items-center gap-2 py-4 text-sm font-semibold" role="status">
                        <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                        Preparing the demo library. The first time can take up to a minute.
                    </p>
                ) : null}

                <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <FontAwesomeIcon icon={faRotateLeft} className="mt-1 text-neutral-400" aria-hidden="true" />
                        <div>
                            <h3 className="text-sm font-bold">Reset demo data</h3>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Bring back the original sample library. Changes made in the demo are lost.</p>
                        </div>
                    </div>
                    <button type="button" className={buttonClasses.secondary} onClick={() => setIsResetConfirmOpen(true)} disabled={!status?.ready || isBusy}>
                        <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
                        {resetDemo.isPending ? "Resetting..." : "Reset demo"}
                    </button>
                </div>
            </div>

            {status?.enabled ? (
                <nav className="mt-4 flex flex-col gap-2 sm:flex-row" aria-label="Open the demo library">
                    <Link to="/dashboard" className={buttonClasses.secondary}>
                        <FontAwesomeIcon icon={faChartColumn} aria-hidden="true" />
                        Open dashboard
                    </Link>
                    <Link to="/gallery" className={buttonClasses.secondary}>
                        <FontAwesomeIcon icon={faImages} aria-hidden="true" />
                        Open gallery
                    </Link>
                </nav>
            ) : null}

            <DeleteConfirmationModal
                isOpen={isResetConfirmOpen}
                title="Reset the demo library?"
                description="The sample library goes back to its original state. Everything you added, changed or deleted in the demo is lost."
                confirmLabel="Reset demo"
                pendingLabel="Resetting..."
                confirmIcon={faRotateLeft}
                isDeleting={resetDemo.isPending}
                onConfirm={() => resetDemo.mutate(undefined, { onSettled: () => setIsResetConfirmOpen(false) })}
                onClose={() => setIsResetConfirmOpen(false)}
            />
        </section>
    );
};
