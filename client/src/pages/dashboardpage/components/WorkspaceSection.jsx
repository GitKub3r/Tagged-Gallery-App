import { Link } from "react-router-dom";
import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faCopy, faDiagramProject, faFolderOpen, faHeart, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { formatBytes, formatNumber, formatPercent, formatShortDate, pluralize, share } from "../dashboardFormat";
import { DashboardSection } from "./DashboardSection";

const DAY_MS = 24 * 60 * 60 * 1000;
const PREVIEW_SLOTS = 4;

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

const StatusDot = ({ tone }) => <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[tone]}`} aria-hidden="true" />;

const describeNextPurge = (nextPurgeAt) => {
    if (!nextPurgeAt) return "Nothing to clean up";
    const days = Math.ceil((new Date(nextPurgeAt).getTime() - Date.now()) / DAY_MS);
    return days <= 0 ? "Next cleanup today" : `Next cleanup in ${pluralize(days, "day")}`;
};

// Cuatro miniaturas (portadas de álbum o medias); los huecos quedan como marco vacío.
const ThumbnailRow = ({ paths, emptyText }) => (
    <span className="relative grid grid-cols-4 gap-1.5" aria-hidden="true">
        {Array.from({ length: PREVIEW_SLOTS }, (_, index) => {
            const path = paths[index];
            return (
                <span key={index} className="block aspect-square overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
                    {path ? <img src={`${API_ORIGIN}${path}`} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                </span>
            );
        })}
        {paths.length === 0 ? <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">{emptyText}</span> : null}
    </span>
);

// Lista corta de nombres (plantillas, reglas, datos de Drive).
const NameList = ({ items, emptyText }) => (
    <span className="grid gap-1.5">
        {items.length === 0 ? <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{emptyText}</span> : null}
        {items.map((item) => (
            <span key={item.key} className="flex min-w-0 items-center gap-2 text-sm">
                {item.marker}
                <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
                {item.meta ? <span className="shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{item.meta}</span> : null}
            </span>
        ))}
    </span>
);

// Pares etiqueta y valor (datos de la conexión con Drive).
const DetailRows = ({ rows }) => (
    <span className="grid gap-1.5">
        {rows.map((row) => (
            <span key={row.key} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                <span className="shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{row.key}</span>
                <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                    {row.marker}
                    <span className="truncate" title={row.value}>{row.value}</span>
                </span>
            </span>
        ))}
    </span>
);

const IndexMarker = ({ index }) => <span className="w-5 shrink-0 text-xs font-bold tracking-widest text-neutral-400 tabular-nums dark:text-neutral-500">{String(index + 1).padStart(2, "0")}</span>;

// Acceso a una parte de la biblioteca: cifra, una vista previa de su contenido y una línea de detalle.
// Toda la tarjeta es el enlace.
const WorkspaceTile = ({ to, icon, label, value, unit, preview, detail }) => (
    <li className="min-w-0">
        <Link
            to={to}
            className="flex h-full flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-950 transition-colors hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600"
        >
            <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                        <FontAwesomeIcon icon={icon} aria-hidden="true" />
                        {label}
                    </span>
                    <span className="mt-1 block truncate text-2xl font-black tracking-tight">
                        {value}
                        {unit ? <span className="ml-1.5 text-sm font-semibold tracking-normal text-neutral-500 dark:text-neutral-400">{unit}</span> : null}
                    </span>
                </span>
            </span>
            <span className="block flex-1">{preview}</span>
            <span className="truncate border-t border-neutral-200 pt-3 text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:text-neutral-400" title={detail}>{detail}</span>
        </Link>
    </li>
);

// 02 · Workspace: álbumes, favoritos, plantillas, reglas, Google Drive y papelera, con lo que contiene cada uno
// y acceso a su página.
export const WorkspaceSection = ({ dashboard }) => {
    const { workspace, totalMedia, favoriteMediaCount, storageByProvider } = dashboard;
    const driveStorage = storageByProvider.find((item) => item.provider === "google_drive");
    const driveStatus = DRIVE_STATUS[workspace.drive.status] || DRIVE_STATUS.disconnected;
    const largestAlbum = workspace.largestAlbums[0];
    const extraTemplates = Math.max(workspace.totalTemplates - workspace.templates.length, 0);
    const extraRules = Math.max(workspace.totalRules - workspace.rules.length, 0);

    return (
        <DashboardSection frame="02" eyebrow="Workspace" title="How you organise it" description="Collections, automations and connections around your media.">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Workspace">
                <WorkspaceTile
                    to="/albums"
                    icon={faFolderOpen}
                    label="Albums"
                    value={formatNumber(workspace.totalAlbums)}
                    unit={`${formatNumber(workspace.mediaInAlbums)} media organised`}
                    preview={<ThumbnailRow paths={workspace.largestAlbums.map((album) => album.albumthumbpath).filter(Boolean)} emptyText="No albums yet" />}
                    detail={largestAlbum ? `Largest: ${largestAlbum.albumname} · ${pluralize(largestAlbum.mediaCount, "media", "media")}` : "Group media into albums"}
                />
                <WorkspaceTile
                    to="/favourites"
                    icon={faHeart}
                    label="Favourites"
                    value={formatNumber(favoriteMediaCount)}
                    unit={`${formatPercent(share(favoriteMediaCount, totalMedia))} of the library`}
                    preview={<ThumbnailRow paths={workspace.recentFavourites.map((media) => media.thumbpath).filter(Boolean)} emptyText="No favourites yet" />}
                    detail={favoriteMediaCount > 0 ? "Your latest favourites" : "Mark media with the heart to find them here"}
                />
                <WorkspaceTile
                    to="/templates"
                    icon={faCopy}
                    label="Templates"
                    value={formatNumber(workspace.totalTemplates)}
                    unit="ready to apply"
                    preview={<NameList items={workspace.templates.map((template, index) => ({ key: template.id, label: template.name, marker: <IndexMarker index={index} /> }))} emptyText="No templates yet" />}
                    detail={extraTemplates > 0 ? `And ${pluralize(extraTemplates, "more template")}` : "Reusable media name, author and tags"}
                />
                <WorkspaceTile
                    to="/rules"
                    icon={faDiagramProject}
                    label="Rules"
                    value={formatNumber(workspace.activeRules)}
                    unit={`of ${formatNumber(workspace.totalRules)} running`}
                    preview={
                        <NameList
                            items={workspace.rules.map((rule) => ({ key: rule.id, label: rule.name, marker: <StatusDot tone={rule.isActive ? "good" : "idle"} />, meta: rule.isActive ? "Running" : "Off" }))}
                            emptyText="No rules yet"
                        />
                    }
                    detail={
                        workspace.ruleChanges > 0
                            ? `Changed ${formatNumber(workspace.ruleChanges)} media${workspace.rulesLastAppliedAt ? ` · last on ${formatShortDate(new Date(workspace.rulesLastAppliedAt))}` : ""}${extraRules > 0 ? ` · ${extraRules} more` : ""}`
                            : "Hasn't changed any media yet"
                    }
                />
                <WorkspaceTile
                    to="/drive"
                    icon={faGoogleDrive}
                    label="Google Drive"
                    value={formatNumber(driveStorage?.mediaCount || 0)}
                    unit="linked media"
                    preview={
                        <DetailRows
                            rows={[
                                { key: "Status", value: driveStatus.label, marker: <StatusDot tone={driveStatus.tone} /> },
                                { key: "Account", value: workspace.drive.email || "None" },
                                { key: "Size", value: formatBytes(driveStorage?.totalBytes || 0) },
                            ]}
                        />
                    }
                    detail={workspace.drive.status === "connected" ? "Originals stay in your Drive" : "Connect Drive to add media from it"}
                />
                <WorkspaceTile
                    to="/trash"
                    icon={faTrashCan}
                    label="Trash"
                    value={formatNumber(workspace.trash.mediaCount)}
                    unit={workspace.trash.mediaCount > 0 ? formatBytes(workspace.trash.totalBytes) : null}
                    preview={<ThumbnailRow paths={workspace.trash.recentMedia.map((media) => media.thumbpath).filter(Boolean)} emptyText="The trash is empty" />}
                    detail={describeNextPurge(workspace.trash.nextPurgeAt)}
                />
            </ul>
        </DashboardSection>
    );
};
