import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DRAG_THRESHOLD_PX = 5;

const buildRect = (start, current) => ({
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y),
});

const intersects = (first, second) =>
    first.left <= second.right &&
    first.right >= second.left &&
    first.top <= second.bottom &&
    first.bottom >= second.top;

export const useMarqueeSelection = ({ items, getItemId = (item) => item.id, selectedIds, onSelectionChange, onActivate }) => {
    const [selectionRect, setSelectionRect] = useState(null);
    const dragRef = useRef(null);
    const suppressClickRef = useRef(false);
    const removeWindowListenersRef = useRef(() => {});
    const itemIdsByKey = useMemo(
        () => new Map(items.map((item) => [String(getItemId(item)), getItemId(item)])),
        [getItemId, items],
    );

    useEffect(() => () => {
        removeWindowListenersRef.current();
        document.documentElement.classList.remove("select-none");
    }, []);

    const stopTracking = () => {
        removeWindowListenersRef.current();
        removeWindowListenersRef.current = () => {};
        dragRef.current = null;
        setSelectionRect(null);
    };

    const containerProps = {
        onMouseDown: (event) => {
            if (event.button !== 0) return;

            removeWindowListenersRef.current();
            const container = event.currentTarget;
            const drag = {
                start: { x: event.clientX, y: event.clientY },
                active: false,
                baseSelection: event.ctrlKey || event.metaKey ? new Set(selectedIds) : new Set(),
            };
            dragRef.current = drag;

            const handleMouseMove = (mouseEvent) => {
                const current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
                if (!drag.active && Math.hypot(current.x - drag.start.x, current.y - drag.start.y) < DRAG_THRESHOLD_PX) return;

                const isStartingSelection = !drag.active;
                drag.active = true;
                mouseEvent.preventDefault();
                window.getSelection?.()?.removeAllRanges();
                document.documentElement.classList.add("select-none");

                const nextRect = buildRect(drag.start, current);
                const nextSelection = new Set(drag.baseSelection);
                container.querySelectorAll("[data-marquee-selection-id]").forEach((element) => {
                    if (!intersects(nextRect, element.getBoundingClientRect())) return;
                    const itemId = itemIdsByKey.get(element.dataset.marqueeSelectionId);
                    if (itemId !== undefined) nextSelection.add(itemId);
                });

                if (isStartingSelection) onActivate();
                onSelectionChange(nextSelection);
                setSelectionRect(nextRect);
            };

            const handleMouseUp = () => {
                suppressClickRef.current = drag.active;
                document.documentElement.classList.remove("select-none");
                stopTracking();
            };

            const handleWindowBlur = () => {
                suppressClickRef.current = false;
                document.documentElement.classList.remove("select-none");
                stopTracking();
            };

            window.addEventListener("mousemove", handleMouseMove, { passive: false });
            window.addEventListener("mouseup", handleMouseUp);
            window.addEventListener("blur", handleWindowBlur);
            removeWindowListenersRef.current = () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);
                window.removeEventListener("blur", handleWindowBlur);
            };
        },
        onClickCapture: (event) => {
            if (!suppressClickRef.current) return;
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
        },
        onDragStart: (event) => event.preventDefault(),
    };

    const selectionOverlay = selectionRect && typeof document !== "undefined" ? createPortal(
        <div
            className="pointer-events-none fixed z-[2000] rounded-xl border-2 border-sky-400 bg-sky-400/25 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
            style={{
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.right - selectionRect.left,
                height: selectionRect.bottom - selectionRect.top,
            }}
            aria-hidden="true"
        />,
        document.body,
    ) : null;

    return { containerProps, selectionOverlay };
};
