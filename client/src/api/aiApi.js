import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "AI assistant request failed");
    }
    return response.data.data;
};

export const aiQueryKeys = {
    all: ["ai-assistant"],
    status: (userId) => ["ai-assistant", "status", userId],
};

// Las acciones de estado (setup, ajustes, ejecución sobre la biblioteca) devuelven el estado completo actualizado.
export const aiApi = {
    async getStatus() {
        return unwrap(await apiClient.get("/ai/status"));
    },
    async setup() {
        return unwrap(await apiClient.post("/ai/setup"));
    },
    async removeModels() {
        return unwrap(await apiClient.delete("/ai/models"));
    },
    // { strictness?, excludedTags? (nombres de tag) }
    async updateSettings(settings) {
        return unwrap(await apiClient.put("/ai/settings", settings));
    },
    // Sugerencias sin aplicarlas: [{ id, status, reason, tags: [{ tagname, score, source }] }].
    async suggest(mediaIds) {
        return unwrap(await apiClient.post("/ai/suggestions", { mediaIds }));
    },
    // Añade las tags sugeridas: { processedCount, changedCount, addedCount, blockedCount, failedCount }.
    async tagMedia(mediaIds) {
        return unwrap(await apiClient.post("/ai/tag", { mediaIds }));
    },
    async startLibraryRun() {
        return unwrap(await apiClient.post("/ai/library-run"));
    },
    async cancelLibraryRun() {
        return unwrap(await apiClient.delete("/ai/library-run"));
    },
};
