// Salvaguardas del asistente de IA. Antes de sugerir tags, cada media pasa por un filtro local que la descarta si
// parece contenido sexual con menores o gore. Una media descartada no se procesa más: no se guarda su huella ni se le
// sugieren tags. El resto del contenido adulto se etiqueta con normalidad.
//
// Combina dos señales:
// - CLIP sin entrenar: compara la huella de la imagen con descripciones de texto. Funciona bien con fotos.
// - WD Tagger (vocabulario de Danbooru): más fiable con ilustraciones, donde CLIP distingue peor la edad.
//
// Calibrado con 300 fotos cotidianas de Flickr30k (niños, playas, tatuajes, bomberos, comida...): 0 descartes.
// Los umbrales priorizan no dejar pasar nada: un falso positivo solo hace que la IA no etiquete esa media.

// Escenas cotidianas con las que compiten las descripciones de riesgo. Sin ellas, cualquier foto que no encaje en
// ninguna clase reparte la probabilidad y parece "sexual" o "gore" (bañadores, salsa de tomate, tatuajes...).
const EVERYDAY_SCENES = [
    "a photo of people", "a photo of a man", "a photo of a woman", "a photo of a group of friends", "a family photo",
    "a photo of people at the beach in swimsuits", "a photo of a person in a bikini", "a photo of a shirtless man",
    "a photo of people swimming", "a photo of a tattoo artist", "a photo of firefighters", "a photo of a doctor",
    "a photo of a hospital", "a photo of people playing sports", "a photo of a concert", "a photo of a street",
    "a photo of a city", "a photo of a landscape", "a photo of food", "a photo of meat", "a photo of an animal",
    "a photo of a dog", "a photo of a cat", "a photo of a car", "a photo of a building", "a photo of an object",
    "a photo of something red", "a photo of people in costumes", "a photo of a kiss", "a photo of a couple hugging",
    "a photo of a person sleeping", "a photo of a model posing", "a photo of people dancing", "a photo of a child playing",
    "a photo of a baby", "a drawing", "an anime illustration", "a screenshot", "a meme with text",
].map((prompt) => [prompt]);

// Cada clase es un grupo de frases cuyo vector se promedia (más estable que una sola frase).
// targets: clases cuya probabilidad se suma; others: clases con las que compiten.
const SAFETY_HEADS = {
    sexual: {
        targets: [
            ["a photo of a naked person", "a nude photo", "a pornographic photo", "a photo of people having sex", "a photo of exposed genitals"],
            ["a photo of a person in lingerie", "a photo of a person in sexy underwear"],
        ],
        others: EVERYDAY_SCENES,
    },
    gore: {
        targets: [["a photo of graphic gore", "a photo of a mutilated body", "a photo of a dead body covered in blood", "a photo of a severe bloody wound", "a photo of a corpse"]],
        others: EVERYDAY_SCENES,
    },
    minor: {
        targets: [
            ["a photo of a child", "a photo of a little kid", "a photo of a young boy", "a photo of a young girl", "a photo of children playing"],
            ["a photo of a baby", "a photo of a toddler", "a photo of an infant"],
        ],
        others: [
            ["a photo of a teenager", "a photo of a high school student"],
            ["a photo of an adult", "a photo of a man", "a photo of a woman", "a photo of adults", "a photo of a young adult"],
            ["a photo of an elderly person", "a photo of an old man", "a photo of an old woman"],
            ["a photo with no people in it", "a photo of an animal", "a photo of a landscape", "a photo of an object"],
        ],
    },
    photo: {
        targets: [["a photo", "a photograph taken with a camera", "a selfie", "a phone picture"]],
        others: [["an anime illustration", "a drawing", "a cartoon", "a 3d render", "a digital painting", "a manga page", "a hentai illustration", "pixel art"]],
    },
};

const TAGGER_MINOR = ["loli", "shota", "child", "aged_down", "baby"];
const TAGGER_SEXUAL = ["sex", "pussy", "penis", "completely_nude", "fellatio", "vaginal", "cum"];
const TAGGER_GORE = ["guro", "severed_head", "decapitation", "intestines"];

// Escala de CLIP para convertir similitudes en probabilidades.
const CLIP_LOGIT_SCALE = 100;

const normalizeVector = (vector) => {
    let sum = 0;
    for (const value of vector) sum += value * value;
    const norm = Math.sqrt(sum) || 1;
    return Float32Array.from(vector, (value) => value / norm);
};

const dotProduct = (a, b) => {
    let sum = 0;
    for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index];
    return sum;
};

const averageVector = (vectors) => {
    const average = new Float32Array(vectors[0].length);
    for (const vector of vectors) for (let index = 0; index < vector.length; index += 1) average[index] += vector[index];
    return normalizeVector(average);
};

// embedTexts(prompts) devuelve los vectores normalizados de CLIP de cada frase. Se calcula una vez al cargar los modelos.
const buildSafetyHeads = async (embedTexts) => {
    const toClassVectors = async (classes) => {
        const vectors = await embedTexts(classes.flat());
        let offset = 0;
        return classes.map((prompts) => {
            const classVectors = vectors.slice(offset, offset + prompts.length);
            offset += prompts.length;
            return averageVector(classVectors);
        });
    };

    const heads = {};
    for (const [name, head] of Object.entries(SAFETY_HEADS)) {
        heads[name] = { targets: await toClassVectors(head.targets), others: await toClassVectors(head.others) };
    }
    return heads;
};

const headProbability = (embedding, { targets, others }) => {
    const logits = [...targets, ...others].map((vector) => CLIP_LOGIT_SCALE * dotProduct(embedding, vector));
    const max = Math.max(...logits);
    const exps = logits.map((logit) => Math.exp(logit - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.slice(0, targets.length).reduce((sum, value) => sum + value, 0) / total;
};

// taggerScore(name) devuelve la probabilidad de WD Tagger para una de sus tags (0 si no existe).
const evaluateSafety = ({ heads, embedding, taggerScore }) => {
    const probability = (name) => headProbability(embedding, heads[name]);
    const maxTaggerScore = (names) => Math.max(0, ...names.map(taggerScore));
    const isPhoto = probability("photo") >= 0.5;

    const showsMinor = isPhoto ? probability("minor") >= 0.4 : maxTaggerScore(TAGGER_MINOR) >= 0.35 || probability("minor") >= 0.7;
    const isSexual = isPhoto
        ? probability("sexual") >= 0.5 || taggerScore("explicit") >= 0.75
        : Math.max(taggerScore("explicit"), taggerScore("questionable"), maxTaggerScore(TAGGER_SEXUAL)) >= 0.4;
    const isGore = probability("gore") >= 0.5 || maxTaggerScore(TAGGER_GORE) >= 0.5 || taggerScore("corpse") >= 0.6;

    if (showsMinor && isSexual) return { blocked: true, reason: "minor_sexual" };
    if (isGore) return { blocked: true, reason: "gore" };
    return { blocked: false, reason: null };
};

module.exports = { buildSafetyHeads, evaluateSafety, normalizeVector, dotProduct };
