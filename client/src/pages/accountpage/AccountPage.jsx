import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./AccountPage.css";

const toTitle = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
        return "-";
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

const initialsFromUser = (username, email) => {
    const source = String(username || email || "").trim();
    if (!source) {
        return "?";
    }

    const cleaned = source.replace(/[^A-Za-z0-9\s]/g, " ").trim();
    if (!cleaned) {
        return source.charAt(0).toUpperCase();
    }

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }

    return cleaned.slice(0, 2).toUpperCase();
};

export const AccountPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const accountSummary = useMemo(() => {
        const username = String(user?.username || "").trim();
        const email = String(user?.email || "").trim();
        const role = toTitle(user?.type || "Basic");

        return {
            username: username || "Unnamed user",
            email: email || "No email available",
            role,
            initials: initialsFromUser(username, email),
        };
    }, [user]);

    const todayLabel = useMemo(() => {
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date());
    }, []);

    const handleSignOut = async () => {
        await logout();
        navigate("/", { replace: true });
    };

    return (
        <section className="tagged-app-page tagged-account-page">
            <header className="tagged-account-hero" aria-label="Account overview">
                <div className="tagged-account-hero-band" aria-hidden="true" />

                <div className="tagged-account-avatar-wrap">
                    <div className="tagged-account-avatar" aria-hidden="true">
                        {accountSummary.initials}
                    </div>
                    <span className="tagged-account-presence">Online</span>
                </div>

                <div className="tagged-account-hero-text">
                    <p className="tagged-account-eyebrow">Account Hub</p>
                    <h1>Welcome, {accountSummary.username}</h1>
                    <p className="tagged-account-subtitle">
                        {accountSummary.email}
                    </p>
                </div>

                <div className="tagged-account-hero-meta" aria-label="Account highlights">
                    <span>
                        <strong>Role</strong>
                        {accountSummary.role}
                    </span>
                    <span>
                        <strong>Today</strong>
                        {todayLabel}
                    </span>
                </div>
            </header>

            <div className="tagged-account-grid" aria-label="Account details and actions">
                <article className="tagged-app-page-card tagged-account-card" aria-label="Account details">
                    <h2>Identity</h2>
                    <dl className="tagged-account-details-list">
                        <div>
                            <dt>Username</dt>
                            <dd>{accountSummary.username}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{accountSummary.email}</dd>
                        </div>
                        <div>
                            <dt>Role</dt>
                            <dd>{accountSummary.role}</dd>
                        </div>
                    </dl>
                </article>

                <article className="tagged-app-page-card tagged-account-card" aria-label="Account actions">
                    <h2>Session control</h2>
                    <p>Close this session safely on this device.</p>
                    <button type="button" className="tagged-account-signout-button" onClick={handleSignOut}>
                        Sign out now
                    </button>
                </article>
            </div>
        </section>
    );
};
