export const LEGACY_DEFAULT_TAG_COLOR = "#643aff";

export const isDefaultTagColor = (hexColor) => {
    const normalizedColor = String(hexColor || "").trim().toLowerCase();
    return !normalizedColor || normalizedColor === LEGACY_DEFAULT_TAG_COLOR;
};

export const buildDefaultTagStyle = ({ darkSurface = false, hoverColorVariable } = {}) => {
    const variablePrefix = darkSurface ? "--tagged-default-tag-dark" : "--tagged-default-tag";
    const textColor = `var(${variablePrefix}-text)`;

    return {
        backgroundColor: `var(${variablePrefix}-background)`,
        color: textColor,
        borderColor: `var(${variablePrefix}-border)`,
        borderWidth: "1px",
        boxShadow: "none",
        ...(hoverColorVariable ? { [hoverColorVariable]: textColor } : {}),
    };
};
