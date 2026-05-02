import React, { createContext, useState, useEffect, useRef } from "react";

const defaultContextValue = {
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: true,
    error: null,
    register: async () => {},
    login: async () => {},
    logout: async () => {},
    refreshAccessToken: async () => false,
    fetchWithAuth: async () => {},
    isAuthenticated: false,
};

export const AuthContext = createContext(defaultContextValue);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const accessTokenRef = useRef(null);
    const refreshTokenRef = useRef(null);
    const refreshPromiseRef = useRef(null);

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

    // Cargar tokens del localStorage al iniciar
    useEffect(() => {
        const storedAccessToken = localStorage.getItem("accessToken");
        const storedRefreshToken = localStorage.getItem("refreshToken");
        const storedUser = localStorage.getItem("user");

        if (storedAccessToken && storedRefreshToken && storedUser) {
            accessTokenRef.current = storedAccessToken;
            refreshTokenRef.current = storedRefreshToken;
            setAccessToken(storedAccessToken);
            setRefreshToken(storedRefreshToken);
            setUser(JSON.parse(storedUser));
        }

        setLoading(false);
    }, []);

    /**
     * Registrar un nuevo usuario
     */
    const register = async (username, email, password) => {
        try {
            setError(null);
            const response = await fetch(`${API_URL}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password, type: "basic" }),
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.message);
                return { success: false, message: data.message };
            }

            return { success: true, data: data.data };
        } catch (err) {
            const errorMsg = err.message || "Error registering user";
            setError(errorMsg);
            return { success: false, message: errorMsg };
        }
    };

    /**
     * Login de usuario
     */
    const login = async (email, password) => {
        try {
            setError(null);
            const response = await fetch(`${API_URL}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.message);
                return { success: false, message: data.message };
            }

            const { user: userData, accessToken: newAccessToken, refreshToken: newRefreshToken } = data.data;

            // Guardar en estado
            accessTokenRef.current = newAccessToken;
            refreshTokenRef.current = newRefreshToken;
            setUser(userData);
            setAccessToken(newAccessToken);
            setRefreshToken(newRefreshToken);

            // Guardar en localStorage
            localStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("accessToken", newAccessToken);
            localStorage.setItem("refreshToken", newRefreshToken);

            return { success: true, user: userData };
        } catch (err) {
            const errorMsg = err.message || "Error logging in";
            setError(errorMsg);
            return { success: false, message: errorMsg };
        }
    };

    /**
     * Refrescar access token
     */
    const refreshAccessToken = async () => {
        if (refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }

        const latestRefreshToken = refreshTokenRef.current || localStorage.getItem("refreshToken");

        if (!latestRefreshToken) {
            return false;
        }

        refreshPromiseRef.current = (async () => {
            try {
                const response = await fetch(`${API_URL}/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: latestRefreshToken }),
                    cache: "no-store",
                });

                const data = await response.json();

                if (!response.ok || !data.success || !data.data?.accessToken) {
                    await logout();
                    return false;
                }

                const newAccessToken = data.data.accessToken;

                accessTokenRef.current = newAccessToken;
                setAccessToken(newAccessToken);
                localStorage.setItem("accessToken", newAccessToken);

                return true;
            } catch (err) {
                console.error("Error refreshing token:", err);
                await logout();
                return false;
            } finally {
                refreshPromiseRef.current = null;
            }
        })();

        return refreshPromiseRef.current;
    };

    /**
     * Logout del usuario
     */
    const logout = async () => {
        const latestRefreshToken = refreshTokenRef.current || localStorage.getItem("refreshToken");

        try {
            if (latestRefreshToken) {
                await fetch(`${API_URL}/auth/logout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: latestRefreshToken }),
                    cache: "no-store",
                });
            }
        } catch (err) {
            console.error("Error during logout:", err);
        } finally {
            accessTokenRef.current = null;
            refreshTokenRef.current = null;
            refreshPromiseRef.current = null;
            setUser(null);
            setAccessToken(null);
            setRefreshToken(null);
            localStorage.removeItem("user");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setError(null);
        }
    };

    /**
     * Petición HTTP autenticada
     */
    const fetchWithAuth = async (url, options = {}) => {
        const headers = {
            ...(options.headers || {}),
        };

        const hasBody = options.body !== undefined && options.body !== null;
        const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
        const hasContentTypeHeader = Object.keys(headers).some(
            (headerName) => headerName.toLowerCase() === "content-type",
        );

        if (hasBody && !isFormDataBody && !hasContentTypeHeader) {
            headers["Content-Type"] = "application/json";
        }

        const latestAccessToken = accessTokenRef.current || localStorage.getItem("accessToken") || accessToken;

        if (latestAccessToken) {
            headers.Authorization = `Bearer ${latestAccessToken}`;
        }

        const requestOptions = {
            cache: "no-store",
            ...options,
            headers,
        };

        let response = await fetch(url, requestOptions);

        // Si el token expiró, refrescar e intentar de nuevo
        const latestRefreshToken = refreshTokenRef.current || localStorage.getItem("refreshToken") || refreshToken;

        if (response.status === 401 && latestRefreshToken) {
            const refreshed = await refreshAccessToken();

            if (refreshed) {
                const refreshedAccessToken = accessTokenRef.current || localStorage.getItem("accessToken");
                headers.Authorization = `Bearer ${refreshedAccessToken}`;
                response = await fetch(url, { ...requestOptions, headers });
            }
        }

        return response;
    };

    const value = {
        user,
        accessToken,
        refreshToken,
        loading,
        error,
        register,
        login,
        logout,
        refreshAccessToken,
        fetchWithAuth,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
