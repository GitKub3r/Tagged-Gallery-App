import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { DevToolsContext } from "./devToolsContext";

const STORAGE_KEY = "tagged:dev:force-loading";

export const DevToolsProvider = ({ children }) => {
    const { user } = useAuth();
    const isDeveloper = user?.type === "dev";
    const [requestedForceLoading, setRequestedForceLoading] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
    const forceLoading = isDeveloper && requestedForceLoading;

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(requestedForceLoading));
    }, [requestedForceLoading]);

    return <DevToolsContext.Provider value={{ forceLoading, setForceLoading: setRequestedForceLoading }}>{children}</DevToolsContext.Provider>;
};
