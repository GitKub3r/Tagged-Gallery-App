import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faCheck, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const STATES = {
    connected: { label: "Connected", dotClassName: "bg-green-500" },
    reconnect: { label: "Reconnect needed", dotClassName: "bg-amber-500" },
    disconnected: { label: "Not connected", dotClassName: "bg-neutral-400 dark:bg-neutral-500" },
    unconfigured: { label: "Not set up", dotClassName: "bg-neutral-400 dark:bg-neutral-500" },
};

export const DriveHero = ({ state, email, action }) => {
    const { label, dotClassName } = STATES[state] || STATES.disconnected;
    const isConnected = state === "connected" || state === "reconnect";

    return (
        <header className="flex flex-col gap-6 border-b border-neutral-200 pb-8 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative w-fit shrink-0">
                    <span className="grid h-24 w-24 place-items-center rounded-xl bg-neutral-200 text-5xl text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                        <FontAwesomeIcon icon={faGoogleDrive} aria-hidden="true" />
                    </span>
                    {state === "connected" ? (
                        <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-4 border-neutral-50 bg-green-500 text-xs text-white dark:border-neutral-950" aria-hidden="true">
                            <FontAwesomeIcon icon={faCheck} />
                        </span>
                    ) : null}
                </div>
                <div className="min-w-0">
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Integrations</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Google Drive</h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                            <span className={`h-2 w-2 rounded-full ${dotClassName}`} aria-hidden="true" />
                            {label}
                        </span>
                    </div>
                    {isConnected && email ? (
                        <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                            <FontAwesomeIcon icon={faEnvelope} className="shrink-0" aria-hidden="true" />
                            <span className="truncate" title={email}>{email}</span>
                        </p>
                    ) : (
                        <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                            Add photos and videos from your Drive to your library. Files stay in Drive; Tagged keeps a reference with your tags, albums and favourites.
                        </p>
                    )}
                </div>
            </div>
            {action}
        </header>
    );
};
