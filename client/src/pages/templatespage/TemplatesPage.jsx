import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { faArrowUpWideShort, faChevronDown, faCopy, faHeart, faImage, faPen, faPlus, faTrash, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { templateApi, templateQueryKeys } from "../../api/templateApi";
import { buttonClasses } from "../../components/button/buttonClasses";
import { CheckboxOption } from "../../components/checkbox-control/CheckboxOption";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { IconButton } from "../../components/icon-button/IconButton";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { Skeleton } from "../../components/loading-skeletons/Skeleton";
import { Pagination } from "../../components/pagination/Pagination";
import { MediaFormModal, MediaMetadataFields } from "../../components/media-form-modal/MediaFormModal";
import { mediaFormInputClasses } from "../../components/media-form-modal/mediaFormStyles";
import { SearchField } from "../../components/search-field/SearchField";
import { TagChip } from "../../components/tag-chip/TagChip";
import { ErrorToast } from "../../components/toast/ErrorToast";
import { useAuth } from "../../hooks/useAuth";
import { useDevTools } from "../../hooks/useDevTools";
import { useClientPagination } from "../../hooks/useClientPagination";
import { useTemplates } from "../../hooks/useTemplates";
import { useMediaMetadataForm } from "../../hooks/useMediaMetadataForm";
import { useMetadata } from "../../hooks/useMetadata";
import { buildTagChipStyle } from "../../utils/tagStyle";

const TemplateEditor = ({ template, metadata, tagNames, tagColorByName, tagTypeByName, isSaving, error, onSave, onCancel }) => {
    const [name, setName] = useState(template?.name || "");
    const form = useMediaMetadataForm({
        metadata,
        tagNames,
        initialValues: { displayname: template?.displayname, author: template?.author, tags: template?.tags },
    });
    const [markFavourite, setMarkFavourite] = useState(Boolean(template?.mark_favourite));
    const [localError, setLocalError] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();
        const nextTags = form.getTagsWithPending();
        if (!form.displayName.trim() && !form.author.trim() && nextTags.length === 0 && !markFavourite) {
            setLocalError("Add a media name, author, tag or favourite action.");
            return;
        }
        setLocalError("");
        onSave({ id: template?.id, name: name.trim(), displayname: form.displayName.trim(), author: form.author.trim(), tags: nextTags, mark_favourite: markFavourite });
    };

    return (
        <MediaFormModal titleId="template-editor-title" title={template ? "Edit template" : "New template"} subtitle="Reusable details for uploads and edits" onClose={onCancel} closeDisabled={isSaving} compact>
            <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
                <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
                    <label className="mb-5 block text-sm font-semibold">
                        <span className="mb-1.5 block">Template name</span>
                        <input className={mediaFormInputClasses} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="For example: Travel photos" required autoFocus />
                    </label>
                    <div className="mb-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                        <p className="text-sm font-semibold">Media details</p>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Add the fields you want this template to fill.</p>
                    </div>
                    <MediaMetadataFields
                        {...form.fieldProps}
                        compact
                        displayNamePlaceholder="Optional media name"
                        tagColorByName={tagColorByName}
                        tagTypeByName={tagTypeByName}
                        error={localError || error}
                        getTagStyle={buildTagChipStyle}
                    />
                    <div className="mt-4">
                        <CheckboxOption checked={markFavourite} onChange={setMarkFavourite} disabled={isSaving} title="Mark media as favourite" description="Applied media will be added to favourites when saved." />
                    </div>
                </div>
                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" className={buttonClasses.secondary} onClick={onCancel} disabled={isSaving}>Cancel</button>
                    <button type="submit" className={buttonClasses.primary} disabled={isSaving || !name.trim()}>{isSaving ? "Saving..." : "Save template"}</button>
                </footer>
            </form>
        </MediaFormModal>
    );
};

// Plantilla = plano técnico reutilizable. El panel usa marco discontinuo, marcas de registro en las
// esquinas y una textura de retícula para evocar un blueprint, en la paleta neutral del resto de la app
// (nada de azules ni colores de marca: DESIGN.md solo permite neutral-* y semánticos).
const BLUEPRINT_GRID_CLASSES =
    "bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:16px_16px] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]";

const BlueprintCornerMarks = () => (
    <>
        <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-neutral-300 dark:border-neutral-700" />
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-neutral-300 dark:border-neutral-700" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-neutral-300 dark:border-neutral-700" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-neutral-300 dark:border-neutral-700" />
    </>
);

const BlueprintPanel = ({ className = "", children }) => (
    <div className={`relative overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900 ${BLUEPRINT_GRID_CLASSES} ${className}`}>
        <BlueprintCornerMarks />
        {children}
    </div>
);

