import { faCalendarDays, faEnvelope, faHardDrive, faKey, faLinkSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";

const ACCESS_LABELS = {
    file: { value: "Only files you select", detail: "Tagged can open the files you pick." },
    readonly: { value: "Read-only, whole Drive", detail: "Browse with thumbnails and add whole folders." },
};

const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
};

const DetailRow = ({ icon, label, value, detail }) => (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-3">
        <dt className="flex w-44 shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            <FontAwesomeIcon icon={icon} className="w-4" aria-hidden="true" />
            {label}
        </dt>
        <dd className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold" title={typeof value === "string" ? value : undefined}>{value}</span>
            {detail ? <span className="block text-xs text-neutral-500 dark:text-neutral-400">{detail}</span> : null}
        </dd>
    </div>
);

export const DriveConnectionDetails = ({ email, grantedAccess, connectedAt, isDisconnecting, onDisconnect }) => {
    const access = ACCESS_LABELS[grantedAccess] || ACCESS_LABELS.file;

    return (
        <>
            <dl className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                <DetailRow icon={faEnvelope} label="Account" value={email || "Google account"} />
                <DetailRow icon={faKey} label="Access" value={access.value} detail={access.detail} />
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
