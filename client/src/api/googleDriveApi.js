import { apiClient } from "./apiClient";

const unwrap = (response) => {
    if (!response.data?.success) {
        throw new Error(response.data?.message || "Google Drive request failed");
    }
    return response.data.data;
};

export const googleDriveQueryKeys = {
    all: ["google-drive"],
    status: (userId) => ["google-drive", "status", userId],
    summaryAll: ["google-drive", "summary"],
    summary: (userId) => ["google-drive", "summary", userId],
    preview: (fileId) => ["google-drive", "preview", fileId],
    browseAll: ["google-drive", "browse"],
    browse: ({ view, folderId, search }) => ["google-drive", "browse", view, folderId || null, search || ""],
};

export const googleDriveApi = {
    async getStatus() {
        return unwrap(await apiClient.get("/google-drive/status"));
    },
    async getSummary() {
        return unwrap(await apiClient.get("/google-drive/summary"));
    },
    async connect(code) {
        return unwrap(await apiClient.post("/google-drive/connect", { code }));
    },
    async browse({ view, folderId, search, pageToken }) {
        return unwrap(await apiClient.get("/google-drive/browse", { params: { view, folderId: folderId || undefined, search: search || undefined, pageToken: pageToken || undefined } }));
    },
    async expandSelection(items) {
        return unwrap(await apiClient.post("/google-drive/expand", { items }));
    },
    async getPreviews(fileIds) {
        return unwrap(await apiClient.post("/google-drive/previews", { fileIds }));
    },
    async linkFiles(payload) {
        return unwrap(await apiClient.post("/google-drive/link", payload));
    },
    async disconnect() {
        return unwrap(await apiClient.post("/google-drive/disconnect"));
    },
};
