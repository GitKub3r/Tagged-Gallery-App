import { faBan, faCircleCheck, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { FeatureList } from "../../../components/feature-list/FeatureList";

const skipped = (count) => `${count.toLocaleString("en-US")} media skipped`;

// library: recuento del análisis (solo con los modelos instalados).
export const AssistantSafeguards = ({ library = null }) => (
    <FeatureList
        items={[
            {
                icon: faShieldHalved,
                title: "No sexual content with minors",
                text: `Media that look sexual and seem to show a minor are skipped: no analysis is kept and no tags are suggested.${library ? ` ${skipped(library.blockedByReason.minor_sexual)}.` : ""}`,
            },
            {
                icon: faBan,
                title: "No graphic gore",
                text: `Gore and mutilation are skipped the same way.${library ? ` ${skipped(library.blockedByReason.gore)}.` : ""}`,
            },
            {
                icon: faCircleCheck,
                title: "Adult content is tagged",
                text: "Nudity and other adult media are tagged like anything else. The checks run on this server and can make mistakes; skipped media can still be tagged by hand.",
            },
        ]}
    />
);
