import { apiClient } from "./apiClient";

const getErrorMessage = (error, fallback) =>
    error.response?.data?.message || error.message || fallback;

export const authApi = {
    async login(credentials) {
        try {
            const { data } = await apiClient.post("/users/login", credentials);
            return data;
        } catch (error) {
            throw new Error(getErrorMessage(error, "Unable to sign in"));
        }
    },

    async register(user) {
        try {
            const { data } = await apiClient.post("/users", { ...user, type: "basic" });
            return data;
        } catch (error) {
            throw new Error(getErrorMessage(error, "Unable to register user"));
        }
    },

    async refresh(refreshToken, { skipErrorToast = false } = {}) {
        const { data } = await apiClient.post("/auth/refresh", { refreshToken }, { _skipErrorToast: skipErrorToast });
        return data;
    },

    async logout(refreshToken) {
        await apiClient.post("/auth/logout", { refreshToken });
    },

    async logoutAll(accessToken) {
        const { data } = await apiClient.post("/auth/logout-all", {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return data;
    },
};
