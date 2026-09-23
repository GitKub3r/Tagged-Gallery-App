import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Aviso en línea (DESIGN.md §7.3). tone "warning" usa ámbar; "neutral" para información sin urgencia.
const TONES = {
    warning: { box: "border-amber-500/30 bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400" },
    neutral: { box: "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900", icon: "text-neutral-600 dark:text-neutral-300" },
};

export const DriveNotice = ({ tone = "neutral", icon, title, text, action }) => {
    const classes = TONES[tone] || TONES.neutral;
    return (
        <div className={`mt-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${classes.box}`}>
            <FontAwesomeIcon icon={icon} className={`hidden shrink-0 sm:block ${classes.icon}`} aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold">{title}</span>
                <span className="block text-xs text-neutral-600 dark:text-neutral-400">{text}</span>
            </p>
            {action}
        </div>
    );
};
