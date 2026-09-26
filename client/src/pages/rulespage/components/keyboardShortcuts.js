// Tecla modificadora que se muestra en los atajos del editor de reglas (⌘ en Apple, Ctrl en el resto).
export const MODIFIER_KEY = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘" : "Ctrl";

// Los atajos del lienzo no actúan mientras se escribe: ahí Ctrl/⌘ + C, V y Z son los del propio campo.
export const isEditableTarget = (target) => Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
