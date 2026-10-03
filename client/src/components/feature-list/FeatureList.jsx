import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Lista de características ("How it works"): icono en caja, título y explicación. items: [{ icon, title, text }].
export const FeatureList = ({ items }) => (
    <ul className="grid gap-6 sm:grid-cols-3">
        {items.map((item) => (
            <li key={item.title} className="min-w-0">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-200 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                    <FontAwesomeIcon icon={item.icon} aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.text}</p>
            </li>
        ))}
    </ul>
);
