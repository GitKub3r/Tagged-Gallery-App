const scriptPromises = new Map();

// Carga una sola vez un script externo (p. ej. Google Identity Services) y devuelve una promesa.
export const loadScript = (src) => {
    if (scriptPromises.has(src)) return scriptPromises.get(src);

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => {
            scriptPromises.delete(src);
            script.remove();
            reject(new Error(`Could not load ${src}`));
        };
        document.head.appendChild(script);
    });

    scriptPromises.set(src, promise);
    return promise;
};
