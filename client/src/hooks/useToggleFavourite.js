import { useMutation, useQueryClient } from "@tanstack/react-query";
import { galleryQueryKeys } from "../api/galleryApi";
import { googleDriveQueryKeys } from "../api/googleDriveApi";
import { mediaApi } from "../api/mediaApi";

// Marca o desmarca una media como favorita y refresca las listas que la muestran.
export const useToggleFavourite = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: mediaApi.toggleFavourite,
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: googleDriveQueryKeys.summaryAll });
        },
    });

    return {
        toggleFavourite: mutation.mutate,
        pendingMediaId: mutation.isPending ? mutation.variables : null,
    };
};
