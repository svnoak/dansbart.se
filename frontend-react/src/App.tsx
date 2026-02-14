import { BrowserRouter, Route, Routes } from 'react-router-dom';

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
import { TrackPage } from '@/pages/TrackPage';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ConsentProvider>
          <PlayerProvider>
            <Layout>
              <CookieBanner />
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/classify" element={<ClassifyPage />} />
                <Route path="/artist/:id" element={<ArtistPage />} />
                <Route path="/album/:id" element={<AlbumPage />} />
                <Route path="/track/:id" element={<TrackPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
              </Routes>
            </Layout>
          </PlayerProvider>
        </ConsentProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
