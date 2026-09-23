import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { faCopy, faPen, faPlus, faTag, faTrash, faUser, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { metadataApi, metadataQueryKeys } from "../../api/metadataApi";
import { templateApi, templateQueryKeys } from "../../api/templateApi";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { IconButton } from "../../components/icon-button/IconButton";
import { LoadErrorState } from "../../components/load-error-state/LoadErrorState";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { MediaMetadataFields } from "../../components/media-form-modal/MediaFormModal";
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
        } else if (event.key === "Escape") {
            closeSuggestions();
        }
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        const pendingTag = tagInput.trim();
        const nextTags = pendingTag && !tags.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase()) ? [...tags, pendingTag] : tags;
        if (!displayName.trim() && !author.trim() && nextTags.length === 0) {
            setLocalError("Add a media name, author or tag.");
            return;
        }
        setLocalError("");
        onSave({ id: template?.id, name: name.trim(), displayname: displayName.trim(), author: author.trim(), tags: nextTags });
    };

    return (
        <form className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6" onSubmit={handleSubmit}>
            <div className="mb-5 flex items-start justify-between gap-3">
                <div><h2 className="text-xl font-bold">{template ? "Edit template" : "New template"}</h2><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Saved fields become a starting point for uploads and edits.</p></div>
                <IconButton type="button" onClick={onCancel} disabled={isSaving} aria-label="Close template editor"><FontAwesomeIcon icon={faXmark} /></IconButton>
            </div>
            <label className="mb-5 block text-sm font-semibold">
                <span className="mb-1.5 block">Template name</span>
                <input className={mediaFormInputClasses} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="For example: Travel photos" required autoFocus />
            </label>
            <MediaMetadataFields
                displayNameInput={displayName}
                authorInput={author}
                tagInput={tagInput}
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
            <footer className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="h-11! w-full! rounded-xl! border! border-neutral-300! bg-transparent! px-4! text-sm! font-semibold! text-neutral-700! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-200! dark:hover:bg-neutral-800! sm:w-auto!" onClick={onCancel} disabled={isSaving}>Cancel</button>
                <button type="submit" className="h-11! w-full! rounded-xl! border-0! bg-neutral-950! px-5! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white! sm:w-auto!" disabled={isSaving || !name.trim()}>{isSaving ? "Saving..." : "Save template"}</button>
            </footer>
        </form>
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
    const filteredTemplates = searchTerm ? templates.filter((template) => template.name.toLowerCase().includes(searchTerm)) : templates;
    const openEditor = (template = null) => { saveMutation.reset(); setEditingTemplate(template); setIsEditorOpen(true); };

    if (forceLoading) return <section className="tagged-app-page"><PageLoadingSkeleton variant="list" ariaLabel="Forced templates loading preview" /></section>;

    return (
        <section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">
            <header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Library settings</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Templates</h1><p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">Save a media name, author and tags to reuse as a starting point.</p></div>
                <button type="button" className="inline-flex! h-11! w-full! shrink-0! items-center! justify-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white! sm:w-auto!" onClick={() => openEditor()}><FontAwesomeIcon icon={faPlus} aria-hidden="true" />New template</button>
            </header>

            {isEditorOpen ? <div className="mb-6 max-w-3xl"><TemplateEditor key={editingTemplate?.id || "new"} template={editingTemplate} isSaving={saveMutation.isPending} error={saveMutation.error?.message} onSave={(template) => saveMutation.mutate(template)} onCancel={() => !saveMutation.isPending && setIsEditorOpen(false)} /></div> : null}

            {!templatesQuery.isPending && !templatesQuery.isError && templates.length > 0 ? (
                <label className="mb-5 block max-w-sm text-sm font-semibold"><span className="mb-1.5 block">Search templates</span><input type="search" className={mediaFormInputClasses} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></label>
            ) : null}
            {templatesQuery.isPending ? <PageLoadingSkeleton variant="list" ariaLabel="Loading templates" /> : null}
            {templatesQuery.isError ? <LoadErrorState title="Could not load templates" onRetry={() => templatesQuery.refetch()} placement="section" /> : null}
            {!isEditorOpen && !templatesQuery.isPending && !templatesQuery.isError && filteredTemplates.length === 0 ? <EmptyState title={search ? "No matching templates" : "No templates yet"} icon={faCopy} placement="section" actionLabel={search ? "Clear search" : "Create template"} onAction={() => search ? setSearch("") : openEditor()} /> : null}
            {filteredTemplates.length > 0 ? (
                <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Saved templates">
                    {filteredTemplates.map((template) => (
                        <li key={template.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
                            <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-bold" title={template.name}>{template.name}</h2><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Reusable media metadata</p></div><div className="flex shrink-0 gap-1"><IconButton onClick={() => openEditor(template)} aria-label={`Edit ${template.name}`} title={`Edit ${template.name}`}><FontAwesomeIcon icon={faPen} /></IconButton><IconButton onClick={() => setPendingDelete(template)} aria-label={`Delete ${template.name}`} title={`Delete ${template.name}`}><FontAwesomeIcon icon={faTrash} /></IconButton></div></div>
                            <dl className="grid gap-2 text-sm"><div className="flex gap-2"><dt className="w-24 shrink-0 text-neutral-500 dark:text-neutral-400">Media name</dt><dd className="min-w-0 break-words font-semibold">{template.displayname || "—"}</dd></div><div className="flex gap-2"><dt className="w-24 shrink-0 text-neutral-500 dark:text-neutral-400"><FontAwesomeIcon icon={faUser} className="mr-1" aria-hidden="true" />Author</dt><dd className="min-w-0 break-words font-semibold">{template.author || "—"}</dd></div></dl>
                            <div className="mt-auto"><p className="mb-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400"><FontAwesomeIcon icon={faTag} className="mr-1" aria-hidden="true" />{template.tags.length} {template.tags.length === 1 ? "tag" : "tags"}</p><div className="flex flex-wrap gap-1.5">{template.tags.map((tag) => <span key={tag} className="rounded-xl border border-neutral-300 px-2 py-1 text-xs font-semibold dark:border-neutral-700">{tag}</span>)}{template.tags.length === 0 ? <span className="text-xs text-neutral-500 dark:text-neutral-400">No tags</span> : null}</div></div>
                        </li>
                    ))}
                </ul>
            ) : null}
            <DeleteConfirmationModal isOpen={Boolean(pendingDelete)} title="Delete this template?" description="The saved template will be removed. Media that already used it will keep their metadata." confirmLabel="Delete template" isDeleting={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate(pendingDelete.id)} onClose={() => !deleteMutation.isPending && setPendingDelete(null)} />
            <ErrorToast message={deleteMutation.error?.message} />
        </section>
    );
};
