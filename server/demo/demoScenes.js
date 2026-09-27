// Escenas de la biblioteca demo dibujadas en SVG (sharp las convierte en imágenes). Son deterministas: la misma
// semilla produce siempre la misma imagen, así cada reset de la demo es idéntico. Para que ninguna imagen se
// parezca a otra, cada familia tiene varias composiciones (variant) y cada media desplaza el tono de su paleta.

// PRNG mulberry32: números entre 0 y 1 a partir de una semilla entera.
const createRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const between = (random, min, max) => min + random() * (max - min);
const pick = (random, items) => items[Math.floor(random() * items.length)];
const round = (value) => Math.round(value * 10) / 10;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

// ---- Color ----

const hexToRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, "0")).join("")}`;
const mix = (from, to, amount) => {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * amount));
};

const hexToHsl = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    if (max === min) return [0, 0, lightness];
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return [hue * 60, saturation, lightness];
};

const hslToHex = (hue, saturation, lightness) => {
    const k = (n) => (n + hue / 30) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const f = (n) => lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
};

// Desplaza todos los colores de una paleta (en cualquier nivel de anidación) con el mismo giro de tono.
const shiftPalette = (value, shift) => {
    if (typeof value === "string" && value.startsWith("#")) {
        const [hue, saturation, lightness] = hexToHsl(value);
        return hslToHex((hue + shift.hue + 360) % 360, clamp01(saturation * shift.saturation), clamp01(lightness + shift.lightness));
    }
    if (Array.isArray(value)) return value.map((item) => shiftPalette(item, shift));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shiftPalette(item, shift)]));
    return value;
};

// ---- SVG ----

const svg = (width, height, defs, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`;

