import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aiApi, aiQueryKeys } from "../api/aiApi";
import { albumQueryKeys } from "../api/albumApi";
import { galleryQueryKeys } from "../api/galleryApi";
import { metadataQueryKeys } from "../api/metadataApi";
import { useAuth } from "./useAuth";

// Mientras descarga los modelos o trabaja en segundo plano, el estado se consulta cada poco para mostrar el progreso.
const BUSY_POLL_MS = 1500;
const AI_TAGGING_STORAGE_KEY = "tagged:ai-tag-new-media";

export const isAiBusy = (status) => status?.models.state === "downloading" || status?.job?.status === "running";

const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;

export const describeTagResult = ({ addedCount, changedCount }) =>
    addedCount > 0 ? `Added ${plural(addedCount, "tag")} to ${plural(changedCount, "media", "media")}` : "No new tags to add";

// Las tags que añade la IA cambian las tarjetas de la galería y los álbumes y los recuentos de Metadata.
const useInvalidateTaggedMedia = () => {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: albumQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
    };
};

export const useAiStatus = () => {
    const { user, accessToken } = useAuth();
    const queryClient = useQueryClient();
    const invalidateTaggedMedia = useInvalidateTaggedMedia();
    const queryKey = aiQueryKeys.status(user?.id);

    return useQuery({
        queryKey,
        // Al terminar "Tag library" (también si el usuario está en otra página que consulta el estado), se avisa
        // y se refrescan las medias.
        queryFn: async () => {
            const previousJob = queryClient.getQueryData(queryKey)?.job;
            const status = await aiApi.getStatus();
            const job = status.job;
            if (previousJob?.status === "running" && job?.type === "tag" && job.status !== "running") {
                if (job.changedCount > 0) invalidateTaggedMedia();
                if (job.status === "done") toast.success(`Library tagged. ${describeTagResult(job)}`);
                else if (job.status === "failed") toast.error(job.error || "The AI assistant stopped");
            }
            return status;
        },
        enabled: Boolean(user?.id && accessToken && user.type !== "admin"),
        // Lo consultan también la galería y los formularios para saber si mostrar las acciones de IA.
        staleTime: 30 * 1000,
        refetchInterval: (query) => (isAiBusy(query.state.data) ? BUSY_POLL_MS : false),
    });
};

// Las acciones de IA solo se muestran con los modelos instalados.
export const useIsAiReady = () => useAiStatus().data?.models.state === "ready";

const useSetStatus = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    return (status) => queryClient.setQueryData(aiQueryKeys.status(user?.id), status);
};

export const useSetupAi = () => {
    const setStatus = useSetStatus();
    return useMutation({ mutationFn: aiApi.setup, onSuccess: setStatus });
};

export const useRemoveAiModels = () => {
    const setStatus = useSetStatus();
    return useMutation({
        mutationFn: aiApi.removeModels,
        onSuccess: (status) => {
            setStatus(status);
            toast.success("AI models removed");
        },
    });
};

export const useUpdateAiSettings = () => {
    const setStatus = useSetStatus();
    return useMutation({
        mutationFn: aiApi.updateSettings,
        onSuccess: (status) => {
            setStatus(status);
            toast.success("AI settings saved");
        },
    });
};

export const useStartAiLibraryRun = () => {
    const setStatus = useSetStatus();
    return useMutation({ mutationFn: aiApi.startLibraryRun, onSuccess: setStatus });
};

export const useCancelAiLibraryRun = () => {
    const setStatus = useSetStatus();
    return useMutation({ mutationFn: aiApi.cancelLibraryRun, onSuccess: setStatus });
};

// Sugerencias para el formulario de edición: no cambian nada hasta que el usuario guarda.
export const useAiSuggestions = () => useMutation({ mutationFn: aiApi.suggest });

// "Tag with AI" sobre una selección de medias. Analizar lo que falte tarda ~0,5 s por media: se avisa mientras tanto.
export const useTagMediaWithAi = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const invalidateTaggedMedia = useInvalidateTaggedMedia();
    return useMutation({
        mutationFn: aiApi.tagMedia,
        onMutate: (mediaIds) => ({ toastId: toast.loading(`Tagging ${plural(mediaIds.length, "media", "media")} with AI...`) }),
        onSuccess: (result, _, context) => {
            if (result.changedCount > 0) invalidateTaggedMedia();
            queryClient.invalidateQueries({ queryKey: aiQueryKeys.status(user?.id) });
            const skipped = result.blockedCount > 0 ? `${plural(result.blockedCount, "media", "media")} skipped by the safeguards.` : null;
            if (result.addedCount > 0) toast.success(describeTagResult(result), { id: context.toastId, description: skipped || undefined });
            else toast(describeTagResult(result), { id: context.toastId, description: skipped || "The assistant found no confident matches among your tags." });
        },
        // El error ya lo muestra apiClient.
        onError: (_, __, context) => toast.dismiss(context?.toastId),
    });
};

// "Tag with AI" al subir o añadir medias: se recuerda en este navegador. Solo se aplica con los modelos instalados.
const readStoredPreference = () => {
    try {
        return localStorage.getItem(AI_TAGGING_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
};

export const useAiTaggingPreference = () => {
    const isAvailable = useIsAiReady();
    const [isEnabled, setIsEnabled] = useState(readStoredPreference);
    const setEnabled = (value) => {
        setIsEnabled(value);
        try {
            localStorage.setItem(AI_TAGGING_STORAGE_KEY, String(value));
        } catch {
            // Sin almacenamiento, la preferencia dura hasta cerrar la página.
        }
    };
    return { isAvailable, tagWithAi: isAvailable && isEnabled, isEnabled, setEnabled };
};
