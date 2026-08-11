import { useEffect, useRef, useState } from "react";

export const useFilterTransition = (filterKey, duration = 450) => {
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isFirstRenderRef = useRef(true);

    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return undefined;
        }

        const startTimeout = window.setTimeout(() => setIsTransitioning(true), 0);
        const endTimeout = window.setTimeout(() => setIsTransitioning(false), duration);
        return () => {
            window.clearTimeout(startTimeout);
            window.clearTimeout(endTimeout);
        };
    }, [duration, filterKey]);

    return isTransitioning;
};
