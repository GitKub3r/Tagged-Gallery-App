const normalizeValue = (value) => String(value || "").trim();
const MEDIA_NAME_MATCH_MODE_STORAGE_KEY = "tagged:media-name-match-mode";

export const getMediaNameMatchMode = () => {
    if (typeof window === "undefined") return "normal";
    return window.localStorage.getItem(MEDIA_NAME_MATCH_MODE_STORAGE_KEY) === "strict" ? "strict" : "normal";
};

export const storeMediaNameMatchMode = (mode) => {
    const normalizedMode = mode === "strict" ? "strict" : "normal";
    window.localStorage.setItem(MEDIA_NAME_MATCH_MODE_STORAGE_KEY, normalizedMode);
    return normalizedMode;
};

const decodeFilterValue = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

export const parseMediaFacetFilters = (value) => {
    const filters = [];

    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => {
            const separatorIndex = token.indexOf(":");
            if (separatorIndex < 1) return;

            const prefix = token.slice(0, separatorIndex).toLowerCase();
            const decodedValue = normalizeValue(decodeFilterValue(token.slice(separatorIndex + 1)));
            const type = prefix === "a" || prefix === "author" ? "author" : prefix === "n" || prefix === "name" ? "name" : null;

            if (type && decodedValue && !filters.some((filter) => filter.type === type && filter.value.toLowerCase() === decodedValue.toLowerCase())) {
                filters.push({ type, value: decodedValue });
            }
        });

    return filters;
};

export const serializeMediaFacetFilters = (filters) =>
    filters
        .map((filter) => `${filter.type === "author" ? "a" : "n"}:${encodeURIComponent(normalizeValue(filter.value))}`)
        .join(" ");

export const matchesMediaFacetFilters = (media, serializedFilters, nameMatchMode = getMediaNameMatchMode()) => {
    const filters = parseMediaFacetFilters(serializedFilters);
    const names = filters.filter((filter) => filter.type === "name").map((filter) => filter.value.toLowerCase());
    const authors = filters.filter((filter) => filter.type === "author").map((filter) => filter.value.toLowerCase());
    const mediaName = normalizeValue(media?.displayname).toLowerCase();
    const mediaAuthor = normalizeValue(media?.author).toLowerCase();

    const matchesName = (name) => nameMatchMode === "strict" ? mediaName === name : mediaName.includes(name);

    return (names.length === 0 || names.some(matchesName)) &&
        (authors.length === 0 || authors.some((author) => mediaAuthor === author));
};
