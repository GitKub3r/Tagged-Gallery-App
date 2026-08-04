import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faAnglesLeft,
    faAnglesRight,
    faBars,
    faChartColumn,
    faCloudArrowUp,
    faFilm,
    faFolderOpen,
    faHeart,
    faImage,
    faImages,
    faListCheck,
    faMinus,
    faMoon,
    faPlus,
    faRightFromBracket,
    faScroll,
    faSearch,
    faSun,
    faTableCellsLarge,
    faTags,
    faUser,
    faUsers,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { NavLink, useLocation, useMatch, useNavigate } from "react-router-dom";
import { sidebarApi } from "../../api/sidebarApi";
import { useAuth } from "../../hooks/useAuth";
import { useTagFilter } from "../../context/TagFilterContext";

const OPEN_UPLOAD_EVENT = "tagged:open-upload";
const GENERAL_FILTER_COMMAND_EVENT = "tagged:general-filter-command";
const GENERAL_FILTER_STATE_EVENT = "tagged:general-filter-state";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "tagged:sidebar-collapsed";

const navItems = [
    { label: "Gallery", path: "/gallery", icon: faImages },
    { label: "Favourites", path: "/favourites", icon: faHeart },
    { label: "Albums", path: "/albums", icon: faFolderOpen },
    { label: "Metadata", path: "/metadata", icon: faTags },
    { label: "Dashboard", path: "/dashboard", icon: faChartColumn },
];

const adminNavItems = [
    { label: "Logs", path: "/logs", icon: faScroll },
    { label: "Actions", path: "/actions", icon: faListCheck },
    { label: "Users", path: "/users", icon: faUsers },
];

const navItemClassName = (isActive, isCollapsed) =>
    [
        "group flex h-11 items-center rounded-xl border text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500",
        isCollapsed ? "xl:mx-auto xl:w-11 xl:justify-center xl:px-0" : "px-3",
        isActive
            ? "border-neutral-800 bg-neutral-900 text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            : "border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
    ].join(" ");

const SidebarLabel = ({ children, isCollapsed }) => (
    <span className={`ml-3 truncate ${isCollapsed ? "xl:hidden" : ""}`}>{children}</span>
);

