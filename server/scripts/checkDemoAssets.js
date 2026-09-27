// Busca las imágenes de la demo que más se parecen entre sí (huella perceptual de estructura y color; en vídeos, un
// fotograma) para comprobar que ninguna se repite. Genera antes los assets que falten. Sin base de datos.
// Uso: npm run demo:check --prefix server
const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");
const { DEMO_ASSETS, ensureDemoAssets, getAssetPath } = require("../demo/demoAssets");

const PAIRS_TO_SHOW = 10;

const extractFrame = (videoPath, outputPath) =>
    new Promise((resolve, reject) => {
        execFile(ffmpegPath, ["-y", "-loglevel", "error", "-ss", "2", "-i", videoPath, "-frames:v", "1", outputPath], (error) => (error ? reject(error) : resolve()));
    });

// dHash de 64 bits (estructura) y miniatura de color de 8x8.
const fingerprint = async (input) => {
    const gray = await sharp(input, { pages: 1 }).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
    const bits = [];
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits.push(gray[y * 9 + x] < gray[y * 9 + x + 1]);
    const color = await sharp(input, { pages: 1 }).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer();
    return { bits, color };
};

const main = async () => {
    await ensureDemoAssets();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tagged-demo-check-"));
    try {
        const prints = [];
        for (const asset of DEMO_ASSETS) {
            let input = getAssetPath(asset);
            if (asset.kind === "video") {
                input = path.join(tempDir, `${asset.id}.png`);
                await extractFrame(getAssetPath(asset), input);
            }
            prints.push({ id: asset.id, ...(await fingerprint(input)) });
        }

        const pairs = [];
        for (let i = 0; i < prints.length; i += 1) {
            for (let j = i + 1; j < prints.length; j += 1) {
                const structure = prints[i].bits.filter((bit, index) => bit !== prints[j].bits[index]).length;
                const color = prints[i].color.reduce((sum, value, index) => sum + Math.abs(value - prints[j].color[index]), 0) / prints[i].color.length;
                pairs.push({ a: prints[i].id, b: prints[j].id, structure, color: Math.round(color), score: structure / 64 + color / 128 });
            }
        }
        pairs.sort((first, second) => first.score - second.score);
        console.log(`${prints.length} demo media, ${pairs.length} pairs. Most similar pairs (structure: different bits of 64; color: mean difference 0-255):`);
        pairs.slice(0, PAIRS_TO_SHOW).forEach((pair) => console.log(`  ${pair.a} ~ ${pair.b}  structure ${pair.structure}  color ${pair.color}`));
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
};

main().catch((error) => {
    console.error("Could not check the demo assets:", error);
    process.exit(1);
});
