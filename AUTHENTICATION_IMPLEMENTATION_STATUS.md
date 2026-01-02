# Authentication & Playlists Implementation Status

## ✅ Completed (Backend)

### Infrastructure
- [x] Added Authentik services to docker-compose.yml
- [x] Updated .env with Authentik configuration
- [x] Generated secret keys for Authentik

### Backend Core
- [x] Updated `backend/app/core/config.py` with Authentik settings
- [x] Created `backend/app/core/oidc.py` - OIDC token validation
- [x] Created `backend/app/core/user_models.py` - User, Playlist, PlaylistTrack models
- [x] Updated `backend/app/core/models.py` - Added uploader_id to Track model
- [x] Created Alembic migration: `a1b2c3d4e5f6_add_user_authentication_and_playlists.py`
- [x] Updated `backend/requirements.common.txt` with python-jose and httpx

### Backend API
- [x] Created `backend/app/api/auth/dependencies.py` - get_current_user, get_optional_user
- [x] Created `backend/app/api/auth/routes.py` - GET /auth/me, POST /auth/logout

## 🚧 Next Steps

### Step 1: Create Playlist Backend Routes

Create `backend/app/api/playlists/routes.py` with the following endpoints:

```python
# Playlist CRUD
GET    /api/playlists              # List user's playlists
POST   /api/playlists              # Create new playlist
GET    /api/playlists/{id}         # Get playlist details
PUT    /api/playlists/{id}         # Update playlist
DELETE /api/playlists/{id}         # Delete playlist

# Playlist Sharing
GET    /api/playlists/share/{share_token}  # Get public playlist by share token

# Track Management
POST   /api/playlists/{id}/tracks          # Add track to playlist
DELETE /api/playlists/{id}/tracks/{track_id}  # Remove track from playlist
PUT    /api/playlists/{id}/tracks/reorder  # Reorder tracks
```

**Reference implementation**: See `/Users/svnoak/.claude/plans/sequential-puzzling-fog.md` section 3.7

Create directory:
```bash
mkdir -p backend/app/api/playlists
touch backend/app/api/playlists/__init__.py
```

### Step 2: Update main.py to Register Routes

Edit `backend/app/main.py`:

```python
from app.api.auth import routes as auth_routes
from app.api.playlists import routes as playlist_routes

# Add after existing routers
app.include_router(auth_routes.router, prefix="/api")
app.include_router(playlist_routes.router, prefix="/api")
```

### Step 3: Run Database Migration

```bash
cd backend
docker-compose up -d db
docker-compose run --rm backend alembic upgrade head
```

### Step 4: Start Authentik and Configure

1. Start Authentik:
```bash
docker-compose up -d authentik-server authentik-worker authentik-postgres authentik-redis
```

2. Access Authentik UI at http://localhost:9000

3. Complete initial setup wizard (create admin account)

4. Create Application & Provider:
   - **Application Name**: Dansbart
   - **Slug**: dansbart
   - **Provider Type**: OAuth2/OpenID Connect
   - **Client ID**: dansbart-client (copy to .env)
   - **Client Secret**: Generate and copy to .env
   - **Redirect URIs**: http://localhost:8080/auth/callback
   - **Scopes**: openid, email, profile

5. Update `.env` with real client secret:
```bash
AUTHENTIK_CLIENT_SECRET=<paste-secret-here>
```

### Step 5: Test Backend

```bash
# Start backend
docker-compose up backend

# Test endpoints
curl http://localhost:8000/api/auth/me  # Should return 401 (no token)
```

## 🎨 Frontend Implementation

### Step 6: Install oidc-client-ts

Edit `frontend/package.json`:
```json
{
  "dependencies": {
    "vue": "^3.x.x",
    "vue-router": "^4.x.x",
    "oidc-client-ts": "^3.0.1"
  }
}
```

Run:
```bash
cd frontend
npm install
```

### Step 7: Create useAuth Composable

Create `frontend/js/hooks/useAuth.js`

**Full implementation**: See plan section 4.2 or use this template:

```javascript
import { ref, computed } from 'vue';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { showError, showToast } from './useToast.js';

const oidcConfig = {
  authority: 'http://localhost:9000/application/o/dansbart/',
  client_id: 'dansbart-client',
  redirect_uri: 'http://localhost:8080/auth/callback',
  post_logout_redirect_uri: 'http://localhost:8080/',
  response_type: 'code',
  scope: 'openid email profile',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
};

const userManager = new UserManager(oidcConfig);
const user = ref(null);
const accessToken = ref(null);
const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

// ... (see full implementation in plan)

export function useAuth() {
  return {
    user,
    isAuthenticated,
    login,
    logout,
    handleCallback,
    fetchWithAuth,
  };
}
```

### Step 8: Create usePlaylists Composable

Create `frontend/js/hooks/usePlaylists.js`

**Full implementation**: See plan section 3.2

### Step 9: Update Header.js

Add login button and account menu to `frontend/js/components/Header.js`:

