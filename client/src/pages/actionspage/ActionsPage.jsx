import { useEffect, useMemo, useState } from "react";
import { faList, faListCheck, faMagnifyingGlass, faPen, faPlus, faTableCellsLarge, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useLocation, useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { useAuth } from "../../hooks/useAuth";
import { useDevTools } from "../../hooks/useDevTools";
import "./ActionsPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

const parseApiResponse = async (response, fallbackMessage) => {
    const clonedResponse = response.clone();

    try {
        return await response.json();
    } catch {
        let bodyText = "";

        try {
            bodyText = (await clonedResponse.text()).trim();
        } catch {
            bodyText = "";
        }

        return {
            success: false,
            message: bodyText || fallbackMessage,
        };
    }
};

const normalizeActionCode = (value) =>
    String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");

const countCharacters = (value) => String(value || "").length;

const emptyForm = {
    actionname: "",
    actioncode: "",
    description: "",
    is_active: true,
};

const ActionButtons = ({ action, onEdit, onDelete }) => (
    <div className="flex items-center justify-end gap-2">
        <button type="button" className="inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border! border-neutral-300! bg-transparent! px-3! py-0! text-xs! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!" onClick={() => onEdit(action)}>
            <FontAwesomeIcon icon={faPen} aria-hidden="true" /><span>Edit</span>
        </button>
        <button type="button" className="inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border! border-red-500/30! bg-transparent! px-3! py-0! text-xs! font-bold! text-red-600! shadow-none! hover:bg-red-500/10! dark:text-red-400!" onClick={() => onDelete(action.id)}>
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" /><span>Delete</span>
        </button>
    </div>
);

export const ActionsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, fetchWithAuth } = useAuth();
    const { forceLoading } = useDevTools();

    const [actions, setActions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [editorMode, setEditorMode] = useState(null);
    const [editingActionId, setEditingActionId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirmActionId, setDeleteConfirmActionId] = useState(null);
    const [deletingActionId, setDeletingActionId] = useState(null);

    const isAdmin = user?.type === "admin";

    const renderMode = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const mode = String(params.get("render") || "table").toLowerCase();
        return mode === "card" ? "card" : "table";
    }, [location.search]);

    const sortedActions = useMemo(
        () => [...actions].sort((a, b) => String(a.actionname || "").localeCompare(String(b.actionname || ""))),
        [actions],
    );

    const filteredActions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return sortedActions;
        }

        return sortedActions.filter((item) => {
            const name = String(item.actionname || "").toLowerCase();
            const code = String(item.actioncode || "").toLowerCase();
            const description = String(item.description || "").toLowerCase();

            return name.includes(query) || code.includes(query) || description.includes(query);
        });
    }, [sortedActions, searchQuery]);

    const stats = useMemo(() => {
        const total = actions.length;
        const active = actions.filter((item) => Boolean(item.is_active)).length;
        const inactive = total - active;

        return { total, active, inactive };
    }, [actions]);

    const deleteConfirmAction = useMemo(
        () => actions.find((item) => item.id === deleteConfirmActionId) || null,
        [actions, deleteConfirmActionId],
    );

    const descriptionCharCount = useMemo(() => countCharacters(form.description), [form.description]);

    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadActions = async () => {
            try {
                setLoading(true);
                setError(null);
                setActionError(null);

                const response = await fetchWithAuth(`${API_URL}/logs/actions`, { method: "GET" });
                const payload = await parseApiResponse(response, "Could not load actions");

                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || "Could not load actions");
                }

                if (!cancelled) {
                    setActions(Array.isArray(payload.data) ? payload.data : []);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load actions");
                    setActions([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadActions();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, isAdmin]);

    const closeEditor = () => {
        if (saving) {
            return;
        }
        setEditorMode(null);
        setEditingActionId(null);
        setForm(emptyForm);
    };

    const openCreateEditor = () => {
        setActionError(null);
        setEditorMode("create");
        setEditingActionId(null);
        setForm(emptyForm);
    };

    const openEditEditor = (action) => {
        setActionError(null);
        setEditorMode("edit");
        setEditingActionId(action.id);
        setForm({
            actionname: action.actionname || "",
            actioncode: action.actioncode || "",
            description: action.description || "",
            is_active: Boolean(action.is_active),
        });
    };

    const openDeleteConfirm = (actionId) => {
        setActionError(null);
        setDeleteConfirmActionId(actionId);
    };

    const closeDeleteConfirm = () => {
        if (deletingActionId) {
            return;
        }
        setDeleteConfirmActionId(null);
    };

    const handleCodeAutofill = () => {
        if (form.actioncode.trim()) {
            return;
        }

        setForm((current) => ({
            ...current,
            actioncode: normalizeActionCode(current.actionname),
        }));
    };

    const handleDescriptionChange = (nextValue) => {
        const limitedValue = String(nextValue || "").slice(0, 150);

        setForm((current) => ({
            ...current,
            description: limitedValue,
        }));
    };

    const handleSaveAction = async () => {
        const actionname = form.actionname.trim();
        const actioncode = normalizeActionCode(form.actioncode || form.actionname);
        const description = form.description.trim();

        if (!actionname) {
            setActionError("Action name is required");
            return;
        }

        if (!actioncode) {
            setActionError("Action code is required");
            return;
        }

        try {
            setSaving(true);
            setActionError(null);

            const isEditing = editorMode === "edit" && editingActionId;
            const endpoint = isEditing ? `${API_URL}/logs/actions/${editingActionId}` : `${API_URL}/logs/actions`;
            const method = isEditing ? "PUT" : "POST";

            const response = await fetchWithAuth(endpoint, {
                method,
                body: JSON.stringify({
                    actionname,
                    actioncode,
                    description: description || null,
                    is_active: Boolean(form.is_active),
                }),
            });
            const payload = await parseApiResponse(response, "Could not save action");

            if (!response.ok || !payload.success) {
                throw new Error(payload.message || "Could not save action");
            }

            const savedAction = payload.data || null;

            if (savedAction) {
                setActions((current) => {
                    if (isEditing) {
                        return current.map((item) => (item.id === savedAction.id ? savedAction : item));
                    }

                    return [...current, savedAction];
                });
            }

            closeEditor();
        } catch (requestError) {
            setActionError(requestError.message || "Could not save action");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAction = async (actionId) => {
        if (!actionId || deletingActionId) {
            return;
        }

        try {
            setDeletingActionId(actionId);
            setActionError(null);

            const response = await fetchWithAuth(`${API_URL}/logs/actions/${actionId}`, { method: "DELETE" });
            const payload = await parseApiResponse(response, "Could not delete action");

            if (!response.ok || !payload.success) {
                throw new Error(payload.message || "Could not delete action");
            }

            setActions((current) => current.filter((item) => item.id !== actionId));
            setDeleteConfirmActionId(null);
        } catch (requestError) {
            setActionError(requestError.message || "Could not delete action");
        } finally {
            setDeletingActionId(null);
        }
    };

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (editorMode) {
                closeEditor();
                return;
            }

            if (deleteConfirmActionId) {
                closeDeleteConfirm();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [editorMode, deleteConfirmActionId, saving, deletingActionId]);

    if (!isAdmin) {
        return (
            <section className="tagged-app-page tagged-actions-page">
                <article
                    className="tagged-app-page-card tagged-actions-empty-card tagged-actions-empty-card--restricted"
                    aria-live="polite"
                >
                    <h2>Access restricted</h2>
                    <p>Only administrator accounts are allowed</p>
                    <img className="tagged-actions-empty-icon" src="/icons/logs.svg" alt="" aria-hidden="true" />
                </article>
            </section>
        );
    }

    if (loading || forceLoading) {
        return (
            <section className="tagged-app-page tagged-actions-page">
                <PageLoadingSkeleton ariaLabel="Loading actions" />
            </section>
        );
    }

    if (error) {
        return (
            <section className="tagged-app-page tagged-actions-page">
                <article
                    className="tagged-app-page-card tagged-actions-status-card tagged-actions-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Error loading actions</h2>
                    <p>{error}</p>
                </article>
            </section>
        );
    }

    return (
        <section className="tagged-app-page tagged-actions-page">
            <section className="tagged-actions-stats" aria-label="Actions summary">
                <article className="tagged-app-page-card tagged-actions-stat-card tagged-actions-stat-card--violet">
                    <span className="tagged-actions-stat-label">Total actions</span>
                    <strong className="tagged-actions-stat-value">{stats.total}</strong>
                    <p className="tagged-actions-stat-hint">{filteredActions.length} under current search</p>
                </article>
                <article className="tagged-app-page-card tagged-actions-stat-card tagged-actions-stat-card--teal">
                    <span className="tagged-actions-stat-label">Active</span>
                    <strong className="tagged-actions-stat-value">{stats.active}</strong>
                    <p className="tagged-actions-stat-hint">Visible in action selectors</p>
                </article>
                <article className="tagged-app-page-card tagged-actions-stat-card tagged-actions-stat-card--rose">
                    <span className="tagged-actions-stat-label">Inactive</span>
                    <strong className="tagged-actions-stat-value">{stats.inactive}</strong>
                    <p className="tagged-actions-stat-hint">Hidden but preserved for history</p>
                </article>
            </section>

            <header className="tagged-actions-header">
                <label className="tagged-actions-search-field" aria-label="Search actions">
                    <span>Search</span>
                    <input
                        type="text"
                        inputMode="search"
                        enterKeyHint="search"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="tagged-actions-search-input"
                        placeholder="Search action name, code or description..."
                    />
                </label>

                <div className="tagged-actions-header-right">
                    <button type="button" className="inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border! border-neutral-950! bg-neutral-950! px-4! py-0! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white!" onClick={openCreateEditor}>
                        <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                        <span>New action</span>
                    </button>

                    <button
                        type="button"
                        className={`inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border! px-3! py-0! text-sm! font-bold! shadow-none! ${renderMode === "table" ? "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!" : "border-neutral-300! bg-white! text-neutral-600! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-300! dark:hover:bg-neutral-800!"}`}
                        onClick={() => {
                            const params = new URLSearchParams(location.search);
                            params.set("render", "table");
                            navigate(`?${params.toString()}`);
                        }}
                        aria-pressed={renderMode === "table"}
                        title="Table view"
                    >
                        <FontAwesomeIcon icon={faList} aria-hidden="true" />
                        <span>Table</span>
                    </button>

                    <button
                        type="button"
                        className={`inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border! px-3! py-0! text-sm! font-bold! shadow-none! ${renderMode === "card" ? "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!" : "border-neutral-300! bg-white! text-neutral-600! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-300! dark:hover:bg-neutral-800!"}`}
                        onClick={() => {
                            const params = new URLSearchParams(location.search);
                            params.set("render", "card");
                            navigate(`?${params.toString()}`);
                        }}
                        aria-pressed={renderMode === "card"}
                        title="Card view"
                    >
                        <FontAwesomeIcon icon={faTableCellsLarge} aria-hidden="true" />
                        <span>Card</span>
                    </button>
                </div>
            </header>

            {actionError ? (
                <article
                    className="tagged-app-page-card tagged-actions-status-card tagged-actions-status-card--error"
                    aria-live="polite"
                >
                    <h2>Action failed</h2>
                    <p>{actionError}</p>
                </article>
            ) : null}

            {actions.length === 0 ? (
                <EmptyState
                    title="No actions available"
                    icon={faListCheck}
                    placement="section"
                    actionLabel="Create action"
                    onAction={openCreateEditor}
                />
            ) : filteredActions.length === 0 ? (
                <EmptyState
                    title="No matching actions"
                    icon={faMagnifyingGlass}
                    placement="section"
                    actionLabel="Clear search"
                    onAction={() => setSearchQuery("")}
                />
            ) : renderMode === "table" ? (
                <section className="tagged-actions-table-wrap" aria-label="Actions table">
                    <table className="tagged-actions-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Status</th>
                                <th>Description</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredActions.map((action) => (
                                <tr key={action.id} className="tagged-actions-row">
                                    <td>{action.actionname || "Unnamed action"}</td>
                                    <td className="tagged-actions-table-code">{action.actioncode || "-"}</td>
                                    <td>
                                        <span
                                            className={`tagged-action-status${action.is_active ? " is-active" : " is-inactive"}`}
                                        >
                                            {action.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="tagged-actions-table-description">
                                        {action.description || "No description"}
                                    </td>
                                    <td>
                                        {action.updated_at
                                            ? new Date(action.updated_at).toLocaleDateString("es-ES")
                                            : "-"}
                                    </td>
                                    <td>
                                        <ActionButtons action={action} onEdit={openEditEditor} onDelete={openDeleteConfirm} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            ) : (
                <section className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-label="Actions list">
                    {filteredActions.map((action) => (
                        <article key={action.id} className="group flex min-h-48 flex-col gap-3 rounded-xl border border-neutral-200 bg-white/70 p-4 transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:bg-neutral-900">
                            <header className="flex items-start justify-between gap-3">
                                <h2 className="m-0 text-base font-bold leading-5">{action.actionname || "Unnamed action"}</h2>
                                <span
                                    className={`tagged-action-status${action.is_active ? " is-active" : " is-inactive"}`}
                                >
                                    {action.is_active ? "Active" : "Inactive"}
                                </span>
                            </header>

                            <p className="m-0 break-words text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{action.actioncode || "-"}</p>
                            <p className="m-0 text-sm leading-5 text-neutral-500 dark:text-neutral-400">{action.description || "No description"}</p>

                            <footer className="mt-auto border-t border-neutral-200 pt-3 dark:border-neutral-800">
                                <ActionButtons action={action} onEdit={openEditEditor} onDelete={openDeleteConfirm} />
                            </footer>
                        </article>
                    ))}
                </section>
            )}

            {editorMode ? (
                <section
                    className="tagged-actions-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-actions-editor-title"
                    onClick={closeEditor}
                >
                    <article className="tagged-actions-modal-content" onClick={(event) => event.stopPropagation()}>
                        <header className="tagged-actions-modal-header">
                            <h2 id="tagged-actions-editor-title">
                                {editorMode === "create" ? "Create action" : "Edit action"}
                            </h2>
                            <button
                                type="button"
                                className="tagged-actions-modal-close"
                                onClick={closeEditor}
                                aria-label="Close action editor"
                                disabled={saving}
                            >
                                <img src="/icons/close.svg" alt="" aria-hidden="true" />
                            </button>
                        </header>

                        <form
                            className="tagged-actions-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleSaveAction();
                            }}
                        >
                            <label>
                                <span>Name</span>
                                <input
                                    value={form.actionname}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            actionname: event.target.value,
                                        }))
                                    }
                                    onBlur={handleCodeAutofill}
                                    maxLength={120}
                                />
                            </label>

                            <label>
                                <span>Code</span>
                                <input
                                    value={form.actioncode}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            actioncode: normalizeActionCode(event.target.value),
                                        }))
                                    }
                                    placeholder="EXAMPLE_ACTION_CODE"
                                    maxLength={120}
                                />
                            </label>

                            <label>
                                <span>
                                    Description{" "}
                                    <small>
                                        <span className="tagged-actions-separator-dot" aria-hidden="true" />
                                        {descriptionCharCount}/150 letters
                                    </small>
                                </span>
                                <textarea
                                    value={form.description}
                                    onChange={(event) => handleDescriptionChange(event.target.value)}
                                    rows={4}
                                    placeholder="Optional description"
                                    maxLength={150}
                                />
                            </label>

                            <label className="tagged-actions-active-toggle">
                                <span>Active action</span>
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            is_active: event.target.checked,
                                        }))
                                    }
                                />
                            </label>

                            <div className="tagged-actions-form-actions">
                                <button type="button" className="tagged-actions-secondary" onClick={closeEditor}>
                                    Cancel
                                </button>
                                <button type="submit" className="tagged-actions-primary" disabled={saving}>
                                    {saving ? "Saving..." : editorMode === "create" ? "Create" : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </article>
                </section>
            ) : null}

            <DeleteConfirmationModal
                isOpen={Boolean(deleteConfirmAction)}
                title="Delete this action?"
                description={deleteConfirmAction
                    ? (deleteConfirmAction.actionname || "This action") + " will be removed if it is not referenced by history logs."
                    : ""}
                confirmLabel="Delete action"
                isDeleting={Boolean(deletingActionId)}
                onConfirm={() => deleteConfirmAction && handleDeleteAction(deleteConfirmAction.id)}
                onClose={closeDeleteConfirm}
            />
        </section>
    );
};
