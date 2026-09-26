import { useState } from "react";
import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatMediaSize } from "../../../utils/mediaFormat";
import { isDriveMedia } from "../../../utils/mediaSource";
import { URGENT_DAYS, addDays, describeDaysLeft, formatDay } from "../trashTime";

// Días marcados bajo la cuña (en móvil solo los que no se solapan).
const SCALE_MARKS = [
    { days: 0, label: "Today" },
    { days: 7, label: "1 week", desktopOnly: true },
    { days: 14, label: "2 weeks" },
    { days: 21, label: "3 weeks", desktopOnly: true },
];

const Figure = ({ label, value, hint, tone }) => (
    <div className="min-w-0 border-l border-neutral-200 pl-3 dark:border-neutral-800">
        <dt className="truncate text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{label}</dt>
        <dd className={`mt-0.5 truncate text-xl font-black tracking-tight ${tone === "warning" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</dd>
        {hint ? <dd className="truncate text-xs font-semibold text-neutral-500 dark:text-neutral-400">{hint}</dd> : null}
    </div>
);

// Cabecera de la papelera: cuánto hay, cuánto espacio se liberará y cuándo se borra cada cosa.
// La cuña de grises (como la escala de tonos de un laboratorio) va de hoy (claro: lo que está a punto
// de desaparecer) a los días de retención (oscuro: lo recién borrado); cada día con medias lleva una marca.
export const RetentionPanel = ({ media, retentionDays }) => {
    const [readout, setReadout] = useState(null);
    const today = new Date();
    const totalBytes = media.reduce((sum, item) => sum + Number(item.size || 0), 0);
    const driveCount = media.filter(isDriveMedia).length;
    const countsByDay = media.reduce((counts, item) => counts.set(item.daysLeft, (counts.get(item.daysLeft) || 0) + 1), new Map());
    const nextDays = media.length > 0 ? Math.min(...media.map((item) => item.daysLeft)) : null;
    const nextCount = nextDays === null ? 0 : countsByDay.get(nextDays);
    const days = Array.from({ length: retentionDays + 1 }, (_, index) => index);

    const showDay = (day) => setReadout({ day, count: countsByDay.get(day) || 0 });
    const clearOnMouseLeave = (event) => {
        if (event.pointerType === "mouse") setReadout(null);
    };

    return (
        <section aria-labelledby="trash-retention" className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-10">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Retention</p>
                    <h2 id="trash-retention" className="mt-1">
                        <span className="block text-5xl font-black tracking-tight">{media.length}</span>
                        <span className="block text-sm font-medium text-neutral-500 dark:text-neutral-400">media waiting to be deleted</span>
                    </h2>
                </div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Figure label="Space to free" value={formatMediaSize(totalBytes)} hint={`Kept for ${retentionDays} days`} />
                    <Figure
                        label="Next deletion"
                        value={nextDays === null ? "—" : formatDay(addDays(today, nextDays))}
                        hint={nextDays === null ? null : `${nextCount} media · ${describeDaysLeft(nextDays).toLowerCase()}`}
                        tone={nextDays !== null && nextDays <= URGENT_DAYS ? "warning" : null}
                    />
                    <Figure
                        label="From Drive"
                        value={driveCount}
                        hint={driveCount > 0 ? "Originals stay in Drive" : "All stored in Tagged"}
                    />
                </dl>
            </div>

            <div className="mt-6">
                {/* Cuña de grises: decorativa para lectores de pantalla, que tienen los grupos por fecha de abajo. */}
                <div aria-hidden="true" onPointerLeave={clearOnMouseLeave}>
                    <div className="flex h-3 items-end gap-px">
                        {days.map((day) => (
                            <span key={day} className="flex flex-1 justify-center">
                                {countsByDay.has(day) ? <span className={`h-1.5 w-1.5 rounded-full ${day <= URGENT_DAYS ? "bg-amber-500" : "bg-neutral-950 dark:bg-white"}`} /> : null}
                            </span>
                        ))}
                    </div>
                    <div className="mt-1 flex h-10 gap-px overflow-hidden rounded-xl">
                        {days.map((day) => (
                            <span
                                key={day}
                                className={`flex-1 bg-neutral-950 transition-[outline] dark:bg-white ${readout?.day === day ? "outline-2 -outline-offset-2 outline-neutral-500" : ""}`}
                                style={{ opacity: 0.08 + 0.62 * (day / retentionDays) }}
                                onPointerEnter={() => showDay(day)}
                                onPointerDown={() => showDay(day)}
                            />
                        ))}
                    </div>
                    <div className="relative mt-2 h-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        {SCALE_MARKS.map((mark) => (
                            <span key={mark.days} className={`absolute whitespace-nowrap ${mark.desktopOnly ? "hidden sm:inline" : ""}`} style={{ left: `${(mark.days / (retentionDays + 1)) * 100}%` }}>{mark.label}</span>
                        ))}
                        <span className="absolute right-0 whitespace-nowrap">{retentionDays} days</span>
                    </div>
                </div>

                <p className="mt-3 min-h-5 text-sm font-semibold tabular-nums" aria-hidden="true">
                    {readout ? (
                        <>
                            {formatDay(addDays(today, readout.day))} <span className="text-neutral-400 dark:text-neutral-500">·</span>{" "}
                            {readout.count > 0 ? `${readout.count} media deleted forever` : "Nothing deleted this day"}
                        </>
                    ) : (
                        <span className="font-medium text-neutral-500 dark:text-neutral-400">
                            Media fade as their day comes closer. Point at a day to see what gets deleted.
                        </span>
                    )}
                </p>
                {nextDays !== null && nextDays <= URGENT_DAYS ? (
                    <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        {nextCount} media will be deleted forever {describeDaysLeft(nextDays).toLowerCase()}. Restore them to keep them.
                    </p>
                ) : null}
                {driveCount > 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <FontAwesomeIcon icon={faGoogleDrive} aria-hidden="true" />
                        Deleting Google Drive media only removes it from Tagged.
                    </p>
                ) : null}
            </div>
        </section>
    );
};
