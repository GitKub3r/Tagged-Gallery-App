import { useEffect, useMemo, useState } from "react";
import { faCheck, faList, faPen, faTableCellsLarge, faTrash, faUsers, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useLocation, useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/empty-state/EmptyState";
import { DeleteConfirmationModal } from "../../components/delete-confirmation-modal/DeleteConfirmationModal";
import { PageLoadingSkeleton } from "../../components/loading-skeletons/PageLoadingSkeleton";
import { useAuth } from "../../hooks/useAuth";
import "./UsersPage.css";

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
const formatDate = (value) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("es-ES", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(parsed);
};

const getUserInitial = (username, email) => {
    const source = String(username || email || "?").trim();
    if (!source) {
        return "?";
    }

    return source.charAt(0).toUpperCase();
};

const getRoleBadgeData = (type) => {
    const normalizedType = String(type || "basic").toLowerCase();

    if (normalizedType === "admin") {
        return {
            label: "A",
            title: "Admin",
            toneClass: "tagged-user-role-badge--admin",
        };
    }

    return {
        label: "B",
        title: "Basic",
        toneClass: "tagged-user-role-badge--basic",
    };
};

const UserActionButtons = ({ listedUser, isCurrentUser, isBusy, onEdit, onDelete }) => (
    <div className="flex items-center justify-end gap-2">
        <button
            type="button"
            className="inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border! border-neutral-300! bg-transparent! px-3! py-0! text-xs! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! disabled:opacity-35! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!"
            onClick={() => onEdit(listedUser)}
            disabled={isBusy || isCurrentUser}
        >
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
            <span>Edit</span>
        </button>
        <button
            type="button"
            className="inline-flex! h-9! w-auto! items-center! gap-2! rounded-xl! border! border-red-500/30! bg-transparent! px-3! py-0! text-xs! font-bold! text-red-600! shadow-none! hover:bg-red-500/10! disabled:opacity-35! dark:text-red-400!"
            onClick={() => onDelete(listedUser.id)}
            disabled={isBusy || isCurrentUser}
        >
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
            <span>Delete</span>
        </button>
    </div>
);

export const UsersPage = () => {
    const { user, fetchWithAuth } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editForm, setEditForm] = useState({ username: "", email: "", type: "basic" });
    const [deleteConfirmUserId, setDeleteConfirmUserId] = useState(null);
    const [savingUserId, setSavingUserId] = useState(null);
    const [deletingUserId, setDeletingUserId] = useState(null);

    const isAdmin = user?.type === "admin";

    const renderMode = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("render") === "table" ? "table" : "card";
    }, [location.search]);

    const setRenderMode = (mode) => {
        const params = new URLSearchParams(location.search);
        if (mode === "table") params.set("render", "table");
        else params.delete("render");
        navigate(`?${params.toString()}`);
    };

    const setRoleFilter = (role) => {
        const params = new URLSearchParams(location.search);
        if (role === "all") params.delete("role");
        else params.set("role", role);
        navigate(`?${params.toString()}`);
    };

    const roleFilter = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const role = String(params.get("role") || "").toLowerCase();

        if (role === "admin" || role === "basic") {
            return role;
        }

        return "all";
    }, [location.search]);

    const sortedUsers = useMemo(() => [...users].sort((a, b) => Number(a.id || 0) - Number(b.id || 0)), [users]);

    const filteredUsers = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return sortedUsers.filter((item) => {
            const itemRole = String(item.type || "basic").toLowerCase();
            const username = String(item.username || "").toLowerCase();

            if (roleFilter !== "all" && itemRole !== roleFilter) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return username.includes(normalizedSearch);
        });
    }, [sortedUsers, searchQuery, roleFilter]);

    const editingUser = useMemo(
        () => sortedUsers.find((item) => item.id === editingUserId) || null,
        [sortedUsers, editingUserId],
    );
    const deleteConfirmUser = useMemo(
        () => sortedUsers.find((item) => item.id === deleteConfirmUserId) || null,
        [sortedUsers, deleteConfirmUserId],
    );

    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadUsers = async () => {
            try {
                setLoading(true);
                setError(null);
                setActionError(null);

                const response = await fetchWithAuth(`${API_URL}/users`, { method: "GET" });
                const data = await parseApiResponse(response, "Could not load users");

                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Could not load users");
                }

                if (!cancelled) {
                    setUsers(Array.isArray(data.data) ? data.data : []);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || "Could not load users");
                    setUsers([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadUsers();

        return () => {
            cancelled = true;
        };
    }, [fetchWithAuth, isAdmin]);

    const openEditor = (targetUser) => {
        if (targetUser.id === user?.id) {
            return;
        }

        setActionError(null);
        setEditingUserId(targetUser.id);
        setEditForm({
            username: targetUser.username || "",
            email: targetUser.email || "",
            type: targetUser.type || "basic",
        });
    };

    const closeEditor = () => {
        setEditingUserId(null);
        setEditForm({ username: "", email: "", type: "basic" });
    };

    const openDeleteUserConfirm = (targetUserId) => {
        if (targetUserId === user?.id) {
            setActionError("You cannot delete the currently logged admin account");
            return;
        }

        setActionError(null);
        setDeleteConfirmUserId(targetUserId);
    };

    const closeDeleteUserConfirm = () => {
        if (deletingUserId) {
            return;
        }

        setDeleteConfirmUserId(null);
    };

    const handleUpdateUser = async (targetUserId) => {
        const username = editForm.username.trim();
        const email = editForm.email.trim();
        const type = editForm.type;

        if (!username || !email) {
            setActionError("Username and email are required");
            return;
        }

        try {
            setSavingUserId(targetUserId);
            setActionError(null);

            const response = await fetchWithAuth(`${API_URL}/users/${targetUserId}`, {
                method: "PUT",
                body: JSON.stringify({ username, email, type }),
            });
            const data = await parseApiResponse(response, "Could not update user");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not update user");
            }

            const updatedUser = data.data || { id: targetUserId, username, email, type };
            setUsers((currentUsers) =>
                currentUsers.map((item) => (item.id === targetUserId ? { ...item, ...updatedUser } : item)),
            );
            closeEditor();
        } catch (requestError) {
            setActionError(requestError.message || "Could not update user");
        } finally {
            setSavingUserId(null);
        }
    };

    const handleDeleteUser = async (targetUserId) => {
        if (!targetUserId || deletingUserId) {
            return;
        }

        try {
            setDeletingUserId(targetUserId);
            setActionError(null);

            const response = await fetchWithAuth(`${API_URL}/users/${targetUserId}`, {
                method: "DELETE",
            });
            const data = await parseApiResponse(response, "Could not delete user");

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Could not delete user");
            }

            setUsers((currentUsers) => currentUsers.filter((item) => item.id !== targetUserId));
            setDeleteConfirmUserId(null);

            if (editingUserId === targetUserId) {
                closeEditor();
            }
        } catch (requestError) {
            setActionError(requestError.message || "Could not delete user");
        } finally {
            setDeletingUserId(null);
        }
    };

    useEffect(() => {
        const handleUsersPageKeyDown = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (editingUserId && !savingUserId) {
                closeEditor();
                return;
            }

            if (deleteConfirmUserId && !deletingUserId) {
                closeDeleteUserConfirm();
            }
        };

        window.addEventListener("keydown", handleUsersPageKeyDown);

        return () => {
            window.removeEventListener("keydown", handleUsersPageKeyDown);
        };
    }, [editingUserId, savingUserId, deleteConfirmUserId, deletingUserId]);

    if (!isAdmin) {
        return (
            <section className="tagged-app-page tagged-users-page">
                <article
                    className="tagged-app-page-card tagged-users-empty-card tagged-users-empty-card--restricted"
                    aria-live="polite"
                >
                    <h2>Access restricted</h2>
                    <p>Only administrator accounts are allowed</p>
                    <img className="tagged-users-empty-icon" src="/icons/users.svg" alt="" aria-hidden="true" />
                </article>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="tagged-app-page tagged-users-page">
                <PageLoadingSkeleton ariaLabel="Loading users" />
            </section>
        );
    }

    if (error) {
        return (
            <section className="tagged-app-page tagged-users-page">
                <article
                    className="tagged-app-page-card tagged-users-status-card tagged-users-status-card--error"
                    aria-live="assertive"
                >
                    <h2>Error loading users</h2>
                    <p>{error}</p>
                </article>
            </section>
        );
    }

    return (
        <section className="tagged-app-page tagged-users-page">
            <header className="tagged-users-header">
                <label className="tagged-users-search-field" aria-label="Search users by username">
                    <input
                        type="text"
                        inputMode="search"
                        enterKeyHint="search"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="tagged-users-search-input"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search users by username..."
                    />
                </label>
                <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
                    <p>{filteredUsers.length} accounts found</p>
                    <div className="flex items-center gap-1 rounded-xl border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900" role="group" aria-label="Filter users by role">
                        {["all", "basic", "admin"].map((role) => (
                            <button
                                key={role}
                                type="button"
                                className={`h-8! w-auto! rounded-xl! border-0! px-3! py-0! text-xs! font-bold! capitalize! shadow-none! ${roleFilter === role ? "bg-neutral-950! text-white! dark:bg-neutral-100! dark:text-neutral-950!" : "bg-transparent! text-neutral-500! hover:bg-neutral-100! hover:text-neutral-950! dark:text-neutral-400! dark:hover:bg-neutral-800! dark:hover:text-neutral-100!"}`}
                                onClick={() => setRoleFilter(role)}
                                aria-pressed={roleFilter === role}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2" role="group" aria-label="Users view">
                        <button type="button" className={`inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border! px-3! py-0! text-sm! font-bold! shadow-none! ${renderMode === "table" ? "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!" : "border-neutral-300! bg-white! text-neutral-600! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-300! dark:hover:bg-neutral-800!"}`} onClick={() => setRenderMode("table")} aria-pressed={renderMode === "table"}>
                            <FontAwesomeIcon icon={faList} aria-hidden="true" /><span>Table</span>
                        </button>
                        <button type="button" className={`inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border! px-3! py-0! text-sm! font-bold! shadow-none! ${renderMode === "card" ? "border-neutral-950! bg-neutral-950! text-white! dark:border-neutral-100! dark:bg-neutral-100! dark:text-neutral-950!" : "border-neutral-300! bg-white! text-neutral-600! hover:bg-neutral-100! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-300! dark:hover:bg-neutral-800!"}`} onClick={() => setRenderMode("card")} aria-pressed={renderMode === "card"}>
                            <FontAwesomeIcon icon={faTableCellsLarge} aria-hidden="true" /><span>Card</span>
                        </button>
                    </div>
                </div>
            </header>

            {actionError ? (
                <article
                    className="tagged-app-page-card tagged-users-status-card tagged-users-status-card--error"
                    aria-live="polite"
                >
                    <h2>Action failed</h2>
                    <p>{actionError}</p>
                </article>
            ) : null}

            {sortedUsers.length === 0 ? (
                <EmptyState
                    title="No users available"
                    icon={faUsers}
                    placement="section"
                    actionLabel="Reload users"
                    onAction={() => window.location.reload()}
                />
            ) : filteredUsers.length === 0 ? (
                <EmptyState
                    title="No users found"
                    icon={faUsers}
                    placement="section"
                    actionLabel="Clear filters"
                    onAction={() => {
                        setSearchQuery("");
                        navigate("/users");
                    }}
                />
            ) : renderMode === "card" ? (
                <section className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-label="Admin users cards">
                    {filteredUsers.map((listedUser) => {
                        const isCurrentUserCard = listedUser.id === user?.id;
                        const roleBadge = getRoleBadgeData(listedUser.type);
                        const isBusy = deletingUserId === listedUser.id || savingUserId === listedUser.id;

                        return (
                            <article
                                key={listedUser.id}
                                className={`group rounded-xl border border-neutral-200 bg-white/70 p-4 transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:bg-neutral-900 ${isCurrentUserCard ? "opacity-70" : ""}`}
                                aria-disabled={isCurrentUserCard ? "true" : undefined}
                            >
                                <div className="flex h-full flex-col gap-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span
                                            className={`tagged-user-role-badge ${roleBadge.toneClass}`}
                                            title={roleBadge.title}
                                        >
                                            <span className="tagged-user-role-badge-letter">{roleBadge.label}</span>
                                            <span className="tagged-user-role-badge-text">{roleBadge.title}</span>
                                        </span>
                                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                            Created {formatDate(listedUser.created_at)}
                                        </span>
                                    </div>

                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-neutral-200 text-lg font-black text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" aria-hidden="true">
                                            {getUserInitial(listedUser.username, listedUser.email)}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="truncate text-lg font-bold">{listedUser.username || "Unknown user"}</h2>
                                            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400" title={listedUser.email || "No email"}>{listedUser.email || "No email"}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto border-t border-neutral-200 pt-3 dark:border-neutral-800">
                                        <UserActionButtons listedUser={listedUser} isCurrentUser={isCurrentUserCard} isBusy={isBusy} onEdit={openEditor} onDelete={openDeleteUserConfirm} />
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/70">
                    <table className="w-full min-w-[48rem] border-collapse text-left">
                        <thead className="border-b border-neutral-200 bg-neutral-100/80 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                            <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {filteredUsers.map((listedUser) => {
                                const isCurrentUser = listedUser.id === user?.id;
                                const roleBadge = getRoleBadgeData(listedUser.type);
                                const isBusy = deletingUserId === listedUser.id || savingUserId === listedUser.id;
                                return <tr key={listedUser.id} className="transition-colors hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60">
                                    <td className="px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-200 text-sm font-black text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{getUserInitial(listedUser.username, listedUser.email)}</span><div className="min-w-0"><strong className="block truncate text-sm">{listedUser.username || "Unknown user"}</strong><span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{listedUser.email || "No email"}</span></div></div></td>
                                    <td className="px-4 py-3"><span className={`tagged-user-role-badge ${roleBadge.toneClass}`}><span className="tagged-user-role-badge-letter">{roleBadge.label}</span><span className="tagged-user-role-badge-text">{roleBadge.title}</span></span></td>
                                    <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">{formatDate(listedUser.created_at)}</td>
                                    <td className="px-4 py-3"><UserActionButtons listedUser={listedUser} isCurrentUser={isCurrentUser} isBusy={isBusy} onEdit={openEditor} onDelete={openDeleteUserConfirm} /></td>
                                </tr>;
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {editingUser ? (
                <section
                    className="tagged-users-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-users-edit-modal-title"
                    onClick={closeEditor}
                >
                    <article className="tagged-users-modal-content" onClick={(event) => event.stopPropagation()}>
                        <header className="tagged-users-modal-header">
                            <h2 id="tagged-users-edit-modal-title">Edit user</h2>
                            <button
                                type="button"
                                className="grid! h-10! w-10! place-items-center! rounded-xl! border! border-neutral-300! bg-transparent! p-0! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!"
                                onClick={closeEditor}
                                aria-label="Close edit user modal"
                                disabled={savingUserId === editingUser.id}
                            >
                                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                            </button>
                        </header>

                        <form
                            className="tagged-user-edit-panel"
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleUpdateUser(editingUser.id);
                            }}
                        >
                            <label>
                                <span>Username</span>
                                <input
                                    value={editForm.username}
                                    onChange={(event) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            username: event.target.value,
                                        }))
                                    }
                                    maxLength={50}
                                />
                            </label>

                            <label>
                                <span>Email</span>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(event) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            email: event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <label>
                                <span>Role</span>
                                <select
                                    value={editForm.type}
                                    onChange={(event) =>
                                        setEditForm((current) => ({ ...current, type: event.target.value }))
                                    }
                                >
                                    <option value="basic">Basic</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </label>

                            <div className="tagged-user-edit-actions">
                                <button
                                    type="submit"
                                    className="inline-flex! h-10! w-auto! items-center! gap-2! rounded-xl! border-0! bg-neutral-950! px-4! py-0! text-sm! font-bold! text-white! shadow-none! hover:bg-neutral-800! disabled:opacity-50! dark:bg-neutral-100! dark:text-neutral-950! dark:hover:bg-white!"
                                    disabled={savingUserId === editingUser.id}
                                >
                                    <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                                    <span>{savingUserId === editingUser.id ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                    type="button"
                                    className="h-10! w-auto! rounded-xl! border! border-neutral-300! bg-transparent! px-4! py-0! text-sm! font-bold! text-neutral-600! shadow-none! hover:bg-neutral-100! dark:border-neutral-700! dark:text-neutral-300! dark:hover:bg-neutral-800!"
                                    onClick={closeEditor}
                                    disabled={savingUserId === editingUser.id}
                                >
                                    <span>Cancel</span>
                                </button>
                            </div>
                        </form>
                    </article>
                </section>
            ) : null}

            <DeleteConfirmationModal
                isOpen={Boolean(deleteConfirmUser)}
                title="Delete this user?"
                description={deleteConfirmUser
                    ? "The account " + (deleteConfirmUser.username || "selected") + " will be permanently removed."
                    : ""}
                confirmLabel="Delete user"
                isDeleting={Boolean(deletingUserId)}
                onConfirm={() => deleteConfirmUser && handleDeleteUser(deleteConfirmUser.id)}
                onClose={closeDeleteUserConfirm}
            />
        </section>
    );
};
