import { createContext } from "react";

export const DevToolsContext = createContext({ forceLoading: false, setForceLoading: () => {} });
