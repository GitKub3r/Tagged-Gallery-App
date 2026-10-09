import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import { faCircleCheck, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { IntegrationHero } from "../../../components/integration-hero/IntegrationHero";

// Estado integrado en la línea bajo el título: sin píldoras. Sin conexión solo se muestra la descripción.
const ACCOUNT_LINES = {
    connected: { icon: faCircleCheck, iconClassName: "text-green-600 dark:text-green-400", prefix: "Connected as" },
    reconnect: { icon: faTriangleExclamation, iconClassName: "text-amber-600 dark:text-amber-400", prefix: "Reconnect needed ·" },
};

export const DriveHero = ({ state, email, action }) => {
    const accountLine = ACCOUNT_LINES[state];

    return (
        <IntegrationHero
            icon={faGoogleDrive}
            eyebrow="Integrations"
            title="Google Drive"
            isActive={state === "connected"}
            statusLine={
                accountLine && {
                    icon: accountLine.icon,
                    iconClassName: accountLine.iconClassName,
                    title: email || undefined,
                    content: (
                        <>
                            {accountLine.prefix} <span className="font-semibold text-neutral-700 dark:text-neutral-200">{email || "your Google account"}</span>
                        </>
                    ),
                }
            }
            description="Add photos and videos from your Drive to your library. Files stay in Drive; Tagged keeps a reference with your tags, albums and favourites."
            action={action}
        />
    );
};
