import { useQuery } from "@tanstack/react-query";
import { templateApi, templateQueryKeys } from "../api/templateApi";
import { useAuth } from "./useAuth";

export const useTemplates = (enabled = true) => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: templateQueryKeys.forUser(user?.id),
        queryFn: templateApi.getAll,
        enabled: enabled && Boolean(user?.id && accessToken && user.type !== "admin"),
    });
};
