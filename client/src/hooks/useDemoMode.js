import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { demoApi, demoQueryKeys } from "../api/demoApi";
import { useAuth } from "./useAuth";

export const useDemoStatus = () => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: demoQueryKeys.forUser(user?.id),
        queryFn: demoApi.getStatus,
        enabled: Boolean(user?.id && accessToken && user.type === "admin"),
    });
};

// Al activar, desactivar o resetear cambia la biblioteca que ve el admin: se guarda el estado, se actualiza el
// usuario (demo_mode abre o cierra las páginas de biblioteca) y se refresca todo lo demás.
const useDemoMutation = (mutationFn, getMessage) => {
    const queryClient = useQueryClient();
    const { user, updateCurrentUser } = useAuth();
    return useMutation({
        mutationFn,
        onSuccess: (status) => {
            queryClient.setQueryData(demoQueryKeys.forUser(user?.id), status);
            updateCurrentUser({ ...user, demo_mode: status.enabled });
            queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== demoQueryKeys.all[0] });
            toast.success(getMessage(status));
        },
    });
};

export const useSetDemoMode = () => useDemoMutation(demoApi.setEnabled, (status) => (status.enabled ? "Demo mode on" : "Demo mode off"));

export const useResetDemo = () => useDemoMutation(demoApi.reset, () => "Demo library reset");
