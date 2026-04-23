import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TagFilterContext = createContext(null);
const DEFAULT_FILTER_MODE = "include";
const LEGACY_FILTER_TAGS_STORAGE_KEY = "tagged:selectedFilterTags";
const LEGACY_FILTER_MODE_STORAGE_KEY = "tagged:tagFilterMode";
const INCLUDE_FILTER_TAGS_STORAGE_KEY = "tagged:includeFilterTags";
const EXCLUDE_FILTER_TAGS_STORAGE_KEY = "tagged:excludeFilterTags";

const normalizeTagList = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
        .filter((tag, index, arr) => arr.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index);
};

const getLegacyFilterTags = () => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const rawValue = window.localStorage.getItem(LEGACY_FILTER_TAGS_STORAGE_KEY);
        if (!rawValue) {
            return [];
        }

        return normalizeTagList(JSON.parse(rawValue));
    } catch {
        return [];
    }
};

const getLegacyFilterMode = () => {
    if (typeof window === "undefined") {
        return DEFAULT_FILTER_MODE;
    }

    const rawValue = String(window.localStorage.getItem(LEGACY_FILTER_MODE_STORAGE_KEY) || "")
        .trim()
        .toLowerCase();

    if (rawValue === "include" || rawValue === "exclude") {
        return rawValue;
    }

    return DEFAULT_FILTER_MODE;
};

const getStoredIncludeFilterTags = () => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const rawValue = window.localStorage.getItem(INCLUDE_FILTER_TAGS_STORAGE_KEY);

        if (rawValue) {
            return normalizeTagList(JSON.parse(rawValue));
        }
    } catch {
        return [];
    }

    const legacyTags = getLegacyFilterTags();
    return getLegacyFilterMode() === "include" ? legacyTags : [];
};

const getStoredExcludeFilterTags = () => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const rawValue = window.localStorage.getItem(EXCLUDE_FILTER_TAGS_STORAGE_KEY);

        if (rawValue) {
            return normalizeTagList(JSON.parse(rawValue));
        }
    } catch {
        return [];
    }

    const legacyTags = getLegacyFilterTags();
    return getLegacyFilterMode() === "exclude" ? legacyTags : [];
};

export const TagFilterProvider = ({ children }) => {
    const [selectedIncludeFilterTags, setSelectedIncludeFilterTags] = useState(getStoredIncludeFilterTags);
    const [selectedExcludeFilterTags, setSelectedExcludeFilterTags] = useState(getStoredExcludeFilterTags);
    const [tagFilterMode, setTagFilterMode] = useState(getLegacyFilterMode);

    const selectedFilterTags = useMemo(
        () => (tagFilterMode === "exclude" ? selectedExcludeFilterTags : selectedIncludeFilterTags),
        [tagFilterMode, selectedExcludeFilterTags, selectedIncludeFilterTags],
    );

    const toggleTagInList = (setList, tagName) => {
        setList((previous) => {
            const alreadySelected = previous.some((tag) => tag.toLowerCase() === tagName.toLowerCase());

            if (alreadySelected) {
                return previous.filter((tag) => tag.toLowerCase() !== tagName.toLowerCase());
            }

            return [...previous, tagName];
        });
    };

    const toggleIncludeFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedExcludeFilterTags((previous) =>
            previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase()),
        );
        toggleTagInList(setSelectedIncludeFilterTags, normalized);
    };

    const toggleExcludeFilterTag = (tagName) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        setSelectedIncludeFilterTags((previous) =>
            previous.filter((tag) => tag.toLowerCase() !== normalized.toLowerCase()),
        );
        toggleTagInList(setSelectedExcludeFilterTags, normalized);
    };

    const toggleFilterTag = (tagName, mode = tagFilterMode) => {
        const normalized = String(tagName || "").trim();

        if (!normalized) {
            return;
        }

        if (String(mode || "").toLowerCase() === "exclude") {
            toggleExcludeFilterTag(normalized);
            return;
        }

        toggleIncludeFilterTag(normalized);
    };

    const clearFilterTags = () => {
        setSelectedIncludeFilterTags([]);
        setSelectedExcludeFilterTags([]);
    };

    const setFilterMode = (mode) => {
        const normalizedMode = String(mode || "")
            .trim()
            .toLowerCase();

        if (normalizedMode !== "include" && normalizedMode !== "exclude") {
            return;
        }

        setTagFilterMode(normalizedMode);
    };

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(INCLUDE_FILTER_TAGS_STORAGE_KEY, JSON.stringify(selectedIncludeFilterTags));
    }, [selectedIncludeFilterTags]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(EXCLUDE_FILTER_TAGS_STORAGE_KEY, JSON.stringify(selectedExcludeFilterTags));
    }, [selectedExcludeFilterTags]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(LEGACY_FILTER_MODE_STORAGE_KEY, tagFilterMode);
        window.localStorage.setItem(LEGACY_FILTER_TAGS_STORAGE_KEY, JSON.stringify(selectedFilterTags));
    }, [tagFilterMode, selectedFilterTags]);

    return (
        <TagFilterContext.Provider
            value={{
                selectedFilterTags,
                tagFilterMode,
                selectedIncludeFilterTags,
                selectedExcludeFilterTags,
                toggleFilterTag,
                toggleIncludeFilterTag,
                toggleExcludeFilterTag,
                clearFilterTags,
                setFilterMode,
            }}
        >
            {children}
        </TagFilterContext.Provider>
    );
};

export const useTagFilter = () => {
    const ctx = useContext(TagFilterContext);

    if (!ctx) {
        throw new Error("useTagFilter must be used within TagFilterProvider");
    }

    return ctx;
};
