import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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

export const UsersPage = () => {
    const { user, fetchWithAuth } = useAuth();
    const location = useLocation();
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
                <article className="tagged-app-page-card tagged-users-status-card" aria-live="polite">
                    <h2>Loading users</h2>
                    <p>Preparing admin directory.</p>
                </article>
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
                <p>{filteredUsers.length} accounts found</p>
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
                <article className="tagged-app-page-card tagged-users-empty-card" aria-live="polite">
                    <h2>No users available</h2>
                    <p>There are no user accounts to display yet.</p>
                    <img className="tagged-users-empty-icon" src="/icons/users.svg" alt="" aria-hidden="true" />
                </article>
            ) : filteredUsers.length === 0 ? (
                <article className="tagged-app-page-card tagged-users-status-card" aria-live="polite">
                    <h2>No users found</h2>
                    <p>Try another username or clear the active role filter.</p>
                </article>
            ) : (
                <section className="tagged-users-grid" aria-label="Admin users list">
                    {filteredUsers.map((listedUser) => {
                        const isCurrentUserCard = listedUser.id === user?.id;
                        const roleBadge = getRoleBadgeData(listedUser.type);

                        return (
                            <article
                                key={listedUser.id}
                                className={`tagged-app-page-card tagged-user-card${isCurrentUserCard ? " is-self" : ""}`}
                                aria-disabled={isCurrentUserCard ? "true" : undefined}
                            >
                                <div className="tagged-user-card-grid">
                                    <div className="tagged-user-top-row">
                                        <span
                                            className={`tagged-user-role-badge ${roleBadge.toneClass}`}
                                            title={roleBadge.title}
                                        >
                                            <span className="tagged-user-role-badge-letter">{roleBadge.label}</span>
                                            <span className="tagged-user-role-badge-text">{roleBadge.title}</span>
                                        </span>
                                        <span className="tagged-user-created-top">
                                            Created {formatDate(listedUser.created_at)}
                                        </span>
                                    </div>

                                    <div className="tagged-user-card-header">
                                        <div className="tagged-user-avatar" aria-hidden="true">
                                            {getUserInitial(listedUser.username, listedUser.email)}
                                        </div>
                                        <div className="tagged-user-identity">
                                            <h2>{listedUser.username || "Unknown user"}</h2>
                                            <p>{listedUser.email || "No email"}</p>
                                        </div>
                                    </div>

                                    <div className="tagged-user-card-footer">
                                        <div className="tagged-user-actions">
                                            <button
                                                className="tagged-user-action-button tagged-user-action-button--edit"
                                                type="button"
                                                onClick={() => openEditor(listedUser)}
                                                disabled={
                                                    deletingUserId === listedUser.id ||
                                                    isCurrentUserCard ||
                                                    savingUserId === listedUser.id
                                                }
                                            >
                                                <img src="/icons/edit.svg" alt="" aria-hidden="true" />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="tagged-user-action-button tagged-user-action-button--danger"
                                                onClick={() => openDeleteUserConfirm(listedUser.id)}
                                                disabled={deletingUserId === listedUser.id || isCurrentUserCard}
                                            >
                                                <img src="/icons/delete.svg" alt="" aria-hidden="true" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
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
                                className="tagged-users-modal-close"
                                onClick={closeEditor}
                                aria-label="Close edit user modal"
                                disabled={savingUserId === editingUser.id}
                            >
                                ×
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
                                    className="tagged-user-action-button tagged-user-action-button--save"
                                    disabled={savingUserId === editingUser.id}
                                >
                                    <img src="/icons/edit.svg" alt="" aria-hidden="true" />
                                    <span>{savingUserId === editingUser.id ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                    type="button"
                                    className="tagged-user-action-button tagged-user-action-button--ghost"
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

            {deleteConfirmUser ? (
                <section
                    className="tagged-users-confirm-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tagged-users-confirm-title"
                    aria-describedby="tagged-users-confirm-description"
                    onClick={closeDeleteUserConfirm}
                >
                    <article
                        className="tagged-users-confirm-modal-content"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="tagged-users-confirm-title">Delete user?</h2>
                        <p id="tagged-users-confirm-description">
                            This action will permanently remove{" "}
                            <strong>{deleteConfirmUser.username || "this user"}</strong>.
                        </p>

                        <div className="tagged-users-confirm-modal-actions">
                            <button
                                type="button"
                                className="tagged-user-action-button tagged-user-action-button--ghost"
                                onClick={closeDeleteUserConfirm}
                                disabled={Boolean(deletingUserId)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tagged-user-action-button tagged-user-action-button--danger"
                                onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                                disabled={Boolean(deletingUserId)}
                            >
                                <img src="/icons/delete.svg" alt="" aria-hidden="true" />
                                <span>{deletingUserId ? "Deleting..." : "Delete user"}</span>
                            </button>
                        </div>
                    </article>
                </section>
            ) : null}
        </section>
    );
};
