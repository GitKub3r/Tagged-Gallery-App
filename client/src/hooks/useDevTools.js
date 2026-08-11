import { useContext } from "react";
import { DevToolsContext } from "../context/devToolsContext";

export const useDevTools = () => useContext(DevToolsContext);
