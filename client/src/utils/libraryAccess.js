// Quién tiene biblioteca (galería, álbumes, plantillas, reglas, papelera, panel...). Las cuentas admin no la tienen,
// salvo con el modo demo activo: entonces usan su biblioteca demo, que el servidor les asigna (authenticateLibrary).
export const hasLibraryAccess = (user) => Boolean(user) && (user.type !== "admin" || Boolean(user.demo_mode));

export const isDemoMode = (user) => user?.type === "admin" && Boolean(user.demo_mode);

// Página de inicio tras iniciar sesión o al entrar en una ruta sin permiso.
export const getHomePath = (user) => (hasLibraryAccess(user) ? "/gallery" : "/logs");
