import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const placementClasses = {
    page: "min-h-[calc(100dvh-4.4rem)]",
    section: "min-h-[min(28rem,60dvh)]",
};

export const EmptyState = ({ title, icon, actionLabel, onAction, placement = "page" }) => (
    <article
        className={`flex w-full flex-col items-center justify-center gap-7 px-6 py-12 text-center ${placementClasses[placement]}`}
        aria-live="polite"
    >
        <h2 className="max-w-xl text-2xl font-medium tracking-[-0.025em] text-zinc-900 sm:text-3xl dark:text-zinc-100">
            {title}
        </h2>

        <div className="flex items-center gap-5" aria-hidden="true">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-zinc-300 sm:w-20 dark:to-zinc-700" />
            <FontAwesomeIcon icon={icon} className="text-5xl text-zinc-400 sm:text-6xl dark:text-zinc-500" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-zinc-300 sm:w-20 dark:to-zinc-700" />
        </div>

        <button
            type="button"
            className="group inline-flex! min-h-11! w-auto! items-center! justify-center! gap-2! rounded-xl! border-0! bg-transparent! px-3! py-2! text-sm! font-semibold! text-zinc-600! shadow-none! transition-colors! hover:bg-transparent! hover:text-zinc-950! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-zinc-500! dark:text-zinc-400! dark:hover:text-zinc-100!"
            onClick={onAction}
        >
            <span>{actionLabel}</span>
            <FontAwesomeIcon
                icon={faArrowRight}
                className="text-xs transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
            />
        </button>
    </article>
);
