import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Cabecera de una página de integración o herramienta (DESIGN.md §4.3): icono grande con un punto verde cuando está
// activa, eyebrow, título y una línea de estado con su icono semántico (sin píldoras). Sin estado, la descripción.
// statusLine: { icon, iconClassName, spin?, content, title? }.
export const IntegrationHero = ({ icon, eyebrow, title, isActive = false, statusLine = null, description, action }) => (
    <header className="flex flex-col gap-6 border-b border-neutral-200 pb-8 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative w-fit shrink-0">
                <span className="grid h-24 w-24 place-items-center rounded-xl bg-neutral-200 text-5xl text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                    <FontAwesomeIcon icon={icon} aria-hidden="true" />
                </span>
                {isActive ? (
                    <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-4 border-neutral-50 bg-green-500 text-xs text-white dark:border-neutral-950" aria-hidden="true">
                        <FontAwesomeIcon icon={faCheck} />
                    </span>
                ) : null}
            </div>
            <div className="min-w-0">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{eyebrow}</p>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
                {statusLine ? (
                    <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
                        <FontAwesomeIcon icon={statusLine.icon} spin={statusLine.spin} className={`shrink-0 motion-reduce:animate-none ${statusLine.iconClassName || ""}`} aria-hidden="true" />
                        <span className="min-w-0 truncate" title={statusLine.title}>{statusLine.content}</span>
                    </p>
                ) : (
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
                )}
            </div>
        </div>
        {action}
    </header>
);
