import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MediaCard } from "../../components/media-card/MediaCard";
import { useAuth } from "../../hooks/useAuth";
import "./MetricsPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const UPLOADS_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");

const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short" });

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));

const formatPercent = (value) =>
    new Intl.NumberFormat("es-ES", {
        style: "percent",
        maximumFractionDigits: 1,
    }).format(Number(value || 0));

const formatBytes = (value) => {
    const numericValue = Number(value || 0);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = numericValue;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const fractionDigits = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const parseApiResponse = async (response, fallbackMessage) => {
    const clonedResponse = response.clone();

    try {
        return await response.json();
    } catch {
        let bodyText = "";

        try {
            bodyText = (await clonedResponse.text()).trim();
        } catch {
            bodyText = "";
        }

        return {
            success: false,
            message: bodyText || fallbackMessage,
        };
    }
};

const getMediaPreviewUrl = (media) => {
    const previewPath = media?.thumbpath || media?.filepath || "";

    if (!previewPath) {
        return "";
    }

    if (previewPath.startsWith("http://") || previewPath.startsWith("https://")) {
        return previewPath;
    }

    return `${UPLOADS_BASE_URL}${previewPath}`;
};

const getMonthLabel = (monthIndex) => monthFormatter.format(new Date(2026, monthIndex - 1, 1));

const StatCard = ({ tone = "violet", label, value, hint }) => (
    <article className={`tagged-metrics-stat-card tagged-metrics-stat-card--${tone}`}>
        <span className="tagged-metrics-stat-label">{label}</span>
        <strong className="tagged-metrics-stat-value">{value}</strong>
        {hint ? <p className="tagged-metrics-stat-hint">{hint}</p> : null}
    </article>
);

const CompactTile = ({ title, value, hint, tone = "violet" }) => (
    <article className={`tagged-metrics-compact-tile tagged-metrics-compact-tile--${tone}`}>
        <span>{title}</span>
        <strong>{value}</strong>
        {hint ? <p>{hint}</p> : null}
    </article>
);

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const entry = payload[0];

    return (
        <div className="tagged-metrics-chart-tooltip">
            <strong>{label}</strong>
            <span>{formatNumber(entry.value)} uploads</span>
        </div>
    );
};

