const fs = require("fs");
const path = require("path");
const AiAssistantModel = require("../models/AiAssistant.model");
const TagModel = require("../models/Tag.model");
const MediaTagModel = require("../models/MediaTag.model");
const AuditService = require("./Audit.service");
const RuleEngineService = require("./RuleEngine.service");
const { isDriveTagName } = require("../utils/driveTag");
const { MEDIA_UPLOAD_DIR, THUMBNAILS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR } = require("../middlewares/upload.middleware");
const { ANALYSIS_VERSION, getModelsStatus, areModelsInstalled, downloadModels, analyzeImage, removeModels } = require("../utils/aiModels");
const { STRICTNESS_LEVELS, DEFAULT_STRICTNESS, toTaggerName, suggestTags } = require("../utils/aiTagSuggestions");

// Asistente de IA: etiqueta medias con las tags que el usuario ya usa en medias parecidas. Todo se ejecuta en este
// servidor (utils/aiModels.js) y solo añade tags: nunca quita ninguna.
// Cada media se analiza una vez (huella, tags de WD y filtro de seguridad) y se guarda en media_ai_index. Al
// instalar los modelos se analiza la biblioteca en segundo plano, y después cada media nueva al añadirla.

const MAX_SUGGEST_MEDIA = 50;
// Un análisis tarda ~0,5 s: con más medias, la petición tardaría demasiado. Para más, "Tag library".
const MAX_TAG_MEDIA = 200;
const ANALYSIS_BATCH_SIZE = 25;
const TAGGING_BATCH_SIZE = 100;

const forbidAdmin = (user) => (user.type === "admin" ? { error: "The AI assistant is only available for library accounts", status: 403 } : null);
const modelsMissing = () => ({ error: "Set up the AI assistant first", status: 409 });
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

const parseMediaIds = (value, max) => {
    const ids = Array.isArray(value) ? [...new Set(value.map(Number))] : [];
    if (ids.length === 0 || ids.length > max || !ids.every((id) => Number.isInteger(id) && id > 0)) {
        return { error: `Select between 1 and ${max} media`, status: 400 };
    }
    return { ids };
};

// ---------- Análisis ----------

const UPLOAD_DIRS = { thumbnails: THUMBNAILS_UPLOAD_DIR, previews: PREVIEWS_UPLOAD_DIR, media: MEDIA_UPLOAD_DIR };
const resolveUploadPath = (uploadPath) => {
    const match = /^\/uploads\/(thumbnails|previews|media)\/([A-Za-z0-9._-]+)$/.exec(String(uploadPath || ""));
    return match ? path.join(UPLOAD_DIRS[match[1]], match[2]) : null;
};

// Se analiza la miniatura (640 px, existe para imágenes, GIFs, vídeos y medias de Drive): basta para los modelos y
// evita leer originales enormes. Si falta, el preview o el original de una imagen local.
const getAnalysisImagePath = (media) =>
    [media.thumbpath, media.previewpath, media.mediatype === "image" && media.storage_provider === "local" ? media.filepath : null]
        .map(resolveUploadPath)
        .find((filePath) => filePath && fs.existsSync(filePath)) || null;

// Huellas de cada usuario en memoria: se cargan una vez y se completan al analizar medias nuevas.
const embeddingCache = new Map();

const getEmbeddings = async (userId) => {
    if (!embeddingCache.has(userId)) {
        const rows = await AiAssistantModel.findEmbeddings(userId, ANALYSIS_VERSION);
        embeddingCache.set(userId, new Map(rows.map((row) => [row.mediaId, row.embedding])));
    }
    return embeddingCache.get(userId);
};

const analyzeMedia = async (userId, media) => {
    const imagePath = getAnalysisImagePath(media);
    let result = { status: "failed", reason: "no_preview" };
    if (imagePath) {
        try {
            const analysis = await analyzeImage(imagePath);
            result = analysis.safety.blocked
                ? { status: "blocked", reason: analysis.safety.reason }
                : { status: "ready", embedding: analysis.embedding, taggerTags: analysis.taggerTags };
        } catch (error) {
            if (error.code === "AI_MODELS_MISSING") throw error;
            console.warn(`Could not analyze media ${media.id} with AI:`, error.message);
            result = { status: "failed", reason: "unreadable" };
        }
    }

    await AiAssistantModel.saveAnalysis({ mediaId: media.id, userId, version: ANALYSIS_VERSION, ...result });
    if (result.embedding) embeddingCache.get(userId)?.set(media.id, result.embedding);
    return result;
};

