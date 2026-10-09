import { faBan, faSliders } from "@fortawesome/free-solid-svg-icons";
import { DetailRow } from "../../../components/detail-row/DetailRow";
import { getStrictnessLevel } from "./strictnessLevels";

// Resumen de los ajustes (se cambian en AssistantSettingsModal).
export const AssistantSettings = ({ settings }) => {
    const level = getStrictnessLevel(settings.strictness);
    return (
        <dl className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            <DetailRow icon={faSliders} label="Confidence" value={level.label} detail={level.description} />
            <DetailRow
                icon={faBan}
                label="Never adds"
                value={settings.excludedTags.length > 0 ? settings.excludedTags.join(", ") : "No excluded tags"}
                detail={settings.excludedTags.length > 0 ? `${settings.excludedTags.length} ${settings.excludedTags.length === 1 ? "tag" : "tags"} the assistant leaves to you.` : "The assistant may add any of your tags."}
            />
        </dl>
    );
};
