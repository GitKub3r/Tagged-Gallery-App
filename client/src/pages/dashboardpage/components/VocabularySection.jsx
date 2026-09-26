import { faFont, faTag, faUserPen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TagChip } from "../../../components/tag-chip/TagChip";
import { formatNumber } from "../dashboardFormat";
import { DashboardSection } from "./DashboardSection";

// Clasificación de un vocabulario: puesto, nombre, recuento y una barra relativa al primero.
const Leaderboard = ({ icon, title, items, emptyText }) => {
    const max = items.reduce((value, item) => Math.max(value, item.count), 0);
    return (
        <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FontAwesomeIcon icon={icon} className="text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                {title}
            </h3>
            {items.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</p>
            ) : (
                <ol className="mt-3 grid gap-3">
                    {items.map((item, index) => (
                        <li key={item.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                            <span className="text-xs font-bold tracking-widest text-neutral-400 tabular-nums dark:text-neutral-500">{String(index + 1).padStart(2, "0")}</span>
                            <span className="flex min-w-0">{item.label}</span>
                            <span className="text-sm font-bold tabular-nums">{formatNumber(item.count)}</span>
                            <span className="col-span-2 col-start-2 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                                <span className="block h-full rounded-full bg-neutral-950 dark:bg-white" style={{ width: `${max > 0 ? (item.count / max) * 100 : 0}%` }} />
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

const TextLabel = ({ children }) => <span className="truncate text-sm font-semibold" title={children}>{children}</span>;

// 06 · Vocabulary: las tags, autores y nombres de media que más se repiten.
export const VocabularySection = ({ dashboard }) => {
    const { topTags, topAuthors, topDisplayNames } = dashboard;
    return (
        <DashboardSection frame="06" eyebrow="Vocabulary" title="The words you use most" description="Your most repeated tags, authors and media names.">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                <Leaderboard
                    icon={faTag}
                    title="Tags"
                    emptyText="No tags yet."
                    items={topTags.map((tag) => ({
                        key: tag.id,
                        count: tag.usageCount,
                        label: <TagChip tag={tag.tagname} color={tag.tagcolor_hex} type={tag.type} />,
                    }))}
                />
                <Leaderboard
                    icon={faUserPen}
                    title="Authors"
                    emptyText="No authors yet."
                    items={topAuthors.map((author) => ({ key: author.author, count: author.mediaCount, label: <TextLabel>{author.author}</TextLabel> }))}
                />
                <Leaderboard
                    icon={faFont}
                    title="Media names"
                    emptyText="No media names yet."
                    items={topDisplayNames.map((item) => ({ key: item.displayname, count: item.mediaCount, label: <TextLabel>{item.displayname}</TextLabel> }))}
                />
            </div>
        </DashboardSection>
    );
};