export const DashboardPage = () => {
    const { fetchWithAuth, user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [updatingFavouriteId, setUpdatingFavouriteId] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const loadDashboard = async () => {
            try {
                setLoading(true);
                setError(null);
                setActionError(null);

                const yearQuery = selectedYear ? `?year=${encodeURIComponent(selectedYear)}` : "";
                const response = await fetchWithAuth(`${API_URL}/metrics${yearQuery}`, { method: "GET" });
                const data = await parseApiResponse(response, "Could not load dashboard");

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Could not load dashboard");
                }

                if (cancelled) {
                    return;
                }

                setDashboard(data.data || null);

                const nextYear = Number(data.data?.selectedYear);
                if (Number.isInteger(nextYear) && nextYear !== selectedYear) {
                    setSelectedYear(nextYear);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load dashboard");
                    setDashboard(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, user, selectedYear]);

    const availableYears = dashboard?.availableYears || [];
    const monthlyUploads = dashboard?.monthlyUploads || [];
    const topAuthors = dashboard?.topAuthors || [];
    const topTags = dashboard?.topTags || [];
    const mediaTypeBreakdown = dashboard?.mediaTypeBreakdown || [];
    const topMedia = dashboard?.featuredMedia || [];
    const topDisplayName = dashboard?.topDisplayName || null;
    const topDisplayNameCount = dashboard?.topDisplayNameCount || 0;

    const currentYearIndex = availableYears.indexOf(selectedYear);
    const canGoPrevious = currentYearIndex > 0;
    const canGoNext = currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1;
    const currentYearLabel = selectedYear || dashboard?.selectedYear || new Date().getFullYear();

    const chartData = useMemo(
        () =>
            monthlyUploads.map((month) => ({
                ...month,
                monthLabel: getMonthLabel(month.monthIndex),
                uploads: Number(month.mediaCount || 0),
            })),
        [monthlyUploads],
    );

    const maxAuthorCount = topAuthors.reduce((maxValue, item) => Math.max(maxValue, Number(item.mediaCount || 0)), 0);
    const maxTagUsage = topTags.reduce((maxValue, item) => Math.max(maxValue, Number(item.usageCount || 0)), 0);
    // Eliminado peakMonth, ya no se usa

    const topAuthor = topAuthors[0] || null;
    const topTag = topTags[0] || null;
    const favouriteRate = Number(dashboard?.favoriteRate || 0);
    const mediaTypeTiles = useMemo(() => {
        const totalMedia = Number(dashboard?.totalMedia || 0);
        const baseTypes = ["image", "video"];
        const preferredExtraTypes = ["gif", "zip"];

        const typeMap = new Map(
            mediaTypeBreakdown.map((item) => {
                const typeKey = String(item.mediatype || "unknown")
                    .trim()
                    .toLowerCase();

                return [
                    typeKey,
                    {
                        mediatype: typeKey,
                        mediaCount: Number(item.mediaCount || 0),
                        taggedMediaCount: Number(item.taggedMediaCount || 0),
                        favouriteMediaCount: Number(item.favouriteMediaCount || 0),
                        totalBytes: Number(item.totalBytes || 0),
                    },
                ];
            }),
        );

        const extraTypesInData = [...typeMap.keys()].filter((typeKey) => !baseTypes.includes(typeKey));
        const showQuad = extraTypesInData.length > 0;

        const selectedExtras = [];
        if (showQuad) {
            preferredExtraTypes.forEach((typeKey) => {
                if (extraTypesInData.includes(typeKey)) {
                    selectedExtras.push(typeKey);
                }
            });

            extraTypesInData.forEach((typeKey) => {
                if (!selectedExtras.includes(typeKey)) {
                    selectedExtras.push(typeKey);
                }
            });

            while (selectedExtras.length < 2) {
                const fallbackType = preferredExtraTypes.find((typeKey) => !selectedExtras.includes(typeKey));
                if (!fallbackType) {
                    break;
                }

                selectedExtras.push(fallbackType);
            }
        }

        const visibleTypes = showQuad ? [...baseTypes, ...selectedExtras.slice(0, 2)] : baseTypes;

        return {
            showQuad,
            items: visibleTypes.map((typeKey) => {
                const source = typeMap.get(typeKey);
                const mediaCount = source ? source.mediaCount : 0;
                const taggedMediaCount = source ? source.taggedMediaCount : 0;
                const favouriteMediaCount = source ? source.favouriteMediaCount : 0;
                const totalBytes = source ? source.totalBytes : 0;

                return {
                    mediatype: typeKey,
                    mediaCount,
                    taggedMediaCount,
                    favouriteMediaCount,
                    totalBytes,
                    mediaShare: totalMedia > 0 ? mediaCount / totalMedia : 0,
                    taggedRate: mediaCount > 0 ? taggedMediaCount / mediaCount : 0,
                    favouriteRate: mediaCount > 0 ? favouriteMediaCount / mediaCount : 0,
                };
            }),
        };
    }, [dashboard?.totalMedia, mediaTypeBreakdown]);

    const handleToggleFeaturedFavourite = async (mediaId) => {
        if (!mediaId) {
            return;
        }

        try {
            setUpdatingFavouriteId(mediaId);
            setActionError(null);

            const response = await fetchWithAuth(`${API_URL}/media/${mediaId}/toggle-favourite`, {
                method: "PATCH",
            });
            const data = await parseApiResponse(response, "Could not update favourite status");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not update favourite status");
            }

            if (data.data) {
                setDashboard((currentDashboard) => {
                    if (!currentDashboard) {
                        return currentDashboard;
                    }

                    return {
                        ...currentDashboard,
                        featuredMedia: currentDashboard.featuredMedia.map((mediaItem) =>
                            mediaItem.id === mediaId
                                ? {
                                      ...mediaItem,
                                      is_favourite: data.data.is_favourite,
                                  }
                                : mediaItem,
                        ),
                        favoriteMediaCount: Math.max(
                            0,
                            Number(currentDashboard.favoriteMediaCount || 0) +
                                ((data.data.is_favourite ? 1 : 0) -
                                    (currentDashboard.featuredMedia.find((item) => item.id === mediaId)?.is_favourite
                                        ? 1
                                        : 0)),
                        ),
                    };
                });
            }
        } catch (requestError) {
            setActionError(requestError.message || "Could not update favourite status");
        } finally {
            setUpdatingFavouriteId(null);
        }
    };

    if (loading) {
        return (
            <section className="tagged-app-page tagged-metrics-page">
                <article className="tagged-app-page-card tagged-metrics-status-card" aria-live="polite">
                    <h2>Loading metrics</h2>
                    <p>Building your dashboard from the library.</p>
                </article>
            </section>
        );
    }

    if (error) {
        return (
            <section className="tagged-app-page tagged-metrics-page">
                <article
                    className="tagged-app-page-card tagged-metrics-status-card tagged-metrics-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Error loading dashboard</h2>
                    <p>{error}</p>
                </article>
            </section>
        );
    }

    if (!dashboard || dashboard.totalMedia === 0) {
        return (
            <section className="tagged-app-page tagged-metrics-page">
                <article className="tagged-app-page-card tagged-metrics-empty-card tagged-metrics-empty-card--no-media">
                    <h2>No media to analyze yet</h2>
                    <p>
                        Dashboard insights are generated from your uploaded media. Let&apos;s{" "}
                        <Link className="tagged-metrics-empty-link" to="/gallery">
                            go to gallery
                        </Link>
                        .
                    </p>
                    <img className="tagged-metrics-empty-icon" src="/icons/metrics.svg" alt="" aria-hidden="true" />
                </article>
            </section>
        );
    }

    return (
        <section className="tagged-app-page tagged-metrics-page">
            {actionError ? (
                <article
                    className="tagged-app-page-card tagged-metrics-status-card tagged-metrics-status-card--error"
                    aria-live="polite"
                >
                    <h2>Action failed</h2>
                    <p>{actionError}</p>
                </article>
            ) : null}

            <section className="tagged-metrics-stats-grid" aria-label="Summary metrics">
                <StatCard
                    tone="violet"
                    label="Total media"
                    value={formatNumber(dashboard.totalMedia)}
                    hint={`${formatNumber(dashboard.taggedMediaCount)} tagged · ${formatNumber(dashboard.untaggedMediaCount)} without tags`}
                />
                <StatCard
                    tone="teal"
                    label="Favourite ratio"
                    value={formatPercent(favouriteRate)}
                    hint={`${formatNumber(dashboard.favoriteMediaCount)} items marked as favourites`}
                />
                <StatCard
                    tone="gold"
                    label="Average tags per media"
                    value={Number(dashboard.averageTagsPerMedia || 0).toFixed(1)}
                    hint={`${formatNumber(dashboard.totalTagAssignments)} total tag assignments`}
                />
                <StatCard
                    tone="rose"
                    label="Storage used"
                    value={formatBytes(dashboard.totalBytes)}
                    hint={`${formatNumber(dashboard.totalAlbums)} albums · ${formatNumber(dashboard.totalTags)} tags`}
                />
            </section>

            <section className="tagged-metrics-insights-panel" aria-label="Quick insights">
                <div className="tagged-metrics-insights-grid">
                    <CompactTile
                        tone="violet"
                        title="Top author"
                        value={topAuthor?.author || "—"}
                        hint={topAuthor ? `${formatNumber(topAuthor.mediaCount)} media` : "No author data yet"}
                    />
                    <CompactTile
                        tone="teal"
                        title="Top tag"
                        value={topTag?.tagname || "—"}
                        hint={topTag ? `${formatNumber(topTag.usageCount)} uses` : "No tag data yet"}
                    />
                    <CompactTile
                        tone="gold"
                        title="Top Name"
                        value={topDisplayName || "—"}
                        hint={topDisplayName ? `${formatNumber(topDisplayNameCount)} media` : "No displayname data yet"}
                    />
                    <CompactTile
                        tone="rose"
                        title="Tag density"
                        value={formatPercent(
                            dashboard.totalMedia > 0 ? dashboard.taggedMediaCount / dashboard.totalMedia : 0,
                        )}
                        hint={`${formatNumber(dashboard.totalTagAssignments)} tag relations`}
                    />
                </div>
            </section>

            <section className="tagged-metrics-panels-grid">
                <article className="tagged-metrics-panel tagged-metrics-panel--featured">
                    <div className="tagged-metrics-panel-header">
                        <div>
                            <h2>Top 4 media by tags</h2>
                        </div>
                    </div>

                    <div className="tagged-metrics-top3-grid">
                        {topMedia.length > 0 ? (
                            topMedia.map((mediaItem) => (
                                <MediaCard
                                    key={mediaItem.id}
                                    media={mediaItem}
                                    uploadsBaseUrl={UPLOADS_BASE_URL}
                                    onOpenMedia={(mediaId) => navigate(`/gallery/${mediaId}`)}
                                    onToggleFavourite={handleToggleFeaturedFavourite}
                                    isTogglingFavourite={updatingFavouriteId === mediaItem.id}
                                    disableLongPressSelection
                                />
                            ))
                        ) : (
                            <p className="tagged-metrics-panel-empty">There is no featured media yet.</p>
                        )}
                    </div>
                </article>

                <article className="tagged-metrics-panel tagged-metrics-panel--chart">
                    <div className="tagged-metrics-panel-header">
                        <div>
                            <h2>Uploads by year</h2>
                        </div>

                        <div className="tagged-metrics-year-nav">
                            {canGoPrevious ? (
                                <button
                                    type="button"
                                    className="tagged-metrics-year-nav-button"
                                    onClick={() => {
                                        setSelectedYear(availableYears[currentYearIndex - 1]);
                                    }}
                                    aria-label="Previous year"
                                >
                                    ←
                                </button>
                            ) : null}

                            <span className="tagged-metrics-year-label">{currentYearLabel}</span>

                            {canGoNext ? (
                                <button
                                    type="button"
                                    className="tagged-metrics-year-nav-button"
                                    onClick={() => {
                                        setSelectedYear(availableYears[currentYearIndex + 1]);
                                    }}
                                    aria-label="Next year"
                                >
                                    →
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="tagged-metrics-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 12, right: 4, left: 0, bottom: 0 }}
                                barCategoryGap="14%"
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(61, 61, 61, 0.1)" />
                                <XAxis
                                    dataKey="monthLabel"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: "#555555", fontSize: 11 }}
                                    interval={0}
                                    minTickGap={0}
                                    tickMargin={8}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: "#555555", fontSize: 11 }}
                                    width={32}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(100, 58, 255, 0.04)" }} />
                                <Bar dataKey="uploads" radius={[10, 10, 0, 0]} fill="#643aff" maxBarSize={42} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>
            </section>

            <section className="tagged-metrics-lists-grid">
                <article className="tagged-metrics-panel tagged-metrics-panel--authors">
                    <div className="tagged-metrics-panel-header">
                        <div>
                            <h2>Favourite authors</h2>
                            <p>Sorted by how many media items each author appears on.</p>
                        </div>
                    </div>

                    {topAuthors.length > 0 ? (
                        <ul className="tagged-metrics-list">
                            {topAuthors.map((author, index) => {
                                const width =
                                    maxAuthorCount > 0 ? (Number(author.mediaCount || 0) / maxAuthorCount) * 100 : 0;

                                return (
                                    <li key={`${author.author}-${index}`} className="tagged-metrics-list-item">
                                        <span className="tagged-metrics-rank">#{index + 1}</span>
                                        <div className="tagged-metrics-list-content">
                                            <div className="tagged-metrics-list-label-row">
                                                <strong>{author.author || "Unknown"}</strong>
                                                <span>{formatNumber(author.mediaCount)}</span>
                                            </div>
                                            <div className="tagged-metrics-progress-track">
                                                <div
                                                    className="tagged-metrics-progress-bar"
                                                    style={{
                                                        width: `${Math.max(width, author.mediaCount > 0 ? 8 : 0)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="tagged-metrics-panel-empty">No authors yet.</p>
                    )}
                </article>

                <article className="tagged-metrics-panel tagged-metrics-panel--tags">
                    <div className="tagged-metrics-panel-header">
                        <div>
                            <h2>Most used tags</h2>
                            <p>Each bar compares against all tag relations in the library.</p>
                        </div>
                    </div>

                    {topTags.length > 0 ? (
                        <ul className="tagged-metrics-list">
                            {topTags.map((tag, index) => {
                                const width = maxTagUsage > 0 ? (Number(tag.usageCount || 0) / maxTagUsage) * 100 : 0;

                                return (
                                    <li
                                        key={`${tag.id}-${index}`}
                                        className="tagged-metrics-list-item tagged-metrics-list-item--tags"
                                    >
                                        <div className="tagged-metrics-list-content">
                                            <div className="tagged-metrics-list-label-row tagged-metrics-list-label-row--tag">
                                                <span
                                                    className="tagged-metrics-tag-swatch"
                                                    style={{
                                                        backgroundColor: tag.tagcolor_hex || "rgba(100, 58, 255, 0.18)",
                                                    }}
                                                    aria-hidden="true"
                                                />
                                                <strong>{tag.tagname}</strong>
                                                <span>{formatNumber(tag.usageCount)}</span>
                                            </div>
                                            <div className="tagged-metrics-progress-track">
                                                <div
                                                    className="tagged-metrics-progress-bar tagged-metrics-progress-bar--tag"
                                                    style={{ width: `${Math.max(width, tag.usageCount > 0 ? 8 : 0)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="tagged-metrics-panel-empty">No tags yet.</p>
                    )}
                </article>

                <article className="tagged-metrics-panel tagged-metrics-panel--types">
                    <div className="tagged-metrics-panel-header">
                        <div>
                            <h2>Media Type Mix</h2>
                            <p>Distribution by format, shown as compact summary tiles.</p>
                        </div>
                    </div>

                    <div
                        className={`tagged-metrics-type-grid${mediaTypeTiles.showQuad ? " tagged-metrics-type-grid--quad" : ""}`}
                    >
                        {mediaTypeTiles.items.map((typeItem) => (
                            <article key={typeItem.mediatype} className="tagged-metrics-type-tile">
                                <div className="tagged-metrics-type-head">
                                    <span className="tagged-metrics-type-name">
                                        {String(typeItem.mediatype || "unknown").toUpperCase()}
                                    </span>
                                    <span className="tagged-metrics-type-pill">{formatPercent(typeItem.mediaShare)}</span>
                                </div>
                                <strong className="tagged-metrics-type-count">
                                    {formatNumber(typeItem.mediaCount)}
                                </strong>
                                <p className="tagged-metrics-type-subtitle">
                                    {typeItem.mediaCount === 1 ? "item in library" : "items in library"}
                                </p>
                                <dl className="tagged-metrics-type-meta">
                                    <div className="tagged-metrics-type-meta-item">
                                        <dt>Tagged</dt>
                                        <dd>{formatPercent(typeItem.taggedRate)}</dd>
                                    </div>
                                    <div className="tagged-metrics-type-meta-item">
                                        <dt>Favourites</dt>
                                        <dd>{formatPercent(typeItem.favouriteRate)}</dd>
                                    </div>
                                    <div className="tagged-metrics-type-meta-item tagged-metrics-type-meta-item--wide">
                                        <dt>Storage</dt>
                                        <dd>{formatBytes(typeItem.totalBytes)}</dd>
                                    </div>
                                </dl>
                            </article>
                        ))}
                    </div>
                </article>
            </section>
        </section>
    );
};
