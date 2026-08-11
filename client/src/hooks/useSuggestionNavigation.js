import { useState } from "react";

export const useSuggestionNavigation = ({
    items,
    isOpen,
    onOpen,
    onClose,
    onSelect,
    onEnter,
    selectFirstOnEnter = false,
}) => {
    const [activeIndex, setActiveIndex] = useState(-1);
    const resolvedActiveIndex = isOpen && activeIndex < items.length ? activeIndex : -1;

    const openSuggestions = () => {
        setActiveIndex(-1);
        onOpen?.();
    };

    const closeSuggestions = () => {
        setActiveIndex(-1);
        onClose?.();
    };

    const handleKeyDown = (event) => {
        if (event.key === "ArrowDown" && items.length > 0) {
            event.preventDefault();
            if (!isOpen) onOpen?.();
            setActiveIndex(resolvedActiveIndex < 0 ? 0 : (resolvedActiveIndex + 1) % items.length);
            return;
        }

        if (event.key === "ArrowUp" && items.length > 0) {
            event.preventDefault();
            if (!isOpen) onOpen?.();
            setActiveIndex(resolvedActiveIndex < 0 ? items.length - 1 : (resolvedActiveIndex - 1 + items.length) % items.length);
            return;
        }

        if (event.key === "Enter") {
            const selectedItem = resolvedActiveIndex >= 0
                ? items[resolvedActiveIndex]
                : isOpen && selectFirstOnEnter
                    ? items[0]
                    : null;

            if (selectedItem !== null && selectedItem !== undefined) {
                event.preventDefault();
                onSelect(selectedItem);
                return;
            }

            onEnter?.(event);
            return;
        }

        if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            closeSuggestions();
        }
    };

    return { activeIndex: resolvedActiveIndex, setActiveIndex, openSuggestions, closeSuggestions, handleKeyDown };
};