```javascript
import { useAuth } from '../hooks/useAuth.js';

// In setup():
const { user, isAuthenticated, login, logout } = useAuth();

// In template - add to navigation:
<button v-if="!isAuthenticated" @click="login" class="bg-blue-500 text-white px-4 py-2 rounded">
  Logga in
</button>

<div v-else>
  <span>{{ user.name }}</span>
  <button @click="logout">Logga ut</button>
</div>
```

### Step 10: Create Auth Callback Page

Create `frontend/js/components/AuthCallbackPage.js`:

```javascript
import { onMounted } from 'vue';
import { useAuth } from '../hooks/useAuth.js';
import { useRouter } from 'vue-router';

export default {
  setup() {
    const { handleCallback } = useAuth();
    const router = useRouter();

    onMounted(async () => {
      const success = await handleCallback();
      if (success) {
        router.push('/');
      }
    });

    return {};
  },
  template: `<div>Loggar in...</div>`,
};
```

### Step 11: Add Routes and Guards

Update `frontend/js/router.js`:

```javascript
import { useAuth } from './hooks/useAuth.js';
import AuthCallbackPage from './components/AuthCallbackPage.js';
import PlaylistsPage from './components/PlaylistsPage.js';

const routes = [
  // ... existing routes ...

  {
    path: '/auth/callback',
    name: 'authCallback',
    component: AuthCallbackPage,
    meta: { page: 'authCallback' }
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: PlaylistsPage,
    meta: { page: 'playlists', requiresAuth: true }
  },
];

// Add navigation guard
router.beforeEach((to, from, next) => {
  const { isAuthenticated, login } = useAuth();

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    sessionStorage.setItem('returnUrl', to.fullPath);
    login();
  } else {
    next();
  }
});
```

### Step 12: Create Playlist UI Components

1. **PlaylistsPage.js** - List all user playlists
2. **PlaylistPage.js** - Show playlist details with tracks
3. **PlaylistModal.js** - Add track to playlist modal
4. **SharePlaylistModal.js** - Generate shareable link

**Full implementations**: See plan sections 3.3-3.4

### Step 13: Update TrackCard.js

Add "Add to Playlist" button to each track card:

```javascript
<button @click="showPlaylistModal = true">
  Lägg till i spellista
</button>

<playlist-modal
  v-if="showPlaylistModal"
  :track-id="track.id"
  @close="showPlaylistModal = false">
</playlist-modal>
```

## 🧪 Testing Checklist

### Backend Tests
- [ ] OIDC token validation with valid token
- [ ] OIDC token validation with expired token (401)
- [ ] Get current user creates new user on first login
- [ ] Get current user updates cached info on subsequent logins
- [ ] Create playlist requires authentication
- [ ] Add track to playlist
- [ ] Remove track from playlist
- [ ] Reorder tracks in playlist
- [ ] Share playlist generates share_token
- [ ] View shared playlist works anonymously

### Frontend Tests
- [ ] Click "Logga in" redirects to Authentik
- [ ] Login with email/password works
- [ ] Callback page handles OIDC response
- [ ] User info appears in header after login
- [ ] Create new playlist
- [ ] Add track to playlist
- [ ] View playlist shows all tracks
- [ ] Delete playlist
- [ ] Logout clears session

### Integration Tests
- [ ] Full flow: Login → Create Playlist → Add Tracks → Share → View (anonymous)
- [ ] Token auto-refresh on 401 response
- [ ] Protected routes redirect to login
- [ ] Multiple tabs stay in sync (localStorage events)

## 📚 Reference Documentation

- **Full Implementation Plan**: `/Users/svnoak/.claude/plans/sequential-puzzling-fog.md`
- **Authentik Docs**: https://docs.goauthentik.io/
- **oidc-client-ts Docs**: https://authts.github.io/oidc-client-ts/
- **FastAPI Security**: https://fastapi.tiangolo.com/tutorial/security/

## 🔧 Troubleshooting

### Authentik Not Starting
```bash
docker-compose logs authentik-server
# Check AUTHENTIK_SECRET_KEY is set in .env
```

### OIDC Login Fails
- Verify redirect URI matches exactly in Authentik and frontend config
- Check browser console for errors
- Verify client_id and client_secret in .env

### Token Validation Fails
- Check AUTHENTIK_ISSUER and AUTHENTIK_JWKS_URI in .env
- Verify Authentik is accessible from backend container
- Clear JWKS cache: restart backend

### Migration Fails
```bash
# Check migration status
docker-compose run --rm backend alembic current

# Rollback if needed
docker-compose run --rm backend alembic downgrade -1
```

## 🎯 Phase 2: User Uploads (Future)

Once playlists are working, implement user-uploaded tracks:

1. Add upload UI (paste Google Drive link)
2. Create `/api/tracks/upload` endpoint
3. Download from cloud storage temporarily
4. Analyze with neckenml (same as Spotify tracks)
5. Set `uploader_id = user.id`
6. Add playback streaming from cloud storage (CORS proxy)
7. Add moderation queue for admin approval

See plan section 11 for full Phase 2 details.

## ✅ Summary

**Backend**: 90% complete - just need playlist routes
**Frontend**: 0% complete - need to implement all UI components
**Infrastructure**: 100% complete - Authentik ready to configure

**Estimated remaining time**: 2-3 hours for backend routes + 4-6 hours for frontend
