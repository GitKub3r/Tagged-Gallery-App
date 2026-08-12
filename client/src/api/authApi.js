import { apiClient } from "./apiClient";

const getErrorMessage = (error, fallback) =>
    error.response?.data?.message || error.message || fallback;

export const authApi = {
    async getCurrentUser(accessToken) {
        const { data } = await apiClient.get("/users/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
            _skipErrorToast: true,
        });
        return data;
    },

    async login(credentials) {
        try {
            const { data } = await apiClient.post("/users/login", credentials, { _skipAuth: true });
            return data;
        } catch (error) {
            throw new Error(getErrorMessage(error, "Unable to sign in"));
        }
    },

    async register(user) {
        try {
            const { data } = await apiClient.post("/users", { ...user, type: "basic" }, { _skipAuth: true });
            return data;
        } catch (error) {
            throw new Error(getErrorMessage(error, "Unable to register user"));
        }
    },

    async refresh(refreshToken, { skipErrorToast = false } = {}) {
        const { data } = await apiClient.post("/auth/refresh", { refreshToken }, { _skipAuth: true, _skipErrorToast: skipErrorToast });
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
