import { useRef, useState } from "react";
import { faMinus, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconButton } from "../../../components/icon-button/IconButton";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const AlbumCoverAdjustModal = ({ imageUrl, initialAdjustment, isSaving, onClose, onSave }) => {
    const [adjustment, setAdjustment] = useState(initialAdjustment);
    const dragRef = useRef(null);

    const handlePointerDown = (event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, positionX: adjustment.positionX, positionY: adjustment.positionY };
    };

    const handlePointerMove = (event) => {
        if (!dragRef.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setAdjustment((current) => ({
            ...current,
            positionX: clamp(dragRef.current.positionX - ((event.clientX - dragRef.current.x) / rect.width) * 100, 0, 100),
            positionY: clamp(dragRef.current.positionY - ((event.clientY - dragRef.current.y) / rect.height) * 100, 0, 100),
        }));
    };

    return (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="adjust-album-cover-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <section className="w-full max-w-3xl rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-white shadow-2xl sm:p-5" onMouseDown={(event) => event.stopPropagation()}>
                <header className="mb-4 flex items-start justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Album banner</p><h2 id="adjust-album-cover-title" className="text-xl font-semibold">Adjust cover</h2></div>
                    <IconButton onClick={onClose} disabled={isSaving} aria-label="Close cover adjustment"><FontAwesomeIcon icon={faXmark} /></IconButton>
                </header>
                <div className="relative aspect-[16/7] w-full touch-none cursor-grab overflow-hidden rounded-xl bg-black active:cursor-grabbing" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
                    <img className="pointer-events-none h-full w-full select-none object-cover" src={imageUrl} alt="Album cover preview" draggable="false" style={{ objectPosition: `${adjustment.positionX}% ${adjustment.positionY}%`, transform: `scale(${adjustment.zoom})` }} />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/20" />
                </div>
                <p className="mt-3 text-center text-sm text-neutral-400">Drag the image to reposition it</p>
                <div className="mt-3 flex items-center justify-center gap-4">
                    <IconButton onClick={() => setAdjustment((value) => ({ ...value, zoom: clamp(value.zoom - 0.1, 1, 3) }))} disabled={adjustment.zoom <= 1 || isSaving} aria-label="Zoom out"><FontAwesomeIcon icon={faMinus} /></IconButton>
                    <span className="min-w-14 text-center text-sm font-bold tabular-nums">{Math.round(adjustment.zoom * 100)}%</span>
                    <IconButton onClick={() => setAdjustment((value) => ({ ...value, zoom: clamp(value.zoom + 0.1, 1, 3) }))} disabled={adjustment.zoom >= 3 || isSaving} aria-label="Zoom in"><FontAwesomeIcon icon={faPlus} /></IconButton>
                </div>
                <footer className="mt-5 flex justify-end gap-2"><button type="button" className="h-11 rounded-xl border border-neutral-700 px-4 text-sm font-bold hover:bg-neutral-900" onClick={onClose} disabled={isSaving}>Cancel</button><button type="button" className="h-11 rounded-xl bg-white px-5 text-sm font-bold text-black hover:bg-neutral-200 disabled:opacity-50" onClick={() => onSave(adjustment)} disabled={isSaving}>{isSaving ? "Saving..." : "Save framing"}</button></footer>
            </section>
        </div>
    );
};
