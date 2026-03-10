import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ConsentProvider } from '@/consent/ConsentContext';
import { CookieBanner } from '@/consent/CookieBanner';
import { Layout } from '@/layout/Layout';
import { PlayerProvider } from '@/player/PlayerContext';
import { ThemeProvider } from '@/theme/ThemeContext';
import { AboutPage } from '@/pages/AboutPage';
import { AlbumPage } from '@/pages/AlbumPage';
import { ArtistPage } from '@/pages/ArtistPage';
import { ClassifyPage } from '@/pages/ClassifyPage';
import { HomePage } from '@/pages/HomePage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { SearchPage } from '@/pages/SearchPage';
import { TermsPage } from '@/pages/TermsPage';
import { ArtistsPage } from '@/pages/ArtistsPage';
import { AlbumsPage } from '@/pages/AlbumsPage';

import { AuthProvider } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AdminLayout } from '@/admin/layout/AdminLayout';
import { AdminLoginPage } from '@/admin/pages/AdminLoginPage';
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
                        <Route path="/artists" element={<ArtistsPage />} />
                        <Route path="/albums" element={<AlbumsPage />} />
                        <Route path="/artist/:id" element={<ArtistPage />} />
                        <Route path="/album/:id" element={<AlbumPage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/privacy" element={<PrivacyPage />} />
                      </Routes>
                    </Layout>
                  </PlayerProvider>
                </ConsentProvider>
              }
            />

            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<Navigate to="/admin/library" replace />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
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
                      <Route path="maintenance" element={<AdminMaintenancePage />} />
                      <Route path="*" element={<Navigate to="/admin/library" replace />} />
                    </Routes>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
