const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const { buildSafetyHeads, evaluateSafety, normalizeVector } = require("./aiSafety");

// Modelos del asistente de IA. Se ejecutan en este servidor (CPU): las imágenes nunca salen de él y no hay coste.
// - CLIP ViT-B/16 (MIT): huella numérica de cada imagen para encontrar medias parecidas, y filtro de seguridad.
// - WD Tagger v3 (Apache 2.0): tags de Danbooru, útiles sobre todo con ilustraciones (también NSFW).
// Se descargan una vez desde Hugging Face (revisión fijada) a server/.ai-models, que no se versiona.
const MODELS_DIR = process.env.AI_MODELS_DIR || path.join(__dirname, "..", ".ai-models");
const CLIP_MODEL = "Xenova/clip-vit-base-patch16";
const TAGGER_MODEL = "SmilingWolf/wd-vit-tagger-v3";
const REVISIONS = {
    [CLIP_MODEL]: "342fdf2f67aded64d138ff074745fb4a5d2bba5f",
    [TAGGER_MODEL]: "7f6b584d0bd3f55c4531f14ba3d4761b2bccdc0f",
};
// El tamaño exacto sirve para saber si un archivo está completo y para mostrar el progreso de la descarga.
const MODEL_FILES = [
    { repo: CLIP_MODEL, file: "config.json", size: 4523 },
    { repo: CLIP_MODEL, file: "preprocessor_config.json", size: 520 },
    { repo: CLIP_MODEL, file: "special_tokens_map.json", size: 472 },
    { repo: CLIP_MODEL, file: "tokenizer_config.json", size: 775 },
    { repo: CLIP_MODEL, file: "tokenizer.json", size: 2224081 },
    { repo: CLIP_MODEL, file: "vocab.json", size: 862328 },
    { repo: CLIP_MODEL, file: "merges.txt", size: 524619 },
    { repo: CLIP_MODEL, file: "onnx/vision_model.onnx", size: 345060583 },
    { repo: CLIP_MODEL, file: "onnx/text_model_quantized.onnx", size: 64504507 },
    { repo: TAGGER_MODEL, file: "selected_tags.csv", size: 308468 },
    { repo: TAGGER_MODEL, file: "model.onnx", size: 378536310 },
];
const TOTAL_MODEL_BYTES = MODEL_FILES.reduce((sum, { size }) => sum + size, 0);

// Cambia cuando cambia lo que se guarda de cada media (modelos, filtro o formato): las analizadas antes se repiten.
const ANALYSIS_VERSION = 1;

const TAGGER_INPUT_SIZE = 448;
// Solo se guardan las tags de WD con cierta probabilidad: las sugerencias nunca usan umbrales más bajos.
const TAGGER_MIN_STORED_SCORE = 0.35;
const TAGGER_CATEGORIES = { 0: "general", 4: "character", 9: "rating" };
// Sin uso durante este tiempo, los modelos se liberan de la memoria (unos 1,5 GB) y se vuelven a cargar al pedirlos.
const IDLE_UNLOAD_MS = 15 * 60 * 1000;

const getModelFilePath = (repo, file) => path.join(MODELS_DIR, repo, file);

const isFileComplete = ({ repo, file, size }) => {
    try {
        return fs.statSync(getModelFilePath(repo, file)).size === size;
    } catch {
        return false;
    }
};

// ---------- Descarga ----------

let download = { state: "idle", downloadedBytes: 0, error: null, promise: null };

const getModelsStatus = () => {
    if (download.state === "downloading") return { state: "downloading", downloadedBytes: download.downloadedBytes, totalBytes: TOTAL_MODEL_BYTES, error: null };
    if (MODEL_FILES.every(isFileComplete)) return { state: "ready", downloadedBytes: TOTAL_MODEL_BYTES, totalBytes: TOTAL_MODEL_BYTES, error: null };
    return { state: download.state === "error" ? "error" : "missing", downloadedBytes: 0, totalBytes: TOTAL_MODEL_BYTES, error: download.error };
};

