import { useCallback, useMemo, useRef, useState } from "react";

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
    const itemIdsByKey = useMemo(
        () => new Map(items.map((item) => [String(getItemId(item)), getItemId(item)])),
        [getItemId, items],
    );

    const finishDrag = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        if (drag.active) suppressClickRef.current = true;
        dragRef.current = null;
        setSelectionRect(null);

        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);

    const cancelDrag = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        suppressClickRef.current = false;
        setSelectionRect(null);
    }, []);

    const containerProps = {
        onPointerDown: (event) => {
            if (event.pointerType !== "mouse" || event.button !== 0) return;

            dragRef.current = {
                pointerId: event.pointerId,
                start: { x: event.clientX, y: event.clientY },
                active: false,
                baseSelection: event.ctrlKey || event.metaKey ? new Set(selectedIds) : new Set(),
            };
        },
        onPointerMove: (event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;

            const current = { x: event.clientX, y: event.clientY };
            if (!drag.active && Math.hypot(current.x - drag.start.x, current.y - drag.start.y) < DRAG_THRESHOLD_PX) return;

            const isStartingSelection = !drag.active;
            if (isStartingSelection) {
                drag.active = true;
                event.currentTarget.setPointerCapture?.(event.pointerId);
            }
            event.preventDefault();
            window.getSelection?.()?.removeAllRanges();
            const nextRect = buildRect(drag.start, current);
            const nextSelection = new Set(drag.baseSelection);

            event.currentTarget.querySelectorAll("[data-marquee-selection-id]").forEach((element) => {
                if (!intersects(nextRect, element.getBoundingClientRect())) return;
                const itemId = itemIdsByKey.get(element.dataset.marqueeSelectionId);
                if (itemId !== undefined) nextSelection.add(itemId);
            });

            if (isStartingSelection) onActivate();
            onSelectionChange(nextSelection);
            setSelectionRect(nextRect);
        },
        onPointerUp: finishDrag,
        onPointerCancel: cancelDrag,
        onDragStart: (event) => event.preventDefault(),
        onClickCapture: (event) => {
            if (!suppressClickRef.current) return;
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
        },
    };

    const selectionOverlay = selectionRect ? (
        <div
            className="pointer-events-none fixed z-[1100] rounded-xl border border-neutral-500 bg-neutral-500/15 dark:border-neutral-300 dark:bg-neutral-100/10"
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
