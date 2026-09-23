import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { googleDriveApi, googleDriveQueryKeys } from "../api/googleDriveApi";
import { loadScript } from "../utils/loadScript";
import { useAuth } from "./useAuth";

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

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
