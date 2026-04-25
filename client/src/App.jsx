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

function App() {
    return (
        <AuthProvider>
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
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
