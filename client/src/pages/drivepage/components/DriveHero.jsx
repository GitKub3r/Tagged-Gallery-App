import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faCheck, faCircleCheck, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Estado integrado en la línea bajo el título: sin píldoras. Sin conexión solo se muestra la descripción.
const ACCOUNT_LINES = {
    connected: { icon: faCircleCheck, iconClassName: "text-green-600 dark:text-green-400", prefix: "Connected as" },
    reconnect: { icon: faTriangleExclamation, iconClassName: "text-amber-600 dark:text-amber-400", prefix: "Reconnect needed ·" },
};

export const DriveHero = ({ state, email, action }) => {
    const accountLine = ACCOUNT_LINES[state];

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
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Google Drive</h1>
                    {accountLine ? (
                        <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                            <FontAwesomeIcon icon={accountLine.icon} className={`shrink-0 ${accountLine.iconClassName}`} aria-hidden="true" />
                            <span className="min-w-0 truncate" title={email || undefined}>
                                {accountLine.prefix} <span className="font-semibold text-neutral-700 dark:text-neutral-200">{email || "your Google account"}</span>
                            </span>
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
