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

export const normalizeHexColor = (input) => {
    const raw = String(input || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        const [, r, g, b] = raw;
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return null;
};

const getHexRgb = (hexColor) => {
    const normalized = normalizeHexColor(hexColor);
    if (!normalized) return null;
    const parsed = Number.parseInt(normalized.slice(1), 16);
    return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255, hex: normalized };
};

const getRelativeLuminance = ({ r, g, b }) => {
    const toLinear = (channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const toHexChannel = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

const mixRgbWithWhite = (rgb, amount = 0.5) => {
    const ratio = Math.max(0, Math.min(1, amount));
    const mix = (channel) => channel + (255 - channel) * ratio;
    return `#${toHexChannel(mix(rgb.r))}${toHexChannel(mix(rgb.g))}${toHexChannel(mix(rgb.b))}`;
};

export const buildTagChipStyle = (hexColor) => {
    const rgb = isDefaultTagColor(hexColor) ? null : getHexRgb(hexColor);
    if (!rgb) return buildDefaultTagStyle();

    const darkTheme = typeof document !== "undefined" && document.documentElement?.getAttribute("data-theme") === "dark";
    const luminance = getRelativeLuminance(rgb);
    const isNearWhite = luminance > 0.88;

    if (darkTheme) {
        const isDarkTone = luminance < 0.3;
        const liftedTone = isDarkTone ? mixRgbWithWhite(rgb, luminance < 0.12 ? 0.72 : 0.56) : rgb.hex;
        return {
            backgroundColor: isNearWhite ? "rgba(255, 255, 255, 0.16)" : `${liftedTone}38`,
            color: isNearWhite ? "#f7f9ff" : liftedTone,
            borderColor: isNearWhite ? "rgba(255, 255, 255, 0.72)" : `${liftedTone}BB`,
            borderWidth: "2px",
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.3)",
        };
    }

    return {
        backgroundColor: `${rgb.hex}22`,
        color: luminance > 0.72 ? "#111111" : rgb.hex,
        borderColor: isNearWhite ? "rgba(0, 0, 0, 0.22)" : `${rgb.hex}66`,
        borderWidth: "2px",
        boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.22)",
    };
};