export const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true",
    );
    const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute("data-theme") !== "light");
    const [tagPanelSearch, setTagPanelSearch] = useState("");
    const [generalMediaTypeFilter, setGeneralMediaTypeFilter] = useState("all");
    const navigate = useNavigate();
    const location = useLocation();
    const isMediaDetailView = Boolean(useMatch("/gallery/:mediaId"));
    const isMetadataView = Boolean(useMatch("/metadata"));
    const isDashboardView = Boolean(useMatch("/dashboard"));
    const isLegacyTagsView = Boolean(useMatch("/tags"));
    const isAlbumsView = Boolean(useMatch("/albums"));
    const isAlbumDetailView = Boolean(useMatch("/albums/:albumId"));
    const isGalleryView = location.pathname.startsWith("/gallery");
    const isFavouritesView = location.pathname.startsWith("/favourites");
    const isUsersView = location.pathname.startsWith("/users");
    const isTagsView = isMetadataView || isLegacyTagsView;
    const isUploadDisabled = isMediaDetailView || isTagsView || isAlbumsView || isAlbumDetailView || isDashboardView;
    const shouldShowTagPanel = !isMetadataView && !isLegacyTagsView && !isDashboardView;
    const shouldShowGeneralFilters = !isMediaDetailView && (isGalleryView || isFavouritesView || isAlbumDetailView);
    const { user, logout, accessToken } = useAuth();
    const {
        selectedIncludeFilterTags,
        selectedExcludeFilterTags,
        toggleIncludeFilterTag,
        toggleExcludeFilterTag,
        clearFilterTags,
    } = useTagFilter();
    const activeTagFiltersCount = selectedIncludeFilterTags.length + selectedExcludeFilterTags.length;
    const sectionOneNavItems = user?.type === "admin" ? adminNavItems : navItems;

    const { data: allTagNames = [] } = useQuery({
        queryKey: ["tags", "names"],
        queryFn: () => sidebarApi.getTagNames(accessToken),
        enabled: Boolean(user && user.type !== "admin" && shouldShowTagPanel && accessToken),
        staleTime: 5 * 60 * 1000,
    });

    const filteredTagNames = useMemo(() => {
        const query = tagPanelSearch.trim().toLowerCase();
        return query ? allTagNames.filter((name) => name.toLowerCase().includes(query)) : allTagNames;
    }, [allTagNames, tagPanelSearch]);

    const adminRoleFilter = useMemo(() => {
        if (!isUsersView) return "all";
        const role = String(new URLSearchParams(location.search).get("role") || "").toLowerCase();
        return role === "admin" || role === "basic" ? role : "all";
    }, [isUsersView, location.search]);

    useEffect(() => {
        const handleGeneralFilterState = (event) => {
            setGeneralMediaTypeFilter(event?.detail?.mediaTypeFilter || "all");
        };
        window.addEventListener(GENERAL_FILTER_STATE_EVENT, handleGeneralFilterState);
        return () => window.removeEventListener(GENERAL_FILTER_STATE_EVENT, handleGeneralFilterState);
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const closeMobileSidebar = () => setIsOpen(false);

    const handleCollapseToggle = () => {
        setIsCollapsed((current) => {
            const next = !current;
            localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
            return next;
        });
    };

    const handleOpenUploadModal = () => {
        window.dispatchEvent(new Event(OPEN_UPLOAD_EVENT));
        closeMobileSidebar();
    };

    const handleToggleGeneralMediaType = (type) => {
        window.dispatchEvent(
            new CustomEvent(GENERAL_FILTER_COMMAND_EVENT, {
                detail: { type: "toggle-media-type", mediaType: type },
            }),
        );
    };

    const handleAdminRoleFilter = (role) => {
        const nextRole = adminRoleFilter === role ? "all" : role;
        const params = new URLSearchParams(location.search);
        if (nextRole === "all") params.delete("role");
        else params.set("role", nextRole);
        navigate({ pathname: "/users", search: params.toString() ? `?${params.toString()}` : "" });
        closeMobileSidebar();
    };

    const handleThemeToggle = () => {
        const nextTheme = isDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("tagged:theme", nextTheme);
        setIsDark(nextTheme === "dark");
    };

    const handleSignOut = async () => {
        await logout();
        closeMobileSidebar();
        navigate("/", { replace: true });
    };

    const compactOnlyClass = isCollapsed ? "xl:hidden" : "";

    return (
        <>
            <button
                type="button"
                className="fixed left-4 top-4 z-70 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-50 p-0 text-neutral-700 shadow-sm hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 xl:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                aria-expanded={isOpen}
                aria-controls="tagged-sidebar"
                aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
                onClick={() => setIsOpen((current) => !current)}
            >
                <FontAwesomeIcon icon={isOpen ? faXmark : faBars} aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`fixed inset-0 z-40 border-0 bg-black/60 p-0 transition-opacity xl:hidden ${isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
                onClick={closeMobileSidebar}
                aria-label="Close navigation menu"
                aria-hidden={!isOpen}
                tabIndex={isOpen ? 0 : -1}
            />

            <aside
                id="tagged-sidebar"
                data-collapsed={isCollapsed}
                className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 transition-transform duration-200 xl:sticky xl:top-0 xl:h-dvh xl:translate-x-0 xl:transition-[width] dark:border-neutral-800 dark:bg-neutral-900 ${isOpen ? "translate-x-0" : "-translate-x-full"} ${isCollapsed ? "xl:w-[5.5rem]" : "xl:w-72"}`}
            >
                <header className={`relative flex h-20 shrink-0 items-center border-b border-neutral-200 px-4 dark:border-neutral-800 ${isCollapsed ? "xl:justify-between xl:px-2" : "justify-between"}`}>
                    <div className="flex min-w-0 items-center gap-3 pl-12 xl:pl-0">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 ${isCollapsed ? "xl:h-9 xl:w-9" : ""}`}>
                            <FontAwesomeIcon icon={faTags} aria-hidden="true" />
                        </span>
                        <div className={`min-w-0 ${isCollapsed ? "xl:hidden" : ""}`}>
                            <p className="truncate text-base font-black tracking-tight text-neutral-950 dark:text-neutral-100">Tagged</p>
                            <p className="truncate text-xs text-neutral-500">{user?.type === "admin" ? "Admin workspace" : "Media library"}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-0 text-neutral-500 shadow-sm transition-[background-color,color,transform] hover:scale-105 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-neutral-500 xl:flex dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 ${isCollapsed ? "xl:h-7 xl:w-7" : ""}`}
                        onClick={handleCollapseToggle}
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <FontAwesomeIcon icon={isCollapsed ? faAnglesRight : faAnglesLeft} aria-hidden="true" />
                    </button>
                </header>

                <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" aria-label="Main navigation">
                    <ul className={isCollapsed ? "space-y-1 xl:space-y-2" : "space-y-1"}>
                        {user?.type !== "admin" ? (
                            <li className="pb-2">
                                <button
                                    type="button"
                                    className={`flex h-11 w-full items-center rounded-xl border border-neutral-300 bg-neutral-900 px-3 text-sm font-bold text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white ${isCollapsed ? "xl:mx-auto xl:w-11 xl:justify-center xl:px-0" : ""}`}
                                    onClick={handleOpenUploadModal}
                                    disabled={isUploadDisabled}
                                    title={isUploadDisabled ? "Upload unavailable on this page" : "Upload media"}
                                    aria-label="Upload media"
                                >
                                    <FontAwesomeIcon icon={faCloudArrowUp} className="w-5 shrink-0" aria-hidden="true" />
                                    <SidebarLabel isCollapsed={isCollapsed}>Upload media</SidebarLabel>
                                </button>
                            </li>
                        ) : null}

                        {sectionOneNavItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => navItemClassName(isActive, isCollapsed)}
                                    onClick={closeMobileSidebar}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    <FontAwesomeIcon icon={item.icon} className="w-5 shrink-0" aria-hidden="true" />
                                    <SidebarLabel isCollapsed={isCollapsed}>{item.label}</SidebarLabel>
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    {user?.type !== "admin" && shouldShowTagPanel && allTagNames.length > 0 ? (
                        <section className={`flex min-h-52 flex-1 flex-col border-t border-neutral-200 pt-4 dark:border-neutral-800 ${compactOnlyClass}`} aria-label="Tag filters">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-black uppercase tracking-widest text-neutral-500">Filter by tags</span>
                                {activeTagFiltersCount > 0 ? (
                                    <button type="button" className="w-auto rounded-xl border border-neutral-300 bg-transparent px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800" onClick={clearFilterTags}>
                                        Clear {activeTagFiltersCount}
                                    </button>
                                ) : null}
                            </div>

                            <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-neutral-500 focus-within:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950">
                                <FontAwesomeIcon icon={faSearch} className="w-4" aria-hidden="true" />
                                <input
                                    type="search"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
                                    value={tagPanelSearch}
                                    onChange={(event) => setTagPanelSearch(event.target.value)}
                                    placeholder="Search tags"
                                    aria-label="Search tags to filter"
                                />
                            </label>

                            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Tag filters">
                                {filteredTagNames.map((tagName) => {
                                    const normalizedTag = tagName.toLowerCase();
                                    const isIncluded = selectedIncludeFilterTags.some((tag) => tag.toLowerCase() === normalizedTag);
                                    const isExcluded = selectedExcludeFilterTags.some((tag) => tag.toLowerCase() === normalizedTag);
                                    return (
                                        <li key={tagName} className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-2 hover:border-neutral-200 hover:bg-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800">
                                            <button type="button" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-sm font-semibold text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white" onClick={() => toggleIncludeFilterTag(tagName)} title={`Include tag ${tagName}`}>
                                                <span className="block truncate">{tagName}</span>
                                            </button>
                                            <button type="button" className={`flex h-7 w-7 items-center justify-center rounded-xl border p-0 text-xs ${isIncluded ? "border-neutral-500 bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-950" : "border-neutral-300 bg-transparent text-neutral-500 dark:border-neutral-700"}`} onClick={() => toggleIncludeFilterTag(tagName)} aria-pressed={isIncluded} aria-label={`Include tag ${tagName}`} title={`Include tag ${tagName}`}>
                                                <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                                            </button>
                                            <button type="button" className={`flex h-7 w-7 items-center justify-center rounded-xl border p-0 text-xs ${isExcluded ? "border-red-500/50 bg-red-500/15 text-red-500" : "border-neutral-300 bg-transparent text-neutral-500 dark:border-neutral-700"}`} onClick={() => toggleExcludeFilterTag(tagName)} aria-pressed={isExcluded} aria-label={`Exclude tag ${tagName}`} title={`Exclude tag ${tagName}`}>
                                                <FontAwesomeIcon icon={faMinus} aria-hidden="true" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ) : null}

                    {user?.type !== "admin" && shouldShowGeneralFilters ? (
                        <section className={`border-t border-neutral-200 pt-4 dark:border-neutral-800 ${compactOnlyClass}`} aria-label="General media filters">
                            <p className="mb-3 text-xs font-black uppercase tracking-widest text-neutral-500">Media type</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { type: "all", label: "All media", icon: faTableCellsLarge },
                                    { type: "image", label: "Images", icon: faImage },
                                    { type: "video", label: "Videos and GIFs", icon: faFilm },
                                ].map((filter) => (
                                    <button
                                        key={filter.type}
                                        type="button"
                                        className={`flex h-10 items-center justify-center rounded-xl border p-0 ${generalMediaTypeFilter === filter.type ? "border-neutral-500 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-transparent text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"}`}
                                        onClick={() => handleToggleGeneralMediaType(filter.type)}
                                        aria-pressed={generalMediaTypeFilter === filter.type}
                                        aria-label={filter.label}
                                        title={filter.label}
                                    >
                                        <FontAwesomeIcon icon={filter.icon} aria-hidden="true" />
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {user?.type === "admin" && isUsersView ? (
                        <section className={`border-t border-neutral-200 pt-4 dark:border-neutral-800 ${compactOnlyClass}`} aria-label="User role filters">
                            <p className="mb-3 text-xs font-black uppercase tracking-widest text-neutral-500">User role</p>
                            <div className="grid grid-cols-2 gap-2">
                                {["basic", "admin"].map((role) => (
                                    <button key={role} type="button" className={`h-10 rounded-xl border px-3 text-sm capitalize ${adminRoleFilter === role ? "border-neutral-500 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950" : "border-neutral-300 bg-transparent text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"}`} onClick={() => handleAdminRoleFilter(role)} aria-pressed={adminRoleFilter === role}>
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <div className="mt-auto border-t border-neutral-200 pt-3 dark:border-neutral-800">
                        <NavLink to="/account" className={({ isActive }) => navItemClassName(isActive, isCollapsed)} onClick={closeMobileSidebar} title={isCollapsed ? "Account" : undefined}>
                            <FontAwesomeIcon icon={faUser} className="w-5 shrink-0" aria-hidden="true" />
                            <SidebarLabel isCollapsed={isCollapsed}>Account</SidebarLabel>
                        </NavLink>
                        <button type="button" className={`mt-1 flex h-11 w-full items-center rounded-xl border border-transparent bg-transparent px-3 text-sm font-bold text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 ${isCollapsed ? "xl:mx-auto xl:w-11 xl:justify-center xl:px-0" : ""}`} onClick={handleThemeToggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isCollapsed ? (isDark ? "Light mode" : "Dark mode") : undefined}>
                            <FontAwesomeIcon icon={isDark ? faMoon : faSun} className="w-5 shrink-0" aria-hidden="true" />
                            <SidebarLabel isCollapsed={isCollapsed}>{isDark ? "Dark mode" : "Light mode"}</SidebarLabel>
                        </button>
                        <button type="button" className={`mt-1 flex h-11 w-full items-center rounded-xl border border-transparent bg-transparent px-3 text-sm font-bold text-neutral-600 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 dark:text-neutral-400 ${isCollapsed ? "xl:mx-auto xl:w-11 xl:justify-center xl:px-0" : ""}`} onClick={handleSignOut} aria-label="Sign out" title={isCollapsed ? "Sign out" : undefined}>
                            <FontAwesomeIcon icon={faRightFromBracket} className="w-5 shrink-0" aria-hidden="true" />
                            <SidebarLabel isCollapsed={isCollapsed}>Sign out</SidebarLabel>
                        </button>
                    </div>
                </nav>
            </aside>
        </>
    );
};
