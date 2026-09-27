// Desfase de la zona horaria del navegador en minutos respecto a UTC (-new Date().getTimezoneOffset()). Sirve para
// trabajar con los días del usuario y no con los del servidor.
// Desfase máximo de una zona horaria respecto a UTC (UTC-12 a UTC+14).
const MAX_UTC_OFFSET_MINUTES = 14 * 60;

const parseUtcOffset = (value) => {
    const offset = Math.round(Number(value));
    return Number.isFinite(offset) ? Math.max(-MAX_UTC_OFFSET_MINUTES, Math.min(MAX_UTC_OFFSET_MINUTES, offset)) : 0;
};

module.exports = { parseUtcOffset };
