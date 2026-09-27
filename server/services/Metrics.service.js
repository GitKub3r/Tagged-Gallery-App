const MediaService = require("./Media.service");
const AlbumModel = require("../models/Album.model");
const MetricsModel = require("../models/Metrics.model");
const { parseUtcOffset } = require("../utils/utcOffset");

const toNumber = (value) => Number(value || 0);
// Días que una media pasa en la papelera antes de borrarse (ver Trash.service).
const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const buildMonthSeries = (dailyUploads, year) => {
    const countsByMonth = new Map();
    dailyUploads.forEach(({ day, mediaCount }) => {
        const monthIndex = Number(day.slice(5, 7));
        countsByMonth.set(monthIndex, (countsByMonth.get(monthIndex) || 0) + mediaCount);
    });

    return Array.from({ length: 12 }, (_, index) => ({
        monthIndex: index + 1,
        monthKey: `${year}-${String(index + 1).padStart(2, "0")}`,
        mediaCount: countsByMonth.get(index + 1) || 0,
    }));
};

const pickYear = (availableYears, requestedYear) => {
    const currentYear = new Date().getFullYear();
    const parsedYear = Number(requestedYear);
    if (availableYears.length === 0) return Number.isInteger(parsedYear) ? parsedYear : currentYear;
    if (availableYears.includes(parsedYear)) return parsedYear;
    return availableYears.includes(currentYear) ? currentYear : availableYears[availableYears.length - 1];
};

// Etiquetas de los grupos de getTagsPerMediaDistribution.
const TAG_COUNT_BUCKETS = ["0", "1–4", "5–9", "10–19", "20+"];

const buildWorkspace = (row, previews, albums) => {
    const trashOldestAt = row.trash_oldest_at ? new Date(row.trash_oldest_at) : null;
    return {
        totalAlbums: toNumber(row.total_albums),
        largestAlbums: albums.map((album) => ({
            id: album.id,
            albumname: album.albumname,
            albumthumbpath: album.albumthumbpath,
            mediaCount: toNumber(album.media_count),
        })),
        recentFavourites: previews.favourites,
        templates: previews.templates.map((template) => ({ id: template.id, name: template.name })),
        rules: previews.rules.map((rule) => ({ id: rule.id, name: rule.name, isActive: Boolean(rule.is_active) })),
        mediaInAlbums: toNumber(row.media_in_albums),
        totalTemplates: toNumber(row.total_templates),
        totalRules: toNumber(row.total_rules),
        activeRules: toNumber(row.active_rules),
        ruleChanges: toNumber(row.rule_changes),
        rulesLastAppliedAt: row.rules_last_applied_at || null,
        drive: {
            status: row.drive_status || "disconnected",
            email: row.drive_email || null,
        },
        trash: {
            mediaCount: toNumber(row.trash_count),
            totalBytes: toNumber(row.trash_bytes),
            retentionDays: TRASH_RETENTION_DAYS,
            recentMedia: previews.trash,
            // La media más antigua de la papelera es la próxima que se borrará.
            nextPurgeAt: trashOldestAt ? new Date(trashOldestAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS) : null,
        },
    };
};

