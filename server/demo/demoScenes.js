// Escenas de la biblioteca demo dibujadas en SVG (sharp las convierte en imágenes). Son deterministas: la misma
// semilla produce siempre la misma imagen, así cada reset de la demo es idéntico.

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

const hexToRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, "0")).join("")}`;
const mix = (from, to, amount) => {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * amount));
};

const svg = (width, height, defs, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`;

const verticalGradient = (id, stops) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</linearGradient>`;

const glow = (id, color) => `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="0.85"/><stop offset="0.35" stop-color="${color}" stop-opacity="0.25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const blur = (id, deviation) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`;

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

const ridgePath = (random, width, height, top, depth, roughness) => {
    const profile = ridgeProfile(random, roughness);
    const points = profile.map((value, index) => `${round((index / (profile.length - 1)) * width)},${round(top + (1 - value) * depth)}`);
    return `M0,${height} L${points.join(" L")} L${width},${height} Z`;
};

const stars = (random, width, height, count, color = "#ffffff") =>
    Array.from({ length: count }, () => `<circle cx="${round(random() * width)}" cy="${round(random() * height)}" r="${round(between(random, 0.6, 2.2))}" fill="${color}" opacity="${round(between(random, 0.25, 0.95))}"/>`).join("");

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
    },
    city: {
        neon: { sky: ["#07061a", "#2a1450"], moon: "#f3e9ff", buildings: ["#1b1740", "#120f2e", "#0a0820"], windows: ["#ff5fa2", "#5ce1ff", "#ffd166"] },
        amber: { sky: ["#0b0f1f", "#3b2a4d"], moon: "#fff3d6", buildings: ["#241f38", "#181426", "#0e0b18"], windows: ["#ffc46b", "#ffe2a8", "#ff9a4d"] },
        blue: { sky: ["#0a1a33", "#3f6fa3"], moon: "#e6f0ff", buildings: ["#1c3150", "#13243d", "#0b1729"], windows: ["#ffe6a3", "#a8d8ff", "#ffffff"] },
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

const mountains = (random, width, height, palette, frame = 0) => {
    const sunX = between(random, width * 0.2, width * 0.8);
    const sunY = height * between(random, 0.25, 0.42);
    const sunR = Math.min(width, height) * between(random, 0.05, 0.08);
    const ridges = palette.ridges
        .map((color, index) => {
            const top = height * (0.3 + index * 0.13);
            const path = `<path d="${ridgePath(random, width, height, top, height * (0.22 - index * 0.02), 0.52)}" fill="${color}"/>`;
            const mist = index < palette.ridges.length - 1 ? `<rect y="${round(top + height * 0.08)}" width="${width}" height="${round(height * 0.35)}" fill="url(#mist)" opacity="${round(0.55 - index * 0.1)}"/>` : "";
            return path + mist;
        })
        .join("");
    const lake =
        random() > 0.5
            ? `<rect y="${round(height * 0.86)}" width="${width}" height="${round(height * 0.14)}" fill="${mix(palette.sky[1], palette.ridges[3], 0.55)}"/><ellipse cx="${round(sunX)}" cy="${round(height * 0.93)}" rx="${round(sunR * 1.2)}" ry="${round(height * 0.05)}" fill="${palette.sun}" opacity="0.18" filter="url(#soft)"/>`
            : "";
    return svg(
        width,
        height,
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) + glow("sun", palette.sun) + verticalGradient("mist", [[0, palette.mist, 0], [1, palette.mist, 0.8]]) + blur("soft", Math.round(height * 0.02)),
        `<rect width="${width}" height="${height}" fill="url(#sky)"/><circle cx="${round(sunX)}" cy="${round(sunY + frame)}" r="${round(sunR * 5)}" fill="url(#sun)"/><circle cx="${round(sunX)}" cy="${round(sunY + frame)}" r="${round(sunR)}" fill="${palette.sun}"/>${ridges}${lake}`,
    );
};