// Analiza las que aún no lo estén de estas medias del usuario (las ajenas no aparecen en la consulta).
const analyzePending = async (userId, mediaIds) => {
    for (const media of await AiAssistantModel.findPendingMedia(userId, ANALYSIS_VERSION, { ids: mediaIds, limit: mediaIds.length })) {
        await analyzeMedia(userId, media);
    }
};

// ---------- Sugerencias ----------

const getSettings = async (userId) => {
    const settings = await AiAssistantModel.getSettings(userId);
    return { strictness: settings.strictness || DEFAULT_STRICTNESS, excludedTagIds: settings.excludedTagIds };
};

// Vocabulario del usuario: qué tags se pueden sugerir y cómo se llaman en WD Tagger. Nunca la tag de sistema
// "Google Drive" ni las que el usuario excluyó.
const loadTagContext = async (userId, settings) => {
    const excludedTagIds = new Set(settings.excludedTagIds);
    const skipTagIds = new Set(excludedTagIds);
    const tagIdsByTaggerName = new Map();
    for (const tag of await TagModel.findAllByUserId(userId)) {
        if (isDriveTagName(tag.tagname)) skipTagIds.add(tag.id);
        if (skipTagIds.has(tag.id)) continue;
        const name = toTaggerName(tag.tagname);
        tagIdsByTaggerName.set(name, [...(tagIdsByTaggerName.get(name) || []), tag.id]);
    }
    return { skipTagIds, tagIdsByTaggerName };
};

// Ejemplos de los que aprende: medias analizadas con las tags que les puso el usuario.
const loadEvidence = async (userId) => {
    const [embeddings, pairs] = await Promise.all([getEmbeddings(userId), AiAssistantModel.findUserTagPairs(userId)]);
    const tagIdsByMedia = new Map();
    for (const { media_id: mediaId, tag_id: tagId } of pairs) {
        if (!tagIdsByMedia.has(mediaId)) tagIdsByMedia.set(mediaId, new Set());
        tagIdsByMedia.get(mediaId).add(tagId);
    }
    const evidence = [];
    for (const [mediaId, tagIds] of tagIdsByMedia) {
        const embedding = embeddings.get(mediaId);
        if (embedding) evidence.push({ mediaId, embedding, tagIds });
    }
    return evidence;
};

const loadSuggestionContext = async (userId) => {
    const settings = await getSettings(userId);
    const [tagContext, evidence] = await Promise.all([loadTagContext(userId, settings), loadEvidence(userId)]);
    return { ...tagContext, evidence, strictness: settings.strictness };
};

// Devuelve las medias analizadas (con su estado) y, para las que pasaron el filtro, sus sugerencias.
const computeSuggestions = async (userId, mediaIds, context) => {
    const [analyses, skipRows] = await Promise.all([
        AiAssistantModel.findAnalyses(userId, ANALYSIS_VERSION, mediaIds),
        AiAssistantModel.findTagIdsToSkip(mediaIds),
    ]);
    const skipByMedia = new Map();
    for (const { media_id: mediaId, tag_id: tagId } of skipRows) skipByMedia.set(mediaId, [...(skipByMedia.get(mediaId) || []), tagId]);

    const results = [];
    for (const analysis of analyses) {
        const suggestions =
            analysis.status === "ready"
                ? suggestTags({
                      target: analysis,
                      evidence: context.evidence,
                      tagIdsByTaggerName: context.tagIdsByTaggerName,
                      skipTagIds: new Set([...context.skipTagIds, ...(skipByMedia.get(analysis.mediaId) || [])]),
                      strictness: context.strictness,
                  })
                : [];
        results.push({ mediaId: analysis.mediaId, status: analysis.status, reason: analysis.reason, suggestions });
        // Cada media compara su huella con toda la biblioteca: se cede el turno para no bloquear otras peticiones.
        await yieldToEventLoop();
    }
    return results;
};