const areModelsInstalled = () => getModelsStatus().state === "ready";

const downloadFile = async ({ repo, file }, onBytes) => {
    const destination = getModelFilePath(repo, file);
    const partialPath = `${destination}.part`;
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    const response = await axios.get(`https://huggingface.co/${repo}/resolve/${REVISIONS[repo]}/${file}`, { responseType: "stream", timeout: 60 * 1000 });

    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(partialPath);
        response.data.on("data", (chunk) => onBytes(chunk.length));
        response.data.on("error", reject);
        output.on("error", reject);
        output.on("finish", resolve);
        response.data.pipe(output);
    });
    await fsp.rename(partialPath, destination);
};

// Descarga lo que falte. Si ya hay una descarga en curso, devuelve la misma promesa.
const downloadModels = () => {
    if (download.promise) return download.promise;

    const pendingFiles = MODEL_FILES.filter((entry) => !isFileComplete(entry));
    download = {
        state: "downloading",
        downloadedBytes: TOTAL_MODEL_BYTES - pendingFiles.reduce((sum, { size }) => sum + size, 0),
        error: null,
        promise: null,
    };
    download.promise = (async () => {
        try {
            for (const entry of pendingFiles) {
                const startBytes = download.downloadedBytes;
                await downloadFile(entry, (bytes) => (download.downloadedBytes += bytes));
                if (!isFileComplete(entry)) throw new Error(`Downloaded ${entry.file} is incomplete`);
                download.downloadedBytes = startBytes + entry.size;
            }
            download = { state: "idle", downloadedBytes: 0, error: null, promise: null };
        } catch (error) {
            console.error("Could not download AI models:", error.message);
            download = { state: "error", downloadedBytes: 0, error: "Could not download the AI models. Check the server's internet connection and try again.", promise: null };
            throw error;
        }
    })();
    return download.promise;
};

// ---------- Carga e inferencia ----------

// Una sola inferencia a la vez: los modelos ya usan todos los núcleos y así una petición no frena a otra a medias.
let inferenceQueue = Promise.resolve();
const runExclusive = (task) => {
    const result = inferenceQueue.then(task, task);
    inferenceQueue = result.catch(() => {});
    return result;
};

let loadedModels = null;
let idleTimer = null;

const releaseModels = async () => {
    const models = await loadedModels?.catch(() => null);
    loadedModels = null;
    if (!models) return;
    await Promise.allSettled([models.vision.dispose(), models.tagger.release()]);
};

const scheduleIdleRelease = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => runExclusive(releaseModels), IDLE_UNLOAD_MS);
    idleTimer.unref?.();
};

const loadTaggerTags = async () => {
    const csv = await fsp.readFile(getModelFilePath(TAGGER_MODEL, "selected_tags.csv"), "utf8");
    return csv
        .trim()
        .split("\n")
        .slice(1)
        .map((line) => {
            const [, name, category] = line.split(",");
            return { name, category: TAGGER_CATEGORIES[Number(category)] || null };
        });
};

const loadModels = () => {
    if (loadedModels) return loadedModels;
    loadedModels = (async () => {
        if (!areModelsInstalled()) throw Object.assign(new Error("AI models are not installed"), { code: "AI_MODELS_MISSING" });

        // Se cargan aquí y no al arrancar: pesan y solo hacen falta si se usa el asistente.
        const transformers = require("@huggingface/transformers");
        const ort = require("onnxruntime-node");
        transformers.env.localModelPath = `${MODELS_DIR}${path.sep}`;
        transformers.env.allowRemoteModels = false;
        transformers.env.allowLocalModels = true;

        const [processor, vision, tokenizer, textModel, tagger, taggerTags] = await Promise.all([
            transformers.AutoProcessor.from_pretrained(CLIP_MODEL),
            transformers.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" }),
            transformers.AutoTokenizer.from_pretrained(CLIP_MODEL),
            transformers.CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "q8" }),
            ort.InferenceSession.create(getModelFilePath(TAGGER_MODEL, "model.onnx")),
            loadTaggerTags(),
        ]);

        // El modelo de texto solo se usa para preparar el filtro de seguridad: después se libera.
        const embedTexts = async (texts) => {
            const { text_embeds: embeddings } = await textModel(tokenizer(texts, { padding: true, truncation: true }));
            const size = embeddings.dims[1];
            return texts.map((_, index) => normalizeVector(embeddings.data.slice(index * size, (index + 1) * size)));
        };
        const safetyHeads = await buildSafetyHeads(embedTexts);
        await textModel.dispose();

        return { transformers, ort, processor, vision, tagger, taggerTags, safetyHeads };
    })().catch((error) => {
        loadedModels = null;
        throw error;
    });
    return loadedModels;
};