const sea = (random, width, height, palette, frame = 0) => {
    const horizon = height * between(random, 0.52, 0.62);
    const sunX = between(random, width * 0.3, width * 0.7);
    const sunR = Math.min(width, height) * between(random, 0.06, 0.09);
    const sunY = horizon - sunR * between(random, 0.2, 1.6);
    const island =
        random() > 0.4 ? `<path d="${ridgePath(random, width, horizon, horizon - height * 0.07, height * 0.07, 0.45)}" fill="${palette.island}" opacity="0.9"/>` : "";
    const glitter = Array.from({ length: 70 }, (_, index) => {
        const y = horizon + 6 + (index / 70) ** 1.4 * (height - horizon);
        const spread = sunR * (0.6 + (index / 70) * 2.4);
        const offset = Math.sin(index * 1.7 + frame * 0.9) * spread * 0.35;
        const lineWidth = spread * between(random, 0.3, 1);
        return `<rect x="${round(sunX - lineWidth / 2 + offset)}" y="${round(y)}" width="${round(lineWidth)}" height="${round(1.5 + index / 25)}" fill="${palette.sun}" opacity="${round(between(random, 0.15, 0.6))}"/>`;
    }).join("");
    const waves = Array.from({ length: 26 }, (_, index) => {
        const y = horizon + ((index + 1) / 27) ** 1.6 * (height - horizon);
        return `<rect y="${round(y)}" width="${width}" height="${round(1 + index / 10)}" fill="${palette.sea[1]}" opacity="0.18"/>`;
    }).join("");
    return svg(
        width,
        height,
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) + verticalGradient("sea", [[0, palette.sea[0]], [1, palette.sea[1]]]) + glow("sun", palette.sun),
        `<rect width="${width}" height="${height}" fill="url(#sky)"/><circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR * 5)}" fill="url(#sun)"/><circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR)}" fill="${palette.sun}"/>${island}<rect y="${round(horizon)}" width="${width}" height="${round(height - horizon)}" fill="url(#sea)"/>${waves}${glitter}`,
    );
};

const city = (random, width, height, palette) => {
    const ground = height * 0.9;
    const layers = palette.buildings
        .map((color, layerIndex) => {
            let x = -between(random, 0, 60);
            let body = "";
            const maxHeight = height * (0.62 - layerIndex * 0.12);
            while (x < width) {
                const buildingWidth = between(random, width * 0.035, width * 0.09);
                const buildingHeight = between(random, maxHeight * 0.35, maxHeight);
                const top = ground - buildingHeight;
                body += `<rect x="${round(x)}" y="${round(top)}" width="${round(buildingWidth)}" height="${round(buildingHeight + height)}" fill="${color}"/>`;
                if (random() > 0.75) body += `<rect x="${round(x + buildingWidth / 2 - 1)}" y="${round(top - height * 0.05)}" width="2" height="${round(height * 0.05)}" fill="${color}"/>`;
                const cell = Math.max(8, width * 0.008);
                for (let wy = top + cell; wy < ground - cell; wy += cell * 1.8) {
                    for (let wx = x + cell * 0.7; wx < x + buildingWidth - cell; wx += cell * 1.5) {
                        if (random() < 0.3 - layerIndex * 0.04) {
                            body += `<rect x="${round(wx)}" y="${round(wy)}" width="${round(cell * 0.7)}" height="${round(cell * 0.9)}" fill="${pick(random, palette.windows)}" opacity="${round(between(random, 0.35, 1) * (1 - layerIndex * 0.2))}"/>`;
                        }
                    }
                }
                x += buildingWidth + between(random, 0, width * 0.01);
            }
            return body;
        })
        .reverse()
        .join("");
    const moonX = between(random, width * 0.15, width * 0.85);
    return svg(
        width,
        height,
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) + glow("moon", palette.moon) + verticalGradient("street", [[0, palette.windows[0], 0], [1, palette.windows[0], 0.35]]),
        `<rect width="${width}" height="${height}" fill="url(#sky)"/>${stars(random, width, height * 0.5, 120)}<circle cx="${round(moonX)}" cy="${round(height * 0.16)}" r="${round(height * 0.2)}" fill="url(#moon)"/><circle cx="${round(moonX)}" cy="${round(height * 0.16)}" r="${round(height * 0.035)}" fill="${palette.moon}"/>${layers}<rect y="${round(ground - height * 0.25)}" width="${width}" height="${round(height * 0.35)}" fill="url(#street)"/>`,
    );
};

