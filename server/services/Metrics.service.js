const MediaService = require("./Media.service");
const MetricsModel = require("../models/Metrics.model");

const toNumber = (value) => Number(value || 0);

const buildMonthSeries = (rows, year) => {
    const countsByMonth = new Map(rows.map((row) => [Number(row.month_index), toNumber(row.media_count)]));

    return Array.from({ length: 12 }, (_, index) => ({
        monthIndex: index + 1,
        monthKey: `${year}-${String(index + 1).padStart(2, "0")}`,
        mediaCount: countsByMonth.get(index + 1) || 0,
    }));
};

const transformTopAuthors = (rows) =>
    rows.map((row) => ({
        author: row.author,
        mediaCount: toNumber(row.media_count),
    }));

const transformTopTags = (rows) =>
    rows.map((row) => ({
        id: row.id,
        tagname: row.tagname,
        tagcolor_hex: row.tagcolor_hex,
        type: row.type,
        usageCount: toNumber(row.usage_count),
    }));

const transformMediaTypeBreakdown = (rows, totalMedia) =>
    rows.map((row) => ({
        mediatype: row.mediatype,
        mediaCount: toNumber(row.media_count),
        mediaShare: totalMedia > 0 ? toNumber(row.media_count) / totalMedia : 0,
    }));

class MetricsService {
    static async getDashboard(requestUser, requestedYear = null) {
        try {
            const timestampColumn = await MetricsModel.getMediaTimestampColumn();
            const availableYears = await MetricsModel.getAvailableYears(requestUser, timestampColumn);

            const currentYear = new Date().getFullYear();
            const parsedRequestedYear = Number(requestedYear);
            const fallbackYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : currentYear;
            const selectedYear = Number.isInteger(parsedRequestedYear)
                ? parsedRequestedYear
                : availableYears.includes(currentYear)
                  ? currentYear
                  : fallbackYear;

            const effectiveYear =
                availableYears.length > 0
                    ? availableYears.includes(selectedYear)
                        ? selectedYear
                        : fallbackYear
                    : selectedYear;

            const [
                mediaSummary,
                tagSummary,
                albumSummary,
                totalTagSummary,
                topAuthors,
                topTags,
                mediaTypeBreakdown,
                monthlyUploads,
                topMediaRows,
                topDisplayNameRow,
            ] = await Promise.all([
                MetricsModel.getMediaSummary(requestUser),
                MetricsModel.getTagSummary(requestUser),
                MetricsModel.getAlbumCount(requestUser),
                MetricsModel.getTotalTagCount(requestUser),
                MetricsModel.getTopAuthors(requestUser),
                MetricsModel.getTopTags(requestUser),
                MetricsModel.getMediaTypeBreakdown(requestUser),
                MetricsModel.getMonthlyUploads(requestUser, timestampColumn, effectiveYear),
                MetricsModel.getTopMediaWithTagCount(requestUser, 4),
                MetricsModel.getTopDisplayName(requestUser),
            ]);

            const totalMedia = toNumber(mediaSummary.total_media);
            const favoriteMediaCount = toNumber(mediaSummary.favorite_media_count);
            const totalBytes = toNumber(mediaSummary.total_bytes);
            const taggedMediaCount = toNumber(tagSummary.tagged_media_count);
            const totalTagAssignments = toNumber(tagSummary.total_tag_assignments);
            const totalTags = toNumber(totalTagSummary.total_tags);
            const totalAlbums = toNumber(albumSummary.total_albums);

            const featuredMedia = await Promise.all(
                topMediaRows.map((mediaItem) => MediaService.enrichMediaWithTags(mediaItem)),
            );

            return {
                success: true,
                data: {
                    scope: requestUser.type === "admin" ? "all" : "own",
                    selectedYear: effectiveYear,
                    availableYears,
                    totalMedia,
                    favoriteMediaCount,
                    taggedMediaCount,
                    untaggedMediaCount: Math.max(totalMedia - taggedMediaCount, 0),
                    totalTagAssignments,
                    totalTags,
                    totalAlbums,
                    totalBytes,
                    averageTagsPerMedia: totalMedia > 0 ? totalTagAssignments / totalMedia : 0,
                    favoriteRate: totalMedia > 0 ? favoriteMediaCount / totalMedia : 0,
                    topAuthors: transformTopAuthors(topAuthors),
                    topTags: transformTopTags(topTags),
                    mediaTypeBreakdown: transformMediaTypeBreakdown(mediaTypeBreakdown, totalMedia),
                    monthlyUploads: buildMonthSeries(monthlyUploads, effectiveYear),
                    featuredMedia,
                    topDisplayName: topDisplayNameRow?.displayname || null,
                    topDisplayNameCount: topDisplayNameRow?.usage_count || 0,
                },
            };
        } catch (error) {
            console.error("Error in MetricsService.getDashboard:", error);
            throw new Error("Error fetching metrics dashboard");
        }
    }
}

module.exports = MetricsService;
