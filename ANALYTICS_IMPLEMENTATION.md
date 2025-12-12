# Custom Analytics Implementation for dansbart.se

This document describes the comprehensive custom analytics system implemented for tracking user behavior and engagement on dansbart.se.

## Overview

A complete analytics solution has been implemented that tracks:
- **Visitor sessions** (unique, returning, and total visits)
- **Visit patterns** (hourly and daily trends)
- **Track playback** (with duration and completion tracking)
- **Platform preferences** (YouTube vs Spotify usage)
- **User interactions** (nudges, modals, reports)
- **Abandonment rates** (for nudges and modals)
- **Listen duration** (total seconds/minutes/hours)

## Implementation Summary

### 1. Database Models

#### Enhanced Models ([backend/app/core/models.py](backend/app/core/models.py))

**TrackPlayback** - Enhanced with:
- `duration_seconds` - How many seconds were actually listened
- `completed` - Boolean flag for plays exceeding the 30-second threshold

**VisitorSession** - New table:
- `session_id` - Unique session identifier
- `first_seen` / `last_seen` - Session timestamps
- `user_agent` - Browser information
- `is_returning` - Returning visitor flag
- `page_views` - Number of page views in session

### 2. Backend Services

#### Analytics Service ([backend/app/services/analytics.py](backend/app/services/analytics.py))

Comprehensive service with methods for:

**Session Tracking:**
- `track_visitor_session()` - Create/update visitor sessions
- `get_visitor_stats()` - Total, unique, new, and returning visitors
- `get_hourly_visit_pattern()` - Visits by hour of day
- `get_daily_visit_pattern()` - Visits by date

**Playback Analytics:**
- `record_playback()` - Track playback with duration and completion
- `get_most_played_tracks_with_completion()` - Top tracks with completion rates
- `get_total_listen_time()` - Total listening time across all tracks
- `get_platform_usage_stats()` - YouTube vs Spotify breakdown

**Engagement Analytics:**
- `record_interaction()` - Track UI interactions
- `get_nudge_abandonment_rate()` - Nudge completion vs abandonment
- `get_modal_abandonment_rate()` - Modal completion vs abandonment
- `get_report_stats()` - All report types breakdown

### 3. API Endpoints

#### Tracking Endpoints - Public ([backend/app/api/routes.py](backend/app/api/routes.py))

**POST Endpoints (No authentication required):**
- `/api/analytics/track/playback/{track_id}` - Record playback events
- `/api/analytics/track/interaction` - Record interaction events
- `/api/analytics/session` - Track/update visitor sessions

#### Analytics Viewing Endpoints - Admin Only ([backend/app/api/analytics_admin.py](backend/app/api/analytics_admin.py))

**GET Endpoints (Require X-Admin-Token header):**
- `/api/admin/analytics/dashboard?days=30` - **Complete dashboard data**
- `/api/admin/analytics/visitors?days=30` - Visitor statistics
- `/api/admin/analytics/visits/hourly?days=30` - Hourly visit patterns
- `/api/admin/analytics/visits/daily?days=30` - Daily visit patterns
- `/api/admin/analytics/tracks/most-played?limit=10&days=30` - Top tracks
- `/api/admin/analytics/listen-time?days=30` - Total listen time
- `/api/admin/analytics/platform-stats?days=30` - Platform usage
- `/api/admin/analytics/abandonment/nudges?days=30` - Nudge metrics
- `/api/admin/analytics/abandonment/modals?days=30` - Modal metrics
- `/api/admin/analytics/reports?days=30` - Report statistics

**Security:** All analytics viewing endpoints require the `X-Admin-Token` header with your admin password.

### 4. Frontend Implementation

#### Analytics Utilities ([frontend/js/analytics.js](frontend/js/analytics.js))

**Session Management:**
- `getSessionId()` - Get or create session ID
- `isReturningVisitor()` - Check visitor status
- `trackSession()` - Send session data to backend

**Tracking Functions:**
- `trackPlayback(trackId, platform, duration, completed)` - Track playback
- `trackInteraction(eventType, trackId, eventData)` - Track interactions
- `createPlaybackTracker(trackId, platform)` - Automatic playback duration tracker

**Event Constants:**
```javascript
AnalyticsEvents = {
  NUDGE_SHOWN, NUDGE_COMPLETED, NUDGE_DISMISSED,
  MODAL_*_OPENED, MODAL_*_SUBMITTED,
  LINK_REPORTED_BROKEN, LINK_REPORTED_WRONG_TRACK,
  STRUCTURE_REPORTED, STRUCTURE_VOTED_UP/DOWN
}
```

#### Integration Points

**App Initialization** ([frontend/js/app.js](frontend/js/app.js)):
- Session tracking on mount

**Player** ([frontend/js/player.js](frontend/js/player.js)):
- Automatic playback tracking
- Duration tracking with play/pause support
- Completion detection (30-second threshold)

**SmartNudge** ([frontend/js/components/toasts/SmartNudge.js](frontend/js/components/toasts/SmartNudge.js)):
- Track nudge shown
- Track nudge completion/dismissal
- Track feedback submission

**FlagTrackModal** ([frontend/js/components/modals/FlagTrackModal.js](frontend/js/components/modals/FlagTrackModal.js)):
- Track modal open
- Track all report types

