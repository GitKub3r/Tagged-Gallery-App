import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
export const useDrivePicker = (config) => {
    const [isOpening, setIsOpening] = useState(false);

    const openPicker = useCallback(async () => {
        setIsOpening(true);
        try {
            const [{ accessToken }] = await Promise.all([googleDriveApi.getPickerToken(), loadPickerLibrary()]);
            const { picker } = window.google;

            return await new Promise((resolve) => {
                const view = new picker.DocsView(picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(false)
                    .setMode(picker.DocsViewMode.GRID);

                new picker.PickerBuilder()
                    .setAppId(config.appId)
                    .setOAuthToken(accessToken)
                    .setDeveloperKey(config.apiKey)
                    .setOrigin(window.location.origin)
                    .setTitle("Select photos and videos")
                    .addView(view)
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
    }, [config?.appId, config?.apiKey]);

    return { openPicker, isOpening };
};

export const useLinkDriveFiles = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: googleDriveApi.linkFiles,
        onSuccess: ({ linked }) => {
            if (linked.length === 0) return;
            queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: tagNameQueryKeys.all });
            toast.success(`${linked.length} ${linked.length === 1 ? "file" : "files"} added from Google Drive`);
        },
    });
};
