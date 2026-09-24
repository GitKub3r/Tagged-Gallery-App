import { useState } from "react";
import { Link } from "react-router-dom";
import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faArrowRight, faLinkSlash, faPlus, faRotate, faScrewdriverWrench, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../components/button/buttonClasses";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { Skeleton } from "../../components/loading-skeletons/Skeleton";
import { useDevTools } from "../../hooks/useDevTools";
import {
    useConnectGoogleDrive,
    useDisconnectGoogleDrive,
    useExpandDriveSelection,
    useGoogleDriveStatus,
    useGoogleDriveSummary,
} from "../../hooks/useGoogleDrive";
import { DriveBrowserModal } from "./components/DriveBrowserModal";
import { DriveConnectionDetails } from "./components/DriveConnectionDetails";
import { DriveHero } from "./components/DriveHero";
import { DriveHowItWorks } from "./components/DriveHowItWorks";
import { DriveLinkAll } from "./components/DriveLinkAll";
import { DriveNotice } from "./components/DriveNotice";
import { DriveRecentMedia } from "./components/DriveRecentMedia";
import { DriveSection } from "./components/DriveSection";
import { DriveStats } from "./components/DriveStats";
import { DriveUploadModal } from "./components/DriveUploadModal";

const getHeroState = (status) => {
    if (!status?.configured) return "unconfigured";
    if (!status.connected) return "disconnected";
    return status.needsReconnect ? "reconnect" : "connected";
};

const StatsSkeleton = () => (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[7.25rem] w-full" />)}
    </div>
);

export const DrivePage = () => {
    const { forceLoading } = useDevTools();
    const statusQuery = useGoogleDriveStatus();
    const status = statusQuery.data;
    // También sin conexión: las medias de Drive siguen en la biblioteca y conviene avisar de que esperan reconexión.
    const summaryQuery = useGoogleDriveSummary(Boolean(status?.configured));
    const summary = summaryQuery.data;
    const { connect, isReady, isConnecting } = useConnectGoogleDrive(status?.configured ? status.config : null);
    const disconnectMutation = useDisconnectGoogleDrive();
    const expandMutation = useExpandDriveSelection();
    const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);

    // Las carpetas elegidas se convierten en sus fotos y vídeos (con subcarpetas) antes de revisar la selección.
    const confirmBrowserSelection = (items) => {
        const applyFiles = (files) => {
            if (files.length === 0) return;
            setSelectedFiles(files);
            setIsBrowserOpen(false);
        };
        if (!items.some((item) => item.isFolder)) {
            applyFiles(items.map((item) => ({ id: item.id, name: item.name, mimeType: item.mimeType, sizeBytes: item.size })));
            return;
        }
        expandMutation.mutate(items, { onSuccess: ({ files }) => applyFiles(files) });
    };

    if (forceLoading || statusQuery.isPending) {
        return <section className="tagged-app-page"><PageLoadingSkeleton variant="detail" ariaLabel="Loading Google Drive" /></section>;
    }
    if (statusQuery.isError) {
        return <section className="tagged-app-page"><LoadErrorState title="Could not load Google Drive" onRetry={() => statusQuery.refetch()} /></section>;
    }

    const heroState = getHeroState(status);
    const heroAction = status.connected ? (
        <button type="button" className={buttonClasses.primary} onClick={() => setIsBrowserOpen(true)} disabled={status.needsReconnect}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            Select from Drive
        </button>
    ) : status.configured ? (
        <button type="button" className={buttonClasses.primary} onClick={() => !isConnecting && connect()} disabled={!isReady || isConnecting}>
            <FontAwesomeIcon icon={faGoogleDrive} aria-hidden="true" />
            {isConnecting ? "Waiting for Google..." : isReady ? "Connect Google Drive" : "Preparing Google sign-in..."}
        </button>
    ) : null;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <DriveHero state={heroState} email={status.email} action={heroAction} />

            <div className="mx-auto max-w-5xl">
                {status.needsReconnect ? (
                    <DriveNotice
                        tone="warning"
                        icon={faTriangleExclamation}
                        title="Reconnect to update access"
                        text="Tagged now needs a different Drive permission. Your linked media are kept."
                        action={
                            <button type="button" className={buttonClasses.secondary} onClick={() => isReady && !isConnecting && connect()} disabled={isConnecting}>
                                <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
                                {isConnecting ? "Waiting for Google..." : "Reconnect"}
                            </button>
                        }
                    />
                ) : null}

                {status.configured && !status.connected && summary?.total > 0 ? (
                    <DriveNotice
                        tone="warning"
                        icon={faTriangleExclamation}
                        title={`${summary.total} ${summary.total === 1 ? "media is" : "media are"} waiting for Google Drive`}
                        text="They keep their tags, albums and favourites, and open again as soon as you reconnect this account."
                    />
                ) : null}

                {!status.configured ? (
                    <DriveNotice
                        icon={faScrewdriverWrench}
                        title="Google Drive is not set up yet"
                        text="The server is missing its Google credentials. Once they are added, you can connect your account here."
                    />
                ) : null}

                {status.connected ? (
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        <DriveSection id="drive-overview-title" title="Overview" description="Media in your library whose originals live in Google Drive.">
                            {summary ? <DriveStats summary={summary} /> : summaryQuery.isError ? <LoadErrorState title="Could not load the overview" onRetry={() => summaryQuery.refetch()} placement="section" /> : <StatsSkeleton />}
                        </DriveSection>

                        <DriveSection
                            id="drive-recent-title"
                            title="Recently added"
                            description="The latest photos and videos you added from Drive."
                            aside={summary?.recent.length ? (
                                <Link to="/gallery" className={buttonClasses.text}>
                                    Open gallery
                                    <FontAwesomeIcon icon={faArrowRight} className="text-xs" aria-hidden="true" />
                                </Link>
                            ) : null}
                        >
                            {summary?.recent.length ? (
                                <DriveRecentMedia media={summary.recent} />
                            ) : summary ? (
                                <EmptyState title="Nothing added from Drive yet" icon={faGoogleDrive} placement="section" actionLabel="Select from Drive" onAction={() => setIsBrowserOpen(true)} />
                            ) : (
                                <StatsSkeleton />
                            )}
                        </DriveSection>

                        <DriveSection id="drive-connection-title" title="Connection" description="The Google account linked to your library.">
                            <DriveConnectionDetails
                                email={status.email}
                                connectedAt={status.connectedAt}
                                isDisconnecting={disconnectMutation.isPending}
                                onDisconnect={() => setIsDisconnectOpen(true)}
                            />
                            <DriveLinkAll />
                        </DriveSection>
                    </div>
                ) : (
                    <DriveSection id="drive-how-title" title="How it works" description="Bring your Drive photos and videos into Tagged without duplicating them.">
                        <DriveHowItWorks />
                    </DriveSection>
                )}
            </div>

            {selectedFiles.length > 0 ? <DriveUploadModal files={selectedFiles} onChangeFiles={() => setIsBrowserOpen(true)} onClose={() => setSelectedFiles([])} /> : null}

            {isBrowserOpen ? (
                <DriveBrowserModal
                    initialSelection={selectedFiles}
                    layer={selectedFiles.length > 0 ? "nested" : "base"}
                    isConfirming={expandMutation.isPending}
                    onConfirm={confirmBrowserSelection}
                    onClose={() => setIsBrowserOpen(false)}
                />
            ) : null}

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
