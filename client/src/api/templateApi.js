import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Could not load templates");
    }
    return response.data.data;
};

export const templateQueryKeys = {
    all: ["templates"],
    forUser: (userId) => ["templates", userId],
};

export const templateApi = {
    async getAll() {
        return unwrap(await apiClient.get("/templates"));
    },
    async save(template) {
        const endpoint = template.id ? `/templates/${template.id}` : "/templates";
        return unwrap(template.id
            ? await apiClient.put(endpoint, template)
            : await apiClient.post(endpoint, template));
    },
    async remove(id) {
        return unwrap(await apiClient.delete(`/templates/${id}`));
    },
};