const SpecField = ({ icon, label, value }) => (
    <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
            <FontAwesomeIcon icon={icon} aria-hidden="true" />
            {label}
        </p>
        <p className={`mt-1 truncate text-sm font-semibold ${value ? "" : "text-neutral-400 dark:text-neutral-600"}`} title={value || "Undefined"}>{value || "Undefined"}</p>
    </div>
);

// Máximo de tags visibles por tarjeta: con la ficha de datos ya a altura fija, esto evita que una
// plantilla con muchas tags crezca más que el resto y rompa la simetría del grid.
const MAX_VISIBLE_TAGS = 4;

const TemplateCard = ({ template, code, tagNameSet, tagColorByName, tagTypeByName, metadataAvailable, onEdit, onDelete }) => {
    const visibleTags = template.tags.slice(0, MAX_VISIBLE_TAGS);
    const hiddenTagCount = template.tags.length - visibleTags.length;

    return (
        <li>
            <BlueprintPanel className="flex h-full flex-col p-4 transition-colors hover:border-neutral-400 dark:hover:border-neutral-600">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest tabular-nums text-neutral-400 dark:text-neutral-600">{code}</p>
                        <h2 className="mt-0.5 truncate text-lg font-black tracking-tight" title={template.name}>{template.name}</h2>
                    </div>
                    {template.mark_favourite ? (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-neutral-400 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400" title="Applies favourite to media" aria-label="Applies favourite to media">
                            <FontAwesomeIcon icon={faHeart} aria-hidden="true" />
                        </span>
                    ) : null}
                </div>

                <div className="mt-4 flex-1 space-y-3 border-t border-dashed border-neutral-300 pt-3 dark:border-neutral-700">
                    <div className="grid grid-cols-2 gap-3 border-b border-dotted border-neutral-300 pb-3 dark:border-neutral-700">
                        <SpecField icon={faImage} label="Media name" value={template.displayname} />
                        <SpecField icon={faUser} label="Author" value={template.author} />
                    </div>

                    <div className="flex min-h-[1.75rem] flex-wrap items-center gap-1.5">
                        {template.tags.length === 0 ? <span className="text-xs text-neutral-400 dark:text-neutral-600">No tags</span> : null}
                        {visibleTags.map((tag) => {
                            const key = tag.trim().toLowerCase();
                            return (
                                <span key={tag} className="inline-flex min-w-0 max-w-[6.5rem]">
                                    <TagChip tag={tag} color={tagColorByName[key]} type={tagTypeByName[key]} isExisting={!metadataAvailable || tagNameSet.has(key)} />
                                </span>
                            );
                        })}
                        {hiddenTagCount > 0 ? (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-200 px-2 py-1 text-xs font-bold tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" title={`${hiddenTagCount} more tag${hiddenTagCount === 1 ? "" : "s"}`}>
                                +{hiddenTagCount}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-dashed border-neutral-300 pt-3 dark:border-neutral-700">
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">Template spec</span>
                    <div className="flex gap-1">
                        <IconButton className="h-9 w-9 border-transparent bg-transparent" onClick={() => onEdit(template)} aria-label={`Edit ${template.name}`} title={`Edit ${template.name}`}><FontAwesomeIcon icon={faPen} /></IconButton>
                        <IconButton className="h-9 w-9 border-transparent bg-transparent hover:text-red-500" onClick={() => onDelete(template)} aria-label={`Delete ${template.name}`} title={`Delete ${template.name}`}><FontAwesomeIcon icon={faTrash} /></IconButton>
                    </div>
                </div>
            </BlueprintPanel>
        </li>
    );
};

const TemplateCardSkeleton = () => (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900" aria-hidden="true">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="mt-2 h-5 w-2/3" />
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mt-4 flex justify-end gap-1 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
        </div>
    </div>
);

// 12 llena filas completas en 2 y en 3 columnas.
const PAGE_SIZE = 12;

const SORT_OPTIONS = [
    { value: "created_asc", label: "Creation order" },
    { value: "created_desc", label: "Newest first" },
    { value: "name_asc", label: "Name (A–Z)" },
    { value: "name_desc", label: "Name (Z–A)" },
];

const compareByCreation = (a, b) => (new Date(a.created_at).getTime() || a.id) - (new Date(b.created_at).getTime() || b.id);
const compareByName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

const sortTemplates = (templates, sortOrder) => {
    const sorted = [...templates];
    switch (sortOrder) {
        case "created_desc":
            return sorted.sort((a, b) => compareByCreation(b, a));
        case "name_asc":
            return sorted.sort(compareByName);
        case "name_desc":
            return sorted.sort((a, b) => compareByName(b, a));
        case "created_asc":
        default:
            return sorted.sort(compareByCreation);
    }
};

const TemplatesLoadingSkeleton = () => (
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite" aria-label="Loading templates">
        {Array.from({ length: 6 }, (_, index) => <TemplateCardSkeleton key={index} />)}
    </div>
);

export const TemplatesPage = () => {
    const { user } = useAuth();
    const { forceLoading } = useDevTools();
    const queryClient = useQueryClient();
    const templatesQuery = useTemplates();
    const { metadata, tagNames, tagNameSet, tagColorByName, tagTypeByName } = useMetadata();
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [search, setSearch] = useState("");
    const [sortOrder, setSortOrder] = useState("created_asc");
    const queryKey = templateQueryKeys.forUser(user?.id);
    const saveMutation = useMutation({
        mutationFn: templateApi.save,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey });
            setIsEditorOpen(false);
            setEditingTemplate(null);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: templateApi.remove,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey });
            setPendingDelete(null);
        },
    });
    const templates = templatesQuery.data || [];
    // El código TPL-NN es un identificador estable ligado al orden de creación: no cambia si el
    // usuario reordena o filtra la vista, solo la posición de la tarjeta en el grid cambia.
    const templateCodeById = useMemo(() => {
        const byCreation = sortTemplates(templatesQuery.data || [], "created_asc");
        return new Map(byCreation.map((template, index) => [template.id, `TPL-${String(index + 1).padStart(2, "0")}`]));
    }, [templatesQuery.data]);
    const searchTerm = search.trim().toLowerCase();
    const searchedTemplates = searchTerm ? templates.filter((template) => [template.name, template.displayname, template.author, ...template.tags].some((value) => value.toLowerCase().includes(searchTerm))) : templates;
    const filteredTemplates = sortTemplates(searchedTemplates, sortOrder);
    const pagination = useClientPagination(filteredTemplates, PAGE_SIZE);
    // Buscar u ordenar vuelve a la primera página.
    const updateSearch = (value) => { setSearch(value); pagination.resetPage(); };
    const openEditor = (template = null) => { saveMutation.reset(); setEditingTemplate(template); setIsEditorOpen(true); };

    if (forceLoading) return <section className="tagged-app-page"><TemplatesLoadingSkeleton /></section>;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Library settings</p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Templates</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">Save media details and add to favourites automatically when applied.</p>
                </div>
                <button type="button" className={buttonClasses.primary} onClick={() => openEditor()}>
                    <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                    New template
                </button>
            </header>

            {isEditorOpen ? <TemplateEditor key={editingTemplate?.id || "new"} template={editingTemplate} metadata={metadata} tagNames={tagNames} tagColorByName={tagColorByName} tagTypeByName={tagTypeByName} isSaving={saveMutation.isPending} error={saveMutation.error?.message} onSave={(template) => saveMutation.mutate(template)} onCancel={() => !saveMutation.isPending && setIsEditorOpen(false)} /> : null}

            {templatesQuery.isPending ? <TemplatesLoadingSkeleton /> : null}
            {templatesQuery.isError ? <LoadErrorState title="Could not load templates" onRetry={() => templatesQuery.refetch()} placement="section" /> : null}

            {!templatesQuery.isPending && !templatesQuery.isError && templates.length > 0 ? (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <SearchField value={search} onChange={updateSearch} onClear={() => updateSearch("")} label="Search templates" placeholder="Name, author or tag" className="w-full sm:max-w-sm" />
                        <label className="block w-full shrink-0 sm:w-auto">
                            <span className="sr-only">Sort templates</span>
                            <div className="relative">
                                <FontAwesomeIcon icon={faArrowUpWideShort} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 dark:text-neutral-600" aria-hidden="true" />
                                <select className={`${mediaFormInputClasses} appearance-none pl-9 pr-10`} value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); pagination.resetPage(); }}>
                                    {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                            </div>
                        </label>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">{filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}</p>
                </div>
            ) : null}

            {!templatesQuery.isPending && !templatesQuery.isError && filteredTemplates.length === 0 ? <EmptyState title={search ? "No matching templates" : "No templates yet"} icon={faCopy} placement="section" actionLabel={search ? "Clear search" : "Create template"} onAction={() => search ? updateSearch("") : openEditor()} /> : null}
            {filteredTemplates.length > 0 ? (
                <div className="flex flex-col gap-4">
                    <ul className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Saved templates">
                        {pagination.pageItems.map((template) => <TemplateCard key={template.id} template={template} code={templateCodeById.get(template.id)} tagNameSet={tagNameSet} tagColorByName={tagColorByName} tagTypeByName={tagTypeByName} metadataAvailable={Boolean(metadata)} onEdit={openEditor} onDelete={setPendingDelete} />)}
                    </ul>
                    <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={pagination.goToPage} label="Template pagination" />
                </div>
            ) : null}
            <DeleteConfirmationModal isOpen={Boolean(pendingDelete)} title="Delete this template?" description="The saved template will be removed. Media that already used it will keep their metadata." confirmLabel="Delete template" isDeleting={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate(pendingDelete.id)} onClose={() => !deleteMutation.isPending && setPendingDelete(null)} />
            <ErrorToast message={deleteMutation.error?.message} />
        </section>
    );
};
