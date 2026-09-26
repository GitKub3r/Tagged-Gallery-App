// Sección del panel como un fotograma de una hoja de contactos: número de fotograma en el eyebrow
// ("02 · Activity"), título, descripción y, a la derecha, sus controles.
export const DashboardSection = ({ frame, eyebrow, title, description, action, className = "", children }) => {
    const headingId = `dashboard-${eyebrow.toLowerCase().replace(/\s+/g, "-")}`;
    return (
        <section aria-labelledby={headingId} className={`min-w-0 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6 ${className}`}>
            <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 tabular-nums dark:text-neutral-500">
                        {frame} <span aria-hidden="true">·</span> {eyebrow}
                    </p>
                    <h2 id={headingId} className="mt-1 text-xl font-bold">{title}</h2>
                    {description ? <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">{description}</p> : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </header>
            {children}
        </section>
    );
};
