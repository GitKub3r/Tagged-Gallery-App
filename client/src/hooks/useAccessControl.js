import { useLayoutEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { getHomePath, isDemoMode } from "../utils/libraryAccess";

const ADMIN_ROUTES = ["/logs", "/actions", "/users", "/account"];
const BASIC_ROUTES = ["/gallery", "/albums", "/favourites", "/metadata", "/templates", "/rules", "/drive", "/dashboard", "/trash", "/account"];
const DEV_ROUTES = BASIC_ROUTES;

// Rutas permitidas por rol. Un admin con el modo demo activo solo usa las de biblioteca (su biblioteca demo):
// las de administración quedan ocultas hasta que lo desactiva.
const getAllowedRoutes = (user) => {
    if (user.type === "admin") return isDemoMode(user) ? BASIC_ROUTES : ADMIN_ROUTES;
    return user.type === "dev" ? DEV_ROUTES : BASIC_ROUTES;
};

const matchesRoute = (routes, path) => routes.some((route) => path === route || path.startsWith(route + "/"));

/**
 * Hook to enforce role-based access control
 * - Admin users: can access /logs, /actions, /users, /account (with demo mode on, only the library pages and /account)
 * - Basic and dev users: can access the library pages and /account
 *
 * If user tries to access a page they don't have permission for,
 * they are redirected to their home page and an unauthorized access is logged
 */
export const useAccessControl = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, fetchWithAuth } = useAuth();

    const recordUnauthorizedAccess = useCallback(
        async (attemptedRoute) => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
                const response = await fetchWithAuth(`${API_URL}/logs/unauthorized-access`, {
                    method: "POST",
                    body: JSON.stringify({
                        attemptedRoute,
                        userType: user?.type,
                    }),
                });
                if (!response.ok) {
                    console.error("Failed to record unauthorized access:", response.statusText);
                }
            } catch (error) {
                console.error("Error recording unauthorized access:", error);
            }
        },
        [fetchWithAuth, user],
    );

    useLayoutEffect(() => {
        if (!user) return;

        const currentPath = location.pathname;
        const allowedRoutes = getAllowedRoutes(user);

        if (!matchesRoute(allowedRoutes, currentPath)) {
            // Una página de administración con el modo demo activo no es un acceso indebido: solo está oculta.
            if (!(isDemoMode(user) && matchesRoute(ADMIN_ROUTES, currentPath))) recordUnauthorizedAccess(currentPath);
            navigate(getHomePath(user), { replace: true });
        }
    }, [user, location.pathname, navigate, recordUnauthorizedAccess]);
};