class MetricsService {
    // utcOffsetMinutes: desfase de la zona horaria del usuario, para agrupar la actividad por sus días.
    static async getDashboard(requestUser, requestedYear = null, utcOffsetMinutes = 0) {
        try {
            const utcOffset = parseUtcOffset(utcOffsetMinutes);
            const timestampColumn = await MetricsModel.getMediaTimestampColumn();
            const availableYears = await MetricsModel.getAvailableYears(requestUser, timestampColumn, utcOffset);
            const selectedYear = pickYear(availableYears, requestedYear);

            const [
                mediaSummary,
                tagSummary,
                coverage,
                storageByProvider,
                totalTagSummary,
                topAuthors,
                topTags,
                topDisplayNames,
                mediaTypeBreakdown,
                dailyUploadRows,
                firstUploadAt,
                recentMediaRows,
                topMediaRows,
                workspaceRow,
                workspacePreviews,
                largestAlbums,
                vocabularyStats,
                tagsPerMediaRows,
            ] = await Promise.all([
                MetricsModel.getMediaSummary(requestUser),
                MetricsModel.getTagSummary(requestUser),
                MetricsModel.getCoverage(requestUser),
                MetricsModel.getStorageByProvider(requestUser),
                MetricsModel.getTotalTagCount(requestUser),
                MetricsModel.getTopAuthors(requestUser),
                MetricsModel.getTopTags(requestUser),
                MetricsModel.getTopDisplayNames(requestUser),
                MetricsModel.getMediaTypeBreakdown(requestUser),
                MetricsModel.getDailyUploads(requestUser, timestampColumn, selectedYear, utcOffset),
                MetricsModel.getFirstUploadAt(requestUser, timestampColumn),
                MetricsModel.getRecentMedia(requestUser, timestampColumn),
                MetricsModel.getTopMediaWithTagCount(requestUser, 4),
                MetricsModel.getWorkspaceSummary(requestUser.id),
                MetricsModel.getWorkspacePreviews(requestUser.id),
                AlbumModel.findLargestByUserId(requestUser.id),
                MetricsModel.getVocabularyStats(requestUser),
                MetricsModel.getTagsPerMediaDistribution(requestUser),
            ]);

            const totalMedia = toNumber(mediaSummary.total_media);
            const favoriteMediaCount = toNumber(mediaSummary.favorite_media_count);
            const taggedMediaCount = toNumber(tagSummary.tagged_media_count);
            const totalTagAssignments = toNumber(tagSummary.total_tag_assignments);
            const dailyUploads = dailyUploadRows.map((row) => ({ day: row.day, mediaCount: toNumber(row.media_count) }));
            const tagsPerMediaCounts = new Map(tagsPerMediaRows.map((row) => [Number(row.bucket), toNumber(row.media_count)]));
            const featuredMedia = await Promise.all(topMediaRows.map((mediaItem) => MediaService.enrichMediaWithTags(mediaItem)));

            return {
                success: true,
                data: {
                    scope: requestUser.type === "admin" ? "all" : "own",
                    selectedYear,
                    availableYears,
                    firstUploadAt,
                    totalMedia,
                    favoriteMediaCount,
                    taggedMediaCount,
                    untaggedMediaCount: Math.max(totalMedia - taggedMediaCount, 0),
                    totalTagAssignments,
                    totalTags: toNumber(totalTagSummary.total_tags),
                    totalBytes: toNumber(mediaSummary.total_bytes),
                    averageTagsPerMedia: totalMedia > 0 ? totalTagAssignments / totalMedia : 0,
                    favoriteRate: totalMedia > 0 ? favoriteMediaCount / totalMedia : 0,
                    coverage: {
                        withAuthor: toNumber(coverage.with_author),
                        withDisplayname: toNumber(coverage.with_displayname),
                        withTags: taggedMediaCount,
                    },
                    vocabulary: {
                        distinctAuthors: toNumber(vocabularyStats.distinct_authors),
                        distinctDisplaynames: toNumber(vocabularyStats.distinct_displaynames),
                        copyrightTags: toNumber(vocabularyStats.copyright_tags),
                        unusedTags: toNumber(vocabularyStats.unused_tags),
                        singleUseTags: toNumber(vocabularyStats.single_use_tags),
                    },
                    tagsPerMedia: TAG_COUNT_BUCKETS.map((label, index) => ({ label, mediaCount: tagsPerMediaCounts.get(index) || 0 })),
                    orientation: {
                        landscape: toNumber(coverage.landscape),
                        portrait: toNumber(coverage.portrait),
                        square: toNumber(coverage.square),
                    },
                    storageByProvider: storageByProvider.map((row) => ({
                        provider: row.storage_provider,
                        mediaCount: toNumber(row.media_count),
                        totalBytes: toNumber(row.total_bytes),
                    })),
                    mediaTypeBreakdown: mediaTypeBreakdown.map((row) => ({
                        mediatype: row.mediatype,
                        mediaCount: toNumber(row.media_count),
                        totalBytes: toNumber(row.total_bytes),
                    })),
                    topAuthors: topAuthors.map((row) => ({ author: row.author, mediaCount: toNumber(row.media_count) })),
                    topDisplayNames: topDisplayNames.map((row) => ({ displayname: row.displayname, mediaCount: toNumber(row.media_count) })),
                    topTags: topTags.map((row) => ({
                        id: row.id,
                        tagname: row.tagname,
                        tagcolor_hex: row.tagcolor_hex,
                        type: row.type,
                        usageCount: toNumber(row.usage_count),
                    })),
                    dailyUploads,
                    monthlyUploads: buildMonthSeries(dailyUploads, selectedYear),
                    recentMedia: recentMediaRows,
                    featuredMedia,
                    workspace: buildWorkspace(workspaceRow, workspacePreviews, largestAlbums),
                },
            };
        } catch (error) {
            console.error("Error in MetricsService.getDashboard:", error);
            throw new Error("Error fetching metrics dashboard");
        }
    }
}

module.exports = MetricsService;
