import { useQuery } from "@tanstack/react-query";
import { albumApi, albumQueryKeys } from "../api/albumApi";
import { useAuth } from "./useAuth";

export const useAlbums = (enabled = true) => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: albumQueryKeys.forUser(user?.id),
        queryFn: albumApi.getAll,
        enabled: enabled && Boolean(user?.id && accessToken && user.type !== "admin"),
    });
};
