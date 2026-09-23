let activeLocks = 0;
let savedStyles = null;

// Bloquea el scroll de la página mientras hay un modal o un panel abiertos.
// Admite bloqueos anidados: el estilo original se restaura al liberar el último. Devuelve la función de liberar.
export const lockPageScroll = () => {
    const { body, documentElement } = document;
    if (activeLocks === 0) {
        savedStyles = { bodyOverflow: body.style.overflow, htmlOverflow: documentElement.style.overflow, bodyTouchAction: body.style.touchAction };
        body.style.overflow = "hidden";
        documentElement.style.overflow = "hidden";
        body.style.touchAction = "none";
    }
    activeLocks += 1;

    let isReleased = false;
    return () => {
        if (isReleased) return;
        isReleased = true;
        activeLocks -= 1;
        if (activeLocks === 0 && savedStyles) {
            body.style.overflow = savedStyles.bodyOverflow;
            documentElement.style.overflow = savedStyles.htmlOverflow;
            body.style.touchAction = savedStyles.bodyTouchAction;
            savedStyles = null;
        }
    };
};
