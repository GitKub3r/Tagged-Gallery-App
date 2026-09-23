import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { googleDriveApi, googleDriveQueryKeys } from "../api/googleDriveApi";
import { galleryQueryKeys } from "../api/galleryApi";
import { metadataQueryKeys } from "../api/metadataApi";
import { tagNameQueryKeys } from "../api/sidebarApi";
import { loadScript } from "../utils/loadScript";
import { useAuth } from "./useAuth";

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_API_SCRIPT = "https://apis.google.com/js/api.js";
export const MAX_DRIVE_SELECTION = 50;
export const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const loadPickerLibrary = async () => {
    await loadScript(GOOGLE_API_SCRIPT);
    await new Promise((resolve, reject) => window.gapi.load("picker", { callback: resolve, onerror: reject }));
};

export const useGoogleDriveStatus = () => {
    const { user, accessToken } = useAuth();
    return useQuery({
        queryKey: googleDriveQueryKeys.status(user?.id),
        queryFn: googleDriveApi.getStatus,
        enabled: Boolean(user?.id && accessToken && user.type !== "admin"),
    });
};

const useSetStatus = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    return (status) => queryClient.setQueryData(googleDriveQueryKeys.status(user?.id), status);
};

// Abre la ventana de Google (flujo de código de Google Identity Services) y envía el código al backend,
// que guarda el refresh token cifrado. El cliente nunca recibe ese token.
export const useConnectGoogleDrive = (config) => {
    const setStatus = useSetStatus();
    const codeClientRef = useRef(null);
    const [isScriptReady, setIsScriptReady] = useState(false);
    const [isAuthorizing, setIsAuthorizing] = useState(false);

    const connectMutation = useMutation({
        mutationFn: googleDriveApi.connect,
        onSuccess: (status) => {
            setStatus(status);
            toast.success("Google Drive connected");
        },
    });
    const { mutate: exchangeCode } = connectMutation;

    // La ventana emergente debe abrirse en el mismo clic del usuario, así que el script se prepara antes.
    useEffect(() => {
        if (!config?.clientId) return undefined;
        let isActive = true;

        loadScript(GOOGLE_IDENTITY_SCRIPT)
            .then(() => {
                if (!isActive) return;
                codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
                    client_id: config.clientId,
                    scope: config.scopes.join(" "),
                    ux_mode: "popup",
                    callback: (response) => {
                        setIsAuthorizing(false);
                        if (response.error || !response.code) {
                            toast.error("Google Drive was not connected");
                            return;
                        }
                        exchangeCode(response.code);
                    },
                    error_callback: (error) => {
                        setIsAuthorizing(false);
                        if (error?.type !== "popup_closed") toast.error("Could not open the Google sign-in window");
                    },
                });
                setIsScriptReady(true);
            })
            .catch(() => {
                if (isActive) toast.error("Could not load Google sign-in");
            });

        return () => {
            isActive = false;
        };
    }, [config?.clientId, config?.scopes, exchangeCode]);

    const connect = useCallback(() => {
        if (!codeClientRef.current) return;
        setIsAuthorizing(true);
        codeClientRef.current.requestCode();
    }, []);

    return {
        connect,
        isReady: isScriptReady,
        isConnecting: isAuthorizing || connectMutation.isPending,
    };
};

export const useDisconnectGoogleDrive = () => {
    const setStatus = useSetStatus();
    return useMutation({
        mutationFn: googleDriveApi.disconnect,
        onSuccess: (status) => {
            setStatus(status);
            toast.success("Google Drive disconnected");
        },
    });
};

