import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { albumQueryKeys } from "../api/albumApi";
import { galleryQueryKeys } from "../api/galleryApi";
import { metadataQueryKeys } from "../api/metadataApi";
import { ruleApi, ruleQueryKeys } from "../api/ruleApi";
import { useAuth } from "./useAuth";

const useRuleQueryEnabled = () => {
    const { user, accessToken } = useAuth();
    return { user, enabled: Boolean(user?.id && accessToken && user.type !== "admin") };
};

export const useRules = () => {
    const { user, enabled } = useRuleQueryEnabled();
    return useQuery({ queryKey: ruleQueryKeys.forUser(user?.id), queryFn: ruleApi.getAll, enabled });
};

export const useRule = (ruleId) => {
    const { user, enabled } = useRuleQueryEnabled();
    return useQuery({
        queryKey: ruleQueryKeys.detail(user?.id, ruleId),
        queryFn: () => ruleApi.getById(ruleId),
        enabled: enabled && Number(ruleId) > 0,
        // Una regla que no existe no aparece por reintentar.
        retry: (failureCount, error) => error?.response?.status !== 404 && failureCount < 1,
    });
};

// Guarda la regla en su caché de detalle y refresca el listado.
const useStoreRule = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    return (rule) => {
        queryClient.setQueryData(ruleQueryKeys.detail(user?.id, rule.id), rule);
        queryClient.invalidateQueries({ queryKey: ruleQueryKeys.forUser(user?.id), exact: true });
    };
};

export const useCreateRule = () => {
    const storeRule = useStoreRule();
    return useMutation({
        mutationFn: ruleApi.create,
        onSuccess: (rule) => {
            storeRule(rule);
            toast.success("Rule created");
        },
    });
};

// successMessage: texto del toast (null para no mostrarlo).
export const useUpdateRule = () => {
    const storeRule = useStoreRule();
    return useMutation({
        mutationFn: ({ changes }) => ruleApi.update(changes),
        onSuccess: (rule, { successMessage = "Rule saved" }) => {
            storeRule(rule);
            if (successMessage) toast.success(successMessage);
        },
    });
};

export const useDeleteRule = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    return useMutation({
        mutationFn: ruleApi.remove,
        onSuccess: (_, ruleId) => {
            queryClient.removeQueries({ queryKey: ruleQueryKeys.detail(user?.id, ruleId) });
            queryClient.invalidateQueries({ queryKey: ruleQueryKeys.forUser(user?.id), exact: true });
            toast.success("Rule deleted");
        },
    });
};

// Una ejecución puede cambiar tags, favoritos y álbumes de cualquier media de la biblioteca.
export const useRunRule = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    return useMutation({
        mutationFn: ruleApi.run,
        onSuccess: ({ processedCount, changedCount }) => {
            toast.success(`${changedCount} media changed`, { description: `The rule checked ${processedCount} media.` });
            queryClient.invalidateQueries({ queryKey: ruleQueryKeys.forUser(user?.id) });
            queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: albumQueryKeys.all });
        },
    });
};
