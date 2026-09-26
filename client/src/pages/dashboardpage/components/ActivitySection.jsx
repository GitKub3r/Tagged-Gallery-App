import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";
import { ResultsLoadingIndicator } from "../../../components/results-loading-indicator/ResultsLoadingIndicator";
import { formatDay, formatNumber, parseLocalDay, pluralize } from "../dashboardFormat";
import { DashboardSection } from "./DashboardSection";

const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1));
const longMonth = new Intl.DateTimeFormat("en-US", { month: "long" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

// Escala secuencial de un solo tono (neutral): más subidas, más contraste con el fondo.
// fill para los puntos del mapa (SVG) y bg para la leyenda.
const LEVELS = [
    { fill: "fill-neutral-200 dark:fill-neutral-800", bg: "bg-neutral-200 dark:bg-neutral-800" },
    { fill: "fill-neutral-400 dark:fill-neutral-600", bg: "bg-neutral-400 dark:bg-neutral-600" },
    { fill: "fill-neutral-500 dark:fill-neutral-400", bg: "bg-neutral-500 dark:bg-neutral-400" },
    { fill: "fill-neutral-700 dark:fill-neutral-200", bg: "bg-neutral-700 dark:bg-neutral-200" },
    { fill: "fill-neutral-950 dark:fill-white", bg: "bg-neutral-950 dark:bg-white" },
];
// Geometría del mapa en unidades del SVG: celda por día, radio del punto, columna de días y fila de meses.
const CELL = 14;
const DOT_RADIUS = 5;
const MAP_LABELS = 26;
const MAP_HEADER = 16;
const MAP_HEIGHT = MAP_HEADER + CELL * 7;

// Escala logarítmica: un día con cientos de subidas no apaga los días con unas pocas.
const getLevel = (count, max) => (count <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((4 * Math.log(count + 1)) / Math.log(max + 1))));

const toDayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Días del año en columnas de semanas (de lunes a domingo), con huecos antes del 1 de enero.
const buildWeeks = (year) => {
    const firstDay = new Date(year, 0, 1);
    const leadingDays = (firstDay.getDay() + 6) % 7;
    const dayCount = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    const slots = [...Array(leadingDays).fill(null), ...Array.from({ length: dayCount }, (_, index) => new Date(year, 0, 1 + index))];
    const weeks = [];
    for (let index = 0; index < slots.length; index += 7) weeks.push(slots.slice(index, index + 7));
    return weeks;
};

const YearControl = ({ year, availableYears, onChange, disabled }) => {
    const index = availableYears.indexOf(year);
    return (
        <div className="flex items-center gap-1" role="group" aria-label="Year">
            <IconButton onClick={() => onChange(availableYears[index - 1])} disabled={disabled || index <= 0} aria-label="Previous year">
                <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
            </IconButton>
            <span className="min-w-16 text-center text-sm font-bold tabular-nums" aria-live="polite">{year}</span>
            <IconButton onClick={() => onChange(availableYears[index + 1])} disabled={disabled || index < 0 || index >= availableYears.length - 1} aria-label="Next year">
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </IconButton>
        </div>
    );
};

const Stat = ({ label, value, hint }) => (
    <div className="min-w-0">
        <dt className="truncate text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">{label}</dt>
        <dd className="mt-1 truncate text-2xl font-black tracking-tight">{value}</dd>
        {hint ? <dd className="truncate text-xs font-semibold text-neutral-500 dark:text-neutral-400">{hint}</dd> : null}
    </div>
);

// 03 · Activity: subidas de un año por día (mapa de puntos) y por mes (barras). Pasar el ratón, tocar o
// enfocar un mes muestra su dato en la lectura; los meses son botones, así que todo se alcanza con teclado.
// controlYear: el año elegido, que puede ir por delante de year mientras llegan sus datos.
export const ActivitySection = ({ year, controlYear, availableYears, dailyUploads, monthlyUploads, isUpdating, onYearChange }) => {
    const scrollRef = useRef(null);
    const [readout, setReadout] = useState(null);
    const weeks = useMemo(() => buildWeeks(year), [year]);
    const countsByDay = useMemo(() => new Map(dailyUploads.map((item) => [item.day, item.mediaCount])), [dailyUploads]);
    const maxDay = dailyUploads.reduce((max, item) => Math.max(max, item.mediaCount), 0);
    const busiestDay = dailyUploads.reduce((best, item) => (!best || item.mediaCount > best.mediaCount ? item : best), null);
    const maxMonth = monthlyUploads.reduce((max, item) => Math.max(max, item.mediaCount), 0);
    const busiestMonth = monthlyUploads.reduce((best, item) => (!best || item.mediaCount > best.mediaCount ? item : best), null);
    const yearTotal = monthlyUploads.reduce((sum, item) => sum + item.mediaCount, 0);
    const today = toDayKey(new Date());
    const mapWidth = MAP_LABELS + weeks.length * CELL;

    // En pantallas estrechas el mapa se desplaza; se empieza por el final (lo más reciente).
    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (container) container.scrollLeft = container.scrollWidth;
    }, [year]);

    const showDay = (dayKey) => setReadout({ dayKey, label: formatDay(parseLocalDay(dayKey)), count: countsByDay.get(dayKey) || 0 });
    const showMonth = (month) => setReadout({ label: longMonth.format(MONTHS[month.monthIndex - 1]), count: month.mediaCount });
    // La celda entera bajo el puntero cuenta, no solo el punto (objetivo mayor que la marca).
    const handleMapPointer = (event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) * mapWidth) / bounds.width - MAP_LABELS;
        const y = ((event.clientY - bounds.top) * MAP_HEIGHT) / bounds.height - MAP_HEADER;
        const date = x >= 0 && y >= 0 ? weeks[Math.floor(x / CELL)]?.[Math.floor(y / CELL)] : null;
        if (date) showDay(toDayKey(date));
    };
    // Con ratón, la lectura se borra al salir; en táctil se queda el último día o mes tocado.
    const clearOnMouseLeave = (event) => {
        if (event.pointerType === "mouse") setReadout(null);
    };

    return (
        <DashboardSection
            frame="03"
            eyebrow="Activity"
            title="When you add media"
            description="Every dot is a day. The darker it is, the more media you uploaded."
            action={<YearControl year={controlYear} availableYears={availableYears} onChange={onYearChange} disabled={isUpdating} />}
        >
            <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Uploads" value={formatNumber(yearTotal)} hint={`in ${year}`} />
                <Stat label="Active days" value={formatNumber(dailyUploads.length)} hint={dailyUploads.length === 1 ? "day with uploads" : "days with uploads"} />
                <Stat label="Busiest day" value={busiestDay ? formatDay(parseLocalDay(busiestDay.day)) : "—"} hint={busiestDay ? pluralize(busiestDay.mediaCount, "media", "media") : "No uploads"} />
                <Stat label="Busiest month" value={busiestMonth?.mediaCount ? longMonth.format(MONTHS[busiestMonth.monthIndex - 1]) : "—"} hint={busiestMonth?.mediaCount ? pluralize(busiestMonth.mediaCount, "media", "media") : "No uploads"} />
            </dl>

            <div className={`relative transition-opacity motion-reduce:transition-none ${isUpdating ? "opacity-50" : ""}`}>
                {isUpdating ? (
                    <div className="absolute inset-x-0 top-1/3 z-10 flex justify-center">
                        <ResultsLoadingIndicator isVisible label={`Loading ${controlYear}...`} placement="inline" />
                    </div>
                ) : null}

                {/* Mapa de puntos: decorativo para lectores de pantalla, que tienen los meses en los botones de abajo.
                    Es un SVG que se escala al ancho de la sección; en pantallas estrechas se desplaza. */}
                <div ref={scrollRef} className="overflow-x-auto pb-2" aria-hidden="true">
                    <svg
                        viewBox={`0 0 ${mapWidth} ${MAP_HEIGHT}`}
                        className="block w-full min-w-[44rem]"
                        onPointerMove={handleMapPointer}
                        onPointerDown={handleMapPointer}
                        onPointerLeave={clearOnMouseLeave}
                    >
                        {WEEKDAY_LABELS.map((label, index) => (label ? (
                            <text key={label} x="0" y={MAP_HEADER + index * CELL + CELL / 2 + 3} fontSize="9" className="fill-neutral-400 dark:fill-neutral-500">{label}</text>
                        ) : null))}
                        {/* Cada mes se rotula en la semana que contiene su día 1. */}
                        {weeks.map((week, weekIndex) => {
                            const monthStart = week.find((date) => date?.getDate() === 1);
                            return monthStart ? (
                                <text key={weekIndex} x={MAP_LABELS + weekIndex * CELL} y="10" fontSize="9" className="fill-neutral-400 dark:fill-neutral-500">{shortMonth.format(monthStart)}</text>
                            ) : null;
                        })}
                        {weeks.map((week, weekIndex) => week.map((date, dayIndex) => {
                            if (!date) return null;
                            const dayKey = toDayKey(date);
                            const isActive = readout?.dayKey === dayKey;
                            return (
                                <circle
                                    key={dayKey}
                                    cx={MAP_LABELS + weekIndex * CELL + CELL / 2}
                                    cy={MAP_HEADER + dayIndex * CELL + CELL / 2}
                                    r={DOT_RADIUS}
                                    strokeWidth="2"
                                    className={`${LEVELS[getLevel(countsByDay.get(dayKey) || 0, maxDay)].fill} ${dayKey > today ? "opacity-40" : ""} ${isActive ? "stroke-neutral-500" : "stroke-transparent"}`}
                                />
                            );
                        }))}
                    </svg>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-h-5 text-sm font-semibold tabular-nums" aria-hidden="true">
                        {readout ? (
                            <>
                                {readout.label} <span className="text-neutral-400 dark:text-neutral-500">·</span> {pluralize(readout.count, "media", "media")}
                            </>
                        ) : (
                            <span className="font-medium text-neutral-500 dark:text-neutral-400">Point at a day or a month to see its uploads</span>
                        )}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400" aria-hidden="true">
                        Less
                        {LEVELS.map((level) => <span key={level.bg} className={`h-2.5 w-2.5 rounded-full ${level.bg}`} />)}
                        More
                    </p>
                </div>

                {/* Subidas por mes: barras que también son el acceso por teclado y lector de pantalla a los datos. */}
                <div className="mt-5 grid grid-cols-12 items-end gap-1 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:gap-2" onPointerLeave={clearOnMouseLeave}>
                    {monthlyUploads.map((month) => {
                        const height = maxMonth > 0 ? Math.max((month.mediaCount / maxMonth) * 100, month.mediaCount > 0 ? 4 : 0) : 0;
                        const monthName = longMonth.format(MONTHS[month.monthIndex - 1]);
                        const isBusiest = month === busiestMonth && month.mediaCount > 0;
                        return (
                            <button
                                key={month.monthKey}
                                type="button"
                                className="group flex h-24 w-full flex-col items-center justify-end gap-1.5 rounded-xl border-0 bg-transparent p-0 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500"
                                aria-label={`${monthName} ${year}: ${pluralize(month.mediaCount, "media", "media")}`}
                                onPointerEnter={() => showMonth(month)}
                                onFocus={() => showMonth(month)}
                                onBlur={() => setReadout(null)}
                                onClick={() => showMonth(month)}
                            >
                                <span className="flex w-full max-w-6 flex-1 items-end">
                                    <span
                                        className={`block w-full rounded-t-xl transition-colors ${isBusiest ? "bg-neutral-950 dark:bg-white" : "bg-neutral-300 group-hover:bg-neutral-500 group-focus-visible:bg-neutral-500 dark:bg-neutral-700 dark:group-hover:bg-neutral-400 dark:group-focus-visible:bg-neutral-400"}`}
                                        style={{ height: `${height}%` }}
                                    />
                                </span>
                                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                    <span className="sm:hidden">{shortMonth.format(MONTHS[month.monthIndex - 1]).charAt(0)}</span>
                                    <span className="hidden sm:inline">{shortMonth.format(MONTHS[month.monthIndex - 1])}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </DashboardSection>
    );
};
