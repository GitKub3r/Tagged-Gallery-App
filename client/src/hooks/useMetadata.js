import { useQuery } from "@tanstack/react-query";
import { metadataApi, metadataQueryKeys } from "../api/metadataApi";
import { uniqueNames } from "./useMediaMetadataForm";
import { useAuth } from "./useAuth";

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
        tagNameSet: new Set(tagNames.map((tag) => tag.toLowerCase())),
        tagColorByName: Object.fromEntries(knownTags.map((tag) => [tag.tagname.trim().toLowerCase(), tag.tagcolor_hex])),
        tagTypeByName: Object.fromEntries(knownTags.map((tag) => [tag.tagname.trim().toLowerCase(), tag.type])),
    };
};