// Añade las tags sugeridas y recuerda que las puso la IA. Devuelve las medias que cambiaron y cuántas tags añadió.
const applySuggestions = async (results) => {
    const pairs = [];
    const changedIds = [];
    for (const { mediaId, suggestions } of results) {
        if (suggestions.length === 0) continue;
        await MediaTagModel.createMany(mediaId, suggestions.map(({ tagId }) => tagId));
        suggestions.forEach(({ tagId }) => pairs.push({ mediaId, tagId }));
        changedIds.push(mediaId);
    }
    await AiAssistantModel.recordAiTags(pairs);
    return { changedIds, addedCount: pairs.length };
};

const summarizeResults = (results, { changedIds, addedCount }) => ({
    processedCount: results.length,
    changedCount: changedIds.length,
    addedCount,
    blockedCount: results.filter(({ status }) => status === "blocked").length,
    failedCount: results.filter(({ status }) => status === "failed").length,
});

// ---------- Trabajos en segundo plano ----------

// Un trabajo por usuario: "analyze" analiza lo pendiente; "tag" además etiqueta toda la biblioteca ("Tag library").
// Viven en memoria: si el servidor se reinicia, se pierde el progreso (lo ya analizado o etiquetado se conserva).
const jobs = new Map();

// Estimación a partir del ritmo de la fase actual (análisis ~0,5 s por media; etiquetar es mucho más rápido).
const estimateRemainingSeconds = (job) => {
    if (job.status !== "running" || job.processed === 0 || job.total <= job.processed) return null;
    const secondsPerMedia = (Date.now() - job.phaseStartedAt.getTime()) / 1000 / job.processed;
    return Math.ceil(secondsPerMedia * (job.total - job.processed));
};

const serializeJob = (job) =>
    job && {
        remainingSeconds: estimateRemainingSeconds(job),
        type: job.type,
        status: job.status,
        phase: job.phase,
        total: job.total,
        processed: job.processed,
        changedCount: job.changedCount,
        addedCount: job.addedCount,
        blockedCount: job.blockedCount,
        failedCount: job.failedCount,
        startedAt: job.startedAt,
        phaseStartedAt: job.phaseStartedAt,
        finishedAt: job.finishedAt,
        error: job.error,
    };

const runAnalysisPhase = async (userId, job) => {
    Object.assign(job, { phase: "analyzing", phaseStartedAt: new Date(), processed: 0, total: await AiAssistantModel.countPendingMedia(userId, ANALYSIS_VERSION) });
    // Las medias que se añaden durante el trabajo tienen ids mayores: también se analizan en esta pasada.
    let afterId = 0;
    while (!job.cancelRequested) {
        const rows = await AiAssistantModel.findPendingMedia(userId, ANALYSIS_VERSION, { afterId, limit: ANALYSIS_BATCH_SIZE });
        if (rows.length === 0) break;
        for (const media of rows) {
            if (job.cancelRequested) break;
            const { status } = await analyzeMedia(userId, media);
            job.processed += 1;
            job.total = Math.max(job.total, job.processed);
            if (status === "blocked") job.blockedCount += 1;
            if (status === "failed") job.failedCount += 1;
            afterId = media.id;
        }
    }
};

const runTaggingPhase = async (userId, job) => {
    const library = await AiAssistantModel.countLibrary(userId, ANALYSIS_VERSION);
    Object.assign(job, { phase: "tagging", phaseStartedAt: new Date(), processed: 0, total: library.ready });
    // Los ejemplos se fijan al empezar: lo que añade este trabajo no influye en el resto de la biblioteca.
    const context = await loadSuggestionContext(userId);
    let afterId = 0;
    while (!job.cancelRequested) {
        const mediaIds = await AiAssistantModel.findReadyMediaIds(userId, ANALYSIS_VERSION, { afterId, limit: TAGGING_BATCH_SIZE });
        if (mediaIds.length === 0) break;
        const { changedIds, addedCount } = await applySuggestions(await computeSuggestions(userId, mediaIds, context));
        if (changedIds.length > 0) await RuleEngineService.runForEvent(userId, "edited", changedIds);
        job.changedCount += changedIds.length;
        job.addedCount += addedCount;
        job.processed = Math.min(job.total, job.processed + mediaIds.length);
        afterId = mediaIds[mediaIds.length - 1];
    }
};

