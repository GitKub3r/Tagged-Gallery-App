// Portapapeles de nodos del editor de reglas. Vive fuera del editor para poder copiar nodos de una regla y
// pegarlos en otra. Guarda { nodes: [{ id, type, position, config }], edges: [{ source, sourceHandle, target }] }.
let clipboard = null;
let pasteCount = 0;

export const copyToRuleClipboard = (content) => {
    clipboard = content;
    pasteCount = 0;
};

export const hasRuleClipboard = () => clipboard !== null;

// Contenido para el siguiente pegado y cuántas veces se ha pegado ya (cada copia se desplaza un poco más).
export const takeRuleClipboard = () => {
    if (!clipboard) return null;
    pasteCount += 1;
    return { ...clipboard, pasteCount };
};
