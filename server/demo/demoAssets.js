// Archivos de la biblioteca demo: imágenes, GIF y vídeos generados a partir de las escenas de demoScenes.js.
// Se generan una sola vez en una caché (uploads/demo-assets/vN) que nunca se sirve; cada seed copia de ahí los
// archivos de sus medias. Cambiar un asset o una escena obliga a subir DEMO_ASSETS_VERSION.
const { execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");
const { MEDIA } = require("./demoContent");
const { renderScene } = require("./demoScenes");

const DEMO_ASSETS_VERSION = 2;
const DEMO_ASSETS_ROOT = path.join(__dirname, "..", "uploads", "demo-assets");
const DEMO_ASSETS_DIR = path.join(DEMO_ASSETS_ROOT, `v${DEMO_ASSETS_VERSION}`);
const GIF_FRAMES = 20;
const GIF_FRAME_DELAY_MS = 90;
const VIDEO_FPS = 25;
const CONCURRENCY = 4;

const EXTENSIONS = { image: ".jpg", gif: ".gif", video: ".mp4" };
const MIME_TYPES = { image: "image/jpeg", gif: "image/gif", video: "video/mp4" };

// Semilla estable a partir de la clave de cada media: la misma media se dibuja siempre igual.
const hashKey = (key) => [...key].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7);

const DEMO_ASSETS = MEDIA.map((item) => ({ ...item.asset, id: item.key, seed: hashKey(item.key) }));

// Ninguna imagen de la demo se repite: cada media usa su propia combinación de escena, composición y paleta.
const assertUniqueAssets = (assets) => {
    const used = new Map();
    for (const asset of assets.filter((item) => item.scene)) {
        const combination = `${asset.scene}/${asset.variant}/${asset.palette}`;
        if (used.has(combination)) throw new Error(`Demo media "${asset.id}" repeats ${combination} (already used by "${used.get(combination)}")`);
        used.set(combination, asset.id);
    }
};

const getAssetPath = (asset) => path.join(DEMO_ASSETS_DIR, `${asset.id}${EXTENSIONS[asset.kind]}`);

const runFfmpeg = (args) =>
    new Promise((resolve, reject) => {
        execFile(ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", ...args], { timeout: 120000 }, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message));
            else resolve();
        });
    });

const H264_ARGS = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];

const renderImage = (asset, frame = 0) => sharp(Buffer.from(renderScene({ ...asset, frame })));

const generateImage = (asset, outputPath) => renderImage(asset).jpeg({ quality: 86, mozjpeg: true }).toFile(outputPath);

const generateGif = async (asset, outputPath) => {
    const frames = [];
    for (let frame = 0; frame < GIF_FRAMES; frame += 1) {
        frames.push(await renderImage(asset, frame).png().toBuffer());
    }
    await sharp(frames, { join: { animated: true } }).gif({ delay: GIF_FRAME_DELAY_MS, loop: 0, effort: 7 }).toFile(outputPath);
};

// Vídeos: un barrido de cámara sobre una escena más grande que el encuadre, o una fuente generativa de ffmpeg.
const generateVideo = async (asset, outputPath) => {
    const { video } = asset;
    if (video.source === "pan") {
        const stillPath = `${outputPath}.png`;
        await renderImage(asset).png().toFile(stillPath);
        const horizontal = asset.width > video.width;
        const crop = horizontal
            ? `crop=${video.width}:${video.height}:'(iw-${video.width})*t/${video.duration}':0`
            : `crop=${video.width}:${video.height}:0:'(ih-${video.height})*t/${video.duration}'`;
        try {
            await runFfmpeg(["-loop", "1", "-framerate", String(VIDEO_FPS), "-i", stillPath, "-vf", crop, "-t", String(video.duration), ...H264_ARGS, outputPath]);
        } finally {
            await fs.rm(stillPath, { force: true });
        }
        return;
    }
    const sources = {
        life: `life=size=${Math.round(video.width / 4)}x${Math.round(video.height / 4)}:rate=15:ratio=0.12:mold=20:death_color=#101418:life_color=#f5b041:mold_color=#1f6f8b`,
    };
    const scale = video.source === "life" ? ["-vf", `scale=${video.width}:${video.height}:flags=neighbor`] : [];
    await runFfmpeg(["-f", "lavfi", "-i", sources[video.source], "-t", String(video.duration), ...scale, ...H264_ARGS, outputPath]);
};

const GENERATORS = { image: generateImage, gif: generateGif, video: generateVideo };

const fileExists = (filePath) => fs.access(filePath).then(() => true, () => false);

// Genera los assets que falten, varios a la vez. Si dos seeds piden la caché a la vez, esperan a la misma tarea.
let pendingGeneration = null;

const ensureDemoAssets = async (assets = DEMO_ASSETS) => {
    assertUniqueAssets(assets);
    while (pendingGeneration) await pendingGeneration.catch(() => null);
    pendingGeneration = (async () => {
        await fs.mkdir(DEMO_ASSETS_DIR, { recursive: true });
        // Las cachés de versiones anteriores ya no sirven: las medias demo copian sus archivos al crearse.
        const versions = await fs.readdir(DEMO_ASSETS_ROOT);
        await Promise.all(versions.filter((name) => name !== path.basename(DEMO_ASSETS_DIR)).map((name) => fs.rm(path.join(DEMO_ASSETS_ROOT, name), { recursive: true, force: true })));
        const missing = [];
        for (const asset of assets) {
            if (!(await fileExists(getAssetPath(asset)))) missing.push(asset);
        }
        const queue = [...missing];
        const worker = async () => {
            while (queue.length > 0) {
                const asset = queue.shift();
                const outputPath = getAssetPath(asset);
                // Se escribe con otro nombre y se renombra al final: un asset a medias nunca parece terminado.
                const partialPath = `${outputPath}.partial${EXTENSIONS[asset.kind]}`;
                await GENERATORS[asset.kind](asset, partialPath);
                await fs.rename(partialPath, outputPath);
            }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        return missing.length;
    })();
    try {
        return await pendingGeneration;
    } finally {
        pendingGeneration = null;
    }
};

module.exports = { DEMO_ASSETS, DEMO_ASSETS_DIR, ensureDemoAssets, getAssetPath, hashKey, MIME_TYPES, EXTENSIONS };
