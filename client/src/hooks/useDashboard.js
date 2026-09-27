import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { metricsApi, metricsQueryKeys } from "../api/metricsApi";
import { useAuth } from "./useAuth";
import { hasLibraryAccess } from "../utils/libraryAccess";

// Datos del panel. Al cambiar de año se conservan los anteriores mientras llegan los nuevos.
// Las cuentas admin no tienen panel (el servidor lo rechaza).
export const useDashboard = (year) => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: metricsQueryKeys.dashboard(user?.id, year),
        queryFn: () => metricsApi.getDashboard(year),
        enabled: Boolean(user?.id && accessToken && hasLibraryAccess(user)),
        placeholderData: keepPreviousData,
    });
};
