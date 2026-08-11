import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    faCopyright,
    faImage,
    faMagnifyingGlass,
    faPen,
    faPlus,
    faTag,
    faTrash,
    faUser,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { metadataApi, metadataQueryKeys } from "../../api/metadataApi";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { ErrorToast } from "../../components/toast/ErrorToast";
import { IconButton } from "../../components/icon-button/IconButton";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { useDevTools } from "../../hooks/useDevTools";
import { useAuth } from "../../hooks/useAuth";
import { buildDefaultTagStyle, isDefaultTagColor } from "../../utils/tagStyle";

const DEFAULT_TAG_COLOR = "#643aff";

const MANAGERS = {
    tags: { label: "Tags", singular: "tag", icon: faTag, field: "tagname", create: "Create tag" },
    displaynames: { label: "Media names", singular: "media name", icon: faImage, field: "value", create: "Create media name" },
    authors: { label: "Authors", singular: "author", icon: faUser, field: "value", create: "Create author" },
};

const normalizeValues = (items, field) => {
    const values = (Array.isArray(items) ? items : []).map((item) =>
        typeof item === "string" ? item : String(item?.[field] || ""),
    );
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))
        .map((value) => ({ id: value.toLowerCase(), value }));
};

const normalizeColor = (color) => (/^#[\da-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : DEFAULT_TAG_COLOR);

const inputClasses =
    "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600";

const MetadataEditor = ({ managerType, item, isSaving, error, onClose, onSave }) => {
    const config = MANAGERS[managerType];
    const [name, setName] = useState(managerType === "tags" ? String(item?.tagname || "") : String(item?.value || ""));
    const [color, setColor] = useState(normalizeColor(item?.tagcolor_hex));
    const [type, setType] = useState(item?.type === "copyright" ? "copyright" : "default");

    return createPortal(
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="metadata-editor-title" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
            <section className="w-full max-w-lg overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                    <div>
                        <h2 id="metadata-editor-title" className="text-xl font-bold tracking-tight">{item ? `Edit ${config.singular}` : config.create}</h2>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Keep library metadata clean and reusable.</p>
                    </div>
                    <IconButton onClick={onClose} disabled={isSaving} aria-label="Close editor"><FontAwesomeIcon icon={faXmark} /></IconButton>
                </header>
                <form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); onSave({ name: name.trim(), color: normalizeColor(color), type }); }}>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold">{config.label.slice(0, -1)} name</span>
                        <input className={inputClasses} value={name} onChange={(event) => setName(event.target.value)} placeholder={`Enter ${config.singular}`} required autoFocus />
                    </label>
                    {managerType === "tags" ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold">Color</span>
                                <div className="flex h-11 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-950">
                                    <input type="color" className="h-7 w-9 cursor-pointer rounded-xl border-0 bg-transparent p-0" value={color} onChange={(event) => setColor(event.target.value)} />
                                    <span className="text-sm font-semibold uppercase text-neutral-500 dark:text-neutral-400">{color}</span>
                                </div>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold">Type</span>
                                <select className={inputClasses} value={type} onChange={(event) => setType(event.target.value)}>
                                    <option value="default">Default</option><option value="copyright">Copyright</option>
                                </select>
                            </label>
                        </div>
                    ) : null}
                    <ErrorToast message={error} />
                    <footer className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                        <button type="button" className="h-10! w-full! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-2! text-sm! font-semibold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800! sm:w-auto!" onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" className="h-10! w-full! rounded-xl! border-0! bg-neutral-950! px-4! py-2! text-sm! font-semibold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white! sm:w-auto!" disabled={isSaving || !name.trim()}>{isSaving ? "Saving..." : item ? "Save changes" : config.create}</button>
                    </footer>
                </form>
            </section>
        </div>, document.body,
    );
};

