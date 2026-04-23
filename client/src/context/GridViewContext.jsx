import { createContext, useContext, useState, useEffect } from "react";

const GRID_COLUMNS_KEY = "tagged:grid-columns";
const GRID_VIEW_MODE_KEY = "tagged:grid-view-mode";

const getDefaultColumns = () => {
    if (typeof window === "undefined") return 5;
    return window.matchMedia("(max-width: 720px)").matches ? 2 : 5;
};

const GridViewContext = createContext(null);

export const GridViewProvider = ({ children }) => {
    const [gridColumns, setGridColumnsState] = useState(() => {
        const stored = Number(localStorage.getItem(GRID_COLUMNS_KEY));
        return Number.isFinite(stored) && stored >= 1 && stored <= 5 ? stored : getDefaultColumns();
    });

    const [gridViewMode, setGridViewModeState] = useState(() => {
        const stored = localStorage.getItem(GRID_VIEW_MODE_KEY);
        return stored === "list" ? "list" : "card";
    });

    const setGridColumns = (n) => {
        const clamped = Math.max(1, Math.min(5, n));
        setGridColumnsState(clamped);
        localStorage.setItem(GRID_COLUMNS_KEY, String(clamped));
    };

    const setGridViewMode = (mode) => {
        setGridViewModeState(mode);
        localStorage.setItem(GRID_VIEW_MODE_KEY, mode);
    };

    // Sync default columns when viewport changes (e.g. orientation change)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 720px)");
        const stored = localStorage.getItem(GRID_COLUMNS_KEY);
        if (stored) return; // user explicitly set it — don't override
        const handler = (e) => setGridColumnsState(e.matches ? 2 : 5);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return (
        <GridViewContext.Provider value={{ gridColumns, setGridColumns, gridViewMode, setGridViewMode }}>
            {children}
        </GridViewContext.Provider>
    );
};

export const useGridView = () => {
    const ctx = useContext(GridViewContext);
    if (!ctx) throw new Error("useGridView must be used inside GridViewProvider");
    return ctx;
};
