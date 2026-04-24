import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTagFilter } from "../../context/TagFilterContext";
import { useGridView } from "../../context/GridViewContext";
import "./Sidebar.css";

const OPEN_UPLOAD_EVENT = "tagged:open-upload";
const GENERAL_FILTER_COMMAND_EVENT = "tagged:general-filter-command";
const GENERAL_FILTER_STATE_EVENT = "tagged:general-filter-state";
const MEDIA_DETAIL_AUTOPLAY_EVENT = "tagged:media-detail-autoplay";
const MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY = "tagged.mediaDetail.autoplay";

const navItems = [
    {
        label: "Gallery",
        path: "/gallery",
        icon: "/icons/gallery.svg",
    },
    {
        label: "Favourites",
        path: "/favourites",
        icon: "/icons/favourites.svg",
    },
    {
        label: "Albums",
        path: "/albums",
        icon: "/icons/album.svg",
    },
    {
        label: "Metadata",
        path: "/metadata",
        icon: "/icons/logs.svg",
    },
    {
        label: "Dashboard",
        path: "/dashboard",
        icon: "/icons/metrics.svg",
    },
];

const adminNavItems = [
    {
        label: "Logs",
        path: "/logs",
        icon: "/icons/logs.svg",
    },
    {
        label: "Users",
        path: "/users",
        icon: "/icons/users.svg",
    },
];

const bottomItems = [
    {
        label: "Account",
        path: "/account",
        icon: "/icons/account.svg",
        type: "link",
    },
    {
        label: "Sign out",
        icon: "/icons/sign_out.svg",
        type: "action",
    },
];