const startJob = (userId, type, req = null) => {
    const previous = jobs.get(userId);
    if (previous?.status === "running") {
        // Un trabajo "tag" ya analiza lo pendiente; uno "analyze" deja paso a "tag".
        if (previous.type === type || previous.type === "tag") return previous;
        previous.cancelRequested = true;
    }

    const job = {
        type,
        status: "running",
        phase: "analyzing",
        total: 0,
        processed: 0,
        changedCount: 0,
        addedCount: 0,
        blockedCount: 0,
        failedCount: 0,
        startedAt: new Date(),
        phaseStartedAt: new Date(),
        finishedAt: null,
        error: null,
        cancelRequested: false,
    };
    jobs.set(userId, job);
    job.promise = (async () => {
        await previous?.promise;
        try {
            await runAnalysisPhase(userId, job);
            if (type === "tag" && !job.cancelRequested) await runTaggingPhase(userId, job);
            job.status = job.cancelRequested ? "cancelled" : "done";
        } catch (error) {
            console.error(`AI assistant ${type} job failed:`, error);
            job.status = "failed";
            job.error = error.code === "AI_MODELS_MISSING" ? "The AI models are not installed" : "The AI assistant stopped because of an unexpected error";
        } finally {
            job.phase = null;
            job.finishedAt = new Date();
        }
        if (type === "tag") {
            await AuditService.logEvent({
                actionCode: "AI_LIBRARY_RUN",
                req,
                userId,
                statusCode: job.status === "failed" ? 500 : 200,
                message: `AI assistant ${job.status === "done" ? "tagged" : `${job.status} tagging`} the library: added ${job.addedCount} tags to ${job.changedCount} media`,
                metadata: serializeJob(job),
            });
        }
    })();
    return job;
};

const isAnyJobRunning = () => [...jobs.values()].some((job) => job.status === "running");

// ---------- Servicio ----------

class AiAssistantService {
    static async getStatus(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const [library, aiTags, settings, tags] = await Promise.all([
            AiAssistantModel.countLibrary(user.id, ANALYSIS_VERSION),
            AiAssistantModel.getAiTagStats(user.id),
            getSettings(user.id),
            TagModel.findAllByUserId(user.id),
        ]);
        const excluded = new Set(settings.excludedTagIds);
        return {
            data: {
                models: getModelsStatus(),
                library,
                aiTags,
                settings: { strictness: settings.strictness, excludedTags: tags.filter((tag) => excluded.has(tag.id)).map((tag) => tag.tagname) },
                job: serializeJob(jobs.get(user.id)),
            },
        };
    }

    // Descarga los modelos (si faltan) y analiza la biblioteca en segundo plano. Responde al momento.
    static async setup(user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (areModelsInstalled()) {
            startJob(user.id, "analyze");
        } else {
            downloadModels()
                .then(() => startJob(user.id, "analyze"))
                .catch(() => {});
            await AuditService.logEvent({ actionCode: "AI_SETUP", req, statusCode: 202, message: "Started downloading the AI assistant models" });
        }
        return this.getStatus(user);
    }

    // Los modelos son del servidor: se borran para todos los usuarios. Los análisis se conservan para reinstalarlos.
    static async removeModels(user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (getModelsStatus().state === "downloading" || isAnyJobRunning()) {
            return { error: "Wait until the AI assistant finishes its current work", status: 409 };
        }
        await removeModels();
        embeddingCache.clear();
        await AuditService.logEvent({ actionCode: "AI_MODELS_REMOVE", req, message: "Removed the AI assistant models" });
        return this.getStatus(user);
    }

