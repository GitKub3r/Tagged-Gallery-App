import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { faGoogleDrive } from "@fortawesome/free-brands-svg-icons";
import {
    faArrowLeft,
    faArrowRight,
    faCheckDouble,
    faChevronRight,
    faClock,
    faHardDrive,
    faSpinner,
    faStar,
    faUserGroup,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "../../../components/button/buttonClasses";
import { EmptyState } from "../../../components/empty-state/EmptyState";
import { IconButton } from "../../../components/icon-button/IconButton";
import { LoadErrorState } from "../../../components/load-error-state/LoadErrorState";
import { Skeleton } from "../../../components/loading-skeletons/Skeleton";
import { MediaFormModal } from "../../../components/media-form-modal/MediaFormModal";
import { SearchField } from "../../../components/search-field/SearchField";
import { useDriveBrowse } from "../../../hooks/useGoogleDrive";
import { useScrollLock } from "../../../hooks/useScrollLock";
import { DriveFileTile, DriveFolderTile } from "./DriveBrowserTiles";

// Mismo límite que el servidor al expandir carpetas (MAX_FOLDER_EXPANSION).
const MAX_SELECTION = 500;
const SEARCH_DEBOUNCE_MS = 350;

const VIEWS = [
    { id: "my-drive", label: "My Drive", icon: faHardDrive, empty: "This folder has no photos or videos" },
    { id: "recent", label: "Recent", icon: faClock, empty: "No photos or videos in your Drive yet" },
    { id: "starred", label: "Starred", icon: faStar, empty: "No starred photos, videos or folders" },
    { id: "shared", label: "Shared", icon: faUserGroup, empty: "Nothing with photos or videos is shared with you" },
];

const FILE_GRID_CLASSES = "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
const FOLDER_GRID_CLASSES = "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3";
const SECTION_TITLE_CLASSES = "mb-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400";

const pluralize = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

const toSelectionItem = (item) => ({ id: item.id, name: item.name, mimeType: item.mimeType, isFolder: item.isFolder, size: item.size });

const describeSelection = (items) => {
    const folderCount = items.filter((item) => item.isFolder).length;
    const fileCount = items.length - folderCount;
    const parts = [fileCount ? pluralize(fileCount, "file") : null, folderCount ? pluralize(folderCount, "folder") : null].filter(Boolean);
    return parts.length ? `${parts.join(" and ")} selected` : "Nothing selected";
};

const BrowserSkeleton = () => (
    <div className={FILE_GRID_CLASSES} role="status">
        <span className="sr-only">Loading Google Drive</span>
        {Array.from({ length: 10 }, (_, index) => (
            <div key={index}>
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="mt-1.5 h-4 w-2/3" />
            </div>
        ))}
    </div>
);

// Explorador de Google Drive con el aspecto de Tagged: vistas, carpetas, búsqueda y selección múltiple
// (incluidas carpetas enteras). Devuelve la selección con onConfirm; las carpetas se expanden después.
export const DriveBrowserModal = ({ initialSelection = [], layer = "base", isConfirming = false, onConfirm, onClose }) => {
    const [view, setView] = useState("my-drive");
    const [path, setPath] = useState([]);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [selection, setSelection] = useState(() => new Map(initialSelection.map((item) => [item.id, toSelectionItem(item)])));
    const [lastToggledId, setLastToggledId] = useState(null);
    const [isSelectingAll, setIsSelectingAll] = useState(false);
    const scrollAreaRef = useRef(null);
    const sentinelRef = useRef(null);
    useScrollLock();

    const currentView = VIEWS.find((option) => option.id === view);
    const currentFolder = path.at(-1) || null;
    const browseQuery = useDriveBrowse({ view, folderId: currentFolder?.id, search });
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = browseQuery;
    const items = useMemo(() => browseQuery.data?.pages.flatMap((page) => page.items) ?? [], [browseQuery.data]);
    const folders = items.filter((item) => item.isFolder);
    const files = items.filter((item) => !item.isFolder);
    const selectableItems = items.filter((item) => !item.inLibrary);
    const selectedItems = [...selection.values()];
    const areAllSelected = !hasNextPage && selectableItems.length > 0 && selectableItems.every((item) => selection.has(item.id));

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [searchInput]);

    // Cada ubicación nueva empieza arriba.
    useEffect(() => {
        scrollAreaRef.current?.scrollTo({ top: 0 });
    }, [view, currentFolder?.id, search]);

    // Scroll infinito: al acercarse al final se pide la página siguiente.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasNextPage) return undefined;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
            },
            { root: scrollAreaRef.current, rootMargin: "400px 0px" },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, items.length]);

    const addToSelection = (itemsToAdd) => {
        const next = new Map(selection);
        for (const item of itemsToAdd) {
            if (next.has(item.id)) continue;
            if (next.size >= MAX_SELECTION) {
                toast.info(`You can select up to ${MAX_SELECTION} items at a time`);
                break;
            }
            next.set(item.id, toSelectionItem(item));
        }
        setSelection(next);
    };

    const removeFromSelection = (itemsToRemove) => {
        setSelection((current) => {
            const next = new Map(current);
            itemsToRemove.forEach((item) => next.delete(item.id));
            return next;
        });
    };

    // Mayúsculas + clic selecciona el rango desde el último elemento marcado.
    const toggleItem = (item, event) => {
        const list = (item.isFolder ? folders : files).filter((entry) => !entry.inLibrary);
        const fromIndex = list.findIndex((entry) => entry.id === lastToggledId);
        const toIndex = list.findIndex((entry) => entry.id === item.id);
        setLastToggledId(item.id);

        if (event?.shiftKey && fromIndex >= 0 && toIndex >= 0) {
            addToSelection(list.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1));
            return;
        }
        if (selection.has(item.id)) removeFromSelection([item]);
        else addToSelection([item]);
    };

    const toggleAll = async () => {
        if (areAllSelected) {
            removeFromSelection(selectableItems);
            return;
        }
        setIsSelectingAll(true);
        try {
            // Se cargan las páginas que falten (hasta el límite de selección) para marcar la ubicación completa.
            let result = browseQuery;
            let loadedItems = items;
            while (result.hasNextPage && loadedItems.length < MAX_SELECTION) {
                result = await fetchNextPage();
                if (result.isError) return;
                loadedItems = result.data?.pages.flatMap((page) => page.items) ?? [];
            }
            addToSelection(loadedItems.filter((item) => !item.inLibrary));
        } finally {
            setIsSelectingAll(false);
        }
    };

    const changeView = (nextView) => {
        setView(nextView);
        setPath([]);
        setSearchInput("");
        setSearch("");
    };

    const openFolder = (folder) => {
        setPath((current) => (search ? [folder] : [...current, folder]));
        setSearchInput("");
        setSearch("");
    };

    const renderEmptyState = () => {
        if (search) {
            return <EmptyState title={`Nothing matches "${search}"`} icon={faGoogleDrive} placement="section" actionLabel="Clear search" onAction={() => setSearchInput("")} />;
        }
        if (currentFolder) {
            return <EmptyState title="This folder has no photos or videos" icon={faGoogleDrive} placement="section" actionLabel="Go back" onAction={() => setPath((current) => current.slice(0, -1))} />;
        }
        return <EmptyState title={currentView.empty} icon={faGoogleDrive} placement="section" actionLabel="Reload" onAction={() => browseQuery.refetch()} />;
    };

    return (
        <MediaFormModal
            titleId="drive-browser-title"
            title="Select from Google Drive"
            subtitle="Photos, videos and whole folders"
            onClose={onClose}
            closeDisabled={isConfirming}
            layer={layer}
        >
            <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 md:flex-row md:items-center md:justify-between sm:px-6">
                <div className="flex h-11 items-center gap-1 rounded-xl border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950 md:w-auto" role="group" aria-label="Drive location">
                    {VIEWS.map((option) => {
                        const isActive = option.id === view;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                className={`inline-flex h-9 w-auto flex-1 items-center justify-center gap-2 rounded-xl border-0 px-3 text-sm font-bold shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 ${isActive ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-transparent text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"}`}
                                onClick={() => changeView(option.id)}
                                aria-pressed={isActive}
                                aria-label={option.label}
                                title={option.label}
                            >
                                <FontAwesomeIcon icon={option.icon} aria-hidden="true" />
                                <span className="hidden sm:inline">{option.label}</span>
                            </button>
                        );
                    })}
                </div>
                <SearchField
                    className="w-full md:max-w-xs"
                    label="Search Drive"
                    placeholder="Search by file or folder name"
                    value={searchInput}
                    onChange={setSearchInput}
                    onClear={() => setSearchInput("")}
                />
            </div>

            <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                    {currentFolder && !search ? (
                        <IconButton onClick={() => setPath((current) => current.slice(0, -1))} aria-label="Back to the previous folder" title="Back">
                            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                        </IconButton>
                    ) : null}
                    {search ? (
                        <p className="truncate text-sm font-semibold" aria-live="polite">Results for "{search}"</p>
                    ) : (
                        <nav className="min-w-0" aria-label="Folder path">
                            <ol className="flex min-w-0 items-center gap-1 text-sm font-semibold">
                                <li className={`min-w-0 items-center ${path.length > 1 ? "hidden sm:flex" : "flex"}`}>
                                    {path.length ? (
                                        <button type="button" className={`${buttonClasses.text} max-w-40 truncate`} onClick={() => setPath([])}>
                                            <span className="truncate">{currentView.label}</span>
                                        </button>
                                    ) : (
                                        <span className="truncate" aria-current="page">{currentView.label}</span>
                                    )}
                                </li>
                                {path.map((folder, index) => {
                                    const isCurrent = index === path.length - 1;
                                    return (
                                        <li key={folder.id} className={`min-w-0 items-center gap-1 ${isCurrent || index === path.length - 2 ? "flex" : "hidden sm:flex"}`}>
                                            <span className={`text-xs text-neutral-400 dark:text-neutral-500 ${index === 0 && path.length > 1 ? "hidden sm:inline" : ""}`} aria-hidden="true">
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </span>
                                            {isCurrent ? (
                                                <span className="truncate" aria-current="page" title={folder.name}>{folder.name}</span>
                                            ) : (
                                                <button type="button" className={`${buttonClasses.text} max-w-40`} onClick={() => setPath((current) => current.slice(0, index + 1))} title={folder.name}>
                                                    <span className="truncate">{folder.name}</span>
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </nav>
                    )}
                </div>
                {selectableItems.length > 0 ? (
                    <button type="button" className={`${buttonClasses.text} shrink-0`} onClick={toggleAll} disabled={isSelectingAll}>
                        <FontAwesomeIcon icon={isSelectingAll ? faSpinner : areAllSelected ? faXmark : faCheckDouble} spin={isSelectingAll} aria-hidden="true" />
                        {isSelectingAll ? "Selecting..." : areAllSelected ? "Deselect all" : "Select all"}
                    </button>
                ) : null}
            </div>

            <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {browseQuery.isPending ? (
                    <BrowserSkeleton />
                ) : browseQuery.isError ? (
                    <LoadErrorState title="Could not load Google Drive" placement="section" onRetry={() => browseQuery.refetch()} />
                ) : items.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <div className="grid gap-6">
                        {folders.length ? (
                            <section aria-labelledby="drive-browser-folders">
                                <h3 id="drive-browser-folders" className={SECTION_TITLE_CLASSES}>Folders</h3>
                                <ul className={FOLDER_GRID_CLASSES}>
                                    {folders.map((folder) => (
                                        <DriveFolderTile key={folder.id} folder={folder} isSelected={selection.has(folder.id)} onOpen={openFolder} onToggle={toggleItem} />
                                    ))}
                                </ul>
                            </section>
                        ) : null}
                        {files.length ? (
                            <section aria-labelledby="drive-browser-files">
                                <h3 id="drive-browser-files" className={SECTION_TITLE_CLASSES}>Photos and videos</h3>
                                <ul className={FILE_GRID_CLASSES}>
                                    {files.map((file) => (
                                        <DriveFileTile key={file.id} file={file} isSelected={selection.has(file.id)} onToggle={toggleItem} />
                                    ))}
                                </ul>
                            </section>
                        ) : null}
                        {hasNextPage ? (
                            <div ref={sentinelRef} className="flex justify-center py-2 text-neutral-400 dark:text-neutral-500" role="status">
                                <FontAwesomeIcon icon={faSpinner} spin className="motion-reduce:animate-none" aria-hidden="true" />
                                <span className="sr-only">Loading more</span>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* En móvil los dos botones comparten fila para dejar más espacio a la rejilla. */}
            <footer className="flex shrink-0 flex-col gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <p className="truncate text-sm font-semibold text-neutral-600 tabular-nums dark:text-neutral-300" aria-live="polite">{describeSelection(selectedItems)}</p>
                    {selectedItems.length ? (
                        <button type="button" className={`${buttonClasses.text} text-xs underline`} onClick={() => setSelection(new Map())} disabled={isConfirming}>
                            Clear
                        </button>
                    ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button type="button" className={buttonClasses.secondary} onClick={onClose} disabled={isConfirming}>
                        Cancel
                    </button>
                    <button type="button" className={buttonClasses.primary} onClick={() => onConfirm(selectedItems)} disabled={!selectedItems.length || isConfirming}>
                        {isConfirming ? "Reading folders..." : "Continue"}
                        <FontAwesomeIcon icon={isConfirming ? faSpinner : faArrowRight} spin={isConfirming} aria-hidden="true" />
                    </button>
                </div>
            </footer>
        </MediaFormModal>
    );
};
