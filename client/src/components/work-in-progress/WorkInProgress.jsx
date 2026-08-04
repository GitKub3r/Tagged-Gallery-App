export const WorkInProgress = ({
    title = "Work In Progress",
    description = "The new Tagged experience is taking shape.",
}) => (
    <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        <div className="relative flex h-36 w-full max-w-sm items-center justify-center" aria-hidden="true">
            <div className="relative h-20 w-24">
                <span className="absolute bottom-1 left-1/2 h-2 w-14 -translate-x-1/2 rounded-full bg-black/30 blur-sm" />
                <span className="tagged-wip-dust tagged-wip-dust--left absolute bottom-2 left-2 h-2 w-2 rounded-full bg-neutral-400/70" />
                <span className="tagged-wip-dust tagged-wip-dust--right absolute bottom-2 right-2 h-2 w-2 rounded-full bg-neutral-400/70" />
                <div className="tagged-wip-cube absolute left-4 top-1 h-16 w-16 rounded-xl border border-neutral-600 bg-neutral-700 shadow-lg shadow-black/30">
                    <div className="absolute inset-0 rounded-xl border border-white/5 bg-neutral-600/20" />
                    <div className="absolute inset-0">
                        <span className="absolute left-4 top-5 h-2 w-1.5 rounded-full bg-neutral-200" />
                        <span className="absolute right-4 top-5 h-2 w-1.5 rounded-full bg-neutral-200" />
                        <span className="absolute bottom-3 left-1/2 h-3 w-6 -translate-x-1/2 rounded-full bg-neutral-200">
                            <span className="absolute -top-1 left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-full bg-neutral-700" />
                        </span>
                    </div>
                </div>
            </div>
        </div>
        <h2 className="mt-8 text-2xl font-black uppercase tracking-widest text-neutral-200 sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm text-neutral-500">{description}</p>
    </div>
);
