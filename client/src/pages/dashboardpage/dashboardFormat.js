// Formato de las cifras del panel (la interfaz está en inglés).
const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthYearFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export const formatNumber = (value) => numberFormatter.format(Number(value || 0));
export const formatDecimal = (value) => decimalFormatter.format(Number(value || 0));
export const formatPercent = (value) => percentFormatter.format(Number(value || 0));
export const formatDay = (date) => dayFormatter.format(date);
export const formatShortDate = (date) => shortDateFormatter.format(date);
export const formatMonthYear = (value) => (value ? monthYearFormatter.format(new Date(value)) : null);

export const formatBytes = (value) => {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / 1024 ** unitIndex;
    return `${unitIndex === 0 ? size : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[unitIndex]}`;
};

export const pluralize = (count, noun, pluralNoun = `${noun}s`) => `${formatNumber(count)} ${count === 1 ? noun : pluralNoun}`;

export const share = (part, total) => (total > 0 ? part / total : 0);

// "YYYY-MM-DD" como fecha local (sin desplazarla a UTC).
export const parseLocalDay = (day) => {
    const [year, month, date] = day.split("-").map(Number);
    return new Date(year, month - 1, date);
};