const desert = (random, width, height, palette) => {
    const sunX = between(random, width * 0.2, width * 0.8);
    const sunR = Math.min(width, height) * between(random, 0.06, 0.1);
    const dunes = palette.dunes
        .map((color, index) => {
            const base = height * (0.5 + index * 0.13);
            const peaks = 3 + Math.floor(random() * 3);
            let path = `M0,${height} L0,${round(base)}`;
            for (let peak = 0; peak < peaks; peak += 1) {
                const x1 = ((peak + 0.5) / peaks) * width;
                const x2 = ((peak + 1) / peaks) * width;
                const crest = base - between(random, height * 0.03, height * 0.12);
                path += ` Q${round(x1 + between(random, -width * 0.05, width * 0.05))},${round(crest)} ${round(x2)},${round(base + between(random, -height * 0.02, height * 0.03))}`;
            }
            path += ` L${width},${height} Z`;
            const shade = `<path d="${path}" fill="${mix(color, "#000000", 0.18)}" transform="translate(${round(width * 0.012)} ${round(height * 0.012)})"/>`;
            return shade + `<path d="${path}" fill="${color}"/>`;
        })
        .join("");
    const night = palette.sky[0] === "#05081a" ? stars(random, width, height * 0.55, 220) : "";
    return svg(
        width,
        height,
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) + glow("sun", palette.sun),
        `<rect width="${width}" height="${height}" fill="url(#sky)"/>${night}<circle cx="${round(sunX)}" cy="${round(height * 0.3)}" r="${round(sunR * 4)}" fill="url(#sun)"/><circle cx="${round(sunX)}" cy="${round(height * 0.3)}" r="${round(sunR)}" fill="${palette.sun}"/>${dunes}`,
    );
};

const pine = (x, base, treeHeight, color) => {
    const widthAt = (ratio) => treeHeight * 0.34 * ratio;
    const tiers = [0, 0.28, 0.52]
        .map((start, index) => {
            const top = base - treeHeight + start * treeHeight * 0.7;
            const bottom = base - treeHeight * (0.45 - index * 0.2);
            const half = widthAt(0.55 + index * 0.25);
            return `M${round(x)},${round(top)} L${round(x + half)},${round(bottom)} L${round(x - half)},${round(bottom)} Z`;
        })
        .join(" ");
    return `<path d="${tiers}" fill="${color}"/><rect x="${round(x - treeHeight * 0.015)}" y="${round(base - treeHeight * 0.2)}" width="${round(treeHeight * 0.03)}" height="${round(treeHeight * 0.25)}" fill="${color}"/>`;
};

const forest = (random, width, height, palette) => {
    const layers = palette.layers
        .map((color, index) => {
            const base = height * (0.62 + index * 0.13);
            let trees = `<rect y="${round(base - 2)}" width="${width}" height="${round(height - base + 2)}" fill="${color}"/>`;
            const size = height * (0.18 + index * 0.1);
            for (let x = -size * 0.2; x < width + size * 0.2; x += size * between(random, 0.18, 0.4)) {
                trees += pine(x, base + between(random, 0, height * 0.02), size * between(random, 0.7, 1.15), color);
            }
            const fog = index < palette.layers.length - 1 ? `<rect y="${round(base - size * 0.6)}" width="${width}" height="${round(size)}" fill="url(#fog)" opacity="${round(0.7 - index * 0.12)}"/>` : "";
            return trees + fog;
        })
        .join("");
    return svg(
        width,
        height,
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) + verticalGradient("fog", [[0, palette.sky[1], 0], [0.6, palette.sky[1], 0.85], [1, palette.sky[1], 0]]),
        `<rect width="${width}" height="${height}" fill="url(#sky)"/>${layers}`,
    );
};

const aurora = (random, width, height, palette, frame = 0) => {
    const bands = palette.bands
        .map((color, index) => {
            const baseY = height * (0.22 + index * 0.1);
            const amplitude = height * between(random, 0.05, 0.12);
            const phase = random() * Math.PI * 2 + frame * 0.35;
            const points = Array.from({ length: 9 }, (_, step) => {
                const x = (step / 8) * width;
                const y = baseY + Math.sin(phase + step * 0.9) * amplitude;
                return `${round(x)},${round(y)}`;
            });
            return `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${round(height * between(random, 0.08, 0.16))}" stroke-linecap="round" opacity="${round(between(random, 0.35, 0.6))}" filter="url(#veil)"/>`;
        })
        .join("");
    const land = `<path d="${ridgePath(random, width, height, height * 0.72, height * 0.14, 0.5)}" fill="${palette.land}"/>`;
    return svg(
        width,
        height,
        verticalGradient("sky", [[0, palette.sky[0]], [1, palette.sky[1]]]) + blur("veil", Math.round(height * 0.04)),
        `<rect width="${width}" height="${height}" fill="url(#sky)"/>${stars(random, width, height * 0.8, 260)}${bands}${land}`,
    );
};

