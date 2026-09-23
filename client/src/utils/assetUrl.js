// Origen del backend para construir URLs de archivos (las rutas firmadas empiezan por /api/v1/files).
export const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1").replace(/\/api\/v1\/?$/, "");