const verticalGradient = (id, stops) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</linearGradient>`;

const glow = (id, color) => `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="0.85"/><stop offset="0.35" stop-color="${color}" stop-opacity="0.25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const blur = (id, deviation) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.max(1, Math.round(deviation))}"/></filter>`;

const rect = (x, y, width, height, fill, extra = "") => `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="${fill}" ${extra}/>`;
const circle = (x, y, r, fill, extra = "") => `<circle cx="${round(x)}" cy="${round(y)}" r="${round(r)}" fill="${fill}" ${extra}/>`;
const polygon = (points, fill, extra = "") => `<polygon points="${points.map(([x, y]) => `${round(x)},${round(y)}`).join(" ")}" fill="${fill}" ${extra}/>`;

// Refleja un grupo respecto a una línea horizontal (lagos, ríos, salares).
const mirror = (content, axisY, opacity, filter = "soft") =>
    `<g transform="matrix(1 0 0 -1 0 ${round(axisY * 2)})" opacity="${opacity}" filter="url(#${filter})">${content}</g>`;

// Perfil de una cordillera por desplazamiento del punto medio: devuelve alturas entre 0 y 1.
const ridgeProfile = (random, roughness, points = 129) => {
    const heights = new Array(points).fill(0);
    heights[0] = random();
    heights[points - 1] = random();
    let step = points - 1;
    let displacement = 1;
    while (step > 1) {
        const half = step / 2;
        for (let index = half; index < points; index += step) {
            heights[index] = (heights[index - half] + heights[index + half]) / 2 + (random() - 0.5) * displacement;
        }
        displacement *= roughness;
        step = half;
    }
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    return heights.map((value) => (value - min) / (max - min || 1));
};

// Silueta de cordillera: de "top" a "top + depth", rellena hasta "bottom".
const ridgePath = (random, width, bottom, top, depth, roughness) => {
    const profile = ridgeProfile(random, roughness);
    const points = profile.map((value, index) => `${round((index / (profile.length - 1)) * width)},${round(top + (1 - value) * depth)}`);
    return `M0,${round(bottom)} L${points.join(" L")} L${width},${round(bottom)} Z`;
};

// Colinas suaves: curva cuadrática con varias crestas.
const hillPath = (random, width, bottom, base, height, crests) => {
    let path = `M0,${round(bottom)} L0,${round(base)}`;
    for (let crest = 0; crest < crests; crest += 1) {
        const x1 = ((crest + 0.5) / crests) * width + between(random, -width * 0.06, width * 0.06);
        const x2 = ((crest + 1) / crests) * width;
        path += ` Q${round(x1)},${round(base - between(random, height * 0.4, height))} ${round(x2)},${round(base + between(random, -height * 0.2, height * 0.25))}`;
    }
    return `${path} L${width},${round(bottom)} Z`;
};

const stars = (random, width, height, count, color = "#ffffff", top = 0) =>
    Array.from({ length: count }, () => circle(random() * width, top + random() * height, between(random, 0.6, 2.2), color, `opacity="${round(between(random, 0.25, 0.95))}"`)).join("");

const sunDisc = (x, y, radius, color) => circle(x, y, radius * 5, "url(#sun)") + circle(x, y, radius, color);

// Luna creciente: disco claro tapado en parte por otro del color del cielo.
const crescent = (x, y, radius, color, sky) => circle(x, y, radius * 4, "url(#sun)") + circle(x, y, radius, color) + circle(x + radius * 0.42, y - radius * 0.22, radius * 0.88, sky);

const clouds = (random, width, height, color, count, top, spread) =>
    `<g filter="url(#cloud)">${Array.from({ length: count }, () =>
        `<ellipse cx="${round(random() * width)}" cy="${round(top + random() * spread)}" rx="${round(width * between(random, 0.12, 0.3))}" ry="${round(height * between(random, 0.025, 0.06))}" fill="${color}" opacity="${round(between(random, 0.35, 0.8))}"/>`,
    ).join("")}</g>`;

const ripples = (random, width, top, bottom, color, count = 30) =>
    Array.from({ length: count }, () => {
        const y = top + random() ** 1.6 * (bottom - top);
        const lineWidth = width * between(random, 0.05, 0.3);
        return rect(random() * width - lineWidth / 2, y, lineWidth, 1.5 + (y - top) / 200, color, `opacity="${round(between(random, 0.08, 0.22))}"`);
    }).join("");

const pine = (x, base, treeHeight, color) => {
    const tiers = [0, 0.28, 0.52]
        .map((start, index) => {
            const top = base - treeHeight + start * treeHeight * 0.7;
            const bottom = base - treeHeight * (0.45 - index * 0.2);
            const half = treeHeight * 0.34 * (0.55 + index * 0.25);
            return `M${round(x)},${round(top)} L${round(x + half)},${round(bottom)} L${round(x - half)},${round(bottom)} Z`;
        })
        .join(" ");
    return `<path d="${tiers}" fill="${color}"/>${rect(x - treeHeight * 0.015, base - treeHeight * 0.2, treeHeight * 0.03, treeHeight * 0.25, color)}`;
};

const pineRow = (random, width, base, size, color, density = [0.18, 0.4]) => {
    let trees = "";
    for (let x = -size * 0.2; x < width + size * 0.2; x += size * between(random, density[0], density[1])) {
        trees += pine(x, base + between(random, 0, size * 0.08), size * between(random, 0.7, 1.15), color);
    }
    return trees;
};

// ---- Paletas base (cada media las desplaza un poco) ----

const PALETTES = {
    mountains: {
        dawn: { sky: ["#23395d", "#f2a65a"], sun: "#ffd29b", ridges: ["#6f7fa6", "#4d5b82", "#34405f", "#1f2740"], mist: "#f6c9a0" },
        alpine: { sky: ["#6fa8dc", "#e8f1f8"], sun: "#fffbe6", ridges: ["#a9bfd6", "#7d97b5", "#4f6b8c", "#2b3f57"], mist: "#ffffff" },
        dusk: { sky: ["#1b1f3b", "#c05a6a"], sun: "#ff9f80", ridges: ["#5c4a72", "#43365a", "#2d2440", "#1a1528"], mist: "#e9829a" },
        snow: { sky: ["#b8c6d9", "#eef2f7"], sun: "#ffffff", ridges: ["#dfe7f1", "#c5d2e2", "#9fb2c9", "#6d819b"], mist: "#ffffff" },
        bluehour: { sky: ["#0d1b3d", "#5b7bb4"], sun: "#dbe7ff", ridges: ["#3f5a8a", "#2c4270", "#1d2e54", "#101c38"], mist: "#8fa8d8" },
        fjord: { sky: ["#3a6f8f", "#f4d9b0"], sun: "#fff1cf", ridges: ["#7b98a8", "#557689", "#35566b", "#1d3848"], mist: "#f2e0c4" },
    },
    sea: {
        sunset: { sky: ["#2b1d4a", "#ff8a5b"], sun: "#ffd27a", sea: ["#e07a5f", "#2a1f3d"], island: "#1f1730" },
        golden: { sky: ["#f7b267", "#fde9c9"], sun: "#fff4d6", sea: ["#f4a259", "#5b4a6b"], island: "#4a3a52" },
        pastel: { sky: ["#a8c5da", "#f6e3e7"], sun: "#fffaf2", sea: ["#c9dde8", "#6f8fa6"], island: "#8aa1b3" },
        overcast: { sky: ["#8e9aa6", "#d6dbe0"], sun: "#f4f6f8", sea: ["#aeb8c2", "#4f5d6b"], island: "#6b7785" },
        night: { sky: ["#070b1c", "#243b6b"], sun: "#e8eeff", sea: ["#2f4a7a", "#050814"], island: "#0b1128" },
        tropical: { sky: ["#3fa7d6", "#e3f6fb"], sun: "#fffdf0", sea: ["#2ec4b6", "#0b6e7f"], island: "#1d5c63" },
        storm: { sky: ["#2f3542", "#7f8c99"], sun: "#e8ecef", sea: ["#57606f", "#1e272e"], island: "#1b1f24" },
        rose: { sky: ["#6b4c9a", "#f7c6d9"], sun: "#fff0f5", sea: ["#d8a7c9", "#4b3a6b"], island: "#3d2c55" },
    },
    city: {
        neon: { sky: ["#07061a", "#2a1450"], moon: "#f3e9ff", buildings: ["#1b1740", "#120f2e", "#0a0820"], windows: ["#ff5fa2", "#5ce1ff", "#ffd166"] },
        amber: { sky: ["#0b0f1f", "#3b2a4d"], moon: "#fff3d6", buildings: ["#241f38", "#181426", "#0e0b18"], windows: ["#ffc46b", "#ffe2a8", "#ff9a4d"] },
        blue: { sky: ["#0a1a33", "#3f6fa3"], moon: "#e6f0ff", buildings: ["#1c3150", "#13243d", "#0b1729"], windows: ["#ffe6a3", "#a8d8ff", "#ffffff"] },
        rose: { sky: ["#2d1b3d", "#b85c7a"], moon: "#ffe3ec", buildings: ["#3a2140", "#2a1730", "#1a0e1f"], windows: ["#ffb3c7", "#ffd6a5", "#fff1e6"] },
        teal: { sky: ["#021a1f", "#0f4c5c"], moon: "#e0fbfc", buildings: ["#0b2d36", "#07212a", "#03151b"], windows: ["#5ef2d0", "#e0fbfc", "#ffd166"] },
    },
    desert: {
        noon: { sky: ["#6fb1e6", "#f3e3c3"], sun: "#fffbe8", dunes: ["#e9c28b", "#dca56a", "#c9864a", "#a8673a"] },
        sunset: { sky: ["#3a2458", "#ff9966"], sun: "#ffcf8a", dunes: ["#d7875c", "#b86645", "#8f4a36", "#5e2f2a"] },
        red: { sky: ["#f2c7a1", "#fbe8d3"], sun: "#fff7ec", dunes: ["#d9794e", "#c0603c", "#9c4a2f", "#723523"] },
        night: { sky: ["#05081a", "#1d2a55"], sun: "#f1f4ff", dunes: ["#2e3558", "#232946", "#191e36", "#10142a"] },
    },
    forest: {
        mist: { sky: ["#c9d3cf", "#eef2ef"], layers: ["#a7b8b0", "#7f988c", "#56705f", "#2f4336"] },
        dawn: { sky: ["#f1c9a5", "#fbeee2"], layers: ["#c9a99a", "#8f7f7a", "#5a5a5d", "#2c3136"] },
        deep: { sky: ["#3c5a4c", "#9fb8a6"], layers: ["#6d8c7a", "#4b6b58", "#2f4a3a", "#172a20"] },
    },
    aurora: {
        green: { sky: ["#020714", "#0e2233"], bands: ["#3dffa8", "#18c9a0", "#7b61ff"], land: "#03060c" },
        violet: { sky: ["#05031a", "#1b1440"], bands: ["#b86bff", "#4de1c1", "#ff6fb1"], land: "#05030f" },
        teal: { sky: ["#010b10", "#0b2a33"], bands: ["#56f0d0", "#3aa0ff", "#9cff6b"], land: "#02080b" },
        crimson: { sky: ["#0a0310", "#2a0d1e"], bands: ["#ff4d6d", "#ffb3c1", "#c77dff"], land: "#070208" },
    },
    abstract: {
        bauhaus: { background: "#efe6d6", colors: ["#d9482b", "#1f3a93", "#f2b134", "#1b1b1b", "#efe6d6"] },
        nord: { background: "#e5e9f0", colors: ["#5e81ac", "#bf616a", "#ebcb8b", "#2e3440", "#a3be8c"] },
        mono: { background: "#f2f2f2", colors: ["#111111", "#555555", "#9a9a9a", "#d4d4d4", "#f2f2f2"] },
        night: { background: "#141821", colors: ["#e76f51", "#f4a261", "#2a9d8f", "#e9c46a", "#264653"] },
    },
    blobs: {
        pastel: { background: "#f6efe9", colors: ["#f7a8b8", "#a8d8f0", "#c3b1e1", "#ffd6a5"] },
        dusk: { background: "#1d1a2f", colors: ["#ff7eb3", "#7afcff", "#feff9c", "#9b5de5"] },
        sea: { background: "#e6f1f5", colors: ["#48cae4", "#90e0ef", "#0077b6", "#caf0f8"] },
        ember: { background: "#1a1110", colors: ["#ff6b35", "#f7c59f", "#efa00b", "#d62246"] },
    },
    bokeh: {
        city: { background: ["#0b0b14", "#1a1426"], colors: ["#ffb347", "#ff6f91", "#6fc3ff", "#ffe08a"] },
        warm: { background: ["#140a05", "#2a1408"], colors: ["#ffcf70", "#ff9a3c", "#fff1c1", "#ff6b3d"] },
    },
};

// ---- Montañas: ridges, peak, lake, night, pines, clouds ----

const mountains = (random, width, height, palette, frame, variant) => {
    const skyColors = variant === "night" ? [mix(palette.sky[0], "#000000", 0.55), mix(palette.sky[0], palette.ridges[2], 0.5)] : palette.sky;
    const defs =
        verticalGradient("sky", [[0, skyColors[0]], [1, skyColors[1]]]) +
        glow("sun", palette.sun) +
        verticalGradient("mist", [[0, palette.mist, 0], [1, palette.mist, 0.8]]) +
        verticalGradient("water", [[0, mix(palette.sky[1], palette.ridges[3], 0.45)], [1, mix(palette.sky[0], palette.ridges[3], 0.7)]]) +
        blur("soft", height * 0.012) +
        blur("cloud", height * 0.025);
    const sunX = between(random, width * 0.15, width * 0.85);
    const sunY = height * between(random, 0.16, 0.36);
    const sunR = Math.min(width, height) * between(random, 0.035, 0.08);
    const ridges = (bottom, top, step, count = palette.ridges.length, withMist = true) =>
        palette.ridges
            .slice(palette.ridges.length - count)
            .map((color, index) => {
                const ridgeTop = height * (top + index * step);
                const mist = withMist && index < count - 1 ? rect(0, ridgeTop + height * 0.07, width, height * 0.3, "url(#mist)", `opacity="${round(0.5 - index * 0.1)}"`) : "";
                return `<path d="${ridgePath(random, width, bottom, ridgeTop, height * (0.2 - index * 0.02), between(random, 0.45, 0.6))}" fill="${color}"/>${mist}`;
            })
            .join("");
    const sky = rect(0, 0, width, height, "url(#sky)");

    if (variant === "peak") {
        const peakX = width * between(random, 0.3, 0.7);
        const peakTop = height * between(random, 0.1, 0.2);
        const base = height * 0.8;
        const halfWidth = width * between(random, 0.3, 0.45);
        // Laderas con saltos irregulares; el último punto de cada tramo es exacto (la cima y el pie).
        const climb = (x1, y1, x2, y2, steps) =>
            Array.from({ length: steps }, (_, index) => {
                const t = (index + 1) / steps;
                const jitter = index === steps - 1 ? 0 : (random() - 0.5) * height * 0.05;
                return [x1 + (x2 - x1) * t + jitter * 0.5, y1 + (y2 - y1) * t + jitter];
            });
        const outline = [[peakX - halfWidth, base], ...climb(peakX - halfWidth, base, peakX, peakTop, 7), ...climb(peakX, peakTop, peakX + halfWidth, base, 7)];
        const snowLine = peakTop + (base - peakTop) * between(random, 0.25, 0.4);
        const snow = [[peakX - halfWidth, snowLine]];
        for (let x = peakX - halfWidth; x <= peakX + halfWidth; x += halfWidth / 6) snow.push([x, snowLine + (random() - 0.3) * height * 0.06]);
        snow.push([peakX + halfWidth, snowLine], [peakX + halfWidth, 0], [peakX - halfWidth, 0]);
        return svg(
            width,
            height,
            defs + `<clipPath id="peak">${polygon(outline, "#000")}</clipPath>`,
            sky +
                sunDisc(sunX, sunY, sunR, palette.sun) +
                clouds(random, width, height, palette.mist, 4, height * 0.1, height * 0.25) +
                polygon(outline, palette.ridges[1]) +
                polygon([[peakX, peakTop], [peakX + halfWidth, base], [peakX + halfWidth * 0.1, base]], palette.ridges[2], 'opacity="0.55"') +
                `<g clip-path="url(#peak)">${polygon(snow, mix(palette.mist, "#ffffff", 0.6), 'opacity="0.9"')}</g>` +
                `<path d="${ridgePath(random, width, height, height * 0.72, height * 0.12, 0.55)}" fill="${palette.ridges[3]}"/>`,
        );
    }

    if (variant === "lake") {
        const horizon = height * between(random, 0.58, 0.68);
        const scenery = sunDisc(sunX, Math.min(sunY, horizon * 0.6), sunR, palette.sun) + ridges(horizon, 0.22, 0.09, 3, false);
        return svg(
            width,
            height,
            defs,
            sky + scenery + rect(0, horizon, width, height - horizon, "url(#water)") + mirror(scenery, horizon, 0.35) + ripples(random, width, horizon, height, palette.mist),
        );
    }

    if (variant === "night") {
        const dark = palette.ridges.map((color) => mix(color, "#050814", 0.55));
        return svg(
            width,
            height,
            defs,
            sky +
                stars(random, width, height * 0.6, 240) +
                crescent(sunX, sunY, sunR * 0.8, "#f4f1e6", mix(skyColors[0], skyColors[1], sunY / height)) +
                dark.map((color, index) => `<path d="${ridgePath(random, width, height, height * (0.4 + index * 0.12), height * (0.2 - index * 0.03), 0.5)}" fill="${color}"/>`).join(""),
        );
    }

    if (variant === "pines") {
        return svg(width, height, defs, sky + sunDisc(sunX, sunY, sunR, palette.sun) + ridges(height, 0.3, 0.12, 3) + pineRow(random, width, height * 1.02, height * 0.3, mix(palette.ridges[3], "#000000", 0.35)));
    }

    if (variant === "clouds") {
        return svg(
            width,
            height,
            defs,
            sky + sunDisc(sunX, sunY, sunR, palette.sun) + clouds(random, width, height, "#ffffff", 9, height * 0.05, height * 0.35) + ridges(height, 0.36, 0.14) + clouds(random, width, height, palette.mist, 4, height * 0.55, height * 0.15),
        );
    }

    return svg(width, height, defs, sky + sunDisc(sunX, sunY, sunR, palette.sun) + ridges(height, 0.3, 0.13));
};

// ---- Mar: horizon, stacks, lighthouse, beach, boat, moon, waves ----

const sea = (random, width, height, palette, frame, variant) => {
    const horizon = height * (variant === "beach" ? between(random, 0.4, 0.48) : between(random, 0.5, 0.62));
    const sunX = between(random, width * 0.25, width * 0.75);
    const sunR = Math.min(width, height) * between(random, 0.045, 0.09);
    const sunY = variant === "moon" ? horizon * between(random, 0.3, 0.6) : horizon - sunR * between(random, 0.3, 2.4);
    const defs =
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) +
        verticalGradient("sea", [[0, palette.sea[0]], [1, palette.sea[1]]]) +
        glow("sun", palette.sun) +
        blur("soft", height * 0.01);
    const glitter = Array.from({ length: 70 }, (_, index) => {
        const y = horizon + 6 + (index / 70) ** 1.4 * (height - horizon);
        const spread = sunR * (0.6 + (index / 70) * 2.4);
        const offset = Math.sin(index * 1.7 + frame * 0.9) * spread * 0.35;
        const lineWidth = spread * between(random, 0.3, 1);
        return rect(sunX - lineWidth / 2 + offset, y, lineWidth, 1.5 + index / 25, palette.sun, `opacity="${round(between(random, 0.15, 0.6))}"`);
    }).join("");
    const waves = Array.from({ length: 26 }, (_, index) => rect(0, horizon + ((index + 1) / 27) ** 1.6 * (height - horizon), width, 1 + index / 10, palette.sea[1], 'opacity="0.18"')).join("");
    const base = rect(0, 0, width, height, "url(#sky)") + (variant === "moon" ? stars(random, width, horizon * 0.8, 200) + crescent(sunX, sunY, sunR * 0.7, palette.sun, mix(palette.sky[0], palette.sky[1], sunY / height)) : sunDisc(sunX, sunY, sunR, palette.sun));
    const water = rect(0, horizon, width, height - horizon, "url(#sea)") + waves;

    if (variant === "stacks") {
        const stacks = Array.from({ length: 3 }, (_, index) => {
            const x = width * (index === 0 ? between(random, 0.05, 0.25) : index === 1 ? between(random, 0.6, 0.72) : between(random, 0.78, 0.92));
            const stackWidth = width * between(random, 0.05, 0.1);
            const top = horizon - height * between(random, 0.12, 0.3);
            const bottom = horizon + height * between(random, 0.08, 0.2);
            return polygon([[x, bottom], [x + stackWidth * 0.1, top + height * 0.03], [x + stackWidth * 0.4, top], [x + stackWidth * 0.8, top + height * 0.05], [x + stackWidth, bottom]], palette.island) + rect(x - stackWidth * 0.2, bottom - 3, stackWidth * 1.4, 4, "#ffffff", 'opacity="0.35"');
        }).join("");
        return svg(width, height, defs, base + water + glitter + stacks);
    }

    if (variant === "lighthouse") {
        const left = random() > 0.5;
        const cliffTop = horizon - height * between(random, 0.1, 0.18);
        const edge = width * between(random, 0.3, 0.42);
        const cliff = left
            ? [[0, height], [0, cliffTop], [edge * 0.8, cliffTop + height * 0.01], [edge, horizon + height * 0.15], [edge * 1.05, height]]
            : [[width, height], [width, cliffTop], [width - edge * 0.8, cliffTop + height * 0.01], [width - edge, horizon + height * 0.15], [width - edge * 1.05, height]];
        const towerX = left ? edge * 0.45 : width - edge * 0.45;
        const towerHeight = height * 0.16;
        const towerWidth = width * 0.028;
        const lampY = cliffTop - towerHeight;
        const beam = polygon([[towerX, lampY], [left ? width : 0, lampY - height * 0.12], [left ? width : 0, lampY + height * 0.08]], palette.sun, 'opacity="0.18"');
        const tower =
            polygon([[towerX - towerWidth / 2, cliffTop], [towerX - towerWidth / 3, lampY], [towerX + towerWidth / 3, lampY], [towerX + towerWidth / 2, cliffTop]], "#f4f1ea") +
            [0.25, 0.55].map((level) => rect(towerX - towerWidth / 2, cliffTop - towerHeight * level - towerHeight * 0.1, towerWidth, towerHeight * 0.1, "#c0392b")).join("") +
            circle(towerX, lampY - towerWidth * 0.3, towerWidth * 0.45, palette.sun);
        return svg(width, height, defs, base + water + glitter + beam + polygon(cliff, palette.island) + tower);
    }

    if (variant === "beach") {
        const sand = mix(palette.sun, "#d9b98c", 0.55);
        const shoreLeft = height * between(random, 0.62, 0.72);
        const shoreRight = height * between(random, 0.55, 0.66);
        const shore = `M0,${round(shoreLeft)} C${round(width * 0.35)},${round(shoreLeft - height * 0.08)} ${round(width * 0.6)},${round(shoreRight + height * 0.1)} ${width},${round(shoreRight)}`;
        return svg(
            width,
            height,
            defs,
            base +
                water +
                glitter +
                `<path d="${shore} L${width},${height} L0,${height} Z" fill="${mix(sand, palette.sea[1], 0.25)}"/>` +
                `<path d="${shore} L${width},${height} L0,${height} Z" fill="${sand}" transform="translate(0 ${round(height * 0.03)})"/>` +
                `<path d="${shore}" fill="none" stroke="#ffffff" stroke-width="${round(height * 0.008)}" opacity="0.7"/>`,
        );
    }

    if (variant === "boat") {
        const boatX = width * between(random, 0.2, 0.8);
        const boatY = horizon + height * between(random, 0.04, 0.1);
        const size = height * between(random, 0.08, 0.14);
        const boat =
            polygon([[boatX - size * 0.6, boatY], [boatX + size * 0.6, boatY], [boatX + size * 0.45, boatY + size * 0.15], [boatX - size * 0.45, boatY + size * 0.15]], palette.island) +
            polygon([[boatX, boatY - size * 1.1], [boatX, boatY - size * 0.05], [boatX + size * 0.55, boatY - size * 0.05]], mix(palette.island, palette.sun, 0.15)) +
            polygon([[boatX - size * 0.05, boatY - size * 0.95], [boatX - size * 0.05, boatY - size * 0.05], [boatX - size * 0.45, boatY - size * 0.05]], mix(palette.island, palette.sun, 0.3));
        return svg(width, height, defs, base + water + glitter + boat + mirror(boat, boatY + size * 0.15, 0.3));
    }

    if (variant === "waves") {
        // Olas estilizadas: capas de crestas alternas (arriba y abajo) con una línea de espuma.
        const layers = Array.from({ length: 6 }, (_, index) => {
            const top = horizon + (index / 6) ** 1.2 * (height - horizon) * 0.9;
            const amplitude = height * (0.01 + index * 0.012);
            const half = width / between(random, 5, 9);
            const offset = -random() * half * 2;
            let crest = `M${round(offset)},${round(top)}`;
            for (let x = offset, up = true; x < width; x += half, up = !up) {
                crest += ` Q${round(x + half / 2)},${round(up ? top - amplitude * 2 : top + amplitude * 2)} ${round(x + half)},${round(top)}`;
            }
            const color = mix(palette.sea[0], palette.sea[1], index / 6);
            return `<path d="${crest} L${round(width + half)},${height} L${round(offset)},${height} Z" fill="${color}"/><path d="${crest}" fill="none" stroke="#ffffff" stroke-width="${round(2 + index)}" opacity="0.35"/>`;
        }).join("");
        return svg(width, height, defs, base + rect(0, horizon, width, height - horizon, "url(#sea)") + layers);
    }

    const island = random() > 0.4 ? `<path d="${ridgePath(random, width, horizon, horizon - height * 0.07, height * 0.07, 0.45)}" fill="${palette.island}" opacity="0.9"/>` : "";
    return svg(width, height, defs, base + island + water + glitter);
};

// ---- Ciudad: skyline, river, bridge, tower, rain, street, dusk ----

const skyline = (random, width, height, palette, ground, scale = 1) =>
    palette.buildings
        .map((color, layerIndex) => {
            let x = -between(random, 0, 60);
            let body = "";
            const maxHeight = height * (0.62 - layerIndex * 0.12) * scale;
            while (x < width) {
                const buildingWidth = between(random, width * 0.035, width * 0.09);
                const buildingHeight = between(random, maxHeight * 0.35, maxHeight);
                const top = ground - buildingHeight;
                body += rect(x, top, buildingWidth, buildingHeight + 2, color);
                if (random() > 0.75) body += rect(x + buildingWidth / 2 - 1, top - height * 0.05, 2, height * 0.05, color);
                const cell = Math.max(8, width * 0.008);
                for (let wy = top + cell; wy < ground - cell; wy += cell * 1.8) {
                    for (let wx = x + cell * 0.7; wx < x + buildingWidth - cell; wx += cell * 1.5) {
                        if (random() < 0.3 - layerIndex * 0.04) body += rect(wx, wy, cell * 0.7, cell * 0.9, pick(random, palette.windows), `opacity="${round(between(random, 0.35, 1) * (1 - layerIndex * 0.2))}"`);
                    }
                }
                x += buildingWidth + between(random, 0, width * 0.01);
            }
            return body;
        })
        .reverse()
        .join("");

const city = (random, width, height, palette, frame, variant) => {
    const moonX = between(random, width * 0.12, width * 0.88);
    const moonY = height * between(random, 0.1, 0.22);
    const warm = variant === "dusk";
    const sky = warm ? [palette.sky[1], mix(palette.windows[2], "#ff8f6b", 0.5)] : palette.sky;
    const defs =
        verticalGradient("sky", [[0, sky[0]], [1, sky[1]]]) +
        glow("sun", warm ? palette.windows[2] : palette.moon) +
        verticalGradient("street", [[0, palette.windows[0], 0], [1, palette.windows[0], 0.35]]) +
        verticalGradient("water", [[0, mix(sky[1], palette.buildings[2], 0.5)], [1, palette.buildings[2]]]) +
        blur("soft", height * 0.008) +
        blur("neon", height * 0.012);
    const background = rect(0, 0, width, height, "url(#sky)") + (warm ? "" : stars(random, width, height * 0.45, 110)) + sunDisc(moonX, warm ? height * 0.5 : moonY, height * (warm ? 0.06 : 0.035), warm ? palette.windows[2] : palette.moon);

    if (variant === "river" || variant === "bridge") {
        const ground = height * (variant === "river" ? between(random, 0.55, 0.64) : 0.66);
        const scenery = skyline(random, width, height, palette, ground, 0.8);
        let bridge = "";
        if (variant === "bridge") {
            const deck = height * 0.74;
            const towers = [width * between(random, 0.2, 0.3), width * between(random, 0.68, 0.8)];
            const towerTop = height * 0.4;
            const color = mix(palette.windows[1], palette.buildings[0], 0.35);
            const cable = `M0,${round(deck - height * 0.12)} Q${round(towers[0] / 2)},${round(deck - height * 0.02)} ${round(towers[0])},${round(towerTop)} Q${round((towers[0] + towers[1]) / 2)},${round(deck - height * 0.01)} ${round(towers[1])},${round(towerTop)} Q${round((towers[1] + width) / 2)},${round(deck - height * 0.02)} ${width},${round(deck - height * 0.12)}`;
            bridge =
                `<g filter="url(#neon)" opacity="0.7"><path d="${cable}" fill="none" stroke="${color}" stroke-width="${round(height * 0.012)}"/></g>` +
                `<path d="${cable}" fill="none" stroke="${color}" stroke-width="${round(height * 0.005)}"/>` +
                towers.map((x) => rect(x - width * 0.012, towerTop, width * 0.024, deck - towerTop + height * 0.1, color)).join("") +
                rect(0, deck, width, height * 0.03, mix(color, "#000000", 0.35)) +
                Array.from({ length: 40 }, (_, index) => circle((index / 40) * width, deck - 2, 2.5, pick(random, palette.windows), 'opacity="0.9"')).join("");
        }
        return svg(width, height, defs, background + scenery + rect(0, ground, width, height - ground, "url(#water)") + mirror(scenery, ground, 0.35) + ripples(random, width, ground, height, palette.windows[1], 40) + bridge);
    }

    if (variant === "aerial") {
        // Vista cenital: manzanas oscuras, calles iluminadas, faros de coches y un paso de cebra.
        const block = Math.min(width, height) * between(random, 0.13, 0.2);
        const street = block * 0.2;
        const span = Math.hypot(width, height);
        const angle = between(random, -25, 25);
        let city = rect(-span, -span, span * 3, span * 3, mix(palette.windows[2], palette.buildings[2], 0.75));
        for (let y = -span / 2; y < height + span / 2; y += block + street) {
            for (let x = -span / 2; x < width + span / 2; x += block + street) {
                city += rect(x, y, block, block, pick(random, palette.buildings));
                for (let dot = 0; dot < 6; dot += 1) city += rect(x + random() * block * 0.9, y + random() * block * 0.9, block * 0.06, block * 0.06, pick(random, palette.windows), `opacity="${round(between(random, 0.3, 0.8))}"`);
                if (random() < 0.5) city += circle(x + block + street / 2, y + random() * block, street * 0.18, random() < 0.5 ? "#ff5a4f" : "#fff6d6");
            }
        }
        const crossX = width * between(random, 0.35, 0.65);
        const crossY = height * between(random, 0.35, 0.65);
        const zebra = Array.from({ length: 7 }, (_, index) => rect(crossX + index * street * 0.4, crossY, street * 0.2, street * 1.4, "#ffffff", 'opacity="0.8"')).join("");
        return svg(width, height, defs, `<g transform="rotate(${round(angle)} ${width / 2} ${height / 2})">${city}${zebra}</g>`);
    }

    const ground = height * 0.9;
    const scenery = skyline(random, width, height, palette, ground) + rect(0, ground, width, height - ground, palette.buildings[2]);

    if (variant === "window") {
        // La ciudad vista desde dentro: marco de ventana en primer plano y un reflejo en el cristal.
        const frameColor = mix(palette.buildings[2], "#000000", 0.55);
        const bar = Math.min(width, height) * 0.035;
        const splitX = width * between(random, 0.4, 0.6);
        const splitY = height * between(random, 0.35, 0.5);
        const frame =
            rect(0, 0, width, bar * 1.5, frameColor) +
            rect(0, height - bar * 3, width, bar * 3, frameColor) +
            rect(0, 0, bar * 1.5, height, frameColor) +
            rect(width - bar * 1.5, 0, bar * 1.5, height, frameColor) +
            rect(splitX - bar / 2, 0, bar, height, frameColor) +
            rect(0, splitY - bar / 2, width, bar, frameColor);
        const glare = polygon([[width * 0.1, height], [width * 0.35, 0], [width * 0.45, 0], [width * 0.2, height]], "#ffffff", 'opacity="0.06"');
        return svg(width, height, defs, background + scenery + glare + frame);
    }

    if (variant === "tower") {
        const x = width * between(random, 0.3, 0.7);
        const top = height * 0.1;
        const baseWidth = width * 0.08;
        const color = mix(palette.windows[0], palette.buildings[0], 0.35);
        const bars = Array.from({ length: 9 }, (_, index) => {
            const y = top + ((index + 1) / 10) * (ground - top);
            const half = (baseWidth / 2) * ((y - top) / (ground - top)) + width * 0.004;
            return `<line x1="${round(x - half)}" y1="${round(y)}" x2="${round(x + half)}" y2="${round(y)}" stroke="${color}" stroke-width="3"/>`;
        }).join("");
        const tower =
            `<g filter="url(#neon)" opacity="0.6">${polygon([[x - baseWidth / 2, ground], [x - 3, top], [x + 3, top], [x + baseWidth / 2, ground]], color)}</g>` +
            `<polyline points="${round(x - baseWidth / 2)},${round(ground)} ${round(x - 2)},${round(top)} ${round(x + 2)},${round(top)} ${round(x + baseWidth / 2)},${round(ground)}" fill="none" stroke="${color}" stroke-width="4"/>` +
            bars +
            rect(x - 1, top - height * 0.06, 2, height * 0.06, color);
        return svg(width, height, defs, background + tower + scenery + rect(0, ground - height * 0.25, width, height * 0.35, "url(#street)"));
    }

    if (variant === "rain") {
        const rain = Array.from({ length: 260 }, () => {
            const x = random() * width * 1.2;
            const y = random() * height;
            const length = height * between(random, 0.02, 0.05);
            return `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x - length * 0.25)}" y2="${round(y + length)}" stroke="#dfe8ff" stroke-width="1.2" opacity="${round(between(random, 0.1, 0.35))}"/>`;
        }).join("");
        const streaks = Array.from({ length: 30 }, () => rect(random() * width, ground, width * 0.006, height * between(random, 0.04, 0.1), pick(random, palette.windows), 'opacity="0.35" filter="url(#soft)"')).join("");
        return svg(width, height, defs, background + scenery + rect(0, ground - height * 0.25, width, height * 0.35, "url(#street)") + streaks + rain);
    }

    if (variant === "street") {
        const vanishX = width * between(random, 0.42, 0.58);
        const vanishY = height * between(random, 0.4, 0.5);
        const left = [[0, 0], [vanishX - width * 0.07, vanishY - height * 0.14], [vanishX - width * 0.07, vanishY + height * 0.06], [0, height]];
        const right = [[width, 0], [vanishX + width * 0.07, vanishY - height * 0.14], [vanishX + width * 0.07, vanishY + height * 0.06], [width, height]];
        const road = [[0, height], [vanishX - width * 0.07, vanishY + height * 0.06], [vanishX + width * 0.07, vanishY + height * 0.06], [width, height]];
        const signs = Array.from({ length: 14 }, (_, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const depth = between(random, 0.05, 0.85);
            const x = side < 0 ? vanishX - width * 0.07 - (vanishX - width * 0.07) * (1 - depth) : vanishX + width * 0.07 + (width - vanishX - width * 0.07) * (1 - depth);
            const scale = 1 - depth * 0.85;
            const y = vanishY - height * 0.1 + (random() - 0.5) * height * 0.5 * scale;
            const color = pick(random, palette.windows);
            const signWidth = width * 0.02 * scale + 4;
            const signHeight = height * between(random, 0.08, 0.2) * scale + 6;
            return `<g filter="url(#neon)">${rect(x - signWidth / 2, y, signWidth, signHeight, color, 'opacity="0.9"')}</g>${rect(x - signWidth / 4, y + 2, signWidth / 2, signHeight - 4, "#ffffff", 'opacity="0.7"')}`;
        }).join("");
        const lanes = Array.from({ length: 8 }, (_, index) => {
            const t0 = index / 8;
            const t1 = t0 + 0.05;
            const y0 = height - (height - vanishY - height * 0.06) * t0;
            const y1 = height - (height - vanishY - height * 0.06) * t1;
            return polygon([[vanishX + (width / 2 - vanishX) * (1 - t0) - 6 * (1 - t0), y0], [vanishX + (width / 2 - vanishX) * (1 - t0) + 6 * (1 - t0), y0], [vanishX + (width / 2 - vanishX) * (1 - t1) + 6 * (1 - t1), y1], [vanishX + (width / 2 - vanishX) * (1 - t1) - 6 * (1 - t1), y1]], "#ffffff", 'opacity="0.5"');
        }).join("");
        return svg(width, height, defs, background + polygon(left, palette.buildings[1]) + polygon(right, palette.buildings[0]) + polygon(road, palette.buildings[2]) + lanes + signs);
    }

    return svg(width, height, defs, background + scenery + rect(0, ground - height * 0.25, width, height * 0.35, "url(#street)"));
};

