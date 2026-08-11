import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { HomePage } from "./pages/homepage/HomePage";
import { GalleryPage } from "./pages/gallerypage/GalleryPage";
import { MediaDetailPage } from "./pages/gallerypage/MediaDetailPage";
import { FavouritesPage } from "./pages/favouritespage/FavouritesPage";
import { MetadataPage } from "./pages/tagspage/TagsPage";
import { DashboardPage } from "./pages/metricspage/MetricsPage";
import { AccountPage } from "./pages/accountpage/AccountPage";
import { ProtectedLayout } from "./components/layout/ProtectedLayout";
import { AlbumPage } from "./pages/albumspage/AlbumPage";
import { AlbumDetailPage } from "./pages/albumspage/AlbumDetailPage";
import { UsersPage } from "./pages/userspage/UsersPage";
import { LogsPage } from "./pages/logspage/LogsPage";
import { ActionsPage } from "./pages/actionspage/ActionsPage";
import { Toaster } from "sonner";
import { DeveloperPage } from "./pages/developerpage/DeveloperPage";

function App() {
    return (
        <AuthProvider>
            <Toaster
                position="top-right"
                closeButton
                duration={4500}
                toastOptions={{
                    classNames: {
                        toast: "rounded-xl! border-neutral-300! bg-white! text-neutral-950! shadow-xl! dark:border-neutral-700! dark:bg-neutral-900! dark:text-neutral-100!",
                        title: "text-sm! font-bold!",
                        description: "text-neutral-500! dark:text-neutral-400!",
                        closeButton: "rounded-full! border-neutral-300! bg-white! text-neutral-600! dark:border-neutral-700! dark:bg-neutral-800! dark:text-neutral-300!",
                        error: "border-red-500/50!",
                        success: "border-green-500/50!",
                    },
                }}
            />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<HomePage />} />

                    <Route element={<ProtectedLayout />}>
                        <Route path="/gallery" element={<GalleryPage />} />
                        <Route path="/gallery/:mediaId" element={<MediaDetailPage />} />
                        <Route path="/favourites" element={<FavouritesPage />} />
                        <Route path="/albums" element={<AlbumPage />} />
                        <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
                        <Route path="/metadata" element={<MetadataPage />} />
                        <Route path="/tags" element={<Navigate to="/metadata" replace />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/metrics" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/users" element={<UsersPage />} />
                        <Route path="/logs" element={<LogsPage />} />
                        <Route path="/actions" element={<ActionsPage />} />
                        <Route path="/account" element={<AccountPage />} />
                        <Route path="/developer" element={<DeveloperPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
