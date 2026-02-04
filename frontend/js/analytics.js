/**
 * Analytics tracking utilities for dansbart.se
 * Handles session management, playback tracking, and user interaction events.
 */

const API_BASE = '/api';
const SESSION_STORAGE_KEY = 'visitor_session_id';
const VISITOR_STORAGE_KEY = 'is_returning_visitor';
const PLAY_THRESHOLD_SECONDS = 30; // Minimum seconds to count as "played"

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create a session ID
 */
export function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Check if this is a returning visitor
 */
export function isReturningVisitor() {
  return localStorage.getItem(VISITOR_STORAGE_KEY) === 'true';
}

/**
 * Mark as a returning visitor
 */
export function markAsReturningVisitor() {
  localStorage.setItem(VISITOR_STORAGE_KEY, 'true');
}

/**
 * Track visitor session with the backend
 */
export async function trackSession() {
  const sessionId = getSessionId();
  const isReturning = isReturningVisitor();

  try {
    await fetch(`${API_BASE}/analytics/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionId,
        userAgent: navigator.userAgent,
      }),
    });

    // Mark as returning for next visit
    if (!isReturning) {
      markAsReturningVisitor();
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Track a track playback event
 * @param {string} trackId - Track UUID
 * @param {string} platform - 'youtube' or 'spotify'
 * @param {number} durationSeconds - How many seconds were listened
 * @param {boolean} completed - Whether the track was played past the threshold
 */
export async function trackPlayback(trackId, platform, durationSeconds, completed = false) {
  const sessionId = getSessionId();

  try {
    await fetch(`${API_BASE}/analytics/playback/${trackId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform,
        sessionId: sessionId,
        durationSeconds: Math.floor(durationSeconds),
        completed,
      }),
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Track a user interaction event
 * @param {string} eventType - Type of event (e.g., 'nudge_shown', 'modal_opened')
 * @param {string|null} trackId - Optional track UUID
 * @param {object|null} eventData - Optional additional event data
 */
export async function trackInteraction(eventType, trackId = null, eventData = null) {
  const sessionId = getSessionId();

  try {
    await fetch(`${API_BASE}/analytics/interaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType: eventType,
        trackId: trackId,
        eventData: eventData,
        sessionId: sessionId,
      }),
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Create a playback tracker for a track
 * Automatically tracks duration and sends when playback ends
 */
export function createPlaybackTracker(trackId, platform) {
  let startTime = Date.now();
  let totalListenTime = 0;
  let isPlaying = false;
  let pauseTime = null;
  let tracked = false;

  const tracker = {
    start() {
      if (!isPlaying) {
        startTime = Date.now();
        isPlaying = true;
        pauseTime = null;
      }
    },

    pause() {
      if (isPlaying) {
        pauseTime = Date.now();
        totalListenTime += (pauseTime - startTime) / 1000;
        isPlaying = false;
      }
    },

    end() {
      if (!tracked) {
        // Calculate final listen time
        if (isPlaying) {
          const now = Date.now();
          totalListenTime += (now - startTime) / 1000;
        }

        const completed = totalListenTime >= PLAY_THRESHOLD_SECONDS;

        // Only track if they listened for at least a few seconds
        if (totalListenTime > 3) {
          trackPlayback(trackId, platform, totalListenTime, completed);
        }

        tracked = true;
      }
    },

    getListenTime() {
      let currentListenTime = totalListenTime;
      if (isPlaying) {
        currentListenTime += (Date.now() - startTime) / 1000;
      }
      return currentListenTime;
    },

    hasReachedThreshold() {
      return this.getListenTime() >= PLAY_THRESHOLD_SECONDS;
    },
  };

  return tracker;
}

// Event tracking helpers
export const AnalyticsEvents = {
  // Nudge events
  NUDGE_SHOWN: 'nudge_shown',
  NUDGE_COMPLETED: 'nudge_completed',
  NUDGE_DISMISSED: 'nudge_dismissed',
  NUDGE_FEEDBACK_SUBMITTED: 'nudge_feedback_submitted',

  // Modal events
  MODAL_ADD_LINK_OPENED: 'modal_add_link_opened',
  MODAL_ADD_LINK_SUBMITTED: 'modal_add_link_submitted',
  MODAL_FLAG_TRACK_OPENED: 'modal_flag_track_opened',
  MODAL_FLAG_TRACK_SUBMITTED: 'modal_flag_track_submitted',
  MODAL_STRUCTURE_EDITOR_OPENED: 'modal_structure_editor_opened',
  MODAL_STRUCTURE_EDITOR_SUBMITTED: 'modal_structure_editor_submitted',

  // Report events
  LINK_REPORTED_BROKEN: 'link_reported_broken',
  LINK_REPORTED_WRONG_TRACK: 'link_reported_wrong_track',
  STRUCTURE_REPORTED: 'structure_reported',

  // Voting events
  STRUCTURE_VOTED_UP: 'structure_voted_up',
  STRUCTURE_VOTED_DOWN: 'structure_voted_down',

  // Discovery page events
  DISCOVERY_PAGE_VIEW: 'discovery_page_view',
  DISCOVERY_SECTION_VIEW: 'discovery_section_view',
  DISCOVERY_TRACK_PLAY: 'discovery_track_play',
  DISCOVERY_STYLE_CLICK: 'discovery_style_click',
  DISCOVERY_TO_SEARCH: 'discovery_to_search',
  DISCOVERY_TO_CLASSIFY: 'discovery_to_classify',
  DISCOVERY_PLAYLIST_PLAY: 'discovery_playlist_play',
  DISCOVERY_PLAYLIST_VIEW_ALL: 'discovery_playlist_view_all',
};
