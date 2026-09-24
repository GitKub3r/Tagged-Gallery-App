import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Trash request failed");
    }
    return response.data.data;
};

export const trashQueryKeys = {
    all: ["trash"],
    forUser: (userId) => ["trash", userId],
};

export const trashApi = {
    async getAll() {
        return unwrap(await apiClient.get("/trash"));
    },
    async restore(ids) {
        return unwrap(await apiClient.post("/trash/restore", { ids }));
    },
    async deleteForever(ids) {
        return unwrap(await apiClient.delete("/trash", { data: { ids } }));
    },
    async empty() {
        return unwrap(await apiClient.delete("/trash", { data: { all: true } }));
    },
};
