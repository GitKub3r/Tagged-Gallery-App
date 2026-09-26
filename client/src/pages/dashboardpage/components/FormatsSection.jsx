import { faFilm, faImage, faPhotoFilm } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatBytes, formatNumber, formatPercent, pluralize, share } from "../dashboardFormat";
import { DashboardSection } from "./DashboardSection";

const MEDIA_TYPES = [
    { key: "image", label: "Images", icon: faImage },
    { key: "video", label: "Videos", icon: faFilm },
    { key: "gif", label: "GIFs", icon: faPhotoFilm },
];

// Forma de cada orientación (proporciones 3:2, 2:3 y 1:1) en un cuadro de 32 × 32.
const ORIENTATIONS = [
    { key: "landscape", label: "Landscape", rect: { x: 1, y: 7, width: 30, height: 18 } },
    { key: "portrait", label: "Portrait", rect: { x: 7, y: 1, width: 18, height: 30 } },
    { key: "square", label: "Square", rect: { x: 4, y: 4, width: 24, height: 24 } },
];

// Medidor de DESIGN.md §7.7: pista y relleno del mismo tono. tone="strong" para el número de medias
// y "soft" para el espacio, con el mismo significado en todas las filas.
const Meter = ({ label, value, detail, tone }) => (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-xs font-semibold">
        <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <span className={`block h-full rounded-full ${tone === "strong" ? "bg-neutral-950 dark:bg-white" : "bg-neutral-500 dark:bg-neutral-400"}`} style={{ width: `${Math.max(value * 100, value > 0 ? 2 : 0)}%` }} />
        </span>
        <span className="min-w-24 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{detail}</span>
    </div>
);

// 04 · Formats: cuánto hay de cada tipo, cuánto espacio ocupa y en qué orientación.
export const FormatsSection = ({ dashboard }) => {
    const { totalMedia, totalBytes, mediaTypeBreakdown, orientation } = dashboard;
    const typeByKey = new Map(mediaTypeBreakdown.map((item) => [item.mediatype, item]));
    const types = MEDIA_TYPES.filter((type) => type.key !== "gif" || typeByKey.has("gif"));
    const measured = orientation.landscape + orientation.portrait + orientation.square;
    const unmeasured = Math.max(totalMedia - measured, 0);

    return (
        <DashboardSection frame="04" eyebrow="Formats" title="What you keep" description="How much of each format you have, compared with the space it takes.">
            <ul className="grid gap-5" aria-label="Media types">
                {types.map((type) => {
                    const item = typeByKey.get(type.key) || { mediaCount: 0, totalBytes: 0 };
                    const mediaShare = share(item.mediaCount, totalMedia);
                    const storageShare = share(item.totalBytes, totalBytes);
                    return (
                        <li key={type.key} className="grid gap-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <FontAwesomeIcon icon={type.icon} className="w-4 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                                    {type.label}
                                </span>
                                <span className="text-sm font-bold tabular-nums">{formatNumber(item.mediaCount)}</span>
                            </div>
                            <Meter label="Media" value={mediaShare} detail={formatPercent(mediaShare)} tone="strong" />
                            <Meter label="Space" value={storageShare} detail={`${formatPercent(storageShare)} · ${formatBytes(item.totalBytes)}`} tone="soft" />
                        </li>
                    );
                })}
            </ul>

            <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <h3 className="text-sm font-semibold">Orientation</h3>
                <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="Orientation">
                    {ORIENTATIONS.map(({ key, label, rect }) => (
                        <li key={key} className="flex min-w-0 flex-col items-start gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-950">
                            <svg viewBox="0 0 32 32" className="h-8 w-8 text-neutral-400 dark:text-neutral-500" aria-hidden="true">
                                <rect {...rect} rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <span className="min-w-0">
                                <span className="block text-xl font-black tracking-tight">{formatPercent(share(orientation[key], measured))}</span>
                                <span className="block truncate text-xs font-semibold text-neutral-500 dark:text-neutral-400">{label} · <span className="tabular-nums">{formatNumber(orientation[key])}</span></span>
                            </span>
                        </li>
                    ))}
                </ul>
                {unmeasured > 0 ? <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{pluralize(unmeasured, "media", "media")} without a known resolution.</p> : null}
            </div>
        </DashboardSection>
    );
};
