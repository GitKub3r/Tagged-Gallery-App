import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Could not update demo mode");
    }
    return response.data.data;
};

export const demoQueryKeys = {
    all: ["demo"],
    forUser: (userId) => ["demo", userId],
};

// Modo demo (solo admin). La respuesta es el estado: { enabled, ready, summary }.
// utcOffset: la biblioteca demo se crea con fechas relativas al día del navegador (p. ej. lo que se borra hoy).
const getUtcOffset = () => -new Date().getTimezoneOffset();

export const demoApi = {
    async getStatus() {
        return unwrap(await apiClient.get("/demo"));
    },
    async setEnabled(enabled) {
        return unwrap(await apiClient.put("/demo", { enabled, utcOffset: getUtcOffset() }));
    },
    async reset() {
        return unwrap(await apiClient.post("/demo/reset", { utcOffset: getUtcOffset() }));
    },
};
