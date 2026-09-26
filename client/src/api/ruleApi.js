import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Rule request failed");
    }
    return response.data.data;
};

export const ruleQueryKeys = {
    all: ["rules"],
    forUser: (userId) => ["rules", userId],
    detail: (userId, ruleId) => ["rules", userId, "detail", Number(ruleId)],
};

export const ruleApi = {
    async getAll() {
        return unwrap(await apiClient.get("/rules"));
    },
    // El editor muestra su propio estado de error (regla inexistente o fallo de carga).
    async getById(id) {
        return unwrap(await apiClient.get(`/rules/${id}`, { _skipErrorToast: true }));
    },
    async create(rule) {
        return unwrap(await apiClient.post("/rules", rule));
    },
    // Admite cambios parciales: { id, name?, is_active?, graph? }.
    async update({ id, ...changes }) {
        return unwrap(await apiClient.put(`/rules/${id}`, changes));
    },
    async remove(id) {
        return unwrap(await apiClient.delete(`/rules/${id}`));
    },
    async run(id) {
        return unwrap(await apiClient.post(`/rules/${id}/run`));
    },
};
