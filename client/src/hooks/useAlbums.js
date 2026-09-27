import { useQuery } from "@tanstack/react-query";
import { albumApi, albumQueryKeys } from "../api/albumApi";
import { useAuth } from "./useAuth";
import { hasLibraryAccess } from "../utils/libraryAccess";

export const useAlbums = (enabled = true) => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: albumQueryKeys.forUser(user?.id),
        queryFn: albumApi.getAll,
        enabled: enabled && Boolean(user?.id && accessToken && hasLibraryAccess(user)),
    });
};
