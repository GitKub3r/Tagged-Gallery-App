import { faCalendarDays, faEnvelope, faHardDrive, faKey, faLinkSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { DetailRow } from "../../../components/detail-row/DetailRow";

const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
};

export const DriveConnectionDetails = ({ email, connectedAt, isDisconnecting, onDisconnect }) => {
    return (
        <>
            <dl className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                <DetailRow icon={faEnvelope} label="Account" value={email || "Google account"} />
                <DetailRow icon={faKey} label="Access" value="Read-only, whole Drive" detail="Tagged never changes or deletes anything in your Drive." />
                <DetailRow icon={faCalendarDays} label="Connected on" value={formatDate(connectedAt)} />
                <DetailRow icon={faHardDrive} label="On this server" value="Thumbnails and previews only" detail="Originals are read from Drive when you open or download them." />
            </dl>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-bold">Disconnect Google Drive</p>
                    <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Media added from Drive stay in your library, but can&apos;t be opened until you reconnect.</p>
                </div>
                <button type="button" className={buttonClasses.dangerGhost} onClick={onDisconnect} disabled={isDisconnecting}>
                    <FontAwesomeIcon icon={faLinkSlash} aria-hidden="true" />
                    Disconnect
                </button>
            </div>
        </>
    );
};
