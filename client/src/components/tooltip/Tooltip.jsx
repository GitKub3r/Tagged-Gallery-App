import { cloneElement, useState } from "react";
import {
    FloatingFocusManager,
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useFocus,
    useHover,
    useInteractions,
    useRole,
    useTransitionStyles,
} from "@floating-ui/react";
import { Kbd } from "../kbd/Kbd";

const PANEL_CLASSES =
    "z-[1500] w-max max-w-xs rounded-xl border border-neutral-200 bg-white text-xs font-medium text-neutral-600 shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300";

// Tooltip de DESIGN.md §7.7. children es un único elemento (el disparador, sin ref propia), que recibe la ref y los eventos.
// openOn="hover": etiqueta breve que aparece con el ratón o el foco (sustituye a title), con atajo opcional en shortcut.
// openOn="click": ayuda más larga que se abre y cierra al pulsar el disparador, también en táctil; label la nombra.
export const Tooltip = ({ content, children, openOn = "hover", placement = "top", shortcut, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isClick = openOn === "click";
    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement,
        middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate,
    });
    const { getReferenceProps, getFloatingProps } = useInteractions([
        useHover(context, { enabled: !isClick, delay: { open: 300 }, move: false }),
        useFocus(context, { enabled: !isClick }),
        useClick(context, { enabled: isClick }),
        useDismiss(context),
        useRole(context, { role: isClick ? "dialog" : "tooltip" }),
    ]);
    const { isMounted, styles } = useTransitionStyles(context, { duration: 150 });
    const { setReference, setFloating } = refs;

    const panel = (
        <div
            ref={setFloating}
            style={{ ...floatingStyles, ...styles }}
            className={`${PANEL_CLASSES} ${isClick ? "p-3" : "flex items-center gap-2 px-2.5 py-1.5"}`}
            aria-label={isClick ? label : undefined}
            {...getFloatingProps()}
        >
            {content}
            {shortcut ? (
                <span className="flex gap-1">
                    {shortcut.map((key) => <Kbd key={key}>{key}</Kbd>)}
                </span>
            ) : null}
        </div>
    );

    return (
        <>
            {cloneElement(children, { ...getReferenceProps(children.props), ref: setReference })}
            {isMounted ? (
                <FloatingPortal>
                    {/* La ayuda recibe el foco al abrirse para que el lector de pantalla la lea y lo devuelve al cerrarse. */}
                    {isClick ? <FloatingFocusManager context={context} modal={false}>{panel}</FloatingFocusManager> : panel}
                </FloatingPortal>
            ) : null}
        </>
    );
};
