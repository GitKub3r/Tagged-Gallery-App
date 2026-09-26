import { Link } from "react-router-dom";
import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faCopy, faDiagramProject, faFolderOpen, faHeart, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatBytes, formatNumber, formatPercent, formatShortDate, pluralize, share } from "../dashboardFormat";
import { DashboardSection } from "./DashboardSection";

const DAY_MS = 24 * 60 * 60 * 1000;

// Estado como un punto con su texto al lado (el color nunca va solo).
const STATUS_DOT_CLASSES = {
    good: "bg-green-500",
    warning: "bg-amber-500",
    idle: "bg-neutral-400 dark:bg-neutral-600",
};

const DRIVE_STATUS = {
    connected: { tone: "good", label: "Connected" },
    revoked: { tone: "warning", label: "Reconnect needed" },
    error: { tone: "warning", label: "Reconnect needed" },
    disconnected: { tone: "idle", label: "Not connected" },
};

const describeNextPurge = (nextPurgeAt) => {
    if (!nextPurgeAt) return "Nothing to clean up";
    const days = Math.ceil((new Date(nextPurgeAt).getTime() - Date.now()) / DAY_MS);
    return days <= 0 ? "Next cleanup today" : `Next cleanup in ${pluralize(days, "day")}`;
};

// Acceso a una parte de la biblioteca con su dato principal. Toda la tarjeta es el enlace.
const WorkspaceTile = ({ to, icon, label, value, unit, detail, status }) => (
    <li className="min-w-0">
        <Link
            to={to}
            className="flex h-full min-h-32 flex-col rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-950 transition-colors hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600"
        >
            <span className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-neutral-500/10 text-neutral-700 dark:text-neutral-200" aria-hidden="true">
                    <FontAwesomeIcon icon={icon} />
                </span>
            </span>
            <span className="mt-auto pt-3">
                <span className="block truncate text-3xl font-black tracking-tight">
                    {value}
                    {unit ? <span className="ml-1.5 text-sm font-semibold tracking-normal text-neutral-500 dark:text-neutral-400">{unit}</span> : null}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {status ? <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[status]}`} aria-hidden="true" /> : null}
                    <span className="truncate" title={detail}>{detail}</span>
                </span>
            </span>
        </Link>
    </li>
);

// 02 · Workspace: álbumes, favoritos, plantillas, reglas, Google Drive y papelera, con acceso a cada página.
export const WorkspaceSection = ({ dashboard }) => {
    const { workspace, totalMedia, favoriteMediaCount, storageByProvider } = dashboard;
    const driveStorage = storageByProvider.find((item) => item.provider === "google_drive");
    const driveStatus = DRIVE_STATUS[workspace.drive.status] || DRIVE_STATUS.disconnected;
    const rulesDetail = workspace.ruleChanges > 0
        ? `Changed ${formatNumber(workspace.ruleChanges)} media${workspace.rulesLastAppliedAt ? ` · last on ${formatShortDate(new Date(workspace.rulesLastAppliedAt))}` : ""}`
        : "Hasn't changed any media yet";

    return (
        <DashboardSection frame="02" eyebrow="Workspace" title="How you organise it" description="Collections, automations and connections around your media.">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Workspace">
                <WorkspaceTile
                    to="/albums"
                    icon={faFolderOpen}
                    label="Albums"
                    value={formatNumber(workspace.totalAlbums)}
                    detail={`${formatNumber(workspace.mediaInAlbums)} media in albums · ${formatPercent(share(workspace.mediaInAlbums, totalMedia))} of the library`}
                />
                <WorkspaceTile to="/favourites" icon={faHeart} label="Favourites" value={formatNumber(favoriteMediaCount)} detail={`${formatPercent(share(favoriteMediaCount, totalMedia))} of the library`} />
                <WorkspaceTile
                    to="/templates"
                    icon={faCopy}
                    label="Templates"
                    value={formatNumber(workspace.totalTemplates)}
                    detail={workspace.totalTemplates > 0 ? "Ready to apply when adding media" : "Save media details to reuse them"}
                />
                <WorkspaceTile
                    to="/rules"
                    icon={faDiagramProject}
                    label="Rules"
                    value={formatNumber(workspace.activeRules)}
                    unit={`of ${formatNumber(workspace.totalRules)} running`}
                    detail={rulesDetail}
                    status={workspace.activeRules > 0 ? "good" : "idle"}
                />
                <WorkspaceTile
                    to="/drive"
                    icon={faGoogleDrive}
                    label="Google Drive"
                    value={formatNumber(driveStorage?.mediaCount || 0)}
                    unit={`linked · ${formatBytes(driveStorage?.totalBytes || 0)}`}
                    detail={workspace.drive.status === "connected" && workspace.drive.email ? `Connected as ${workspace.drive.email}` : driveStatus.label}
                    status={driveStatus.tone}
                />
                <WorkspaceTile
                    to="/trash"
                    icon={faTrashCan}
                    label="Trash"
                    value={formatNumber(workspace.trash.mediaCount)}
                    unit={workspace.trash.mediaCount > 0 ? formatBytes(workspace.trash.totalBytes) : null}
                    detail={describeNextPurge(workspace.trash.nextPurgeAt)}
                />
            </ul>
        </DashboardSection>
    );
};
