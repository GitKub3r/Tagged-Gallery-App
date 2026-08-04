import { createContext, useContext, useState, useEffect } from "react";

const GRID_COLUMNS_KEY = "tagged:grid-columns";
const GRID_VIEW_MODE_KEY = "tagged:grid-view-mode";

const getDefaultColumns = () => {
    if (typeof window === "undefined") return 5;
    if (window.matchMedia("(max-width: 640px)").matches) return 2;
    if (window.matchMedia("(max-width: 1024px)").matches) return 3;
    if (window.matchMedia("(max-width: 1440px)").matches) return 4;
    return 5;
};

const GridViewContext = createContext(null);

export const GridViewProvider = ({ children }) => {
    const [gridColumns, setGridColumnsState] = useState(() => {
        const stored = Number(localStorage.getItem(GRID_COLUMNS_KEY));
        const responsiveMaximum = getDefaultColumns();
        return Number.isFinite(stored) && stored >= 1 && stored <= 5
            ? Math.min(stored, responsiveMaximum)
            : responsiveMaximum;
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

    // Keep cards readable when the viewport or device orientation changes.
    useEffect(() => {
        const mediaQueries = [640, 1024, 1440].map((width) => window.matchMedia(`(max-width: ${width}px)`));
        const handleViewportChange = () => {
            const stored = Number(localStorage.getItem(GRID_COLUMNS_KEY));
            const responsiveMaximum = getDefaultColumns();
            setGridColumnsState(
                Number.isFinite(stored) && stored >= 1 && stored <= 5
                    ? Math.min(stored, responsiveMaximum)
                    : responsiveMaximum,
            );
        };

        mediaQueries.forEach((query) => query.addEventListener("change", handleViewportChange));
        return () => mediaQueries.forEach((query) => query.removeEventListener("change", handleViewportChange));
    }, []);

    return (
        <GridViewContext.Provider value={{ gridColumns, setGridColumns, gridViewMode, setGridViewMode }}>
            {children}
        </GridViewContext.Provider>
    );
};

// Context hooks intentionally live beside their provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useGridView = () => {
    const ctx = useContext(GridViewContext);
    if (!ctx) throw new Error("useGridView must be used inside GridViewProvider");
    return ctx;
};
