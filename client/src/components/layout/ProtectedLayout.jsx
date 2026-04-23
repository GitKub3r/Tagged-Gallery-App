import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "../sidebar/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { useAccessControl } from "../../hooks/useAccessControl";
import { TagFilterProvider } from "../../context/TagFilterContext";
import { GridViewProvider } from "../../context/GridViewContext";
import "./ProtectedLayout.css";

export const ProtectedLayout = () => {
    const { loading, isAuthenticated, user } = useAuth();

    // Enforce role-based access control
    useAccessControl();

    if (loading) {
        return <main className="tagged-shell-loading">Loading...</main>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return (
        <TagFilterProvider>
        <GridViewProvider>
            <div className="tagged-shell">
                <Sidebar />
                <main className="tagged-shell-content">
                    <Outlet />
                </main>
            </div>
        </GridViewProvider>
        </TagFilterProvider>
    );
};