// Abre el Google Picker (solo fotos y vídeos, selección múltiple) y devuelve los archivos elegidos.
// Con el permiso drive.file, elegir un archivo aquí es lo que da acceso a Tagged a ese archivo.
// allowFolders: con acceso de solo lectura a todo el Drive se pueden elegir carpetas enteras.
export const useDrivePicker = (config, { allowFolders = false } = {}) => {
    const [isOpening, setIsOpening] = useState(false);

    const openPicker = useCallback(async () => {
        setIsOpening(true);
        try {
            const [{ accessToken }] = await Promise.all([googleDriveApi.getPickerToken(), loadPickerLibrary()]);
            const { picker } = window.google;

            return await new Promise((resolve) => {
                // Sin setParent, setIncludeFolders lista todas las carpetas de Drive en plano;
                // con "root" se navega por carpetas igual que en Drive.
                const folderView = new picker.DocsView(picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
                    .setLabel("My Drive")
                    .setParent("root")
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(allowFolders)
                    .setMode(picker.DocsViewMode.GRID);
                const allMediaView = new picker.DocsView(picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
                    .setLabel("All photos and videos")
                    .setIncludeFolders(false)
                    .setMode(picker.DocsViewMode.GRID);

                new picker.PickerBuilder()
                    .setAppId(config.appId)
                    .setOAuthToken(accessToken)
                    .setDeveloperKey(config.apiKey)
                    .setOrigin(window.location.origin)
                    .setTitle(allowFolders ? "Select photos, videos or folders" : "Select photos and videos")
                    .addView(folderView)
                    .addView(allMediaView)
                    .enableFeature(picker.Feature.MULTISELECT_ENABLED)
                    .setMaxItems(MAX_DRIVE_SELECTION)
                    .setCallback((data) => {
                        const action = data[picker.Response.ACTION];
                        if (action === picker.Action.CANCEL) resolve([]);
                        if (action !== picker.Action.PICKED) return;
                        resolve(
                            data[picker.Response.DOCUMENTS].map((doc) => ({
                                id: doc[picker.Document.ID],
                                name: doc[picker.Document.NAME],
                                mimeType: doc[picker.Document.MIME_TYPE],
                                sizeBytes: Number(doc.sizeBytes) || 0,
                            })),
                        );
                    })
                    .build()
                    .setVisible(true);
                setIsOpening(false);
            });
        } catch (error) {
            // Los errores de la API ya muestran un toast desde apiClient; aquí solo los de carga del Picker.
            if (!error?.isAxiosError) toast.error("Could not open Google Drive");
            return [];
        } finally {
            setIsOpening(false);
        }
    }, [config?.appId, config?.apiKey, allowFolders]);

    return { openPicker, isOpening };
};

// Convierte la selección del Picker (con carpetas) en la lista de fotos y vídeos, recorriendo subcarpetas.
export const useExpandDriveSelection = () =>
    useMutation({
        mutationFn: googleDriveApi.expandSelection,
        onSuccess: ({ files, truncated, limit }) => {
            if (files.length === 0) toast.info("No photos or videos found in the selected folders");
            else if (truncated) toast.info(`Only the first ${limit} files were selected`, { description: "Add the rest in another round." });
        },
    });

const PREVIEW_WINDOW_BEFORE = 1;
const PREVIEW_WINDOW_AFTER = 3;

// Vista previa de cada archivo elegido. Solo se piden las cercanas al archivo que se está viendo,
// para no lanzar cientos de peticiones al elegir carpetas grandes; las ya cargadas quedan en caché.
export const useDrivePreviews = (fileIds, activeIndex = 0) =>
    useQueries({
        queries: fileIds.map((fileId, index) => ({
            queryKey: googleDriveQueryKeys.preview(fileId),
            queryFn: async () => (await googleDriveApi.getPreviews([fileId]))[0],
            enabled: index >= activeIndex - PREVIEW_WINDOW_BEFORE && index <= activeIndex + PREVIEW_WINDOW_AFTER,
            staleTime: Infinity,
            gcTime: 5 * 60 * 1000,
        })),
    });

const LINK_BATCH_SIZE = 10;
const EMPTY_LINK_RESULT = { linked: [], alreadyLinked: [], duplicates: [], skipped: [] };

const pluralize = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

const showLinkSummary = (result, wasStopped) => {
    if (result.linked.length > 0) {
        toast.success(`${pluralize(result.linked.length, "file")} added from Google Drive`);
    }
    const notes = [
        result.alreadyLinked.length ? `${pluralize(result.alreadyLinked.length, "file")} already in your library` : null,
        result.duplicates.length ? `${pluralize(result.duplicates.length, "file")} already uploaded to Tagged` : null,
        result.skipped.length ? `${pluralize(result.skipped.length, "file")} could not be added` : null,
        wasStopped ? "Adding was stopped before the end" : null,
    ].filter(Boolean);
    if (notes.length > 0) toast.info(result.linked.length ? "Some files were skipped" : "No new files were added", { description: notes.join(" · ") });
};

// Vincula los archivos por lotes para mostrar el progreso. Parar deja terminar el lote en curso,
// así el resumen coincide con lo que el servidor ha vinculado.
export const useLinkDriveFiles = () => {
    const queryClient = useQueryClient();
    const stopRequestedRef = useRef(false);
    const [progress, setProgress] = useState({ processed: 0, total: 0 });

    const mutation = useMutation({
        mutationFn: async ({ fileIds, details }) => {
            stopRequestedRef.current = false;
            const result = { linked: [], alreadyLinked: [], duplicates: [], skipped: [] };
            setProgress({ processed: 0, total: fileIds.length });

            for (let start = 0; start < fileIds.length && !stopRequestedRef.current; start += LINK_BATCH_SIZE) {
                const batch = fileIds.slice(start, start + LINK_BATCH_SIZE);
                try {
                    const batchResult = await googleDriveApi.linkFiles({ ...details, fileIds: batch });
                    Object.keys(EMPTY_LINK_RESULT).forEach((key) => result[key].push(...batchResult[key]));
                } catch (error) {
                    throw Object.assign(error, { partialResult: result });
                }
                setProgress({ processed: start + batch.length, total: fileIds.length });
            }

            return { result, wasStopped: result.linked.length + result.alreadyLinked.length + result.duplicates.length + result.skipped.length < fileIds.length };
        },
        onSuccess: ({ result, wasStopped }) => showLinkSummary(result, wasStopped),
        onSettled: (data, error) => {
            const linkedCount = (data?.result || error?.partialResult || EMPTY_LINK_RESULT).linked.length;
            if (linkedCount === 0) return;
            queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: tagNameQueryKeys.all });
        },
    });

    return {
        ...mutation,
        progress,
        stop: () => {
            stopRequestedRef.current = true;
        },
    };
};