// ---- Desierto: dunes, mesas, cacti, saltflat, canyon, milkyway ----

const saguaro = (x, base, size, color) => {
    const stroke = (d, widthRatio) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${round(size * widthRatio)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return (
        stroke(`M${round(x)},${round(base)} V${round(base - size)}`, 0.16) +
        stroke(`M${round(x)},${round(base - size * 0.45)} H${round(x - size * 0.28)} V${round(base - size * 0.8)}`, 0.11) +
        stroke(`M${round(x)},${round(base - size * 0.6)} H${round(x + size * 0.25)} V${round(base - size * 0.9)}`, 0.11)
    );
};

const desert = (random, width, height, palette, frame, variant) => {
    const sunX = between(random, width * 0.15, width * 0.85);
    const sunY = height * between(random, 0.18, 0.34);
    const sunR = Math.min(width, height) * between(random, 0.05, 0.1);
    const night = variant === "milkyway";
    const skyColors = night ? [mix(palette.sky[0], "#000000", 0.35), mix(palette.sky[0], "#3b4f9a", 0.65)] : palette.sky;
    const defs = verticalGradient("sky", [[0, skyColors[0]], [1, skyColors[1]]]) + glow("sun", palette.sun) + blur("soft", height * 0.01) + blur("band", height * 0.05);
    const sky = rect(0, 0, width, height, "url(#sky)");
    const dunes = (layers, start, step, crestsRange, colors = palette.dunes) =>
        colors
            .slice(colors.length - layers)
            .map((color, index) => {
                const path = hillPath(random, width, height, height * (start + index * step), height * between(random, 0.05, 0.12), Math.round(between(random, crestsRange[0], crestsRange[1])));
                return `<path d="${path}" fill="${mix(color, "#000000", 0.2)}" transform="translate(${round(width * 0.015)} ${round(height * 0.012)})"/><path d="${path}" fill="${color}"/>`;
            })
            .join("");

    if (variant === "arch") {
        // Arco de roca natural recortado contra el cielo, con el sol asomando por el hueco.
        const ground = height * 0.8;
        const cx = width * between(random, 0.35, 0.65);
        const half = width * between(random, 0.17, 0.25);
        const top = height * between(random, 0.16, 0.28);
        const thickness = height * between(random, 0.07, 0.11);
        const leg = half * between(random, 0.3, 0.42);
        const shoulder = top + (ground - top) * 0.35;
        const inner = top + thickness + (ground - top) * 0.25;
        const arch =
            `M${round(cx - half)},${round(ground)} L${round(cx - half)},${round(shoulder)} Q${round(cx - half)},${round(top)} ${round(cx)},${round(top)} ` +
            `Q${round(cx + half)},${round(top)} ${round(cx + half)},${round(shoulder)} L${round(cx + half)},${round(ground)} L${round(cx + half - leg)},${round(ground)} ` +
            `L${round(cx + half - leg)},${round(inner)} Q${round(cx + half - leg)},${round(top + thickness)} ${round(cx)},${round(top + thickness)} ` +
            `Q${round(cx - half + leg)},${round(top + thickness)} ${round(cx - half + leg)},${round(inner)} L${round(cx - half + leg)},${round(ground)} Z`;
        return svg(
            width,
            height,
            defs,
            sky +
                sunDisc(cx + between(random, -half * 0.2, half * 0.2), (top + thickness + ground) / 2, sunR * 0.8, palette.sun) +
                `<path d="${hillPath(random, width, height, height * 0.78, height * 0.05, 3)}" fill="${palette.dunes[1]}"/>` +
                `<path d="${arch}" fill="${palette.dunes[2]}"/>` +
                rect(cx + half - leg, top, leg, ground - top, palette.dunes[3], 'opacity="0.35"') +
                `<path d="${hillPath(random, width, height, height * 0.88, height * 0.05, 2)}" fill="${palette.dunes[3]}"/>`,
        );
    }

    if (variant === "mesas") {
        const layers = palette.dunes.slice(0, 3).map((color, index) => {
            const base = height * (0.62 + index * 0.12);
            let body = rect(0, base, width, height - base, color);
            let x = -width * 0.05;
            while (x < width) {
                const mesaWidth = width * between(random, 0.08, 0.25);
                const top = base - height * between(random, 0.08, 0.22) * (1 - index * 0.25);
                if (random() > 0.35) body += polygon([[x, base + 1], [x + mesaWidth * 0.12, top], [x + mesaWidth * 0.88, top], [x + mesaWidth, base + 1]], color);
                x += mesaWidth + width * between(random, 0.02, 0.12);
            }
            return body;
        });
        return svg(width, height, defs, sky + sunDisc(sunX, sunY, sunR, palette.sun) + layers.join(""));
    }

    if (variant === "cacti") {
        const color = mix(palette.dunes[3], "#1a1a1a", 0.55);
        const cacti = Array.from({ length: Math.round(between(random, 3, 6)) }, () => saguaro(random() * width, height * between(random, 0.84, 0.95), height * between(random, 0.18, 0.4), color)).join("");
        return svg(width, height, defs, sky + sunDisc(sunX, sunY, sunR, palette.sun) + dunes(2, 0.7, 0.12, [1, 3]) + cacti);
    }

    if (variant === "saltflat") {
        const horizon = height * between(random, 0.5, 0.6);
        const range = `<path d="${ridgePath(random, width, horizon, horizon - height * 0.12, height * 0.1, 0.5)}" fill="${palette.dunes[2]}"/>`;
        const scenery = sunDisc(sunX, Math.min(sunY, horizon * 0.7), sunR, palette.sun) + range;
        const salt = mix(palette.sky[1], "#ffffff", 0.55);
        const cracks = Array.from({ length: 40 }, () => {
            const cx = random() * width;
            const cy = horizon + height * 0.12 + random() ** 0.7 * (height - horizon);
            const radius = width * between(random, 0.02, 0.05) * ((cy - horizon) / (height - horizon));
            const points = Array.from({ length: 6 }, (_, index) => `${round(cx + Math.cos((index * Math.PI) / 3) * radius)},${round(cy + Math.sin((index * Math.PI) / 3) * radius * 0.35)}`).join(" ");
            return `<polygon points="${points}" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.55"/>`;
        }).join("");
        return svg(width, height, defs, sky + scenery + rect(0, horizon, width, height - horizon, salt) + mirror(sky + scenery, horizon, 0.45) + cracks);
    }

    if (variant === "canyon") {
        const wall = (fromLeft) => {
            const points = [[fromLeft ? 0 : width, 0]];
            for (let y = 0; y <= height; y += height / 12) {
                const depth = width * between(random, 0.25, 0.4) * (0.8 + (y / height) * 0.4);
                points.push([fromLeft ? depth : width - depth, y]);
            }
            points.push([fromLeft ? 0 : width, height]);
            return points;
        };
        const strata = (points, colors) =>
            colors.map((color, index) => polygon(points.map(([x, y]) => [x, y]), color, `transform="translate(0 ${round(index * height * 0.18)})"`)).join("");
        return svg(
            width,
            height,
            defs,
            sky +
                sunDisc(width / 2, height * 0.12, sunR * 0.7, palette.sun) +
                `<path d="${hillPath(random, width, height, height * 0.85, height * 0.05, 2)}" fill="${mix(palette.sky[0], palette.dunes[3], 0.4)}"/>` +
                strata(wall(true), palette.dunes) +
                strata(wall(false), [...palette.dunes].reverse()),
        );
    }

    if (night) {
        const angle = between(random, -35, 35);
        const band = Array.from({ length: 700 }, () => {
            const t = random();
            const spread = (random() - 0.5) * height * 0.25;
            return circle(t * width * 1.2 - width * 0.1, height * 0.35 + spread + (t - 0.5) * Math.tan((angle * Math.PI) / 180) * width, between(random, 0.4, 1.6), "#ffffff", `opacity="${round(between(random, 0.2, 0.9))}"`);
        }).join("");
        const glowBand = `<ellipse cx="${width / 2}" cy="${round(height * 0.35)}" rx="${round(width * 0.7)}" ry="${round(height * 0.08)}" fill="${mix(palette.sun, "#c9b8ff", 0.4)}" opacity="0.45" filter="url(#band)" transform="rotate(${round(angle)} ${width / 2} ${round(height * 0.35)})"/>`;
        return svg(width, height, defs, sky + stars(random, width, height * 0.7, 250) + glowBand + band + dunes(3, 0.66, 0.1, [2, 4], palette.dunes.map((color) => mix(color, "#0a0f24", 0.45))));
    }

    return svg(width, height, defs, sky + sunDisc(sunX, sunY, sunR, palette.sun) + dunes(4, 0.52, 0.12, [2, 4]));
};

// ---- Bosque: pines, birch, rays, lake, autumn ----

const AUTUMN = ["#d9822b", "#c8553d", "#e9b44c", "#9b2915", "#f2a541"];

const forest = (random, width, height, palette, frame, variant) => {
    const defs =
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) +
        verticalGradient("fog", [[0, palette.sky[1], 0], [0.6, palette.sky[1], 0.85], [1, palette.sky[1], 0]]) +
        verticalGradient("water", [[0, mix(palette.sky[1], palette.layers[3], 0.4)], [1, palette.layers[3]]]) +
        blur("soft", height * 0.01) +
        blur("ray", height * 0.02) +
        blur("leaves", height * 0.004);
    const sky = rect(0, 0, width, height, "url(#sky)");
    const layered = (count, start, step) =>
        palette.layers
            .slice(palette.layers.length - count)
            .map((color, index) => {
                const base = height * (start + index * step);
                const size = height * (0.18 + index * 0.1);
                const fog = index < count - 1 ? rect(0, base - size * 0.6, width, size, "url(#fog)", `opacity="${round(0.7 - index * 0.12)}"`) : "";
                return rect(0, base - 2, width, height - base + 2, color) + pineRow(random, width, base, size, color) + fog;
            })
            .join("");

    if (variant === "birch") {
        const trunks = Array.from({ length: 22 }, (_, index) => {
            const far = index < 10;
            const x = random() * width;
            const trunkWidth = width * (far ? between(random, 0.006, 0.012) : between(random, 0.015, 0.03));
            const color = far ? mix("#f1efe8", palette.sky[1], 0.5) : "#f1efe8";
            const marks = Array.from({ length: 10 }, () => rect(x, random() * height, trunkWidth * between(random, 0.3, 0.8), height * 0.006, "#2d2a26", `opacity="${far ? 0.3 : 0.75}"`)).join("");
            return rect(x, 0, trunkWidth, height, color) + marks;
        }).join("");
        const leaves = `<g filter="url(#leaves)">${Array.from({ length: 70 }, () => circle(random() * width, random() * height * 0.35, height * between(random, 0.01, 0.03), pick(random, [palette.layers[0], palette.layers[1], "#d8c36a"]), `opacity="${round(between(random, 0.4, 0.8))}"`)).join("")}</g>`;
        return svg(width, height, defs, sky + leaves + trunks + rect(0, height * 0.88, width, height * 0.12, palette.layers[2]));
    }

    if (variant === "rays") {
        const rays = `<g filter="url(#ray)">${Array.from({ length: 6 }, (_, index) => {
            const x = width * (0.05 + index * 0.13 + between(random, 0, 0.05));
            return polygon([[x, 0], [x + width * 0.06, 0], [x + width * 0.4, height], [x + width * 0.2, height]], "#fffbe8", `opacity="${round(between(random, 0.14, 0.28))}"`);
        }).join("")}</g>`;
        return svg(width, height, defs, sky + layered(4, 0.6, 0.13) + rays);
    }

    if (variant === "lake") {
        const horizon = height * between(random, 0.5, 0.6);
        const shore = palette.layers.slice(1).map((color, index) => pineRow(random, width, horizon, height * (0.14 + index * 0.05), color, [0.2, 0.45])).join("");
        return svg(width, height, defs, sky + shore + rect(0, horizon, width, height - horizon, "url(#water)") + mirror(shore, horizon, 0.4) + ripples(random, width, horizon, height, palette.sky[1]));
    }

    if (variant === "autumn") {
        const hills = palette.layers
            .slice(2)
            .map((color, index) => {
                const base = height * (0.62 + index * 0.16);
                let trees = "";
                for (let x = -20; x < width + 20; x += width * between(random, 0.04, 0.09)) {
                    const size = height * between(random, 0.05, 0.1) * (1 + index * 0.6);
                    const trunkTop = base - size * 0.6 + random() * height * 0.03;
                    trees += rect(x - size * 0.04, trunkTop, size * 0.08, size * 0.8, mix(color, "#000000", 0.3));
                    trees += [0, 1, 2].map((part) => circle(x + (part - 1) * size * 0.3, trunkTop - size * (part === 1 ? 0.4 : 0.2), size * 0.42, pick(random, AUTUMN))).join("");
                }
                return `<path d="${hillPath(random, width, height, base, height * 0.06, 2)}" fill="${color}"/>${trees}`;
            })
            .join("");
        return svg(width, height, defs, sky + hills);
    }

    return svg(width, height, defs, sky + layered(4, 0.62, 0.13));
};

