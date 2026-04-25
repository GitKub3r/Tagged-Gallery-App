import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./LogsPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const LOGS_TIMEZONE = "Europe/Madrid";

const getSpainDateInputValue = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: LOGS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
        return "";
    }

    return `${year}-${month}-${day}`;
};

const formatDateOnly = (value) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("es-ES", {
        timeZone: LOGS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(parsed);
};

const formatDateParts = (value) => {
    if (!value) {
        return {
            date: "-",
            time: "-",
        };
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return {
            date: String(value),
            time: "-",
        };
    }

    return {
        date: new Intl.DateTimeFormat("es-ES", {
            timeZone: LOGS_TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(parsed),
        time: new Intl.DateTimeFormat("es-ES", {
            timeZone: LOGS_TIMEZONE,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            hourCycle: "h23",
        }).format(parsed),
    };
};

const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value || 0));

const MESSAGE_ROUTE_SEGMENT_REGEX = /(\/[A-Za-z0-9._~%!$&'()*+,;=:@-]+(?:\/[A-Za-z0-9._~%!$&'()*+,;=:@-]+)*)/g;
const MESSAGE_ROUTE_FULL_REGEX = /^\/[A-Za-z0-9._~%!$&'()*+,;=:@-]+(?:\/[A-Za-z0-9._~%!$&'()*+,;=:@-]+)*$/;

const renderMessageWithHighlightedPaths = (message, emptyFallback = "-") => {
    const normalizedMessage = String(message || "");

    if (!normalizedMessage.trim()) {
        return emptyFallback;
    }

    const segments = normalizedMessage.split(MESSAGE_ROUTE_SEGMENT_REGEX);

    return segments.map((segment, index) => {
        if (MESSAGE_ROUTE_FULL_REGEX.test(segment)) {
            return (
                <strong key={`route-${index}`} className="tagged-logs-message-route">
                    {segment}
                </strong>
            );
        }

        return <Fragment key={`text-${index}`}>{segment}</Fragment>;
    });
};

const normalizeDateInputValue = (value) => {
    if (!value) {
        return "";
    }

    const asString = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
        return asString;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(asString)) {
        const [day, month, year] = asString.split("/");
        return `${year}-${month}-${day}`;
    }

    const parsed = new Date(asString);
    if (!Number.isNaN(parsed.getTime())) {
        const year = String(parsed.getFullYear());
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    return "";
};

const getStatusTone = (code) => {
    const numeric = Number(code || 0);

    if (numeric >= 500) {
        return "error";
    }

    if (numeric >= 400) {
        return "warning";
    }

    if (numeric >= 200) {
        return "success";
    }

    return "neutral";
};

const parseApiResponse = async (response, fallbackMessage) => {
    const cloned = response.clone();

    try {
        return await response.json();
    } catch {
        let bodyText = "";

        try {
            bodyText = (await cloned.text()).trim();
        } catch {
            bodyText = "";
        }

        return {
            success: false,
            message: bodyText || fallbackMessage,
        };
    }
};

const buildQueryString = (query) => {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        params.set(key, String(value));
    });

    return params.toString();
};

const extractFilenameFromDisposition = (contentDisposition) => {
    const header = String(contentDisposition || "");

    if (!header) {
        return null;
    }

    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1].trim());
        } catch {
            return utf8Match[1].trim();
        }
    }

    const plainMatch = header.match(/filename="?([^"]+)"?/i);
    if (plainMatch?.[1]) {
        return plainMatch[1].trim();
    }

    return null;
};

const readBlobWithProgress = async (response, onProgress) => {
    const totalBytes = Number(response.headers.get("content-length") || 0);

    if (!response.body || typeof response.body.getReader !== "function") {
        const blob = await response.blob();
        onProgress?.({
            loadedBytes: totalBytes > 0 ? totalBytes : blob.size,
            totalBytes: totalBytes > 0 ? totalBytes : null,
            percent: 100,
        });
        return blob;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        if (!value) {
            continue;
        }

        chunks.push(value);
        receivedBytes += value.byteLength;

        if (totalBytes > 0) {
            const progress = Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 100)));
            onProgress?.({
                loadedBytes: receivedBytes,
                totalBytes,
                percent: progress,
            });
        } else {
            onProgress?.({
                loadedBytes: receivedBytes,
                totalBytes: null,
                percent: null,
            });
        }
    }

    onProgress?.({
        loadedBytes: receivedBytes,
        totalBytes: totalBytes > 0 ? totalBytes : null,
        percent: 100,
    });

    return new Blob(chunks, {
        type: response.headers.get("content-type") || "application/octet-stream",
    });
};

const buildBackupFallbackName = (includeData) => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    const suffix = includeData ? "with-data" : "structure";
    return `tagged-backup-${suffix}-${timestamp}.zip`;
};

