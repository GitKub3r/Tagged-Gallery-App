const { dotProduct } = require("./aiSafety");

// Sugerencias de tags del asistente de IA. Solo propone tags que el usuario ya tiene, a partir de dos fuentes:
// - "similar": las medias más parecidas de su biblioteca (por la huella de CLIP) y las tags que les puso él.
//   Cada vecino vota con un peso que crece con el parecido; una tag se sugiere si reúne suficiente peso y votos.
// - "tagger": WD Tagger reconoce la tag por su nombre (p. ej. "Blonde hair" ↔ blonde_hair). Útil al principio,
//   cuando todavía hay pocas medias etiquetadas, y con personajes de ilustración.
// Calibrado sin datos del usuario (300 fotos de Flickr30k con palabras de sus descripciones como tags): con
// "balanced", unas 8 de cada 10 tags añadidas son correctas.

const STRICTNESS_LEVELS = {
    strict: { similarScore: 0.8, similarVotes: 3, taggerGeneral: 0.7, taggerCharacter: 0.85 },
    balanced: { similarScore: 0.65, similarVotes: 2, taggerGeneral: 0.55, taggerCharacter: 0.75 },
    relaxed: { similarScore: 0.5, similarVotes: 2, taggerGeneral: 0.4, taggerCharacter: 0.65 },
};
const DEFAULT_STRICTNESS = "balanced";

const NEIGHBOR_COUNT = 10;
// Por debajo de este parecido, dos medias no tienen nada que ver (mediana entre fotos al azar: 0,54).
const MIN_SIMILARITY = 0.6;
// Una copia casi idéntica basta como único voto.
const NEAR_DUPLICATE_SIMILARITY = 0.95;
// Cuanto menor, más pesan los vecinos más parecidos frente al resto.
const SIMILARITY_TEMPERATURE = 0.05;

// "Blonde hair", "blonde-hair" y blonde_hair son la misma tag para WD Tagger.
const toTaggerName = (tagName) => String(tagName || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const findNeighbors = (embedding, evidence, excludedMediaId) => {
    const neighbors = [];
    for (const entry of evidence) {
        if (entry.mediaId === excludedMediaId) continue;
        const similarity = dotProduct(embedding, entry.embedding);
        if (similarity < MIN_SIMILARITY) continue;
        neighbors.push({ similarity, tagIds: entry.tagIds });
    }
    return neighbors.sort((a, b) => b.similarity - a.similarity).slice(0, NEIGHBOR_COUNT);
};

const scoreSimilarTags = (neighbors, level) => {
    const weights = neighbors.map(({ similarity }) => Math.exp((similarity - 1) / SIMILARITY_TEMPERATURE));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const scores = new Map();
    neighbors.forEach(({ similarity, tagIds }, index) => {
        for (const tagId of tagIds) {
            const current = scores.get(tagId) || { weight: 0, votes: 0, nearDuplicate: false };
            current.weight += weights[index] / totalWeight;
            current.votes += 1;
            current.nearDuplicate ||= similarity >= NEAR_DUPLICATE_SIMILARITY;
            scores.set(tagId, current);
        }
    });

    const suggestions = [];
    for (const [tagId, { weight, votes, nearDuplicate }] of scores) {
        if (weight >= level.similarScore && (votes >= level.similarVotes || nearDuplicate)) suggestions.push({ tagId, score: weight, source: "similar" });
    }
    return suggestions;
};

const scoreTaggerTags = (taggerTags, tagIdsByTaggerName, level) => {
    const suggestions = [];
    for (const [category, threshold] of [["general", level.taggerGeneral], ["character", level.taggerCharacter]]) {
        for (const [name, score] of Object.entries(taggerTags?.[category] || {})) {
            if (score < threshold) continue;
            for (const tagId of tagIdsByTaggerName.get(name) || []) suggestions.push({ tagId, score, source: "tagger" });
        }
    }
    return suggestions;
};

// target: { mediaId, embedding, taggerTags }. evidence: [{ mediaId, embedding, tagIds: Set }] con las tags que puso
// el usuario. tagIdsByTaggerName: ids de las tags del usuario por su nombre en WD. skipTagIds: tags que no se
// sugieren a esta media (las que ya tiene, las excluidas y las que la IA ya le puso alguna vez).
// Devuelve [{ tagId, score, source }] ordenadas de mayor a menor confianza.
const suggestTags = ({ target, evidence, tagIdsByTaggerName, skipTagIds, strictness }) => {
    const level = STRICTNESS_LEVELS[strictness] || STRICTNESS_LEVELS[DEFAULT_STRICTNESS];
    const neighbors = findNeighbors(target.embedding, evidence, target.mediaId);
    const best = new Map();
    for (const suggestion of [...scoreSimilarTags(neighbors, level), ...scoreTaggerTags(target.taggerTags, tagIdsByTaggerName, level)]) {
        if (skipTagIds.has(suggestion.tagId)) continue;
        if (!best.has(suggestion.tagId) || best.get(suggestion.tagId).score < suggestion.score) best.set(suggestion.tagId, suggestion);
    }
    return [...best.values()].sort((a, b) => b.score - a.score);
};

module.exports = { STRICTNESS_LEVELS, DEFAULT_STRICTNESS, toTaggerName, suggestTags };
