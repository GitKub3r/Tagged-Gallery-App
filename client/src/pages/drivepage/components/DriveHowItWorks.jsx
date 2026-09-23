import { faImage, faLink, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const ITEMS = [
    { icon: faLink, title: "Linked, not copied", text: "Tagged keeps a reference with your tags, albums and favourites. Originals stay in your Drive." },
    { icon: faImage, title: "Only thumbnails are saved", text: "Small previews are cached so your gallery stays fast without using space on this server." },
    { icon: faShieldHalved, title: "Your Drive stays untouched", text: "Removing media from Tagged never deletes or changes anything in Google Drive." },
];

export const DriveHowItWorks = () => (
    <ul className="grid gap-6 sm:grid-cols-3">
        {ITEMS.map((item) => (
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