// Composición tipo Bauhaus: una retícula de celdas con círculos, cuartos, medias lunas, triángulos y bandas.
const abstract = (random, width, height, palette, frame = 0) => {
    const columns = width >= height ? 4 : 3;
    const cell = width / columns;
    const rows = Math.ceil(height / cell);
    let body = `<rect width="${width}" height="${height}" fill="${palette.background}"/>`;
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const x = column * cell;
            const y = row * cell;
            const background = pick(random, palette.colors);
            const color = pick(random, palette.colors.filter((item) => item !== background));
            const rotation = (Math.floor(random() * 4) * 90 + frame * 18 * ((row + column) % 2 ? 1 : -1)) % 360;
            const center = `${round(x + cell / 2)} ${round(y + cell / 2)}`;
            body += `<rect x="${round(x)}" y="${round(y)}" width="${round(cell)}" height="${round(cell)}" fill="${background}"/>`;
            const shape = Math.floor(random() * 6);
            const inner = [
                `<circle cx="${round(x + cell / 2)}" cy="${round(y + cell / 2)}" r="${round(cell * 0.38)}" fill="${color}"/>`,
                `<path d="M${round(x)},${round(y)} A${round(cell)},${round(cell)} 0 0 1 ${round(x + cell)},${round(y + cell)} L${round(x)},${round(y + cell)} Z" fill="${color}"/>`,
                `<path d="M${round(x)},${round(y + cell / 2)} A${round(cell / 2)},${round(cell / 2)} 0 0 1 ${round(x + cell)},${round(y + cell / 2)} Z" fill="${color}"/>`,
                `<path d="M${round(x)},${round(y + cell)} L${round(x + cell / 2)},${round(y)} L${round(x + cell)},${round(y + cell)} Z" fill="${color}"/>`,
                Array.from({ length: 4 }, (_, band) => `<rect x="${round(x)}" y="${round(y + band * cell * 0.25)}" width="${round(cell)}" height="${round(cell * 0.12)}" fill="${color}"/>`).join(""),
                `<rect x="${round(x + cell * 0.2)}" y="${round(y + cell * 0.2)}" width="${round(cell * 0.6)}" height="${round(cell * 0.6)}" fill="${color}"/><circle cx="${round(x + cell / 2)}" cy="${round(y + cell / 2)}" r="${round(cell * 0.18)}" fill="${background}"/>`,
            ][shape];
            body += `<g transform="rotate(${rotation} ${center})">${inner}</g>`;
        }
    }
    return svg(width, height, "", body);
};

// Manchas de color muy desenfocadas: fondos de pantalla suaves.
const blobs = (random, width, height, palette) => {
    const circles = Array.from({ length: 7 }, () => {
        const radius = Math.max(width, height) * between(random, 0.18, 0.4);
        return `<circle cx="${round(random() * width)}" cy="${round(random() * height)}" r="${round(radius)}" fill="${pick(random, palette.colors)}" opacity="${round(between(random, 0.55, 0.9))}"/>`;
    }).join("");
    return svg(width, height, blur("haze", Math.round(Math.max(width, height) * 0.09)), `<rect width="${width}" height="${height}" fill="${palette.background}"/><g filter="url(#haze)">${circles}</g>`);
};

const bokeh = (random, width, height, palette) => {
    const lights = (count, minRadius, maxRadius, minOpacity, maxOpacity) =>
        Array.from({ length: count }, () => `<circle cx="${round(random() * width)}" cy="${round(random() * height)}" r="${round(between(random, minRadius, maxRadius))}" fill="${pick(random, palette.colors)}" opacity="${round(between(random, minOpacity, maxOpacity))}"/>`).join("");
    const size = Math.min(width, height);
    return svg(
        width,
        height,
        verticalGradient("night", [[0, palette.background[0]], [1, palette.background[1]]]) + blur("far", Math.round(size * 0.02)) + blur("near", Math.round(size * 0.006)),
        `<rect width="${width}" height="${height}" fill="url(#night)"/><g filter="url(#far)">${lights(40, size * 0.04, size * 0.12, 0.15, 0.45)}</g><g filter="url(#near)">${lights(30, size * 0.015, size * 0.05, 0.35, 0.8)}</g>`,
    );
};

const SCENES = { mountains, sea, city, desert, forest, aurora, abstract, blobs, bokeh };

// SVG de una escena. frame desplaza las partes animadas (GIF).
const renderScene = ({ scene, palette, width, height, seed, frame = 0 }) => {
    const draw = SCENES[scene];
    const colors = PALETTES[scene]?.[palette];
    if (!draw || !colors) throw new Error(`Unknown demo scene ${scene}/${palette}`);
    return draw(createRandom(seed), width, height, colors, frame);
};

module.exports = { renderScene, createRandom };
