import { apiClient } from "./apiClient";

export const sidebarApi = {
    async getTagNames(accessToken) {
        const { data } = await apiClient.get("/tags/names", {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });

        if (!data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || "Unable to load tags");
        }

        return data.data.filter(Boolean).sort((a, b) => a.localeCompare(b));
    },
};