#### Analytics Dashboard ([frontend/js/components/AnalyticsDashboard.js](frontend/js/components/AnalyticsDashboard.js))

Beautiful, comprehensive dashboard showing:
- Visitor statistics (total, unique, new, returning)
- Listen time metrics
- Platform usage breakdown
- Most played tracks with completion rates
- Nudge and modal performance
- Report statistics
- Configurable time periods (7, 30, 90 days)

### 5. Database Migration

**Migration File:** [backend/alembic/versions/a1b2c3d4e5f6_add_analytics_tracking.py](backend/alembic/versions/a1b2c3d4e5f6_add_analytics_tracking.py)

Adds:
- `duration_seconds` and `completed` columns to `track_playbacks`
- `visitor_sessions` table with indexes
- Proper upgrade/downgrade paths

## Metrics Tracked

### ✅ Visitor Metrics
- Total visits
- Unique visitors
- Returning vs new visitors
- Visit patterns (hourly/daily)

### ✅ Track Playback
- Which tracks were played
- How many times each track was played
- Platform used (YouTube/Spotify)
- Listen duration (actual seconds listened)
- Completion rate (% that listened >30 seconds)
- Total listen time across all tracks

### ✅ Abandonment Tracking
- Nudges shown vs completed
- Modals opened vs submitted
- Abandonment rates for each

### ✅ Report Analytics
- Non-folk music flags
- Broken link reports
- Wrong track reports
- Structure spam reports

## Usage

### Running the Migration

```bash
cd backend
alembic upgrade head
```

### Accessing the Dashboard

The analytics dashboard component can be integrated into your admin panel or accessed via a dedicated route. The component fetches all data from `/api/analytics/dashboard` endpoint.

### Tracking Examples

**Frontend - Track a playback:**
```javascript
import { trackPlayback } from './analytics.js';

// When track finishes or changes
trackPlayback(trackId, 'youtube', 125, true); // 125 seconds, completed
```

**Frontend - Track an interaction:**
```javascript
import { trackInteraction, AnalyticsEvents } from './analytics.js';

trackInteraction(AnalyticsEvents.NUDGE_SHOWN, trackId, {
  has_style: true,
  has_tempo: false
});
```

**Backend - Custom queries:**
```python
from app.services.analytics import AnalyticsService

# Get visitor stats for last 7 days
stats = AnalyticsService.get_visitor_stats(db, days=7)

# Get most played tracks
tracks = AnalyticsService.get_most_played_tracks_with_completion(db, limit=20)
```

## Privacy Considerations

- **No personal data** - Only session IDs (randomly generated)
- **No cookies** - Uses localStorage for session persistence
- **User agent** - Stored for device/browser statistics (optional)
- **GDPR-friendly** - All tracking is anonymous and aggregated
- **Respects consent** - Tracking only occurs with user consent

## Additional Analytics Ideas

You mentioned "anything else that could be of interest" - here are some additional metrics you could add:

1. **Search Analytics** - Track what users search for
2. **Filter Usage** - Which filters are most popular
3. **Dance Style Preferences** - Which styles get played most
4. **Time to First Play** - How long before users play their first track
5. **Session Duration** - How long users stay on the site
6. **Scroll Depth** - How far users scroll down the track list
7. **Device Types** - Mobile vs desktop usage
8. **Geographic Data** - If you add IP geolocation
9. **Referral Sources** - Where users come from
10. **Feature Discovery** - How users discover structure editor, voting, etc.

## Files Modified/Created

### Backend
- ✅ `backend/app/core/models.py` - Enhanced models
- ✅ `backend/app/services/analytics.py` - Analytics service
- ✅ `backend/app/api/routes.py` - Public tracking endpoints
- ✅ `backend/app/api/analytics_admin.py` - Protected analytics viewing endpoints
- ✅ `backend/app/api/schemas.py` - Request schemas
- ✅ `backend/app/main.py` - Router registration
- ✅ `backend/alembic/versions/a1b2c3d4e5f6_add_analytics_tracking.py` - Migration

### Frontend
- ✅ `frontend/js/analytics.js` - Analytics utilities
- ✅ `frontend/js/app.js` - Session tracking integration
- ✅ `frontend/js/player.js` - Playback tracking
- ✅ `frontend/js/components/toasts/SmartNudge.js` - Nudge tracking
- ✅ `frontend/js/components/modals/FlagTrackModal.js` - Modal tracking
- ✅ `frontend/admin/features/analytics/AnalyticsTab.js` - Admin analytics dashboard
- ✅ `frontend/admin/AdminPanel.js` - Analytics tab integration

## Next Steps

1. **Run the migration:**
   ```bash
   cd backend && alembic upgrade head
   ```

2. **Test the tracking** - Visit the site and interact with tracks, nudges, and modals

3. **View analytics** - Access the dashboard or query the API endpoints

4. **Add dashboard to UI** - Integrate the AnalyticsDashboard component into your admin area

5. **Optional enhancements:**
   - Add charts/graphs for visual analytics
   - Export analytics data to CSV
   - Set up automated reports
   - Add real-time analytics

Enjoy your comprehensive custom analytics system! 🎉
