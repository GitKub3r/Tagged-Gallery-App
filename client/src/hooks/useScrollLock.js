import { useEffect } from "react";
import { lockPageScroll } from "../utils/scrollLock";

export const useScrollLock = (isActive = true) => {
    useEffect(() => (isActive ? lockPageScroll() : undefined), [isActive]);
};
