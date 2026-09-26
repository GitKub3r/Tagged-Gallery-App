const RuleModel = require("../models/Rule.model");
const MediaModel = require("../models/Media.model");
const TagModel = require("../models/Tag.model");
const MediaTagModel = require("../models/MediaTag.model");
const MediaAlbumModel = require("../models/MediaAlbum.model");
const AlbumModel = require("../models/Album.model");
const { executeGraph, getGraphIssues, getMediaSignature } = require("../utils/ruleGraph");

// Una ejecución manual recorre la biblioteca por tandas para no cargarla entera en memoria.
const RUN_BATCH_SIZE = 200;

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

// Copia en memoria de cada media con sus tags y álbumes. Las reglas trabajan sobre ella y al final
// solo se guarda la diferencia con el estado original.
const loadMediaStates = async (rows) => {
    const ids = rows.map((row) => row.id);
    const [tagRows, albumRows] = await Promise.all([TagModel.findByMediaIds(ids), MediaAlbumModel.findAlbumIdsByMediaIds(ids)]);

    return rows.map((row) => {
        const state = {
            ...row,
            size: Number(row.size) || 0,
            is_favourite: Boolean(row.is_favourite),
            was_trashed: Boolean(row.was_trashed),
            tags: tagRows.filter((tag) => tag.mediaid === row.id).map((tag) => tag.tagname),
            albumIds: new Set(albumRows.filter((album) => album.mediaid === row.id).map((album) => album.albumid)),
        };
        return { original: { tags: [...state.tags], is_favourite: state.is_favourite, albumIds: new Set(state.albumIds) }, state };
    });
};

const saveChanges = async ({ original, state }) => {
    const originalKeys = new Set(original.tags.map(normalizeKey));
    const finalKeys = new Set(state.tags.map(normalizeKey));
    const tagsToAdd = state.tags.filter((tag) => !originalKeys.has(normalizeKey(tag)));
    const tagsToRemove = original.tags.filter((tag) => !finalKeys.has(normalizeKey(tag)));

    if (tagsToRemove.length) await MediaTagModel.deleteSpecificTagsByNameForMedia(state.id, tagsToRemove, state.user_id);
    if (tagsToAdd.length) await MediaTagModel.createMany(state.id, await TagModel.findOrCreateIdsForUser(tagsToAdd, state.user_id));
    if (state.is_favourite !== original.is_favourite) await MediaModel.update(state.id, { is_favourite: state.is_favourite });
    for (const albumId of state.albumIds) {
        if (!original.albumIds.has(albumId)) await MediaAlbumModel.addMany(albumId, [state.id]);
    }
};

// Aplica las reglas a un grupo de medias y guarda los cambios. Devuelve cuántas medias cambiaron.
// trace: recorrido acumulado de la ejecución (ver executeGraph), solo en las ejecuciones manuales.
const applyRules = async (rules, event, rows, context, trace = null) => {
    const entries = await loadMediaStates(rows);
    const countsByRuleId = new Map();
    let changedCount = 0;

    for (const entry of entries) {
        const initialSignature = getMediaSignature(entry.state);
        for (const rule of rules) {
            const before = getMediaSignature(entry.state);
            executeGraph(rule.graph, event, entry.state, context, trace);
            if (getMediaSignature(entry.state) !== before) countsByRuleId.set(rule.id, (countsByRuleId.get(rule.id) || 0) + 1);
        }
        if (getMediaSignature(entry.state) !== initialSignature) {
            await saveChanges(entry);
            changedCount += 1;
        }
    }

    await RuleModel.recordApplications(countsByRuleId);
    return changedCount;
};

const loadContext = async (userId) => ({ albumIds: new Set(await AlbumModel.findIdsByUserId(userId)) });

class RuleEngineService {
    // Ejecuta las reglas activas del usuario que empiezan por el disparador del evento ("added", "edited",
    // "restored"). Nunca hace fallar la operación que lo dispara: un error se registra y se ignora.
    // Los cambios que hacen las reglas no vuelven a disparar reglas.
    static async runForEvent(userId, event, mediaIds) {
        try {
            if (!userId || !mediaIds?.length) return;
            const context = await loadContext(userId);
            const rules = (await RuleModel.findActiveByUserId(userId)).filter((rule) => getGraphIssues(rule.graph, context).length === 0);
            if (rules.length === 0) return;

            const rows = await MediaModel.findRuleSnapshots(userId, { ids: mediaIds });
            if (rows.length > 0) await applyRules(rules, event, rows, context);
        } catch (error) {
            console.error(`Could not apply rules (${event}):`, error);
        }
    }

    // "Run": aplica una regla a toda la biblioteca, partiendo de todos sus disparadores (también si está inactiva).
    static async runOnLibrary(rule, userId) {
        const context = await loadContext(userId);
        const issues = getGraphIssues(rule.graph, context);
        if (issues.length > 0) return { error: issues[0].message, status: 400 };

        let afterId = 0;
        let processedCount = 0;
        let changedCount = 0;
        const trace = { nodes: {}, edges: {} };
        for (;;) {
            const rows = await MediaModel.findRuleSnapshots(userId, { afterId, limit: RUN_BATCH_SIZE });
            if (rows.length === 0) break;
            processedCount += rows.length;
            changedCount += await applyRules([rule], "manual", rows, context, trace);
            afterId = rows[rows.length - 1].id;
            if (rows.length < RUN_BATCH_SIZE) break;
        }
        return { data: { processedCount, changedCount, trace } };
    }
}

module.exports = RuleEngineService;
