import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { faCopy, faHeart, faPen, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { metadataApi, metadataQueryKeys } from "../../api/metadataApi";
import { templateApi, templateQueryKeys } from "../../api/templateApi";
import { CheckboxControl } from "../../components/checkbox-control/CheckboxControl";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { IconButton } from "../../components/icon-button/IconButton";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { MediaFormModal, MediaMetadataFields } from "../../components/media-form-modal/MediaFormModal";
import { mediaFormInputClasses } from "../../components/media-form-modal/mediaFormStyles";
import { ErrorToast } from "../../components/toast/ErrorToast";
import { useAuth } from "../../hooks/useAuth";
import { useDevTools } from "../../hooks/useDevTools";
import { useTemplates } from "../../hooks/useTemplates";
import { rankSuggestions } from "../../utils/suggestionRanking";
import { buildDefaultTagStyle } from "../../utils/tagStyle";

const uniqueNames = (items) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const TemplateEditor = ({ template, isSaving, error, onSave, onCancel }) => {
    const [name, setName] = useState(template?.name || "");
    const [displayName, setDisplayName] = useState(template?.displayname || "");
    const [author, setAuthor] = useState(template?.author || "");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState(template?.tags || []);
    const [markFavourite, setMarkFavourite] = useState(Boolean(template?.mark_favourite));
    const [activeField, setActiveField] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [localError, setLocalError] = useState("");
    const { accessToken } = useAuth();
    const metadataQuery = useQuery({
        queryKey: metadataQueryKeys.all,
        queryFn: () => metadataApi.getAll(accessToken),
        enabled: Boolean(accessToken),
    });
    const metadata = metadataQuery.data;
    const tagNames = uniqueNames((metadata?.tags || []).map((item) => item.tagname));
    const displayNameSuggestions = rankSuggestions(uniqueNames((metadata?.displayNames || []).map((item) => typeof item === "string" ? item : item.displayname)), displayName).slice(0, 8);
    const authorSuggestions = rankSuggestions(uniqueNames((metadata?.authors || []).map((item) => typeof item === "string" ? item : item.author)), author).slice(0, 8);
    const tagSuggestions = rankSuggestions(tagNames.filter((item) => !tags.some((tag) => tag.toLowerCase() === item.toLowerCase())), tagInput).slice(0, 8);
    const suggestions = { displayname: displayNameSuggestions, author: authorSuggestions, tag: tagSuggestions };

    const closeSuggestions = () => { setActiveField(null); setActiveIndex(0); };
    const addTag = (value) => {
        const next = String(value || "").trim();
        if (next && !tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) setTags((current) => [...current, next]);
        setTagInput("");
        closeSuggestions();
    };
    const selectSuggestion = (field, value) => {
        if (field === "displayname") setDisplayName(value);
        else if (field === "author") setAuthor(value);
        else addTag(value);
        closeSuggestions();
    };
    const handleSuggestionKeyDown = (event, field) => {
        const items = suggestions[field] || [];
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length > 0) {
            event.preventDefault();
            setActiveField(field);
            setActiveIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
        } else if (event.key === "Enter" && field === "tag") {
            event.preventDefault();
            addTag(activeField === field && items.length ? items[activeIndex] : tagInput);
        } else if (event.key === "Enter" && activeField === field && items.length) {
            event.preventDefault();
            selectSuggestion(field, items[activeIndex]);
        } else if (event.key === "Escape" && activeField) {
            event.preventDefault();
            closeSuggestions();
        }
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        const pendingTag = tagInput.trim();
        const nextTags = pendingTag && !tags.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase()) ? [...tags, pendingTag] : tags;
        if (!displayName.trim() && !author.trim() && nextTags.length === 0 && !markFavourite) {
            setLocalError("Add a media name, author, tag or favourite action.");
            return;
        }
        setLocalError("");
        onSave({ id: template?.id, name: name.trim(), displayname: displayName.trim(), author: author.trim(), tags: nextTags, mark_favourite: markFavourite });
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
                        compact
                        displayNameInput={displayName}
                        authorInput={author}
                        tagInput={tagInput}
                        displayNamePlaceholder="Optional media name"
                        selectedTags={tags}
                        existingTagNames={tagNames}
                        activeSuggestionField={activeField}
                        activeSuggestionIndex={activeIndex}
                        displayNameSuggestions={displayNameSuggestions}
                        authorSuggestions={authorSuggestions}
                        tagSuggestions={tagSuggestions}
                        error={localError || error}
                        onDisplayNameChange={(event) => { setDisplayName(event.target.value); setActiveField("displayname"); setActiveIndex(0); }}
                        onAuthorChange={(event) => { setAuthor(event.target.value); setActiveField("author"); setActiveIndex(0); }}
                        onTagInputChange={(event) => { setTagInput(event.target.value); setActiveField("tag"); setActiveIndex(0); }}
                        onOpenSuggestions={(field) => { setActiveField(field); setActiveIndex(0); }}
                        onCloseSuggestions={closeSuggestions}
                        onSuggestionKeyDown={handleSuggestionKeyDown}
                        onSelectDisplayName={(value) => selectSuggestion("displayname", value)}
                        onSelectAuthor={(value) => selectSuggestion("author", value)}
                        onAddTag={addTag}
                        onRemoveTag={(value) => setTags((current) => current.filter((tag) => tag !== value))}
                        getTagStyle={buildDefaultTagStyle}
                    />
                    <label className="mt-4 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100/60 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/50">
                        <CheckboxControl checked={markFavourite} onChange={setMarkFavourite} disabled={isSaving} />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">Mark media as favourite</span>
                            <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">Applied media will be added to favourites when saved.</span>
                        </span>
                    </label>
                </div>
                <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" className="h-11! w-full! rounded-xl! border! border-neutral-300! bg-transparent! px-4! text-sm! font-semibold! text-neutral-700! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-200! dark:hover:bg-neutral-800! sm:w-auto!" onClick={onCancel} disabled={isSaving}>Cancel</button>
                    <button type="submit" className="h-11! w-full! rounded-xl! border-0! bg-neutral-950! px-5! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white! sm:w-auto!" disabled={isSaving || !name.trim()}>{isSaving ? "Saving..." : "Save template"}</button>
                </footer>
            </form>
        </MediaFormModal>
    );
};

