import { useLayoutEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

const ADMIN_ROUTES = ["/logs", "/users", "/account"];
const BASIC_ROUTES = ["/gallery", "/albums", "/favourites", "/metadata", "/dashboard", "/account"];

/**
 * Hook to enforce role-based access control
 * - Admin users: can access /logs, /users, /account
 * - Basic users: can access /gallery, /albums, /favourites, /metadata, /account
 *
 * If user tries to access a page they don't have permission for,
 * they are redirected to /logs and an unauthorized access is logged
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
        [fetchWithAuth, user?.type],
    );

    useLayoutEffect(() => {
        if (!user) return;

        const currentPath = location.pathname;
        const allowedRoutes = user.type === "admin" ? ADMIN_ROUTES : BASIC_ROUTES;

        // Check if current path starts with any allowed route
        const hasAccess = allowedRoutes.some((route) => currentPath === route || currentPath.startsWith(route + "/"));

        if (!hasAccess) {
            recordUnauthorizedAccess(currentPath);
            navigate("/logs", { replace: true });
        }
    }, [user, location.pathname, navigate, recordUnauthorizedAccess]);
};
