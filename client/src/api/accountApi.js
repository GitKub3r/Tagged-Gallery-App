import { apiClient } from "./apiClient";

const authConfig = (accessToken) => ({ headers: { Authorization: `Bearer ${accessToken}` } });
const message = (error, fallback) => error.response?.data?.message || error.message || fallback;

export const accountApi = {
    async updateProfile(profile, accessToken) {
        try {
            const { data } = await apiClient.put("/users/me", profile, authConfig(accessToken));
            return data;
        } catch (error) {
            throw new Error(message(error, "Unable to update profile"));
        }
    },
    async changePassword(passwords, accessToken) {
        try {
            const { data } = await apiClient.put("/users/me/password", passwords, authConfig(accessToken));
            return data;
        } catch (error) {
            throw new Error(message(error, "Unable to change password"));
        }
    },
    async updateAvatar(file, accessToken) {
        try {
            const formData = new FormData();
            formData.append("avatar", file, "avatar.jpg");
            const { data } = await apiClient.put("/users/me/avatar", formData, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            return data;
        } catch (error) {
            throw new Error(message(error, "Unable to update profile image"));
        }
    },
    async resetAvatar(accessToken) {
        try {
            const { data } = await apiClient.delete("/users/me/avatar", authConfig(accessToken));
            return data;
        } catch (error) {
            throw new Error(message(error, "Unable to remove profile image"));
        }
    },
};
