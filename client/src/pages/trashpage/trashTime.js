// Tiempo en la papelera por días de calendario (hora local): el día en que se borra una media es el de su
// expires_at, aunque falten unas horas.
const DAY_MS = 24 * 60 * 60 * 1000;
const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const shortDayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// Días o menos que quedan para que una parada se considere inminente (aviso ámbar).
export const URGENT_DAYS = 3;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Días de calendario hasta una fecha (redondeo: los días con cambio de hora duran 23 o 25 horas).
export const daysUntil = (value) => Math.max(0, Math.round((startOfDay(new Date(value)) - startOfDay(new Date())) / DAY_MS));

export const formatDay = (date) => dayFormatter.format(date);

export const formatShortDay = (date) => shortDayFormatter.format(date);

export const isUrgent = (days) => days <= URGENT_DAYS;

// Título de una parada: destino de los enlaces de la línea de ruta.
export const getStopHeadingId = (daysLeft) => `trash-stop-${daysLeft}`;

// Punto de una parada, en la línea de ruta y en la cabecera de su grupo: ámbar si es inminente.
export const stopDotClasses = (days) => (isUrgent(days) ? "bg-amber-500" : "bg-neutral-950 dark:bg-white");

export const describeDaysLeft = (days) => (days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`);

// Tramo de días de varias paradas agrupadas en la línea de ruta.
export const describeDayRange = (firstDays, lastDays) => {
    if (firstDays === lastDays) return describeDaysLeft(firstDays);
    if (firstDays <= 0) return lastDays === 1 ? "Today and tomorrow" : `Within ${lastDays} days`;
    return `In ${firstDays}–${lastDays} days`;
};

export const describeDeletion = (days) => (days <= 0 ? "Deleted forever today" : days === 1 ? "Deleted forever tomorrow" : `Deleted forever in ${days} days`);
