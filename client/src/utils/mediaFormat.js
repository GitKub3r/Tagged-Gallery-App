export const formatMediaSize = (sizeInBytes) => {
    const size = Number(sizeInBytes);
    if (!Number.isFinite(size) || size <= 0) return "0 KB";

    const units = ["KB", "MB", "GB"];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
};

export const formatMediaResolution = (width, height) => {
    const normalizedWidth = Math.round(Number(width));
    const normalizedHeight = Math.round(Number(height));
    return normalizedWidth > 0 && normalizedHeight > 0 ? `${normalizedWidth} × ${normalizedHeight}` : "Resolution unavailable";
};
