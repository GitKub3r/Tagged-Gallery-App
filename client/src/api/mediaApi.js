import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Media request failed");
    }
    return response.data.data;
};

export const mediaApi = {
    async toggleFavourite(mediaId) {
        return unwrap(await apiClient.patch(`/media/${mediaId}/toggle-favourite`));
    },
};