// ---- Auroras: bands, curtain, lake, corona ----

const aurora = (random, width, height, palette, frame, variant) => {
    const defs =
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) +
        blur("veil", height * 0.04) +
        blur("soft", height * 0.012) +
        blur("ray", height * 0.006) +
        palette.bands.map((color, index) => verticalGradient(`ray${index}`, [[0, color, 0], [0.7, color, 0.7], [1, color, 0.9]])).join("");
    const sky = rect(0, 0, width, height, "url(#sky)") + stars(random, width, height * 0.8, 260);
    const bands = palette.bands
        .map((color, index) => {
            const baseY = height * (0.22 + index * 0.1);
            const amplitude = height * between(random, 0.05, 0.12);
            const phase = random() * Math.PI * 2 + frame * 0.35;
            const points = Array.from({ length: 9 }, (_, step) => `${round((step / 8) * width)},${round(baseY + Math.sin(phase + step * 0.9) * amplitude)}`);
            return `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${round(height * between(random, 0.08, 0.16))}" stroke-linecap="round" opacity="${round(between(random, 0.35, 0.6))}" filter="url(#veil)"/>`;
        })
        .join("");

    if (variant === "curtain") {
        const phase = random() * Math.PI * 2;
        const rays = Array.from({ length: 110 }, (_, index) => {
            const x = (index / 110) * width;
            const base = height * (0.5 + Math.sin(phase + index * 0.08) * 0.08);
            const length = height * between(random, 0.25, 0.45);
            return rect(x, base - length, width / 90, length, `url(#ray${index % palette.bands.length})`, `opacity="${round(between(random, 0.4, 0.9))}"`);
        }).join("");
        return svg(width, height, defs, sky + `<g filter="url(#ray)">${rays}</g>` + `<path d="${ridgePath(random, width, height, height * 0.66, height * 0.16, 0.55)}" fill="${palette.land}"/>`);
    }

    if (variant === "lake") {
        const horizon = height * between(random, 0.6, 0.7);
        const scenery = bands + `<path d="${ridgePath(random, width, horizon, horizon - height * 0.12, height * 0.1, 0.5)}" fill="${palette.land}"/>`;
        return svg(width, height, defs, sky + scenery + rect(0, horizon, width, height - horizon, mix(palette.sky[1], "#000000", 0.4)) + mirror(scenery, horizon, 0.4));
    }

    if (variant === "corona") {
        const cx = width * between(random, 0.4, 0.6);
        const cy = height * between(random, 0.25, 0.4);
        const rays = Array.from({ length: 72 }, (_, index) => {
            const angle = (index / 72) * 360 + between(random, -2, 2);
            const length = Math.max(width, height) * between(random, 0.35, 0.7);
            return `<rect x="${round(cx - 3)}" y="${round(cy)}" width="6" height="${round(length)}" fill="url(#ray${index % palette.bands.length})" opacity="${round(between(random, 0.3, 0.8))}" transform="rotate(${round(angle)} ${round(cx)} ${round(cy)})"/>`;
        }).join("");
        return svg(width, height, defs, sky + `<g filter="url(#ray)">${rays}</g>` + `<path d="${ridgePath(random, width, height, height * 0.78, height * 0.12, 0.55)}" fill="${palette.land}"/>`);
    }

    return svg(width, height, defs, sky + bands + `<path d="${ridgePath(random, width, height, height * 0.72, height * 0.14, 0.5)}" fill="${palette.land}"/>`);
};