    static async updateSettings(body, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const current = await getSettings(user.id);
        const strictness = body?.strictness === undefined ? current.strictness : body.strictness;
        if (!Object.hasOwn(STRICTNESS_LEVELS, strictness)) return { error: "Choose a valid confidence level", status: 400 };

        let excludedTagIds = current.excludedTagIds;
        if (body?.excludedTags !== undefined) {
            if (!Array.isArray(body.excludedTags) || !body.excludedTags.every((name) => typeof name === "string")) {
                return { error: "Excluded tags must be a list of tag names", status: 400 };
            }
            const wanted = new Set(body.excludedTags.map((name) => name.trim().toLowerCase()));
            excludedTagIds = (await TagModel.findAllByUserId(user.id)).filter((tag) => wanted.has(tag.tagname.trim().toLowerCase())).map((tag) => tag.id);
        }

        await AiAssistantModel.saveSettings(user.id, { strictness, excludedTagIds });
        return this.getStatus(user);
    }

    // Sugerencias sin aplicarlas (formulario de edición): el usuario decide antes de guardar.
    static async suggest(body, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const { ids, ...idsError } = parseMediaIds(body?.mediaIds, MAX_SUGGEST_MEDIA);
        if (!ids) return idsError;
        if (!areModelsInstalled()) return modelsMissing();

        await analyzePending(user.id, ids);
        const context = await loadSuggestionContext(user.id);
        const tagNames = new Map((await TagModel.findAllByUserId(user.id)).map((tag) => [tag.id, tag.tagname]));
        const results = await computeSuggestions(user.id, ids, context);
        return {
            data: results.map(({ mediaId, status, reason, suggestions }) => ({
                id: mediaId,
                status,
                reason,
                tags: suggestions.map(({ tagId, score, source }) => ({ tagname: tagNames.get(tagId), score: Math.round(score * 100) / 100, source })),
            })),
        };
    }

    // "Tag with AI" desde la selección: añade las tags sugeridas a estas medias.
    static async tagMedia(body, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const { ids, ...idsError } = parseMediaIds(body?.mediaIds, MAX_TAG_MEDIA);
        if (!ids) return idsError;
        if (!areModelsInstalled()) return modelsMissing();

        await analyzePending(user.id, ids);
        const results = await computeSuggestions(user.id, ids, await loadSuggestionContext(user.id));
        const applied = await applySuggestions(results);
        if (applied.changedIds.length > 0) await RuleEngineService.runForEvent(user.id, "edited", applied.changedIds);

        const summary = summarizeResults(results, applied);
        await AuditService.logEvent({
            actionCode: "AI_TAG_MEDIA",
            req,
            message: `AI assistant added ${summary.addedCount} tags to ${summary.changedCount} of ${summary.processedCount} media`,
            metadata: { ...summary, mediaIds: applied.changedIds },
        });
        return { data: summary };
    }

    // Todo flujo que añade medias lo llama antes de las reglas "Media added". Con "Tag with AI", el asistente añade
    // sus tags en ese momento (así las reglas ya las ven); sin él, solo las analiza en segundo plano para que sirvan
    // de ejemplo y estén listas. Nunca hace fallar la operación: si algo falla, las medias se quedan como estaban.
    static async prepareAddedMedia(userId, mediaIds, { tagWithAi = false } = {}) {
        try {
            if (!areModelsInstalled() || !mediaIds?.length) return;
            if (!tagWithAi) {
                startJob(userId, "analyze");
                return;
            }
            await analyzePending(userId, mediaIds);
            await applySuggestions(await computeSuggestions(userId, mediaIds, await loadSuggestionContext(userId)));
        } catch (error) {
            console.error("Could not prepare new media for the AI assistant:", error);
        }
    }

    static async startLibraryRun(user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (!areModelsInstalled()) return modelsMissing();
        if (jobs.get(user.id)?.status === "running" && jobs.get(user.id).type === "tag") return { error: "The AI assistant is already tagging your library", status: 409 };
        startJob(user.id, "tag", req);
        return this.getStatus(user);
    }

    static async cancelJob(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const job = jobs.get(user.id);
        if (job?.status === "running") job.cancelRequested = true;
        return this.getStatus(user);
    }
}

module.exports = AiAssistantService;
