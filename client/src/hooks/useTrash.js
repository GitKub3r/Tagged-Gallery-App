import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { galleryQueryKeys } from "../api/galleryApi";
import { googleDriveQueryKeys } from "../api/googleDriveApi";
import { metadataQueryKeys } from "../api/metadataApi";
import { trashApi, trashQueryKeys } from "../api/trashApi";
import { useAuth } from "./useAuth";

// "media" es igual en singular y plural (DESIGN.md §9).
const pluralMedia = (count) => `${count} media`;

export const useTrash = () => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: trashQueryKeys.forUser(user?.id),
        queryFn: trashApi.getAll,
        enabled: Boolean(user?.id && accessToken && user.type !== "admin"),
    });
};

// Restaurar devuelve medias a la galería, los álbumes, las métricas y el resumen de Drive.
export const useRestoreFromTrash = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: trashApi.restore,
        onSuccess: ({ restoredCount }) => {
            toast.success(`${pluralMedia(restoredCount)} restored`);
            queryClient.invalidateQueries({ queryKey: trashQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: googleDriveQueryKeys.summaryAll });
        },
    });
};

// Borrar definitivamente (ids) o vaciar la papelera (ids = null). Solo cambia la papelera.
export const useDeleteForever = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids) => (ids ? trashApi.deleteForever(ids) : trashApi.empty()),
        onSuccess: ({ deletedCount }) => {
            toast.success(`${pluralMedia(deletedCount)} deleted forever`);
            queryClient.invalidateQueries({ queryKey: trashQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: googleDriveQueryKeys.browseAll });
        },
    });
};