// ---- Abstracto: grid, circles, mondrian, arches, stripes ----

const abstract = (random, width, height, palette, frame, variant) => {
    const { background, colors } = palette;
    const base = rect(0, 0, width, height, background);

    if (variant === "circles") {
        const shapes = Array.from({ length: Math.round(between(random, 6, 10)) }, () => {
            const r = Math.min(width, height) * between(random, 0.06, 0.28);
            const x = random() * width;
            const y = random() * height;
            const color = pick(random, colors.filter((item) => item !== background));
            return random() > 0.35 ? circle(x, y, r, color, 'opacity="0.92"') : circle(x, y, r, "none", `stroke="${color}" stroke-width="${round(r * 0.18)}"`);
        }).join("");
        return svg(width, height, "", base + shapes);
    }

    if (variant === "mondrian") {
        const gap = Math.min(width, height) * 0.012;
        const cells = [];
        const split = (x, y, w, h, depth) => {
            if (depth === 0 || (depth < 3 && random() < 0.25) || w < width * 0.12 || h < height * 0.12) {
                cells.push([x, y, w, h]);
                return;
            }
            if (w > h ? random() < 0.75 : random() < 0.25) {
                const cut = w * between(random, 0.3, 0.7);
                split(x, y, cut, h, depth - 1);
                split(x + cut, y, w - cut, h, depth - 1);
            } else {
                const cut = h * between(random, 0.3, 0.7);
                split(x, y, w, cut, depth - 1);
                split(x, y + cut, w, h - cut, depth - 1);
            }
        };
        split(0, 0, width, height, 5);
        const fills = cells.map(([x, y, w, h]) => rect(x + gap / 2, y + gap / 2, w - gap, h - gap, random() < 0.4 ? pick(random, colors.slice(0, 3)) : background)).join("");
        return svg(width, height, "", rect(0, 0, width, height, colors[3]) + fills);
    }

    if (variant === "arches") {
        const cx = width * between(random, 0.3, 0.7);
        const bottom = height * between(random, 0.75, 0.95);
        const maxRadius = Math.min(width, height) * between(random, 0.35, 0.5);
        const rings = 6;
        const arches = Array.from({ length: rings }, (_, index) => {
            const r = maxRadius * (1 - index / rings);
            return `<path d="M${round(cx - r)},${round(bottom)} A${round(r)},${round(r)} 0 0 1 ${round(cx + r)},${round(bottom)} Z" fill="${colors[index % colors.length]}"/>`;
        }).join("");
        const sun = circle(width * between(random, 0.15, 0.85), height * between(random, 0.12, 0.3), Math.min(width, height) * 0.07, colors[(rings + 1) % colors.length]);
        return svg(width, height, "", base + sun + arches + rect(0, bottom, width, height - bottom, colors[3]));
    }

    if (variant === "stripes") {
        const angle = pick(random, [-45, -30, 30, 45, 60]);
        const stripeWidth = Math.min(width, height) * between(random, 0.03, 0.06);
        const diagonal = Math.hypot(width, height);
        const stripes = (color) =>
            Array.from({ length: Math.ceil(diagonal / stripeWidth) }, (_, index) =>
                index % 2 ? "" : rect(-diagonal / 2 + index * stripeWidth, -diagonal / 2, stripeWidth, diagonal * 2, color, `transform="rotate(${angle} ${width / 2} ${height / 2})"`),
            ).join("");
        const r = Math.min(width, height) * between(random, 0.25, 0.38);
        const cx = width * between(random, 0.3, 0.7);
        const cy = height * between(random, 0.3, 0.7);
        return svg(
            width,
            height,
            `<clipPath id="disc"><circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}"/></clipPath>`,
            base + stripes(colors[0]) + circle(cx, cy, r, colors[1]) + `<g clip-path="url(#disc)">${stripes(colors[2])}</g>`,
        );
    }

    // Retícula tipo Bauhaus: celdas con círculos, cuartos, medias lunas, triángulos y bandas.
    const columns = width >= height ? pick(random, [4, 5, 6]) : pick(random, [3, 4]);
    const cell = width / columns;
    const rows = Math.ceil(height / cell);
    let body = base;
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const x = column * cell;
            const y = row * cell;
            const fill = pick(random, colors);
            const color = pick(random, colors.filter((item) => item !== fill));
            const rotation = (Math.floor(random() * 4) * 90 + frame * 18 * ((row + column) % 2 ? 1 : -1)) % 360;
            const center = `${round(x + cell / 2)} ${round(y + cell / 2)}`;
            body += rect(x, y, cell, cell, fill);
            const inner = [
                circle(x + cell / 2, y + cell / 2, cell * 0.38, color),
                `<path d="M${round(x)},${round(y)} A${round(cell)},${round(cell)} 0 0 1 ${round(x + cell)},${round(y + cell)} L${round(x)},${round(y + cell)} Z" fill="${color}"/>`,
                `<path d="M${round(x)},${round(y + cell / 2)} A${round(cell / 2)},${round(cell / 2)} 0 0 1 ${round(x + cell)},${round(y + cell / 2)} Z" fill="${color}"/>`,
                polygon([[x, y + cell], [x + cell / 2, y], [x + cell, y + cell]], color),
                Array.from({ length: 4 }, (_, band) => rect(x, y + band * cell * 0.25, cell, cell * 0.12, color)).join(""),
                rect(x + cell * 0.2, y + cell * 0.2, cell * 0.6, cell * 0.6, color) + circle(x + cell / 2, y + cell / 2, cell * 0.18, fill),
            ][Math.floor(random() * 6)];
            body += `<g transform="rotate(${rotation} ${center})">${inner}</g>`;
        }
    }
    return svg(width, height, "", body);
};

