import { apiClient } from "./apiClient";

const authConfig = (accessToken) => ({
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
});

const unwrap = (response, fallbackMessage) => {
    const payload = response.data;

    if (!payload?.success) {
        throw new Error(payload?.message || fallbackMessage);
    }

    return payload.data;
};

export const metadataQueryKeys = {
    all: ["metadata"],
};

export const metadataApi = {
    async getAll(accessToken) {
        const config = authConfig(accessToken);
        const [tagsResponse, displayNamesResponse, authorsResponse] = await Promise.all([
            apiClient.get("/tags", config),
            apiClient.get("/media/displaynames", config),
            apiClient.get("/media/authors", config),
        ]);

        return {
            tags: unwrap(tagsResponse, "Could not load tags") || [],
            displayNames: unwrap(displayNamesResponse, "Could not load media names") || [],
            authors: unwrap(authorsResponse, "Could not load authors") || [],
        };
    },

    async save({ managerType, item, values, accessToken }) {
        const config = authConfig(accessToken);

        if (managerType === "tags") {
            const payload = { tagname: values.name, tagcolor_hex: values.color, type: values.type };
            const response = item?.id
                ? await apiClient.put(`/tags/${item.id}`, payload, config)
                : await apiClient.post("/tags", payload, config);
            return unwrap(response, "Could not save tag");
        }

        const isDisplayName = managerType === "displaynames";
        const endpoint = isDisplayName ? "/media/displaynames" : "/media/authors";
        const payload = item?.value
            ? { previousValue: item.value, nextValue: values.name }
            : isDisplayName
              ? { displayname: values.name }
              : { author: values.name };
        const response = item?.value
            ? await apiClient.put(endpoint, payload, config)
            : await apiClient.post(endpoint, payload, config);
        return unwrap(response, "Could not save value");
    },

    async remove({ managerType, item, accessToken }) {
        const config = authConfig(accessToken);

        if (managerType === "tags") {
            return unwrap(await apiClient.delete(`/tags/${item.id}`, config), "Could not delete tag");
        }

        const endpoint = managerType === "displaynames" ? "/media/displaynames" : "/media/authors";
        return unwrap(
            await apiClient.delete(endpoint, { ...config, data: { value: item.value } }),
            "Could not delete value",
        );
    },
};
