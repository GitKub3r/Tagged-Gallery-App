import { faCircleCheck, faImages, faShieldHalved, faTags } from "@fortawesome/free-solid-svg-icons";
import { StatTile } from "../../../components/stat-tile/StatTile";

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

export const AssistantStats = ({ library, aiTags }) => {
    const keptRate = aiTags.added > 0 ? Math.round((aiTags.kept / aiTags.added) * 100) : null;
    const unreadable = library.failed > 0 ? ` · ${formatNumber(library.failed)} unreadable` : "";

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={faImages} label="Analyzed" value={formatNumber(library.ready)} hint={`Of ${formatNumber(library.total)} media${unreadable}`} />
            <StatTile icon={faTags} label="Tags added" value={formatNumber(aiTags.added)} hint="By the assistant, never removed" />
            <StatTile
                icon={faCircleCheck}
                label="Kept"
                value={keptRate === null ? "–" : `${keptRate}%`}
                hint={keptRate === null ? "No tags added yet" : `${formatNumber(aiTags.kept)} still on your media`}
            />
            <StatTile icon={faShieldHalved} label="Skipped" value={formatNumber(library.blocked)} hint="By the safeguards" />
        </div>
    );
};
