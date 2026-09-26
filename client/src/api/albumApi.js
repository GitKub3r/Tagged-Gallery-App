import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Could not load albums");
    }
    return response.data.data;
};

export const albumQueryKeys = {
    all: ["albums"],
    forUser: (userId) => ["albums", userId],
};

export const albumApi = {
    async getAll() {
        return unwrap(await apiClient.get("/albums"));
    },
};
