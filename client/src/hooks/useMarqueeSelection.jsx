import { useEffect, useMemo, useRef, useState } from "react";

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

    useEffect(() => () => removeWindowListenersRef.current(), []);

    const stopTracking = () => {
        removeWindowListenersRef.current();
        removeWindowListenersRef.current = () => {};
        dragRef.current = null;
        setSelectionRect(null);
    };

    const containerProps = {
        onPointerDown: (event) => {
            if (event.pointerType !== "mouse" || event.button !== 0) return;

            removeWindowListenersRef.current();
            const container = event.currentTarget;
            const drag = {
                pointerId: event.pointerId,
                start: { x: event.clientX, y: event.clientY },
                active: false,
                baseSelection: event.ctrlKey || event.metaKey ? new Set(selectedIds) : new Set(),
            };
            dragRef.current = drag;

            const handlePointerMove = (pointerEvent) => {
                if (pointerEvent.pointerId !== drag.pointerId) return;

                const current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
                if (!drag.active && Math.hypot(current.x - drag.start.x, current.y - drag.start.y) < DRAG_THRESHOLD_PX) return;

                const isStartingSelection = !drag.active;
                drag.active = true;
                pointerEvent.preventDefault();
                window.getSelection?.()?.removeAllRanges();

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

            const handlePointerUp = (pointerEvent) => {
                if (pointerEvent.pointerId !== drag.pointerId) return;
                suppressClickRef.current = drag.active;
                stopTracking();
            };

            const handlePointerCancel = (pointerEvent) => {
                if (pointerEvent.pointerId !== drag.pointerId) return;
                suppressClickRef.current = false;
                stopTracking();
            };

            window.addEventListener("pointermove", handlePointerMove, { passive: false });
            window.addEventListener("pointerup", handlePointerUp);
            window.addEventListener("pointercancel", handlePointerCancel);
            removeWindowListenersRef.current = () => {
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
                window.removeEventListener("pointercancel", handlePointerCancel);
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

    const selectionOverlay = selectionRect ? (
        <div
            className="pointer-events-none fixed z-[1100] rounded-xl border-2 border-sky-500 bg-sky-500/20 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
            style={{
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.right - selectionRect.left,
                height: selectionRect.bottom - selectionRect.top,
            }}
            aria-hidden="true"
        />
    ) : null;

    return { containerProps, selectionOverlay };
};
