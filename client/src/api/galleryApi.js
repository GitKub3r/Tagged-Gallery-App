import { apiClient } from "./apiClient";

export const galleryApi = {
    async getMedia(params, accessToken) {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((item) => searchParams.append(key, item));
            } else if (value !== undefined && value !== null && value !== "") {
                searchParams.set(key, String(value));
            }
        });

        const { data } = await apiClient.get(`/media?${searchParams.toString()}`, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });

        if (!data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || "Could not load gallery");
        }

        return data;
    },
};
