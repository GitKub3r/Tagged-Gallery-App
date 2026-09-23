import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faCircleCheck, faLinkSlash, faRotate, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const formatConnectedDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
};

const ACCESS_LABELS = {
    file: "Only files you select",
    readonly: "Read-only, whole Drive",
};

export const DriveConnectionCard = ({ email, connectedAt, grantedAccess, requiredAccess, needsReconnect, isDisconnecting, isReconnecting, onDisconnect, onReconnect }) => (
    <article className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xl text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    <FontAwesomeIcon icon={faGoogleDrive} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold" title={email || undefined}>{email || "Google account"}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                        Connected
                    </p>
                </div>
            </div>
            <button
                type="button"
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-transparent px-4 text-sm font-semibold text-neutral-700 shadow-none transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:text-red-400 sm:w-auto"
                onClick={onDisconnect}
                disabled={isDisconnecting}
            >
                <FontAwesomeIcon icon={faLinkSlash} aria-hidden="true" />
                Disconnect
            </button>
        </div>

        {needsReconnect ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-950 sm:flex-row sm:items-center">
                <FontAwesomeIcon icon={faTriangleExclamation} className="hidden shrink-0 text-neutral-600 dark:text-neutral-300 sm:block" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold">Reconnect to update access</span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">Tagged now needs a different Drive permission ({ACCESS_LABELS[requiredAccess] || ACCESS_LABELS.file}). Your linked media are kept.</span>
                </p>
                <button
                    type="button"
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border-0 bg-neutral-950 px-4 text-sm font-bold text-white shadow-none transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white sm:w-auto"
                    onClick={onReconnect}
                    disabled={isReconnecting}
                >
                    <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
                    {isReconnecting ? "Waiting for Google..." : "Reconnect"}
                </button>
            </div>
        ) : null}

        <dl className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950">
                <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Access</dt>
                <dd className="mt-0.5 text-sm font-semibold">{ACCESS_LABELS[grantedAccess] || ACCESS_LABELS.file}</dd>
            </div>
            <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950">
                <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Connected on</dt>
                <dd className="mt-0.5 text-sm font-semibold">{formatConnectedDate(connectedAt)}</dd>
            </div>
        </dl>
    </article>
);
