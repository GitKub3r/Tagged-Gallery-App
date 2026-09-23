// Sección de la página de Drive con título, descripción y una acción opcional a la derecha.
export const DriveSection = ({ id, title, description, aside, children }) => (
    <section className="py-8" aria-labelledby={id}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h2 id={id} className="text-xl font-bold">{title}</h2>
                {description ? <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p> : null}
            </div>
            {aside}
        </div>
        {children}
    </section>
);
