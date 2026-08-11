import axios from "axios";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

let refreshPromise = null;

apiClient.interceptors.request.use((config) => {
    if (config.headers?.Authorization) {
        const latestAccessToken = localStorage.getItem("accessToken");
        if (latestAccessToken) config.headers.Authorization = `Bearer ${latestAccessToken}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
            return Promise.reject(error);
        }

        const request = error.config;
        const isAuthenticatedRequest = Boolean(request?.headers?.Authorization);

        if (error.response?.status === 401 && isAuthenticatedRequest && !request._retriedAfterRefresh) {
            request._retriedAfterRefresh = true;
            const refreshToken = localStorage.getItem("refreshToken");
            if (refreshToken) {
                try {
                    refreshPromise ||= axios.post(`${API_URL}/auth/refresh`, { refreshToken }).finally(() => { refreshPromise = null; });
                    const { data } = await refreshPromise;
                    const accessToken = data.data?.accessToken;
                    if (accessToken) {
                        localStorage.setItem("accessToken", accessToken);
                        request.headers.Authorization = `Bearer ${accessToken}`;
                        return apiClient.request(request);
                    }
                } catch (refreshError) {
                    localStorage.removeItem("user");
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    window.dispatchEvent(new Event("tagged:session-invalidated"));
                    if (!request?._skipErrorToast) {
                        toast.error(refreshError.response?.data?.message || refreshError.message || "Could not refresh the session", { id: "session-refresh-error" });
                    }
                    return Promise.reject(refreshError);
                }
            }
        }

        if (!request?._skipErrorToast) {
            toast.error(error.response?.data?.message || error.message || "Something went wrong");
        }
        return Promise.reject(error);
    },
);
