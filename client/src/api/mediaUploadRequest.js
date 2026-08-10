import { apiClient } from "./apiClient";

export const createMediaUploadRequest = ({ files, displayName = "", author = "", tags = [] }) => {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error("At least one file is required");
    }

    const isMultiple = files.length > 1;
    const formData = new FormData();

    formData.append("displayname", String(displayName).trim());
    formData.append("author", String(author).trim());
    formData.append("tag_names", JSON.stringify(tags));

    if (isMultiple) {
        files.forEach((file) => formData.append("files", file));
    } else {
        formData.append("file", files[0]);
    }

    return {
        endpoint: isMultiple ? "/media/upload/multiple" : "/media/upload",
        formData,
        isMultiple,
    };
};

export const uploadMedia = async ({ files, displayName, author, tags, onUploadProgress }) => {
    const { endpoint, formData } = createMediaUploadRequest({ files, displayName, author, tags });
    const accessToken = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;

    const response = await apiClient.post(endpoint, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        onUploadProgress,
    });

    return response.data;
};