// ---- Fondos: blobs, waves, mesh, orb ----

const blobs = (random, width, height, palette, frame, variant) => {
    const size = Math.max(width, height);

    if (variant === "waves") {
        const layers = [...palette.colors, palette.colors[0]]
            .map((color, index, list) => {
                const top = height * (0.2 + (index / list.length) * 0.75);
                const amplitude = height * between(random, 0.03, 0.08);
                const phase = random() * Math.PI * 2;
                const points = Array.from({ length: 25 }, (_, step) => `${round((step / 24) * width)},${round(top + Math.sin(phase + (step / 24) * Math.PI * between(random, 1.5, 2.2)) * amplitude)}`);
                return `<path d="M0,${height} L${points.join(" L")} L${width},${height} Z" fill="${color}" opacity="0.92"/>`;
            })
            .join("");
        return svg(width, height, blur("soft", size * 0.004), rect(0, 0, width, height, palette.background) + `<g filter="url(#soft)">${layers}</g>`);
    }

    if (variant === "mesh") {
        const corners = [[0, 0], [width, 0], [0, height], [width, height], [width * between(random, 0.3, 0.7), height * between(random, 0.3, 0.7)]];
        const defs = corners.map((_, index) => `<radialGradient id="mesh${index}"><stop offset="0" stop-color="${palette.colors[index % palette.colors.length]}" stop-opacity="1"/><stop offset="1" stop-color="${palette.colors[index % palette.colors.length]}" stop-opacity="0"/></radialGradient>`).join("");
        return svg(width, height, defs, rect(0, 0, width, height, palette.background) + corners.map(([x, y], index) => circle(x, y, size * between(random, 0.55, 0.8), `url(#mesh${index})`)).join(""));
    }

    if (variant === "orb") {
        const cx = width * between(random, 0.35, 0.65);
        const cy = height * between(random, 0.35, 0.6);
        const r = Math.min(width, height) * between(random, 0.25, 0.35);
        const defs =
            `<radialGradient id="orb" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.25" stop-color="${palette.colors[0]}"/><stop offset="1" stop-color="${palette.colors[2]}"/></radialGradient>` +
            verticalGradient("backdrop", [[0, palette.background], [1, mix(palette.background, palette.colors[3], 0.5)]]) +
            blur("shadow", r * 0.15);
        return svg(width, height, defs, rect(0, 0, width, height, "url(#backdrop)") + `<ellipse cx="${round(cx)}" cy="${round(cy + r * 1.1)}" rx="${round(r * 0.9)}" ry="${round(r * 0.15)}" fill="#000000" opacity="0.25" filter="url(#shadow)"/>` + circle(cx, cy, r, "url(#orb)"));
    }

    const circles = Array.from({ length: Math.round(between(random, 4, 9)) }, () => circle(random() * width, random() * height, size * between(random, 0.18, 0.4), pick(random, palette.colors), `opacity="${round(between(random, 0.55, 0.9))}"`)).join("");
    return svg(width, height, blur("haze", size * 0.09), rect(0, 0, width, height, palette.background) + `<g filter="url(#haze)">${circles}</g>`);
};

