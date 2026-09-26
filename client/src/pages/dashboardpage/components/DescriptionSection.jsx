import { Link } from "react-router-dom";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { formatDecimal, formatNumber, formatPercent, pluralize, share } from "../dashboardFormat";
import { DashboardMeter } from "./DashboardMeter";
import { DashboardSection } from "./DashboardSection";

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Indicador circular de DESIGN.md §5.1: pista y relleno del mismo tono, con el porcentaje en el centro.
const CoverageRing = ({ label, count, total }) => {
    const value = share(count, total);
    const missing = Math.max(total - count, 0);
    return (
        <li className="flex min-w-0 flex-col items-center gap-2 text-center">
            <span className="relative grid h-24 w-24 place-items-center">
                <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="32" cy="32" r={RING_RADIUS} fill="none" strokeWidth="6" className="stroke-neutral-200 dark:stroke-neutral-800" />
                    <circle
                        cx="32"
                        cy="32"
                        r={RING_RADIUS}
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${value * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                        className="stroke-neutral-950 dark:stroke-white"
                    />
                </svg>
                <span className="text-lg font-black tracking-tight">{formatPercent(value)}</span>
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="flex items-center justify-center gap-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {missing === 0 ? (
                        <>
                            <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                            Every media
                        </>
                    ) : (
                        `${pluralize(missing, "media", "media")} missing`
                    )}
                </span>
            </span>
        </li>
    );
};

const Fact = ({ label, value, hint }) => (
    <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950">
        <dt className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</dt>
        <dd className="mt-0.5 text-lg font-black tracking-tight">{value}</dd>
        <dd className="truncate text-xs text-neutral-500 dark:text-neutral-400">{hint}</dd>
    </div>
);

// 05 · Description: qué parte de la biblioteca tiene tags, nombre y autor, cuántas tags lleva cada media
// y el estado del vocabulario de tags.
export const DescriptionSection = ({ dashboard }) => {
    const { totalMedia, coverage, averageTagsPerMedia, totalTagAssignments, totalTags, tagsPerMedia, vocabulary } = dashboard;
    return (
        <DashboardSection frame="05" eyebrow="Description" title="How findable it is" description="Media with tags, a name and an author are easier to search, filter and organise.">
            <ul className="grid grid-cols-3 gap-2" aria-label="Metadata coverage">
                <CoverageRing label="Tags" count={coverage.withTags} total={totalMedia} />
                <CoverageRing label="Media name" count={coverage.withDisplayname} total={totalMedia} />
                <CoverageRing label="Author" count={coverage.withAuthor} total={totalMedia} />
            </ul>

            <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold">Tags per media</h3>
                    <p className="text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">
                        {formatDecimal(averageTagsPerMedia)} on average · {formatNumber(totalTagAssignments)} given
                    </p>
                </div>
                <div className="grid gap-2">
                    {tagsPerMedia.map((bucket) => (
                        <DashboardMeter
                            key={bucket.label}
                            label={bucket.label === "0" ? "No tags" : `${bucket.label} tags`}
                            value={share(bucket.mediaCount, totalMedia)}
                            detail={`${formatNumber(bucket.mediaCount)} · ${formatPercent(share(bucket.mediaCount, totalMedia))}`}
                        />
                    ))}
                </div>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold">Tag vocabulary</h3>
                    <Link to="/metadata" className={buttonClasses.text}>Manage tags</Link>
                </div>
                <dl className="grid grid-cols-3 gap-2">
                    <Fact label="Unused" value={formatNumber(vocabulary.unusedTags)} hint={`of ${pluralize(totalTags, "tag")}`} />
                    <Fact label="Used once" value={formatNumber(vocabulary.singleUseTags)} hint={formatPercent(share(vocabulary.singleUseTags, totalTags))} />
                    <Fact label="Copyright" value={formatNumber(vocabulary.copyrightTags)} hint={formatPercent(share(vocabulary.copyrightTags, totalTags))} />
                </dl>
            </div>
        </DashboardSection>
    );
};