export const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");
    const [isThemeAnimating, setIsThemeAnimating] = useState(false);
    const [allTagNames, setAllTagNames] = useState([]);
    const [tagPanelSearch, setTagPanelSearch] = useState("");
    const [generalMediaTypeFilter, setGeneralMediaTypeFilter] = useState("all");
    const [mediaDetailAutoplay, setMediaDetailAutoplay] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }
        return window.localStorage.getItem(MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY) === "true";
    });
    const navigate = useNavigate();
    const location = useLocation();
    const isMediaDetailView = Boolean(useMatch("/gallery/:mediaId"));
    const isMetadataView = Boolean(useMatch("/metadata"));
    const isDashboardView = Boolean(useMatch("/dashboard"));
    const isLegacyTagsView = Boolean(useMatch("/tags"));
    const isTagsView = isMetadataView || isLegacyTagsView;
    const isAlbumsView = Boolean(useMatch("/albums"));
    const isAlbumDetailView = Boolean(useMatch("/albums/:albumId"));
    const isGalleryView = location.pathname.startsWith("/gallery");
    const isFavouritesView = location.pathname.startsWith("/favourites");
    const isUploadDisabled = isMediaDetailView || isTagsView || isAlbumsView || isAlbumDetailView;
    const shouldShowTagPanel = !isMetadataView && !isLegacyTagsView && !isDashboardView;
    const shouldShowGeneralFilters = !isMediaDetailView && (isGalleryView || isFavouritesView || isAlbumDetailView);
    const isUsersView = location.pathname.startsWith("/users");
    const { user, logout, fetchWithAuth } = useAuth();
    const {
        selectedIncludeFilterTags,
        selectedExcludeFilterTags,
        toggleIncludeFilterTag,
        toggleExcludeFilterTag,
        clearFilterTags,
    } = useTagFilter();
    const { gridViewMode } = useGridView();
    const activeTagFiltersCount = selectedIncludeFilterTags.length + selectedExcludeFilterTags.length;
    const sectionOneNavItems = user?.type === "admin" ? adminNavItems : navItems;
    const adminRoleFilter = useMemo(() => {
        if (!isUsersView) {
            return "all";
        }

        const params = new URLSearchParams(location.search);
        const role = String(params.get("role") || "").toLowerCase();

        if (role === "admin" || role === "basic") {
            return role;
        }

        return "all";
    }, [isUsersView, location.search]);

    useEffect(() => {
        if (!user || user.type === "admin") {
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
        let cancelled = false;

        fetchWithAuth(`${API_URL}/tags/names`, { method: "GET" })
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled && data.success && Array.isArray(data.data)) {
                    setAllTagNames(data.data.filter(Boolean).sort((a, b) => a.localeCompare(b)));
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [user, fetchWithAuth]);

    const filteredTagNames = useMemo(() => {
        const q = tagPanelSearch.trim().toLowerCase();
        if (!q) return allTagNames;
        return allTagNames.filter((name) => name.toLowerCase().includes(q));
    }, [allTagNames, tagPanelSearch]);

    useEffect(() => {
        if (isMediaDetailView) {
            setIsOpen(false);
        }
    }, [isMediaDetailView]);

    useEffect(() => {
        const handleGeneralFilterState = (event) => {
            const detail = event?.detail || {};

            setGeneralMediaTypeFilter(detail.mediaTypeFilter || "all");
        };

        window.addEventListener(GENERAL_FILTER_STATE_EVENT, handleGeneralFilterState);

        return () => {
            window.removeEventListener(GENERAL_FILTER_STATE_EVENT, handleGeneralFilterState);
        };
    }, []);

    const handleOpenUploadModal = () => {
        window.dispatchEvent(new Event(OPEN_UPLOAD_EVENT));
        setIsOpen(false);
    };

    const handleToggleGeneralMediaType = (type) => {
        if (!shouldShowGeneralFilters) {
            return;
        }
        window.dispatchEvent(
            new CustomEvent(GENERAL_FILTER_COMMAND_EVENT, {
                detail: {
                    type: "toggle-media-type",
                    mediaType: type,
                },
            }),
        );
    };

    const handleAdminRoleFilter = (role) => {
        if (user?.type !== "admin") {
            return;
        }

        const normalizedRole = role === "admin" || role === "basic" ? role : "all";
        const nextRole = adminRoleFilter === normalizedRole ? "all" : normalizedRole;
        const params = new URLSearchParams(location.search);

        if (nextRole === "all") {
            params.delete("role");
        } else {
            params.set("role", nextRole);
        }

        navigate({
            pathname: "/users",
            search: params.toString() ? `?${params.toString()}` : "",
        });
        setIsOpen(false);
    };

    const handleSignOut = async () => {
        await logout();
        setIsOpen(false);
        navigate("/", { replace: true });
    };

    const closeMobileSidebar = () => setIsOpen(false);

    const handleThemeToggle = () => {
        const next = isDark ? "light" : "dark";
        const applyTheme = () => {
            document.documentElement.setAttribute("data-theme", next);
            localStorage.setItem("tagged:theme", next);
            setIsDark(next === "dark");
        };

        setIsThemeAnimating(true);
        applyTheme();

        window.setTimeout(() => {
            setIsThemeAnimating(false);
        }, 220);
    };

    const handleToggleMediaDetailAutoplay = () => {
        const next = !mediaDetailAutoplay;
        setMediaDetailAutoplay(next);
        window.localStorage.setItem(MEDIA_DETAIL_AUTOPLAY_STORAGE_KEY, next ? "true" : "false");
        window.dispatchEvent(
            new CustomEvent(MEDIA_DETAIL_AUTOPLAY_EVENT, {
                detail: { enabled: next },
            }),
        );
    };

    return (
        <>
            <button
                className="tagged-sidebar-menu-toggle"
                type="button"
                aria-expanded={isOpen}
                aria-controls="tagged-sidebar"
                aria-label="Open navigation menu"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span />
                <span />
                <span />
            </button>

            <div
                className={`tagged-sidebar-overlay${isOpen ? " is-visible" : ""}`}
                onClick={closeMobileSidebar}
                aria-hidden={!isOpen}
            />

            <aside
                id="tagged-sidebar"
                className={`tagged-sidebar${user?.type === "admin" ? " tagged-sidebar--admin" : " tagged-sidebar--user"}${isOpen ? " is-open" : ""}`}
            >
                <nav className="tagged-sidebar-nav" aria-label="Main navigation">
                    {user?.type === "admin" ? <p className="tagged-sidebar-admin-panel-label">ADMIN PANEL</p> : null}

                    <ul className="tagged-sidebar-section">
                        {user?.type !== "admin" ? (
                            <li>
                                <button
                                    className={`tagged-sidebar-upload${isUploadDisabled ? " is-disabled" : ""}`}
                                    type="button"
                                    onClick={handleOpenUploadModal}
                                    disabled={isUploadDisabled}
                                    aria-disabled={isUploadDisabled}
                                    title={isUploadDisabled ? "Upload unavailable on this page" : "Upload media"}
                                >
                                    <img src="/icons/upload.svg" alt="" aria-hidden="true" />
                                    <span>Upload</span>
                                </button>
                            </li>
                        ) : null}

                        {sectionOneNavItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => `tagged-sidebar-link${isActive ? " is-active" : ""}`}
                                    onClick={closeMobileSidebar}
                                >
                                    <span
                                        className="tagged-sidebar-icon"
                                        style={{ "--sidebar-icon": `url(${item.icon})` }}
                                        aria-hidden="true"
                                    />
                                    <span>{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    {user?.type !== "admin" && shouldShowTagPanel && allTagNames.length > 0 ? (
                        <div className="tagged-sidebar-tag-panel">
                            <div className="tagged-sidebar-tag-panel-header">
                                <div className="tagged-sidebar-tag-panel-header-main">
                                    <span className="tagged-sidebar-tag-panel-title">Filter by tags</span>
                                    {activeTagFiltersCount > 0 ? (
                                        <button
                                            type="button"
                                            className="tagged-sidebar-clear-button"
                                            onClick={clearFilterTags}
                                        >
                                            Clear ({activeTagFiltersCount})
                                        </button>
                                    ) : null}
                                </div>

                            </div>

                            <input
                                type="text"
                                inputMode="search"
                                enterKeyHint="search"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className="tagged-sidebar-tag-panel-search"
                                value={tagPanelSearch}
                                onChange={(event) => setTagPanelSearch(event.target.value)}
                                placeholder="Search tags..."
                                aria-label="Search tags to filter"
                            />

                            <ul className="tagged-sidebar-tag-list" aria-label="Tag filters">
                                {filteredTagNames.map((tagName) => {
                                    const isIncluded = selectedIncludeFilterTags.some(
                                        (t) => t.toLowerCase() === tagName.toLowerCase(),
                                    );
                                    const isExcluded = selectedExcludeFilterTags.some(
                                        (t) => t.toLowerCase() === tagName.toLowerCase(),
                                    );

                                    return (
                                        <li key={tagName}>
                                            <div
                                                className={`tagged-sidebar-tag-item${isIncluded ? " is-included" : ""}${isExcluded ? " is-excluded" : ""}`}
                                            >
                                                <div
                                                    className="tagged-sidebar-tag-item-label-wrap"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => toggleIncludeFilterTag(tagName)}
                                                    onKeyDown={(e) =>
                                                        e.key === "Enter" || e.key === " "
                                                            ? toggleIncludeFilterTag(tagName)
                                                            : undefined
                                                    }
                                                    aria-pressed={isIncluded}
                                                    title={`Include tag ${tagName}`}
                                                >
                                                    <span className="tagged-sidebar-tag-item-label">{tagName}</span>
                                                </div>

                                                <div
                                                    className="tagged-sidebar-tag-item-actions"
                                                    aria-label={`Filter ${tagName}`}
                                                >
                                                    <button
                                                        type="button"
                                                        className={`tagged-sidebar-tag-item-action tagged-sidebar-tag-item-action--include${isIncluded ? " is-active" : ""}`}
                                                        onClick={() => toggleIncludeFilterTag(tagName)}
                                                        aria-pressed={isIncluded}
                                                        title={`Include tag ${tagName}`}
                                                    >
                                                        +
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={`tagged-sidebar-tag-item-action tagged-sidebar-tag-item-action--exclude${isExcluded ? " is-active" : ""}`}
                                                        onClick={() => toggleExcludeFilterTag(tagName)}
                                                        aria-pressed={isExcluded}
                                                        title={`Exclude tag ${tagName}`}
                                                    >
                                                        -
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ) : null}

                    {user?.type !== "admin" && shouldShowGeneralFilters ? (
                        <section className="tagged-sidebar-general-filters" aria-label="General media filters">
                            <div className="tagged-sidebar-general-filters-header">
                                <span className="tagged-sidebar-general-filters-title">General filters</span>
                            </div>

                            <div className="tagged-sidebar-general-filters-segmented" role="group" aria-label="Media type filters">
                                <button
                                    type="button"
                                    className={`tagged-sidebar-segmented-filter${generalMediaTypeFilter === "all" ? " is-active" : ""}`}
                                    onClick={() => handleToggleGeneralMediaType("all")}
                                    aria-pressed={generalMediaTypeFilter === "all"}
                                    aria-label="Show all media"
                                    title="All media"
                                >
                                    <img src="/icons/gallery.svg" alt="" aria-hidden="true" />
                                </button>

                                <button
                                    type="button"
                                    className={`tagged-sidebar-segmented-filter${generalMediaTypeFilter === "image" ? " is-active" : ""}`}
                                    onClick={() => handleToggleGeneralMediaType("image")}
                                    aria-pressed={generalMediaTypeFilter === "image"}
                                    aria-label="Filter only images"
                                    title="Images"
                                >
                                    <img src="/icons/image.svg" alt="" aria-hidden="true" />
                                </button>

                                <button
                                    type="button"
                                    className={`tagged-sidebar-segmented-filter${generalMediaTypeFilter === "video" ? " is-active" : ""}`}
                                    onClick={() => handleToggleGeneralMediaType("video")}
                                    aria-pressed={generalMediaTypeFilter === "video"}
                                    aria-label="Filter only videos and GIFs"
                                    title="Videos and GIFs"
                                >
                                    <img src="/icons/video.svg" alt="" aria-hidden="true" />
                                </button>
                            </div>
                        </section>
                    ) : null}

                    {user?.type === "admin" && isUsersView ? (
                        <section className="tagged-sidebar-general-filters" aria-label="General user filters">
                            <div className="tagged-sidebar-general-filters-header">
                                <span className="tagged-sidebar-general-filters-title">General filters</span>
                            </div>

                            <div className="tagged-sidebar-general-filters-actions tagged-sidebar-general-filters-actions--two">
                                <button
                                    type="button"
                                    className={`tagged-sidebar-general-filter-button${adminRoleFilter === "basic" ? " is-active" : ""}`}
                                    onClick={() => handleAdminRoleFilter("basic")}
                                    aria-pressed={adminRoleFilter === "basic"}
                                    aria-label="Filter only basic users"
                                    title="Show only basic users"
                                >
                                    <span>Basic</span>
                                </button>

                                <button
                                    type="button"
                                    className={`tagged-sidebar-general-filter-button${adminRoleFilter === "admin" ? " is-active" : ""}`}
                                    onClick={() => handleAdminRoleFilter("admin")}
                                    aria-pressed={adminRoleFilter === "admin"}
                                    aria-label="Filter only admin users"
                                    title="Show only admin users"
                                >
                                    <span>Admin</span>
                                </button>
                            </div>
                        </section>
                    ) : null}

                    {user?.type !== "admin" && isMediaDetailView ? (
                        <section className="tagged-sidebar-general-filters" aria-label="Media detail options">
                            <div className="tagged-sidebar-general-filters-header tagged-sidebar-media-detail-header">
                                <span className="tagged-sidebar-general-filters-title">Media detail</span>
                                <button
                                    type="button"
                                    className={`tagged-sidebar-media-detail-toggle${mediaDetailAutoplay ? " is-active" : ""}`}
                                    onClick={handleToggleMediaDetailAutoplay}
                                    role="switch"
                                    aria-checked={mediaDetailAutoplay}
                                    aria-label={`Autoplay ${mediaDetailAutoplay ? "enabled" : "disabled"}`}
                                    title={`Autoplay ${mediaDetailAutoplay ? "enabled" : "disabled"}`}
                                >
                                    <span className="tagged-sidebar-media-detail-toggle-track" aria-hidden="true">
                                        <span className="tagged-sidebar-media-detail-toggle-thumb" />
                                    </span>
                                </button>
                            </div>
                        </section>
                    ) : null}

                    <div className="tagged-sidebar-theme-row">
                        <button
                            type="button"
                            className={`tagged-sidebar-theme-toggle${isDark ? " is-dark" : ""}${isThemeAnimating ? " is-animating" : ""}`}
                            onClick={handleThemeToggle}
                            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                        >
                            <img
                                src={isDark ? "/icons/moon.svg" : "/icons/sun.svg"}
                                alt=""
                                aria-hidden="true"
                                className="tagged-sidebar-theme-toggle-icon"
                            />
                            <span className="tagged-sidebar-theme-toggle-label">
                                {isDark ? "Dark Mode" : "Light Mode"}
                            </span>
                        </button>
                    </div>

                    <ul className="tagged-sidebar-section tagged-sidebar-section-bottom">
                        {bottomItems.map((item) => (
                            <li key={item.type === "action" ? item.label : item.path}>
                                {item.type === "action" ? (
                                    <button className="tagged-sidebar-signout" type="button" onClick={handleSignOut}>
                                        <img src={item.icon} alt="" aria-hidden="true" />
                                        <span>{item.label}</span>
                                    </button>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `tagged-sidebar-link${isActive ? " is-active" : ""}`
                                        }
                                        onClick={closeMobileSidebar}
                                    >
                                        <span
                                            className="tagged-sidebar-icon"
                                            style={{ "--sidebar-icon": `url(${item.icon})` }}
                                            aria-hidden="true"
                                        />
                                        <span>{item.label}</span>
                                    </NavLink>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>
    );
};