const TemplateCard = ({ template, onEdit, onDelete }) => {
    const hasMediaDetails = Boolean(template.displayname || template.author);

    return (
        <li className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
            <div className="flex min-w-0 items-start gap-3">
                <h2 className="min-w-0 flex-1 truncate pt-1 text-lg font-bold" title={template.name}>{template.name}</h2>
                <div className="flex shrink-0 gap-1">
                    <IconButton onClick={() => onEdit(template)} aria-label={`Edit ${template.name}`} title={`Edit ${template.name}`}><FontAwesomeIcon icon={faPen} /></IconButton>
                    <IconButton onClick={() => onDelete(template)} aria-label={`Delete ${template.name}`} title={`Delete ${template.name}`}><FontAwesomeIcon icon={faTrash} /></IconButton>
                </div>
            </div>
            {hasMediaDetails ? (
                <dl className={`mt-3 grid gap-2 ${template.displayname && template.author ? "sm:grid-cols-2" : ""}`}>
                    {template.displayname ? <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950"><dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Media name</dt><dd className="mt-0.5 truncate text-sm font-semibold" title={template.displayname}>{template.displayname}</dd></div> : null}
                    {template.author ? <div className="min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950"><dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Author</dt><dd className="mt-0.5 truncate text-sm font-semibold" title={template.author}>{template.author}</dd></div> : null}
                </dl>
            ) : null}
            {template.tags.length > 0 ? (
                <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${hasMediaDetails ? "mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800" : "mt-3"}`}>
                    <span className="mr-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Tags</span>
                    {template.tags.map((tag) => <span key={tag} className="max-w-full truncate rounded-xl border border-neutral-300 px-2 py-1 text-xs font-medium dark:border-neutral-700" title={tag}>{tag}</span>)}
                </div>
            ) : null}
            {template.mark_favourite ? <div className="mt-3 text-xs font-semibold text-neutral-600 dark:text-neutral-300"><FontAwesomeIcon icon={faHeart} className="mr-1.5" aria-hidden="true" />Auto favourite</div> : null}
        </li>
    );
};

export const TemplatesPage = () => {
    const { user } = useAuth();
    const { forceLoading } = useDevTools();
    const queryClient = useQueryClient();
    const templatesQuery = useTemplates();
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [search, setSearch] = useState("");
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
    const searchTerm = search.trim().toLowerCase();
    const filteredTemplates = searchTerm ? templates.filter((template) => [template.name, template.displayname, template.author, ...template.tags].some((value) => value.toLowerCase().includes(searchTerm))) : templates;
    const openEditor = (template = null) => { saveMutation.reset(); setEditingTemplate(template); setIsEditorOpen(true); };

    if (forceLoading) return <section className="tagged-app-page"><PageLoadingSkeleton variant="list" ariaLabel="Forced templates loading preview" /></section>;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Library settings</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Templates</h1><p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">Save media details and add to favourites automatically when applied.</p></div>
                <button type="button" className="inline-flex! h-11! w-full! shrink-0! items-center! justify-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white! sm:w-auto!" onClick={() => openEditor()}><FontAwesomeIcon icon={faPlus} aria-hidden="true" />New template</button>
            </header>

            {isEditorOpen ? <TemplateEditor key={editingTemplate?.id || "new"} template={editingTemplate} isSaving={saveMutation.isPending} error={saveMutation.error?.message} onSave={(template) => saveMutation.mutate(template)} onCancel={() => !saveMutation.isPending && setIsEditorOpen(false)} /> : null}

            {!templatesQuery.isPending && !templatesQuery.isError && templates.length > 0 ? (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="block w-full max-w-sm text-sm font-semibold"><span className="mb-1.5 block">Search templates</span><input type="search" className={mediaFormInputClasses} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, author or tag" /></label>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">{filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}</p>
                </div>
            ) : null}
            {templatesQuery.isPending ? <PageLoadingSkeleton variant="list" ariaLabel="Loading templates" /> : null}
            {templatesQuery.isError ? <LoadErrorState title="Could not load templates" onRetry={() => templatesQuery.refetch()} placement="section" /> : null}
            {!templatesQuery.isPending && !templatesQuery.isError && filteredTemplates.length === 0 ? <EmptyState title={search ? "No matching templates" : "No templates yet"} icon={faCopy} placement="section" actionLabel={search ? "Clear search" : "Create template"} onAction={() => search ? setSearch("") : openEditor()} /> : null}
            {filteredTemplates.length > 0 ? (
                <ul className="grid items-start gap-3 lg:grid-cols-2" aria-label="Saved templates">
                    {filteredTemplates.map((template) => <TemplateCard key={template.id} template={template} onEdit={openEditor} onDelete={setPendingDelete} />)}
                </ul>
            ) : null}
            <DeleteConfirmationModal isOpen={Boolean(pendingDelete)} title="Delete this template?" description="The saved template will be removed. Media that already used it will keep their metadata." confirmLabel="Delete template" isDeleting={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate(pendingDelete.id)} onClose={() => !deleteMutation.isPending && setPendingDelete(null)} />
            <ErrorToast message={deleteMutation.error?.message} />
        </section>
    );
};
