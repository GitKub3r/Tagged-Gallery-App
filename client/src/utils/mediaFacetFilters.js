const normalizeValue = (value) => String(value || "").trim();

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

export const matchesMediaFacetFilters = (media, serializedFilters) => {
    const filters = parseMediaFacetFilters(serializedFilters);
    const names = filters.filter((filter) => filter.type === "name").map((filter) => filter.value.toLowerCase());
    const authors = filters.filter((filter) => filter.type === "author").map((filter) => filter.value.toLowerCase());
    const mediaName = normalizeValue(media?.displayname).toLowerCase();
    const mediaAuthor = normalizeValue(media?.author).toLowerCase();

    return (names.length === 0 || names.some((name) => mediaName === name)) &&
        (authors.length === 0 || authors.some((author) => mediaAuthor === author));
};