// ---- Bokeh: lights, string ----

const bokeh = (random, width, height, palette, frame, variant) => {
    const size = Math.min(width, height);
    const lights = (count, minRadius, maxRadius, minOpacity, maxOpacity) =>
        Array.from({ length: count }, () => circle(random() * width, random() * height, between(random, minRadius, maxRadius), pick(random, palette.colors), `opacity="${round(between(random, minOpacity, maxOpacity))}"`)).join("");
    const defs = verticalGradient("night", [[0, palette.background[0]], [1, palette.background[1]]]) + blur("far", size * 0.02) + blur("near", size * 0.006) + blur("bulb", size * 0.01);
    const background = rect(0, 0, width, height, "url(#night)");

    if (variant === "string") {
        const start = [0, height * between(random, 0.2, 0.4)];
        const control = [width * 0.5, height * between(random, 0.6, 0.85)];
        const end = [width, height * between(random, 0.15, 0.35)];
        const bulbs = Array.from({ length: 22 }, (_, index) => {
            const t = (index + 0.5) / 22;
            const x = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * control[0] + t ** 2 * end[0];
            const y = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control[1] + t ** 2 * end[1] + size * 0.02;
            const color = pick(random, palette.colors);
            return `<g filter="url(#bulb)">${circle(x, y, size * 0.03, color, 'opacity="0.6"')}</g>${circle(x, y, size * 0.009, "#fffbe8")}`;
        }).join("");
        return svg(
            width,
            height,
            defs,
            background + `<g filter="url(#far)">${lights(25, size * 0.05, size * 0.14, 0.1, 0.3)}</g>` + `<path d="M${start.join(",")} Q${control.join(",")} ${end.join(",")}" fill="none" stroke="#2a2a2a" stroke-width="2"/>` + bulbs,
        );
    }

    return svg(width, height, defs, background + `<g filter="url(#far)">${lights(40, size * 0.04, size * 0.12, 0.15, 0.45)}</g><g filter="url(#near)">${lights(30, size * 0.015, size * 0.05, 0.35, 0.8)}</g>`);
};

const SCENES = { mountains, sea, city, desert, forest, aurora, abstract, blobs, bokeh };

// SVG de una escena. variant elige la composición; frame desplaza las partes animadas (GIF).
const renderScene = ({ scene, palette, variant, width, height, seed, frame = 0 }) => {
    const draw = SCENES[scene];
    const colors = PALETTES[scene]?.[palette];
    if (!draw || !colors) throw new Error(`Unknown demo scene ${scene}/${palette}`);
    const random = createRandom(seed);
    // Cada media gira un poco el tono de su paleta: dos medias de la misma paleta nunca comparten colores.
    const shift = { hue: between(random, -18, 18), saturation: between(random, 0.85, 1.15), lightness: between(random, -0.05, 0.05) };
    return draw(random, width, height, shiftPalette(colors, shift), frame, variant);
};

module.exports = { renderScene, createRandom };
