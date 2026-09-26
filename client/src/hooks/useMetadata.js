import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { galleryQueryKeys } from "../api/galleryApi";
import { metadataApi, metadataQueryKeys } from "../api/metadataApi";
import { uniqueNames } from "./useMediaMetadataForm";
import { useAuth } from "./useAuth";

const namesOf = (items, key) => uniqueNames((items || []).map((item) => (typeof item === "string" ? item : item?.[key])));

// Nombres de media, autores y tags del usuario, con los datos que necesitan los formularios de metadatos.
export const useMetadata = () => {
    const { accessToken } = useAuth();
    const query = useQuery({
        queryKey: metadataQueryKeys.all,
        queryFn: () => metadataApi.getAll(accessToken),
        enabled: Boolean(accessToken),
    });

    const knownTags = (query.data?.tags || []).filter((tag) => typeof tag?.tagname === "string" && tag.tagname.trim());
    const tagNames = uniqueNames(knownTags.map((tag) => tag.tagname));

    return {
        query,
        metadata: query.data,
        tagNames,
        displayNames: namesOf(query.data?.displayNames, "displayname"),
        authors: namesOf(query.data?.authors, "author"),
        tagNameSet: new Set(tagNames.map((tag) => tag.toLowerCase())),
        tagColorByName: Object.fromEntries(knownTags.map((tag) => [tag.tagname.trim().toLowerCase(), tag.tagcolor_hex])),
        tagTypeByName: Object.fromEntries(knownTags.map((tag) => [tag.tagname.trim().toLowerCase(), tag.type])),
    };
};

// Cuántas medias se verían afectadas al quitar un valor de todas ellas (se pide al abrir la confirmación).
export const useMetadataMediaCount = (managerType, value, enabled) =>
    useQuery({
        queryKey: metadataQueryKeys.mediaCount(managerType, value),
        queryFn: () => metadataApi.getMediaCount({ managerType, value }),
        enabled: enabled && Boolean(value),
        staleTime: 0,
    });

// Quitar una tag, un nombre de media o un autor de todas las medias cambia la galería y los metadatos.
export const useRemoveFromAllMedia = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: metadataApi.removeFromAllMedia,
        onSuccess: ({ removedCount }, { label }) => {
            toast.success(`${label} removed from ${removedCount} media`);
            queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
        },
    });
};
