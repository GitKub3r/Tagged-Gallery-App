const normalizeSuggestionText = (value) => String(value || "").trim().toLowerCase();

const getMatchRank = (label, query) => {
    if (!query) return 0;
    if (label === query) return 0;
    if (label.startsWith(query)) return 1;
    if (label.split(/\s+/).some((word) => word.startsWith(query))) return 2;
    if (label.includes(query)) return 3;
    return Number.POSITIVE_INFINITY;
};

export const rankSuggestions = (items, query, getLabel = (item) => item) => {
    const normalizedQuery = normalizeSuggestionText(query);

    return [...items]
        .map((item) => ({ item, label: normalizeSuggestionText(getLabel(item)) }))
        .filter(({ label }) => label && (!normalizedQuery || label.includes(normalizedQuery)))
        .sort((a, b) => {
            const rankDifference = getMatchRank(a.label, normalizedQuery) - getMatchRank(b.label, normalizedQuery);
            if (rankDifference !== 0) return rankDifference;

            if (normalizedQuery) {
                const lengthDifference = a.label.length - b.label.length;
                if (lengthDifference !== 0) return lengthDifference;
            }

            return a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true });
        })
        .map(({ item }) => item);
};