// Entrada de WD Tagger: cuadrado de 448 px con relleno blanco, canales BGR de 0 a 255 (formato NHWC).
const prepareTaggerInput = async (imageBuffer, ort) => {
    const { data } = await sharp(imageBuffer)
        .resize(TAGGER_INPUT_SIZE, TAGGER_INPUT_SIZE, { fit: "contain", background: "#ffffff", kernel: "cubic" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const pixels = new Float32Array(TAGGER_INPUT_SIZE * TAGGER_INPUT_SIZE * 3);
    for (let index = 0; index < TAGGER_INPUT_SIZE * TAGGER_INPUT_SIZE; index += 1) {
        pixels[index * 3] = data[index * 3 + 2];
        pixels[index * 3 + 1] = data[index * 3 + 1];
        pixels[index * 3 + 2] = data[index * 3];
    }
    return new ort.Tensor("float32", pixels, [1, TAGGER_INPUT_SIZE, TAGGER_INPUT_SIZE, 3]);
};

const roundScore = (value) => Math.round(value * 1000) / 1000;

// Analiza una imagen (normalmente la miniatura de la media). Devuelve la huella de CLIP, las tags de WD agrupadas por
// categoría y el resultado del filtro de seguridad. Si el filtro la descarta, no devuelve huella ni tags.
const analyzeImage = (imagePath) =>
    runExclusive(async () => {
        const models = await loadModels();
        scheduleIdleRelease();
        const image = await sharp(imagePath, { failOn: "none" })
            .rotate()
            .resize(640, 640, { fit: "inside", withoutEnlargement: true })
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 90 })
            .toBuffer();

        const rawImage = await models.transformers.RawImage.fromBlob(new Blob([image]));
        const { image_embeds: imageEmbeds } = await models.vision(await models.processor(rawImage));
        const embedding = normalizeVector(imageEmbeds.data);

        const taggerOutput = await models.tagger.run({ [models.tagger.inputNames[0]]: await prepareTaggerInput(image, models.ort) });
        const scores = taggerOutput[models.tagger.outputNames[0]].data;
        const scoreByName = new Map(models.taggerTags.map(({ name }, index) => [name, scores[index]]));
        const safety = evaluateSafety({ heads: models.safetyHeads, embedding, taggerScore: (name) => scoreByName.get(name) || 0 });
        if (safety.blocked) return { safety, embedding: null, taggerTags: null };

        const taggerTags = { general: {}, character: {} };
        models.taggerTags.forEach(({ name, category }, index) => {
            if (taggerTags[category] && scores[index] >= TAGGER_MIN_STORED_SCORE) taggerTags[category][name] = roundScore(scores[index]);
        });
        return { safety, embedding, taggerTags };
    });

const removeModels = () =>
    runExclusive(async () => {
        await releaseModels();
        await fsp.rm(MODELS_DIR, { recursive: true, force: true });
    });

module.exports = {
    ANALYSIS_VERSION,
    TOTAL_MODEL_BYTES,
    getModelsStatus,
    areModelsInstalled,
    downloadModels,
    analyzeImage,
    removeModels,
};
