import { useEffect, useMemo, useRef, useState } from "react";
import Selecto from "react-selecto";

export const useMarqueeSelection = ({ items, getItemId = (item) => item.id, selectedIds, onSelectionChange, onActivate }) => {
    const selectoRef = useRef(null);
    const [dragContainer, setDragContainer] = useState(null);
    const itemIdsByKey = useMemo(
        () => new Map(items.map((item) => [String(getItemId(item)), getItemId(item)])),
        [getItemId, items],
    );

    useEffect(() => {
        if (!selectoRef.current || !dragContainer) return;

        const selectedTargets = Array.from(
            dragContainer.querySelectorAll("[data-marquee-selection-id]"),
        ).filter((element) => selectedIds.has(itemIdsByKey.get(element.dataset.marqueeSelectionId)));
        selectoRef.current.setSelectedTargets(selectedTargets);
    }, [dragContainer, itemIdsByKey, selectedIds]);

    const containerProps = {
        ref: setDragContainer,
        onDragStart: (event) => event.preventDefault(),
    };

    const selectionOverlay = dragContainer && typeof document !== "undefined" ? (
        <Selecto
            ref={selectoRef}
            container={document.body}
            dragContainer={window}
            dragCondition={({ inputEvent }) => dragContainer.contains(inputEvent.target)}
            selectableTargets={[() => Array.from(dragContainer.querySelectorAll("[data-marquee-selection-id]"))]}
            selectByClick={false}
            selectFromInside
            preventDragFromInside={false}
            preventClickEventOnDrag
            hitRate={1}
            keyContainer={window}
            toggleContinueSelect={[["ctrl"], ["meta"]]}
            className="z-[2000]! rounded-xl! border-2! border-sky-400! bg-sky-400/25! shadow-[0_0_0_1px_rgba(255,255,255,0.7)]!"
            onSelect={({ selected, rect }) => {
                if (rect.width < 5 && rect.height < 5) return;

                onActivate();
                const nextSelection = new Set();
                selected.forEach((element) => {
                    const itemId = itemIdsByKey.get(element.dataset.marqueeSelectionId);
                    if (itemId !== undefined) nextSelection.add(itemId);
                });
                onSelectionChange(nextSelection);
            }}
        />
    ) : null;

    return { containerProps, selectionOverlay };
};
