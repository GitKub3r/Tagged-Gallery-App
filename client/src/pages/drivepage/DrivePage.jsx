import { useState } from "react";
import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faLinkSlash, faPlus, faScrewdriverWrench } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { useDevTools } from "../../hooks/useDevTools";
import { useConnectGoogleDrive, useDisconnectGoogleDrive, useDrivePicker, useGoogleDriveStatus } from "../../hooks/useGoogleDrive";
import { DriveConnectionCard } from "./components/DriveConnectionCard";
import { DriveUploadModal } from "./components/DriveUploadModal";

const NotConfiguredNotice = () => (
    <article className="flex min-w-0 items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
            <FontAwesomeIcon icon={faScrewdriverWrench} aria-hidden="true" />
        </span>
        <div className="min-w-0">
            <h2 className="text-lg font-bold">Google Drive is not set up yet</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                The server is missing its Google credentials. Once they are added, you can connect your account here.
            </p>
        </div>
    </article>
);

export const DrivePage = () => {
    const { forceLoading } = useDevTools();
    const statusQuery = useGoogleDriveStatus();
    const status = statusQuery.data;
    const { connect, isReady, isConnecting } = useConnectGoogleDrive(status?.configured ? status.config : null);
    const disconnectMutation = useDisconnectGoogleDrive();
    const { openPicker, isOpening } = useDrivePicker(status?.config);
    const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const selectFromDrive = async () => {
        const files = await openPicker();
        if (files.length > 0) setSelectedFiles(files);
    };

    if (forceLoading) return <section className="tagged-app-page"><PageLoadingSkeleton variant="list" ariaLabel="Forced Google Drive loading preview" /></section>;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Integrations</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Google Drive</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                        Add photos and videos from your Drive to your library. Files stay in Drive; Tagged keeps a reference with your tags, albums and favourites.
                    </p>
                </div>
                {status?.connected ? (
                    <button
                        type="button"
                        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border-0 bg-neutral-950 px-4 text-sm font-bold text-white shadow-none transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white sm:w-auto"
                        onClick={selectFromDrive}
                        disabled={isOpening}
                    >
                        <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                        {isOpening ? "Opening Drive..." : "Select from Drive"}
                    </button>
                ) : null}
            </header>

            {statusQuery.isPending ? <PageLoadingSkeleton variant="list" ariaLabel="Loading Google Drive status" /> : null}
            {statusQuery.isError ? <LoadErrorState title="Could not load Google Drive status" onRetry={() => statusQuery.refetch()} placement="section" /> : null}

            {status && !status.configured ? <NotConfiguredNotice /> : null}

            {status?.configured && !status.connected ? (
                <EmptyState
                    title={isConnecting ? "Waiting for Google..." : "Connect your Google Drive"}
                    icon={faGoogleDrive}
                    placement="section"
                    actionLabel={isReady ? "Connect Google Drive" : "Preparing Google sign-in..."}
                    onAction={() => !isConnecting && connect()}
                />
            ) : null}

            {status?.connected ? (
                <div className="grid max-w-3xl gap-4">
                    <DriveConnectionCard
                        email={status.email}
                        connectedAt={status.connectedAt}
                        grantedAccess={status.grantedAccess}
                        requiredAccess={status.requiredAccess}
                        needsReconnect={status.needsReconnect}
                        isDisconnecting={disconnectMutation.isPending}
                        isReconnecting={isConnecting}
                        onDisconnect={() => setIsDisconnectOpen(true)}
                        onReconnect={() => isReady && !isConnecting && connect()}
                    />
                </div>
            ) : null}

            {selectedFiles.length > 0 ? <DriveUploadModal files={selectedFiles} onChangeFiles={selectFromDrive} onClose={() => setSelectedFiles([])} /> : null}

            <DeleteConfirmationModal
                isOpen={isDisconnectOpen}
                title="Disconnect Google Drive?"
                description="Media added from Drive stay in your library with their tags and albums, but can't be opened until you reconnect. Nothing is deleted from Drive."
                confirmLabel="Disconnect"
                pendingLabel="Disconnecting..."
                confirmIcon={faLinkSlash}
                isDeleting={disconnectMutation.isPending}
                onConfirm={() => disconnectMutation.mutate(undefined, { onSettled: () => setIsDisconnectOpen(false) })}
                onClose={() => !disconnectMutation.isPending && setIsDisconnectOpen(false)}
            />
        </section>
    );
};
