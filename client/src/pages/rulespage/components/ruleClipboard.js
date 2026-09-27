// Portapapeles de nodos del editor de reglas. Vive fuera del editor para poder copiar nodos de una regla y
// pegarlos en otra. Guarda { nodes: [{ id, type, position, config }], edges: [{ source, sourceHandle, target }] }.
// Pertenece al usuario que copió: si otra cuenta inicia sesión en la misma pestaña, no puede pegar sus nodos
// (llevan nombres de tags, autores y álbumes de esa biblioteca).
let clipboard = null;
let pasteCount = 0;

export const copyToRuleClipboard = (userId, content) => {
    clipboard = { userId, content };
    pasteCount = 0;
};

export const hasRuleClipboard = (userId) => Boolean(userId) && clipboard?.userId === userId;

// Contenido para el siguiente pegado y cuántas veces se ha pegado ya (cada copia se desplaza un poco más).
export const takeRuleClipboard = (userId) => {
    if (!hasRuleClipboard(userId)) return null;
    pasteCount += 1;
    return { ...clipboard.content, pasteCount };
};
