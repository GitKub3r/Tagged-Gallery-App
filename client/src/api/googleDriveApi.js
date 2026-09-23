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
};

export const googleDriveApi = {
    async getStatus() {
        return unwrap(await apiClient.get("/google-drive/status"));
    },
    async connect(code) {
        return unwrap(await apiClient.post("/google-drive/connect", { code }));
    },
    async disconnect() {
        return unwrap(await apiClient.post("/google-drive/disconnect"));
    },
};
