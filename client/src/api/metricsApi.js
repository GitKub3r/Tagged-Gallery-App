import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Could not load the dashboard");
    }
    return response.data.data;
};

export const metricsQueryKeys = {
    all: ["metrics"],
    dashboard: (userId, year) => ["metrics", "dashboard", userId, year ?? "current"],
};

export const metricsApi = {
    // year: año de la actividad (sin él, el servidor elige el actual o el último con subidas).
    // utcOffset: desfase de la zona horaria del navegador, para agrupar la actividad por días locales.
    async getDashboard(year) {
        return unwrap(await apiClient.get("/metrics", { params: { year: year ?? undefined, utcOffset: -new Date().getTimezoneOffset() } }));
    },
};
