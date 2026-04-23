import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ConsentProvider } from '@/consent/ConsentContext';
import { CookieBanner } from '@/consent/CookieBanner';
import { Layout } from '@/layout/Layout';
import { PlayerProvider } from '@/player/PlayerContext';
import { ThemeProvider } from '@/theme/ThemeContext';
import { AboutPage } from '@/pages/AboutPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { AlbumPage } from '@/pages/AlbumPage';
import { ArtistPage } from '@/pages/ArtistPage';
import { ClassifyPage } from '@/pages/ClassifyPage';
import { HomePage } from '@/pages/HomePage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { SearchPage } from '@/pages/SearchPage';
import { TermsPage } from '@/pages/TermsPage';
import { ArtistsPage } from '@/pages/ArtistsPage';
import { AlbumsPage } from '@/pages/AlbumsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { AuthProvider } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { PlaylistsPage } from '@/pages/PlaylistsPage';
import { PlaylistPage } from '@/pages/PlaylistPage';
import { PlaylistSettingsPage } from '@/pages/PlaylistSettingsPage';
import { SharedPlaylistPage } from '@/pages/SharedPlaylistPage';
import { AdminLayout } from '@/admin/layout/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { AdminLibraryPage } from '@/admin/pages/AdminLibraryPage';
import { AdminArtistsPage } from '@/admin/pages/AdminArtistsPage';
import { AdminAlbumsPage } from '@/admin/pages/AdminAlbumsPage';
import { AdminStatsPage } from '@/admin/pages/AdminStatsPage';
import { AdminKeywordsPage } from '@/admin/pages/AdminKeywordsPage';
import { AdminIngestPage } from '@/admin/pages/AdminIngestPage';
import { AdminPendingPage } from '@/admin/pages/AdminPendingPage';
import { AdminDuplicatesPage } from '@/admin/pages/AdminDuplicatesPage';
import { AdminMaintenancePage } from '@/admin/pages/AdminMaintenancePage';
import { AdminStyleConfigPage } from '@/admin/pages/AdminStyleConfigPage';
import { AdminFolkwikiPage } from '@/admin/pages/AdminFolkwikiPage';
import { AdminUsersPage } from '@/admin/pages/AdminUsersPage';
import { AdminDancesPage } from '@/admin/pages/AdminDancesPage';
import { DancesPage } from '@/pages/DancesPage';
import { DancePage } from '@/pages/DancePage';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route
              path="/*"
              element={
                <ConsentProvider>
                  <PlayerProvider>
                    <Layout>
                      <CookieBanner />
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/search" element={<SearchPage />} />
                        <Route path="/classify" element={<ClassifyPage />} />
                        <Route path="/dances" element={<DancesPage />} />
                        <Route path="/dance/:id" element={<DancePage />} />
                        <Route path="/artists" element={<ArtistsPage />} />
                        <Route path="/albums" element={<AlbumsPage />} />
                        <Route path="/artist/:id" element={<ArtistPage />} />
                        <Route path="/album/:id" element={<AlbumPage />} />
                        <Route
                          path="/playlists"
                          element={
                            <ProtectedRoute>
                              <PlaylistsPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/playlists/:id"
                          element={
                            <ProtectedRoute>
                              <PlaylistPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/playlists/:id/settings"
                          element={
                            <ProtectedRoute>
                              <PlaylistSettingsPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/shared/:token" element={<SharedPlaylistPage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/feedback" element={<FeedbackPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/privacy" element={<PrivacyPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </Layout>
                  </PlayerProvider>
                </ConsentProvider>
              }
            />

            {/* Admin routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<Navigate to="/admin/library" replace />} />
            <Route
              path="/admin/*"
              element={
                <ConsentProvider>
                  <PlayerProvider>
                    <ProtectedRoute requiredRole="ADMIN">
                      <AdminLayout>
                        <Routes>
                      <Route path="library" element={<AdminLibraryPage />} />
                      <Route path="artists" element={<AdminArtistsPage />} />
                      <Route path="albums" element={<AdminAlbumsPage />} />
                      <Route path="stats" element={<AdminStatsPage />} />
                      <Route path="keywords" element={<AdminKeywordsPage />} />
                      <Route path="style-config" element={<AdminStyleConfigPage />} />
                      <Route path="ingest" element={<AdminIngestPage />} />
                      <Route path="pending" element={<AdminPendingPage />} />
                      <Route path="duplicates" element={<AdminDuplicatesPage />} />
                      <Route path="folkwiki" element={<AdminFolkwikiPage />} />
                      <Route path="users" element={<AdminUsersPage />} />
                      <Route path="dances" element={<AdminDancesPage />} />
                      <Route path="maintenance" element={<AdminMaintenancePage />} />
                      <Route path="*" element={<Navigate to="/admin/library" replace />} />
                        </Routes>
                      </AdminLayout>
                    </ProtectedRoute>
                  </PlayerProvider>
                </ConsentProvider>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
