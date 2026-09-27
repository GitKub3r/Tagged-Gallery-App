import { useEffect, useRef, useState } from "react";
import { faCheckDouble, faImage, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { InlineNotice } from "../../../components/inline-notice/InlineNotice";
import { SpecFigure } from "../../../components/spec-figure/SpecFigure";
import { API_ORIGIN } from "../../../utils/assetUrl";
import { formatMediaSize } from "../../../utils/mediaFormat";
import { isDriveMedia } from "../../../utils/mediaSource";
import { describeDayRange, describeDaysLeft, formatDay, formatShortDay, isUrgent, stopDotClasses } from "../trashTime";

// Ancho de la etiqueta de una parada (w-28): la línea se divide en tramos de este ancho y las paradas de un
// mismo tramo comparten etiqueta, así nunca se solapan.
const LABEL_WIDTH = 112;
// Margen a los lados de la línea para que los puntos de los extremos no se corten.
const EDGE = 8;
// Alturas en la línea (px): etiqueta arriba (h-[5.75rem]), bus que la une a sus puntos, línea y escala debajo.
const LABEL_BOTTOM = 92;
const BUS_Y = 110;
const LINE_Y = 128;
const MAX_THUMBNAILS = 3;
// En móvil la línea es vertical y solo muestra las primeras paradas: los grupos de abajo tienen todas.
const MAX_LIST_STOPS = 4;
const SCALE_MARKS = [
    { days: 7, label: "1 week" },
    { days: 14, label: "2 weeks" },
    { days: 21, label: "3 weeks" },
];

const getThumbnailUrl = (media) => (media.thumbpath ? `${API_ORIGIN}${media.thumbpath}` : "");

// Miniaturas solapadas de lo que se borra en una parada. Decorativas: el botón que las contiene lo dice en texto.
const StopThumbnails = ({ media }) => (
    <span className="flex shrink-0 -space-x-5" aria-hidden="true">
        {media.slice(0, MAX_THUMBNAILS).map((item) => {
            const thumbnailUrl = getThumbnailUrl(item);
            return (
                <span key={item.id} className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-neutral-200 text-neutral-500 ring-2 ring-white dark:bg-neutral-800 dark:ring-neutral-900">
                    {thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" draggable="false" className="h-full w-full object-cover" /> : <FontAwesomeIcon icon={faImage} />}
                </span>
            );
        })}
    </span>
);

// Reparte las paradas en tramos del ancho de una etiqueta. La etiqueta se centra sobre sus puntos sin salir de su tramo.
const buildClusters = (stops, width, retentionDays) => {
    const slotCount = Math.max(1, Math.floor(width / LABEL_WIDTH));
    const slotWidth = width / slotCount;
    const bySlot = new Map();
    stops.forEach((stop) => {
        const x = EDGE + (Math.min(stop.daysLeft, retentionDays) / retentionDays) * (width - EDGE * 2);
        const slot = Math.min(slotCount - 1, Math.floor(x / slotWidth));
        bySlot.set(slot, [...(bySlot.get(slot) || []), { ...stop, x }]);
    });
    return [...bySlot].map(([slot, slotStops]) => {
        const center = slotStops.reduce((sum, stop) => sum + stop.x, 0) / slotStops.length;
        return {
            key: slot,
            stops: slotStops,
            media: slotStops.flatMap((stop) => stop.media),
            labelX: Math.min(Math.max(center, slot * slotWidth + LABEL_WIDTH / 2), (slot + 1) * slotWidth - LABEL_WIDTH / 2),
        };
    });
};

// Línea horizontal (desde sm): los días de retención a escala, de hoy (final de línea) a los recién borrados.
// Cada día con medias es un punto; las etiquetas con miniaturas se unen a sus puntos con pistas en ángulo recto.
const RouteLine = ({ stops, retentionDays, onGoToStop }) => {
    const trackRef = useRef(null);
    const [width, setWidth] = useState(0);
    // Etiqueta señalada: resalta sus pistas y sus puntos.
    const [activeKey, setActiveKey] = useState(null);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return undefined;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(track);
        return () => observer.disconnect();
    }, []);

    const clusters = width > 0 ? buildClusters(stops, width, retentionDays) : [];
    const xForDays = (days) => EDGE + (days / retentionDays) * (width - EDGE * 2);

    return (
        <div ref={trackRef} className="relative hidden h-40 sm:block">
            {width > 0 ? (
                <>
                    <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                        <line x1={EDGE} y1={LINE_Y} x2={width - EDGE} y2={LINE_Y} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth="2" strokeLinecap="round" />
                        {/* Señal que avanza hacia el final de la línea: las medias se acercan al día en que se borran. */}
                        <path
                            d={`M ${width - EDGE} ${LINE_Y} H ${EDGE}`}
                            fill="none"
                            className="animate-signal stroke-neutral-400 motion-reduce:animate-none dark:stroke-neutral-600"
                            strokeWidth="2"
                            strokeDasharray="4 12"
                            strokeLinecap="round"
                        />
                        {SCALE_MARKS.filter((mark) => mark.days < retentionDays).map((mark) => (
                            <line key={mark.days} x1={xForDays(mark.days)} y1={LINE_Y + 6} x2={xForDays(mark.days)} y2={LINE_Y + 11} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth="1.5" />
                        ))}
                        {/* Final de línea: hoy. */}
                        <line x1={EDGE} y1={LINE_Y - 9} x2={EDGE} y2={LINE_Y + 9} className="stroke-neutral-950 dark:stroke-white" strokeWidth="3" strokeLinecap="round" />
                        {clusters.map((cluster) => (
                            <g
                                key={cluster.key}
                                fill="none"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                                className={`transition-colors ${cluster.key === activeKey ? "stroke-neutral-950 dark:stroke-white" : "stroke-neutral-300 dark:stroke-neutral-700"}`}
                            >
                                {cluster.stops.map((stop) => <path key={stop.daysLeft} d={`M ${cluster.labelX} ${LABEL_BOTTOM} V ${BUS_Y} H ${stop.x} V ${LINE_Y - 8}`} />)}
                            </g>
                        ))}
                    </svg>

                    {clusters.flatMap((cluster) => cluster.stops.map((stop) => (
                        <span
                            key={stop.daysLeft}
                            className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white transition-transform motion-reduce:transition-none dark:ring-neutral-900 ${stopDotClasses(stop.daysLeft)} ${cluster.key === activeKey ? "scale-125" : ""}`}
                            style={{ left: stop.x, top: LINE_Y }}
                            aria-hidden="true"
                        />
                    )))}

                    <ol aria-label="Stops">
                        {clusters.map((cluster) => {
                            const first = cluster.stops[0];
                            const last = cluster.stops[cluster.stops.length - 1];
                            const dates = first === last ? formatDay(first.date) : `${formatShortDay(first.date)} to ${formatShortDay(last.date)}`;
                            return (
                                <li key={cluster.key} className="absolute top-0 w-28" style={{ left: cluster.labelX - LABEL_WIDTH / 2 }}>
                                    <button
                                        type="button"
                                        className="flex h-[5.75rem] w-full flex-col items-center gap-1.5 rounded-xl border-0 bg-transparent p-1.5 text-center text-neutral-950 shadow-none transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-100 dark:hover:bg-neutral-800"
                                        onClick={() => onGoToStop(first.daysLeft)}
                                        onPointerEnter={() => setActiveKey(cluster.key)}
                                        onPointerLeave={() => setActiveKey(null)}
                                        onFocus={() => setActiveKey(cluster.key)}
                                        onBlur={() => setActiveKey(null)}
                                    >
                                        <StopThumbnails media={cluster.media} />
                                        <span className="block w-full min-w-0">
                                            <span className={`block truncate text-xs font-bold ${isUrgent(first.daysLeft) ? "text-amber-600 dark:text-amber-400" : ""}`}>
                                                {describeDayRange(first.daysLeft, last.daysLeft)}
                                            </span>
                                            <span className="block truncate text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">{cluster.media.length} media</span>
                                        </span>
                                        <span className="sr-only">, {dates}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>

                    <div className="absolute inset-x-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400" style={{ top: LINE_Y + 16 }} aria-hidden="true">
                        <span className="absolute left-0 font-bold text-neutral-950 dark:text-neutral-100">Today</span>
                        {SCALE_MARKS.filter((mark) => mark.days < retentionDays).map((mark) => (
                            <span key={mark.days} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: xForDays(mark.days) }}>{mark.label}</span>
                        ))}
                        <span className="absolute right-0 whitespace-nowrap">{retentionDays} days</span>
                    </div>
                </>
            ) : null}
        </div>
    );
};

// Línea vertical (móvil): las primeras paradas en filas, como las estaciones de un trayecto.
const RouteList = ({ stops, onGoToStop }) => {
    const visibleStops = stops.slice(0, MAX_LIST_STOPS);
    const hiddenCount = stops.length - visibleStops.length;

    return (
        <ol aria-label="Stops" className="relative sm:hidden">
            <span className={`absolute left-3 top-8 w-0.5 -translate-x-1/2 bg-neutral-200 dark:bg-neutral-800 ${hiddenCount > 0 ? "bottom-5" : "bottom-8"}`} aria-hidden="true" />
            {visibleStops.map((stop) => (
                <li key={stop.daysLeft}>
                    <button
                        type="button"
                        className="relative flex min-h-16 w-full items-center gap-3 rounded-xl border-0 bg-transparent py-2 pl-0 pr-2 text-left text-neutral-950 shadow-none transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => onGoToStop(stop.daysLeft)}
                    >
                        <span className="grid w-6 shrink-0 place-items-center" aria-hidden="true">
                            <span className={`h-3 w-3 rounded-full ${stopDotClasses(stop.daysLeft)}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-bold ${isUrgent(stop.daysLeft) ? "text-amber-600 dark:text-amber-400" : ""}`}>{describeDaysLeft(stop.daysLeft)}</span>
                            <span className="block truncate text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">{formatDay(stop.date)} · {stop.media.length} media</span>
                        </span>
                        <StopThumbnails media={stop.media} />
                    </button>
                </li>
            ))}
            {hiddenCount > 0 ? (
                <li className="flex min-h-10 items-center gap-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    <span className="grid w-6 shrink-0 place-items-center" aria-hidden="true">
                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    </span>
                    {hiddenCount} more {hiddenCount === 1 ? "stop" : "stops"} until {formatShortDay(stops[stops.length - 1].date)}
                </li>
            ) : null}
        </ol>
    );
};

// Cabecera de la papelera como una línea de ruta: las medias viajan hacia el final de la línea (hoy), donde se
// borran para siempre. Cada día con medias es una parada; la más cercana da el titular.
export const TrashRoute = ({ stops, retentionDays, onGoToStop, onSelectStop }) => {
    const media = stops.flatMap((stop) => stop.media);
    const totalBytes = media.reduce((sum, item) => sum + Number(item.size || 0), 0);
    const driveCount = media.filter(isDriveMedia).length;
    const nextStop = stops[0];
    const lastStop = stops[stops.length - 1];
    const isNextUrgent = isUrgent(nextStop.daysLeft);

    return (
        <section aria-labelledby="trash-route" className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
                <div className="min-w-0">
                    <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${isNextUrgent ? "text-amber-600 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400"}`}>
                        {isNextUrgent ? <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" /> : null}
                        Next stop
                    </p>
                    <h2 id="trash-route" className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{describeDaysLeft(nextStop.daysLeft)}</h2>
                    <p className="mt-1 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                        {formatDay(nextStop.date)} · {nextStop.media.length} media deleted forever
                    </p>
                </div>
                <dl className="grid grid-cols-3 gap-4 lg:w-auto lg:gap-8">
                    <SpecFigure label="Media" value={media.length} hint={driveCount > 0 ? `${driveCount} from Drive` : "All in Tagged"} />
                    <SpecFigure label="To free" value={formatMediaSize(totalBytes)} hint={`Kept ${retentionDays} days`} />
                    <SpecFigure label="Stops" value={stops.length} hint={`Until ${formatShortDay(lastStop.date)}`} />
                </dl>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:pt-6">
                <RouteLine stops={stops} retentionDays={retentionDays} onGoToStop={onGoToStop} />
                <RouteList stops={stops} onGoToStop={onGoToStop} />
            </div>

            {isNextUrgent ? (
                <div className="mt-4">
                    <InlineNotice
                        tone="warning"
                        icon={faTriangleExclamation}
                        title={`${nextStop.media.length} media will be deleted forever ${describeDaysLeft(nextStop.daysLeft).toLowerCase()}`}
                        text={nextStop.media.length === 1 ? "Restore it to keep it in your library." : "Restore them to keep them in your library."}
                        action={
                            <button type="button" className={buttonClasses.secondary} onClick={() => onSelectStop(nextStop)}>
                                <FontAwesomeIcon icon={faCheckDouble} aria-hidden="true" />
                                Select them
                            </button>
                        }
                    />
                </div>
            ) : null}
        </section>
    );
};