const formatDownloadSpeed = (bytesPerSecond) => {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
        return null;
    }

    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let value = bytesPerSecond;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const LogStatCard = ({ tone, label, value, hint }) => (
    <article className={`tagged-logs-stat-card tagged-logs-stat-card--${tone}`}>
        <span className="tagged-logs-stat-label">{label}</span>
        <strong className="tagged-logs-stat-value">{value}</strong>
        {hint ? <p className="tagged-logs-stat-hint">{hint}</p> : null}
    </article>
);

export const LogsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, fetchWithAuth } = useAuth();
    const [actions, setActions] = useState([]);
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
    });
    const [dateSummary, setDateSummary] = useState([]);
    const [todaySummary, setTodaySummary] = useState({
        total: 0,
        success: 0,
        clientError: 0,
        serverError: 0,
    });

    const [search, setSearch] = useState("");
    const [actionCode, setActionCode] = useState("");
    const [statusGroup, setStatusGroup] = useState("");
    const [statusCode, setStatusCode] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState(null);
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [backupMode, setBackupMode] = useState("structure_only");
    const [isBackupDownloading, setIsBackupDownloading] = useState(false);
    const [downloadToast, setDownloadToast] = useState(null);
    const downloadToastTimeoutRef = useRef(null);
    const backupAbortControllerRef = useRef(null);

    const renderMode = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const mode = String(params.get("render") || "table").toLowerCase();

        return mode === "card" ? "card" : "table";
    }, [location.search]);

    const baseFilters = useMemo(
        () => ({
            search: search.trim(),
            actionCode,
            statusGroup,
            statusCode,
        }),
        [search, actionCode, statusGroup, statusCode],
    );

    const activeFilterCount = useMemo(() => {
        return [search.trim(), actionCode, statusGroup, statusCode, dateFrom, dateTo].filter(Boolean).length;
    }, [search, actionCode, statusGroup, statusCode, dateFrom, dateTo]);
    const totalPages = Math.max(1, Number(pagination.totalPages || 1));

    const clearDownloadToastTimer = () => {
        if (downloadToastTimeoutRef.current) {
            window.clearTimeout(downloadToastTimeoutRef.current);
            downloadToastTimeoutRef.current = null;
        }
    };

    const showDownloadToast = (nextToast, autoCloseMs = 0) => {
        clearDownloadToastTimer();
        setDownloadToast(nextToast);

        if (autoCloseMs > 0) {
            downloadToastTimeoutRef.current = window.setTimeout(() => {
                setDownloadToast(null);
                downloadToastTimeoutRef.current = null;
            }, autoCloseMs);
        }
    };

    const hideDownloadToast = () => {
        clearDownloadToastTimer();
        setDownloadToast(null);
    };

    const closeBackupModal = () => {
        if (isBackupDownloading) {
            return;
        }
        setIsBackupModalOpen(false);
    };

    const cancelBackupDownload = () => {
        if (!isBackupDownloading) {
            return;
        }

        backupAbortControllerRef.current?.abort();
        fetchWithAuth(`${API_URL}/logs/backup/cancel`, {
            method: "POST",
        }).catch(() => {
            // Best-effort cancellation request to backend.
        });
    };

    const handleDownloadBackup = async () => {
        if (isBackupDownloading) {
            return;
        }

        const includeData = backupMode === "include_data";
        const getNowMs = () =>
            typeof window !== "undefined" && typeof window.performance?.now === "function"
                ? window.performance.now()
                : Date.now();
        let latestSpeedLabel = null;
        let sampledLoadedBytes = 0;
        let sampledAtMs = getNowMs();

        const sampleSpeedLabel = (absoluteLoadedBytes) => {
            const normalizedLoadedBytes = Number.isFinite(absoluteLoadedBytes)
                ? Math.max(0, absoluteLoadedBytes)
                : sampledLoadedBytes;
            const nowMs = getNowMs();
            const elapsedSeconds = (nowMs - sampledAtMs) / 1000;

            if (elapsedSeconds < 0.2) {
                return latestSpeedLabel;
            }

            const deltaBytes = Math.max(0, normalizedLoadedBytes - sampledLoadedBytes);
            sampledLoadedBytes = normalizedLoadedBytes;
            sampledAtMs = nowMs;

            const nextLabel = formatDownloadSpeed(deltaBytes / elapsedSeconds);
            if (nextLabel) {
                latestSpeedLabel = nextLabel;
            }

            return latestSpeedLabel;
        };

        try {
            setIsBackupDownloading(true);
            setIsBackupModalOpen(false);
            backupAbortControllerRef.current = new AbortController();
            showDownloadToast({
                status: "info",
                title: "Preparing backup",
                message: includeData
                    ? "Building database dump and packing uploads..."
                    : "Building database structure dump...",
                indeterminate: true,
                speedLabel: null,
            });

            const response = await fetchWithAuth(`${API_URL}/logs/backup`, {
                method: "POST",
                body: JSON.stringify({ includeData }),
                signal: backupAbortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorPayload = await parseApiResponse(response, "Could not generate backup");
                throw new Error(errorPayload.message || "Could not generate backup");
            }

            const backupBlob = await readBlobWithProgress(response, ({ loadedBytes, percent }) => {
                const speedLabel = sampleSpeedLabel(loadedBytes);
                showDownloadToast({
                    status: "info",
                    title: "Downloading backup",
                    message: "Please wait while the backup is downloaded.",
                    progress: typeof percent === "number" ? percent : null,
                    indeterminate: false,
                    speedLabel,
                });
            });

            const suggestedName =
                extractFilenameFromDisposition(response.headers.get("content-disposition")) ||
                buildBackupFallbackName(includeData);

            showDownloadToast({
                status: "info",
                title: "Finalizing in browser",
                message:
                    "Backup is ready. For very large files, the browser can take a few seconds to start the download.",
                progress: 100,
                indeterminate: false,
                speedLabel: null,
            });

            await new Promise((resolve) => {
                window.setTimeout(resolve, 60);
            });

            const downloadUrl = URL.createObjectURL(backupBlob);
            const anchor = document.createElement("a");
            anchor.href = downloadUrl;
            anchor.download = suggestedName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);

            showDownloadToast(
                {
                    status: "success",
                    title: "Backup ready",
                    message: `${suggestedName} downloaded successfully.`,
                    progress: 100,
                    indeterminate: false,
                    speedLabel: null,
                },
                3600,
            );
        } catch (requestError) {
            const wasCancelled =
                requestError?.name === "AbortError" || /aborted|abort/i.test(String(requestError?.message || ""));
            const isNetworkError =
                requestError instanceof TypeError &&
                /failed to fetch|networkerror|load failed/i.test(String(requestError.message || ""));

            showDownloadToast({
                status: wasCancelled ? "info" : "error",
                title: wasCancelled ? "Backup cancelled" : "Backup failed",
                message: wasCancelled
                    ? "Backup generation was cancelled."
                    : isNetworkError
                      ? "Could not connect to API server. Check if backend is running and CORS origin is correct."
                      : requestError.message || "Could not generate database backup",
            });
        } finally {
            setIsBackupDownloading(false);
            backupAbortControllerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            clearDownloadToastTimer();
            backupAbortControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadActions = async () => {
            try {
                const response = await fetchWithAuth(`${API_URL}/logs/actions`, { method: "GET" });
                const payload = await parseApiResponse(response, "Could not load log actions");

                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || "Could not load log actions");
                }

                if (!cancelled) {
                    setActions(Array.isArray(payload.data) ? payload.data : []);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load log actions");
                }
            }
        };

        if (user?.type === "admin") {
            loadActions();
        }

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, user]);

    useEffect(() => {
        let cancelled = false;

        const loadLogsDashboard = async () => {
            if (user?.type !== "admin") {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const logsQuery = buildQueryString({
                    ...baseFilters,
                    dateFrom,
                    dateTo,
                    page,
                    pageSize,
                });

                const todayQuery = buildQueryString({
                    ...baseFilters,
                    page: 1,
                    pageSize: 1000,
                });

                const datesQuery = buildQueryString({
                    ...baseFilters,
                    limit: 14,
                });

                const [logsResponse, todayResponse, datesResponse] = await Promise.all([
                    fetchWithAuth(`${API_URL}/logs${logsQuery ? `?${logsQuery}` : ""}`, { method: "GET" }),
                    fetchWithAuth(`${API_URL}/logs/today${todayQuery ? `?${todayQuery}` : ""}`, { method: "GET" }),
                    fetchWithAuth(`${API_URL}/logs/dates${datesQuery ? `?${datesQuery}` : ""}`, { method: "GET" }),
                ]);

                const [logsPayload, todayPayload, datesPayload] = await Promise.all([
                    parseApiResponse(logsResponse, "Could not load logs"),
                    parseApiResponse(todayResponse, "Could not load today logs"),
                    parseApiResponse(datesResponse, "Could not load log date summary"),
                ]);

                if (!logsResponse.ok || !logsPayload.success) {
                    throw new Error(logsPayload.message || "Could not load logs");
                }

                if (!todayResponse.ok || !todayPayload.success) {
                    throw new Error(todayPayload.message || "Could not load today logs");
                }

                if (!datesResponse.ok || !datesPayload.success) {
                    throw new Error(datesPayload.message || "Could not load log date summary");
                }

                if (cancelled) {
                    return;
                }

                const nextLogs = Array.isArray(logsPayload.data) ? logsPayload.data : [];
                const nextPagination = logsPayload.pagination || {
                    page,
                    pageSize,
                    total: nextLogs.length,
                    totalPages: 1,
                };
                const nextDates = Array.isArray(datesPayload.data) ? datesPayload.data : [];

                const todayTotal = Number(todayPayload.pagination?.total || 0);
                const todayRows = Array.isArray(todayPayload.data) ? todayPayload.data : [];
                const todaySuccess = todayRows.filter(
                    (item) => Number(item.status_code) >= 200 && Number(item.status_code) < 300,
                ).length;
                const todayClientError = todayRows.filter(
                    (item) => Number(item.status_code) >= 400 && Number(item.status_code) < 500,
                ).length;
                const todayServerError = todayRows.filter((item) => Number(item.status_code) >= 500).length;

                setLogs(nextLogs);
                setPagination({
                    page: Number(nextPagination.page || page),
                    pageSize: Number(nextPagination.pageSize || pageSize),
                    total: Number(nextPagination.total || 0),
                    totalPages: Number(nextPagination.totalPages || 1),
                });
                setDateSummary(nextDates);
                setTodaySummary({
                    total: todayTotal,
                    success: todaySuccess,
                    clientError: todayClientError,
                    serverError: todayServerError,
                });
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load logs dashboard");
                    setLogs([]);
                    setDateSummary([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setHasLoadedOnce(true);
                }
            }
        };

        loadLogsDashboard();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, user, baseFilters, dateFrom, dateTo, page, pageSize]);

    const clearFilters = () => {
        setSearch("");
        setActionCode("");
        setStatusGroup("");
        setStatusCode("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const applyTodayRange = () => {
        const today = getSpainDateInputValue();

        if (!today) {
            return;
        }

        setDateFrom(today);
        setDateTo(today);
        setPage(1);
    };

    const applySingleDateRange = (dateValue) => {
        const normalizedDate = normalizeDateInputValue(dateValue);

        if (!normalizedDate) {
            return;
        }

        const isAlreadySelected = dateFrom === normalizedDate && dateTo === normalizedDate;

        if (isAlreadySelected) {
            setDateFrom("");
            setDateTo("");
            setPage(1);
            return;
        }

        setDateFrom(normalizedDate);
        setDateTo(normalizedDate);
        setFiltersOpen(true);
        setPage(1);
    };

    if (user?.type !== "admin") {
        return (
            <section className="tagged-app-page tagged-logs-page">
                <article
                    className="tagged-app-page-card tagged-logs-empty-card tagged-logs-empty-card--restricted"
                    aria-live="polite"
                >
                    <h2>Access restricted</h2>
                    <p>Only administrator accounts are allowed</p>
                    <img className="tagged-logs-empty-icon" src="/icons/logs.svg" alt="" aria-hidden="true" />
                </article>
            </section>
        );
    }

    if (loading && !hasLoadedOnce) {
        return (
            <section className="tagged-app-page tagged-logs-page">
                <article className="tagged-app-page-card tagged-logs-status-card" aria-live="polite">
                    <h2>Loading logs dashboard</h2>
                    <p>Fetching audit history and filters.</p>
                </article>
            </section>
        );
    }

    if (error) {
        return (
            <section className="tagged-app-page tagged-logs-page">
                <article
                    className="tagged-app-page-card tagged-logs-status-card tagged-logs-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Error loading logs</h2>
                    <p>{error}</p>
                </article>
            </section>
        );
    }

    return (
        <section className="tagged-app-page tagged-logs-page">
            <section className="tagged-logs-stats-grid" aria-label="Logs summary cards">
                <LogStatCard
                    tone="violet"
                    label="Today events"
                    value={formatNumber(todaySummary.total)}
                    hint="Events with current filters"
                />
                <LogStatCard
                    tone="teal"
                    label="Today success"
                    value={formatNumber(todaySummary.success)}
                    hint="Successful events"
                />
                <LogStatCard
                    tone="gold"
                    label="Today client errors"
                    value={formatNumber(todaySummary.clientError)}
                    hint="Client-side errors"
                />
                <LogStatCard
                    tone="rose"
                    label="Today server errors"
                    value={formatNumber(todaySummary.serverError)}
                    hint="Server-side errors"
                />
            </section>

            <section className="tagged-logs-panels-grid">
                <article className="tagged-logs-panel tagged-logs-panel--events" aria-label="Logs events">
                    <div className="tagged-logs-panel-header tagged-logs-panel-header--events">
                        <div className="tagged-logs-events-header-left">
                            <h2>Events</h2>
                            <p>
                                {formatNumber(pagination.total)} total · page {formatNumber(pagination.page)} of{" "}
                                {formatNumber(pagination.totalPages)}
                            </p>
                        </div>

                        <div className="tagged-logs-events-header-right">
                            <button
                                type="button"
                                className="tagged-logs-render-button tagged-logs-backup-button"
                                onClick={() => setIsBackupModalOpen(true)}
                                title="Download database backup"
                            >
                                <svg
                                    className="tagged-logs-render-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M12 4v10" />
                                    <path d="m8.5 11.5 3.5 3.5 3.5-3.5" />
                                    <path d="M4 16.5v1.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-1.5" />
                                </svg>
                                <span className="tagged-logs-render-label">Backup</span>
                            </button>

                            <button
                                type="button"
                                className={`tagged-logs-render-button${renderMode === "table" ? " is-active" : ""}`}
                                onClick={() => {
                                    const params = new URLSearchParams(location.search);
                                    params.delete("render");
                                    navigate(`?${params.toString()}`);
                                }}
                                aria-pressed={renderMode === "table"}
                                title="Table view"
                            >
                                <svg
                                    className="tagged-logs-render-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M3 9h18M9 3v18" />
                                </svg>
                                <span className="tagged-logs-render-label">Table</span>
                            </button>

                            <button
                                type="button"
                                className={`tagged-logs-render-button${renderMode === "card" ? " is-active" : ""}`}
                                onClick={() => {
                                    const params = new URLSearchParams(location.search);
                                    params.set("render", "card");
                                    navigate(`?${params.toString()}`);
                                }}
                                aria-pressed={renderMode === "card"}
                                title="Card view"
                            >
                                <svg
                                    className="tagged-logs-render-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="3" y="3" width="8" height="8" rx="1" />
                                    <rect x="13" y="3" width="8" height="8" rx="1" />
                                    <rect x="3" y="13" width="8" height="8" rx="1" />
                                    <rect x="13" y="13" width="8" height="8" rx="1" />
                                </svg>
                                <span className="tagged-logs-render-label">Card</span>
                            </button>
                        </div>
                    </div>

                    <div className="tagged-logs-events-controls">
                        <label className="tagged-logs-field tagged-logs-field--search">
                            <span>Search</span>
                            <div className="tagged-logs-search-input-wrap">
                                <input
                                    type="search"
                                    value={search}
                                    placeholder="Username, Action, Message, Path..."
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setPage(1);
                                    }}
                                />
                                {search.trim().length > 0 ? (
                                    <button
                                        type="button"
                                        className="tagged-logs-search-inline-clear"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            setSearch("");
                                            setPage(1);
                                        }}
                                        aria-label="Clear search"
                                        title="Clear search"
                                    >
                                        <span className="tagged-logs-search-inline-clear-icon" aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>
                        </label>

                        <div className="tagged-logs-events-controls-actions">
                            <button
                                type="button"
                                className={`tagged-logs-filter-toggle${filtersOpen ? " is-active" : ""}`}
                                onClick={() => setFiltersOpen((current) => !current)}
                                aria-expanded={filtersOpen}
                                aria-controls="tagged-logs-advanced-filters"
                                aria-label="Toggle advanced filters"
                            >
                                <svg
                                    className="tagged-logs-events-action-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M3 6h18M6 12h12M10 18h4" />
                                </svg>
                                <span className="tagged-logs-events-action-label">Filters</span>
                                <span className="tagged-logs-filter-toggle-count">{activeFilterCount}</span>
                            </button>
                            <button type="button" onClick={applyTodayRange} aria-label="Apply today filter">
                                <svg
                                    className="tagged-logs-events-action-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="3" y="4" width="18" height="17" rx="2" />
                                    <path d="M8 2.8v3.4M16 2.8v3.4M3 9h18" />
                                </svg>
                                <span className="tagged-logs-events-action-label">Today</span>
                            </button>
                            <button type="button" onClick={clearFilters} aria-label="Clear filters">
                                <svg
                                    className="tagged-logs-events-action-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                                <span className="tagged-logs-events-action-label">Clear</span>
                            </button>
                        </div>
                    </div>

                    {filtersOpen ? (
                        <div className="tagged-logs-events-advanced" id="tagged-logs-advanced-filters">
                            <label className="tagged-logs-field">
                                <span>Action</span>
                                <select
                                    value={actionCode}
                                    onChange={(event) => {
                                        setActionCode(event.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="">All actions</option>
                                    {actions.map((action) => (
                                        <option key={action.id} value={action.actioncode}>
                                            {action.actionname} ({action.actioncode})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="tagged-logs-field">
                                <span>Status Group</span>
                                <select
                                    value={statusGroup}
                                    onChange={(event) => {
                                        setStatusGroup(event.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="">All groups</option>
                                    <option value="success">2xx Success</option>
                                    <option value="client_error">4xx Client error</option>
                                    <option value="server_error">5xx Server error</option>
                                </select>
                            </label>

                            <label className="tagged-logs-field">
                                <span>Date from</span>
                                <div className="tagged-logs-date-input-wrap">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(event) => {
                                            setDateFrom(event.target.value);
                                            setPage(1);
                                        }}
                                    />
                                    <span className="tagged-logs-date-input-icon" aria-hidden="true" />
                                </div>
                            </label>

                            <label className="tagged-logs-field">
                                <span>Date to</span>
                                <div className="tagged-logs-date-input-wrap">
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(event) => {
                                            setDateTo(event.target.value);
                                            setPage(1);
                                        }}
                                    />
                                    <span className="tagged-logs-date-input-icon" aria-hidden="true" />
                                </div>
                            </label>

                            <label className="tagged-logs-field">
                                <span>Status Code</span>
                                <input
                                    type="number"
                                    min="100"
                                    max="599"
                                    value={statusCode}
                                    placeholder="e.g. 401"
                                    onChange={(event) => {
                                        setStatusCode(event.target.value);
                                        setPage(1);
                                    }}
                                />
                            </label>
                        </div>
                    ) : null}

                    {renderMode === "table" ? (
                        <div className="tagged-logs-table-wrap">
                            <table className="tagged-logs-table">
                                <colgroup>
                                    <col className="tagged-logs-col-date" />
                                    <col className="tagged-logs-col-action" />
                                    <col className="tagged-logs-col-user" />
                                    <col className="tagged-logs-col-status" />
                                    <col className="tagged-logs-col-method" />
                                    <col className="tagged-logs-col-path" />
                                    <col className="tagged-logs-col-message" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Action</th>
                                        <th>User</th>
                                        <th>Status</th>
                                        <th>Method</th>
                                        <th>Path</th>
                                        <th>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="tagged-logs-table-empty">
                                                No logs match the active filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((entry) => {
                                            const tone = getStatusTone(entry.status_code);
                                            const hasMetadata = Boolean(entry.metadata);
                                            const isExpanded = expandedRowId === entry.id;
                                            const dateParts = formatDateParts(entry.date);

                                            return (
                                                <Fragment key={entry.id}>
                                                    <tr
                                                        className={`tagged-logs-row tagged-logs-row--${tone}${isExpanded ? " is-expanded" : ""}`}
                                                        onClick={() => {
                                                            if (!hasMetadata) {
                                                                return;
                                                            }

                                                            setExpandedRowId((current) =>
                                                                current === entry.id ? null : entry.id,
                                                            );
                                                        }}
                                                    >
                                                        <td className="tagged-logs-date-cell">
                                                            <strong>{dateParts.date}</strong>
                                                            <span>{dateParts.time}</span>
                                                        </td>
                                                        <td>
                                                            <div className="tagged-logs-action-cell">
                                                                <strong>
                                                                    {entry.actionname ||
                                                                        entry.action_code ||
                                                                        "Unknown action"}
                                                                </strong>
                                                                <span>{entry.action_code || "-"}</span>
                                                            </div>
                                                        </td>
                                                        <td>{entry.username || `User #${entry.userid || "-"}`}</td>
                                                        <td>
                                                            <span
                                                                className={`tagged-logs-status tagged-logs-status--${tone}`}
                                                            >
                                                                {entry.status_code}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="tagged-logs-method">
                                                                {entry.request_method || "-"}
                                                            </span>
                                                        </td>
                                                        <td
                                                            className="tagged-logs-path"
                                                            title={entry.request_path || ""}
                                                        >
                                                            {entry.request_path || "-"}
                                                        </td>
                                                        <td className="tagged-logs-message" title={entry.message || ""}>
                                                            {renderMessageWithHighlightedPaths(entry.message, "-")}
                                                        </td>
                                                    </tr>

                                                    {hasMetadata && isExpanded ? (
                                                        <tr className="tagged-logs-metadata-row">
                                                            <td colSpan={7}>
                                                                <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="tagged-logs-cards-grid" aria-live="polite">
                            {logs.length === 0 ? (
                                <p className="tagged-logs-panel-empty">No logs match the active filters.</p>
                            ) : (
                                logs.map((entry) => {
                                    const tone = getStatusTone(entry.status_code);
                                    const dateParts = formatDateParts(entry.date);

                                    return (
                                        <article
                                            key={entry.id}
                                            className={`tagged-logs-event-card tagged-logs-event-card--${tone}`}
                                        >
                                            <div className="tagged-logs-event-card-head">
                                                <strong>
                                                    {entry.actionname || entry.action_code || "Unknown action"}
                                                </strong>
                                                <span className={`tagged-logs-status tagged-logs-status--${tone}`}>
                                                    {entry.status_code}
                                                </span>
                                            </div>
                                            <p className="tagged-logs-event-card-meta">
                                                <span className="tagged-logs-event-card-date-user">
                                                    {dateParts.date} ·{" "}
                                                    {entry.username || `User #${entry.userid || "-"}`}
                                                </span>
                                                <span className="tagged-logs-event-card-time">{dateParts.time}</span>
                                            </p>
                                            <p className="tagged-logs-event-card-message">
                                                {renderMessageWithHighlightedPaths(entry.message, "No message")}
                                            </p>
                                            <div className="tagged-logs-event-card-foot">
                                                <span>{entry.action_code || "-"}</span>
                                                <span>{entry.request_method || "-"}</span>
                                            </div>
                                        </article>
                                    );
                                })
                            )}
                        </div>
                    )}

                    <div className="tagged-logs-pagination">
                        <div className="tagged-logs-page-size">
                            <label htmlFor="tagged-logs-page-size">Rows</label>
                            <select
                                id="tagged-logs-page-size"
                                value={pageSize}
                                onChange={(event) => {
                                    setPageSize(Number(event.target.value));
                                    setPage(1);
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                            </select>
                        </div>

                        <div className="tagged-logs-pagination__nav">
                            <button
                                type="button"
                                className="tagged-logs-pagination__btn tagged-logs-pagination__btn--icon"
                                onClick={() => setPage(1)}
                                disabled={page <= 1}
                                aria-label="First page"
                                title="First page"
                            >
                                <span
                                    className="tagged-logs-pagination__double-icon tagged-logs-pagination__double-icon--first"
                                    aria-hidden="true"
                                >
                                    <span className="tagged-logs-pagination__double-icon-arrow tagged-logs-pagination__double-icon-arrow--back" />
                                </span>
                            </button>
                            <button
                                type="button"
                                className="tagged-logs-pagination__btn tagged-logs-pagination__btn--icon"
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                disabled={page <= 1}
                                aria-label="Previous page"
                                title="Previous page"
                            >
                                <span
                                    className="tagged-logs-pagination__icon tagged-logs-pagination__icon--back"
                                    aria-hidden="true"
                                />
                            </button>

                            {(() => {
                                const visibleCount = Math.min(3, totalPages);
                                let startPage = Math.max(1, page - 1);
                                let endPage = startPage + visibleCount - 1;

                                if (endPage > totalPages) {
                                    endPage = totalPages;
                                    startPage = Math.max(1, endPage - visibleCount + 1);
                                }

                                const pages = Array.from(
                                    { length: endPage - startPage + 1 },
                                    (_, index) => startPage + index,
                                );

                                return pages.map((pageNumber) => (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        className={`tagged-logs-pagination__btn${pageNumber === page ? " tagged-logs-pagination__btn--active" : ""}`}
                                        onClick={() => setPage(pageNumber)}
                                        aria-current={pageNumber === page ? "page" : undefined}
                                    >
                                        {pageNumber}
                                    </button>
                                ));
                            })()}

                            <button
                                type="button"
                                className="tagged-logs-pagination__btn tagged-logs-pagination__btn--icon"
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                disabled={page >= totalPages}
                                aria-label="Next page"
                                title="Next page"
                            >
                                <span
                                    className="tagged-logs-pagination__icon tagged-logs-pagination__icon--forward"
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                className="tagged-logs-pagination__btn tagged-logs-pagination__btn--icon"
                                onClick={() => setPage(totalPages)}
                                disabled={page >= totalPages}
                                aria-label="Last page"
                                title="Last page"
                            >
                                <span
                                    className="tagged-logs-pagination__double-icon tagged-logs-pagination__double-icon--last"
                                    aria-hidden="true"
                                >
                                    <span className="tagged-logs-pagination__double-icon-arrow tagged-logs-pagination__double-icon-arrow--forward" />
                                </span>
                            </button>

                            <span className="tagged-logs-pagination__count">
                                {formatNumber(page)} / {formatNumber(totalPages)}
                            </span>
                        </div>
                    </div>
                </article>

                <article className="tagged-logs-panel tagged-logs-panel--dates" aria-label="Recent log dates summary">
                    <div className="tagged-logs-panel-header">
                        <h2>Recent dates</h2>
                        <p>Last 14 days with activity under current filters.</p>
                    </div>

                    <div className="tagged-logs-date-list">
                        {dateSummary.length === 0 ? (
                            <p className="tagged-logs-panel-empty">No date summary available for current filters.</p>
                        ) : (
                            dateSummary.map((row) => {
                                const normalizedRowDate = normalizeDateInputValue(row.log_date);
                                const isActive =
                                    Boolean(normalizedRowDate) &&
                                    dateFrom === normalizedRowDate &&
                                    dateTo === normalizedRowDate;

                                return (
                                    <button
                                        key={row.log_date}
                                        type="button"
                                        className={`tagged-logs-date-item${isActive ? " is-active" : ""}`}
                                        onClick={() => applySingleDateRange(row.log_date)}
                                        title={`Filter events by ${formatDateOnly(row.log_date)}`}
                                    >
                                        <div className="tagged-logs-date-item-head">
                                            <strong>{formatDateOnly(row.log_date)}</strong>
                                            <span>{formatNumber(row.total_logs)} total</span>
                                        </div>
                                        <div className="tagged-logs-date-bars" aria-label="Status breakdown">
                                            <span className="tagged-logs-dot tagged-logs-dot--success">
                                                2xx · {formatNumber(row.success_logs)}
                                            </span>
                                            <span className="tagged-logs-dot tagged-logs-dot--warning">
                                                4xx · {formatNumber(row.client_error_logs)}
                                            </span>
                                            <span className="tagged-logs-dot tagged-logs-dot--error">
                                                5xx · {formatNumber(row.server_error_logs)}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </article>
            </section>

            {downloadToast ? (
                <aside
                    className={`tagged-logs-download-toast tagged-logs-download-toast--${downloadToast.status || "info"}`}
                    role="status"
                    aria-live="polite"
                >
                    <header className="tagged-logs-download-toast-header">
                        <strong>{downloadToast.title || "Backup download"}</strong>
                        <button
                            type="button"
                            className="tagged-logs-download-toast-close"
                            onClick={hideDownloadToast}
                            aria-label="Close backup download status"
                        >
                            <span aria-hidden="true">x</span>
                        </button>
                    </header>
                    <p>{downloadToast.message}</p>
                    {typeof downloadToast.progress === "number" ||
                    downloadToast.indeterminate ||
                    downloadToast.speedLabel ? (
                        <>
                            <div
                                className={`tagged-logs-download-toast-progress${downloadToast.indeterminate ? " is-indeterminate" : ""}`}
                                aria-hidden="true"
                            >
                                <span
                                    style={
                                        downloadToast.indeterminate
                                            ? undefined
                                            : { width: `${Math.max(0, Math.min(100, downloadToast.progress || 0))}%` }
                                    }
                                />
                            </div>
                            {typeof downloadToast.progress === "number" ||
                            downloadToast.indeterminate ||
                            downloadToast.speedLabel ? (
                                <div className="tagged-logs-download-toast-meta">
                                    <small className="tagged-logs-download-toast-percent">
                                        {downloadToast.indeterminate
                                            ? "Preparing..."
                                            : typeof downloadToast.progress === "number"
                                              ? `${Math.round(downloadToast.progress || 0)}%`
                                              : ""}
                                    </small>
                                    {downloadToast.indeterminate && isBackupDownloading ? (
                                        <button
                                            type="button"
                                            className="tagged-logs-download-toast-cancel"
                                            onClick={cancelBackupDownload}
                                        >
                                            Cancel
                                        </button>
                                    ) : (
                                        <small className="tagged-logs-download-toast-speed">
                                            {downloadToast.speedLabel || ""}
                                        </small>
                                    )}
                                </div>
                            ) : null}
                        </>
                    ) : null}
                </aside>
            ) : null}

            {isBackupModalOpen ? (
                <div
                    className="tagged-logs-backup-modal"
                    role="presentation"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closeBackupModal();
                        }
                    }}
                >
                    <article className="tagged-logs-backup-modal-card" role="dialog" aria-modal="true">
                        <header className="tagged-logs-backup-modal-header">
                            <h3>Download backup</h3>
                            <p>Choose what should be included in the generated backup package.</p>
                        </header>

                        <div className="tagged-logs-backup-options" role="radiogroup" aria-label="Backup options">
                            <label className="tagged-logs-backup-option">
                                <input
                                    type="radio"
                                    name="tagged-backup-mode"
                                    value="structure_only"
                                    checked={backupMode === "structure_only"}
                                    onChange={(event) => setBackupMode(event.target.value)}
                                    disabled={isBackupDownloading}
                                />
                                <span>
                                    <strong>Just DB structure</strong>
                                    <small>ZIP with `dump.sql` including only database structure.</small>
                                </span>
                            </label>

                            <label className="tagged-logs-backup-option">
                                <input
                                    type="radio"
                                    name="tagged-backup-mode"
                                    value="include_data"
                                    checked={backupMode === "include_data"}
                                    onChange={(event) => setBackupMode(event.target.value)}
                                    disabled={isBackupDownloading}
                                />
                                <span>
                                    <strong>Include data</strong>
                                    <small>ZIP with `dump.sql` (structure + INSERTS) and `uploads` folder copy.</small>
                                </span>
                            </label>
                        </div>

                        <footer className="tagged-logs-backup-modal-actions">
                            <button
                                type="button"
                                className="tagged-logs-backup-cancel-button"
                                onClick={closeBackupModal}
                                disabled={isBackupDownloading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tagged-logs-backup-confirm-button"
                                onClick={handleDownloadBackup}
                                disabled={isBackupDownloading}
                            >
                                {isBackupDownloading ? "Preparing..." : "Download backup"}
                            </button>
                        </footer>
                    </article>
                </div>
            ) : null}
        </section>
    );
};
