import { useQuery } from "@tanstack/react-query";
import { templateApi, templateQueryKeys } from "../api/templateApi";
import { useAuth } from "./useAuth";
import { hasLibraryAccess } from "../utils/libraryAccess";

export const useTemplates = (enabled = true) => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: templateQueryKeys.forUser(user?.id),
        queryFn: templateApi.getAll,
        enabled: enabled && Boolean(user?.id && accessToken && hasLibraryAccess(user)),
    });
};