export const MetadataPage = () => {
    const { accessToken } = useAuth();
    const { forceLoading } = useDevTools();
    const queryClient = useQueryClient();
    const [managerType, setManagerType] = useState("tags");
    const [search, setSearch] = useState("");
    const [editingItem, setEditingItem] = useState(undefined);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const config = MANAGERS[managerType];

    const metadataQuery = useQuery({
        queryKey: metadataQueryKeys.all,
        queryFn: () => metadataApi.getAll(accessToken),
        enabled: Boolean(accessToken),
    });

    const saveMutation = useMutation({
        mutationFn: (values) => metadataApi.save({ managerType, item: editingItem, values, accessToken }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            setIsEditorOpen(false);
            setEditingItem(undefined);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => metadataApi.remove({ managerType, item: pendingDelete, accessToken }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: metadataQueryKeys.all });
            setPendingDelete(null);
        },
    });

    const counts = {
        tags: metadataQuery.data?.tags?.length || 0,
        displaynames: metadataQuery.data?.displayNames?.length || 0,
        authors: metadataQuery.data?.authors?.length || 0,
    };

    const items = useMemo(() => {
        if (!metadataQuery.data) return [];
        const source = managerType === "tags"
            ? [...(metadataQuery.data.tags || [])].sort((a, b) => String(a.tagname || "").localeCompare(String(b.tagname || ""), undefined, { sensitivity: "base", numeric: true }))
            : normalizeValues(managerType === "displaynames" ? metadataQuery.data.displayNames : metadataQuery.data.authors, managerType === "displaynames" ? "displayname" : "author");
        const query = search.trim().toLowerCase();
        return query ? source.filter((item) => String(item[config.field] || "").toLowerCase().includes(query)) : source;
    }, [config.field, managerType, metadataQuery.data, search]);

    const openEditor = (item) => { saveMutation.reset(); setEditingItem(item); setIsEditorOpen(true); };

    if (forceLoading) return <section className="tagged-app-page"><PageLoadingSkeleton variant="list" ariaLabel="Forced metadata loading preview" /></section>;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Library settings</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Metadata</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">Manage the reusable tags, names and authors that keep your gallery organized.</p>
                </div>
                <button type="button" className="inline-flex! h-11! w-full! items-center! justify-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white! sm:w-auto!" onClick={() => openEditor(undefined)}><FontAwesomeIcon icon={faPlus} /><span>{config.create}</span></button>
            </header>

            <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
                <nav className="grid content-start gap-2 self-start sm:grid-cols-3 xl:sticky xl:top-6 xl:grid-cols-1" aria-label="Metadata categories">
                    {Object.entries(MANAGERS).map(([key, manager]) => (
                        <button key={key} type="button" className={`flex! min-h-16! w-full! items-center! gap-3! rounded-xl! border! px-4! py-3! text-left! shadow-none! transition-colors! ${managerType === key ? "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!" : "border-neutral-200! bg-white/70! text-neutral-700! hover:bg-white! dark:border-neutral-800! dark:bg-neutral-900/70! dark:text-neutral-300! dark:hover:bg-neutral-900!"}`} onClick={() => { setManagerType(key); setSearch(""); }} aria-current={managerType === key ? "page" : undefined}>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-500/10"><FontAwesomeIcon icon={manager.icon} /></span>
                            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{manager.label}</span><span className="block text-xs opacity-60">{counts[key]} items</span></span>
                        </button>
                    ))}
                </nav>

                <div className="min-w-0">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div><h2 className="text-xl font-bold">{config.label}</h2><p className="text-sm text-neutral-500 dark:text-neutral-400">{counts[managerType]} saved {counts[managerType] === 1 ? config.singular : `${config.singular}s`}</p></div>
                        <label className="relative block w-full sm:max-w-sm"><span className="sr-only">Search {config.label}</span><FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-600" /><input type="search" className={`${inputClasses} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.label.toLowerCase()}`} /></label>
                    </div>

                    {metadataQuery.isPending ? <PageLoadingSkeleton variant="list" ariaLabel="Loading metadata" /> : null}
                    {metadataQuery.isError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-600 dark:text-red-400"><h2 className="font-bold">Could not load metadata</h2><p className="mt-1 text-sm">{metadataQuery.error.message}</p></div> : null}
                    {!metadataQuery.isPending && !metadataQuery.isError && items.length === 0 ? <EmptyState title={search ? `No matching ${config.label.toLowerCase()}` : `No ${config.label.toLowerCase()} yet`} icon={config.icon} placement="section" actionLabel={search ? "Clear search" : config.create} onAction={() => search ? setSearch("") : openEditor(undefined)} /> : null}
                    {items.length > 0 ? (
                        <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3" aria-label={config.label}>
                            {items.map((item) => {
                                const label = String(item[config.field] || "");
                                return <li key={item.id ?? label} className="group flex min-w-0 items-center gap-3 rounded-xl border border-neutral-200 bg-white/70 p-3 transition-colors hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:bg-neutral-900">
                                    {managerType === "tags" ? <span className="h-9 w-9 shrink-0 rounded-xl border border-black/10" style={isDefaultTagColor(item.tagcolor_hex) ? buildDefaultTagStyle() : { backgroundColor: normalizeColor(item.tagcolor_hex) }} aria-hidden="true" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"><FontAwesomeIcon icon={config.icon} /></span>}
                                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold" title={label}>{label}</p>{managerType === "tags" ? <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">{item.type === "copyright" ? <><FontAwesomeIcon icon={faCopyright} /> Copyright</> : "Standard tag"}</p> : <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Reusable {config.singular}</p>}</div>
                                    <div className="flex shrink-0 gap-1"><IconButton className="h-9 w-9 border-transparent bg-transparent" onClick={() => openEditor(item)} aria-label={`Edit ${label}`} title={`Edit ${label}`}><FontAwesomeIcon icon={faPen} /></IconButton><IconButton className="h-9 w-9 border-transparent bg-transparent hover:text-red-500" onClick={() => setPendingDelete(item)} aria-label={`Delete ${label}`} title={`Delete ${label}`}><FontAwesomeIcon icon={faTrash} /></IconButton></div>
                                </li>;
                            })}
                        </ul>
                    ) : null}
                </div>
            </div>

            {isEditorOpen ? <MetadataEditor key={`${managerType}-${editingItem?.id || editingItem?.value || "new"}`} managerType={managerType} item={editingItem} isSaving={saveMutation.isPending} error={saveMutation.error?.message} onClose={() => !saveMutation.isPending && setIsEditorOpen(false)} onSave={(values) => saveMutation.mutate(values)} /> : null}
            <DeleteConfirmationModal isOpen={Boolean(pendingDelete)} title={`Delete this ${config.singular}?`} description="This item will be permanently removed. This action cannot be undone." confirmLabel={`Delete ${config.singular}`} isDeleting={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate()} onClose={() => !deleteMutation.isPending && setPendingDelete(null)} />
        </section>
    );
};
