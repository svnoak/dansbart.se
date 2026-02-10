/**
 * Analytics tracking utilities for dansbart.se
 */

const API_BASE = '/api';
const SESSION_STORAGE_KEY = 'visitor_session_id';
const VISITOR_STORAGE_KEY = 'is_returning_visitor';
const PLAY_THRESHOLD_SECONDS = 30;

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

export function isReturningVisitor(): boolean {
  return localStorage.getItem(VISITOR_STORAGE_KEY) === 'true';
}

export function markAsReturningVisitor(): void {
  localStorage.setItem(VISITOR_STORAGE_KEY, 'true');
}

export async function trackSession(): Promise<void> {
  const sessionId = getSessionId();
  const isReturning = isReturningVisitor();
  try {
    await fetch(`${API_BASE}/analytics/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userAgent: navigator.userAgent }),
    });
    if (!isReturning) markAsReturningVisitor();
  } catch {
    // Ignore
  }
}

export async function trackPlayback(
  trackId: string,
  platform: string,
  durationSeconds: number,
  completed = false,
): Promise<void> {
  const sessionId = getSessionId();
  try {
    await fetch(`${API_BASE}/analytics/playback/${trackId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        sessionId,
        durationSeconds: Math.floor(durationSeconds),
        completed,
      }),
    });
  } catch {
    // Ignore
  }
}

export async function trackInteraction(
  eventType: string,
  trackId: string | null = null,
  eventData: Record<string, string | number | boolean | null> | null = null,
): Promise<void> {
  const sessionId = getSessionId();
  try {
    await fetch(`${API_BASE}/analytics/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, trackId, eventData, sessionId }),
    });
  } catch {
    // Ignore
  }
}

export interface PlaybackTracker {
  start(): void;
  pause(): void;
  end(): void;
  getListenTime(): number;
  hasReachedThreshold(): boolean;
}

export function createPlaybackTracker(trackId: string, platform: string): PlaybackTracker {
  let startTime = Date.now();
  let totalListenTime = 0;
  let isPlaying = false;
  let pauseTime: number | null = null;
  let tracked = false;

  return {
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
        if (isPlaying) {
          totalListenTime += (Date.now() - startTime) / 1000;
        }
        const completed = totalListenTime >= PLAY_THRESHOLD_SECONDS;
        if (totalListenTime > 3) {
          trackPlayback(trackId, platform, totalListenTime, completed);
        }
        tracked = true;
      }
    },
    getListenTime() {
      let current = totalListenTime;
      if (isPlaying) current += (Date.now() - startTime) / 1000;
      return current;
    },
    hasReachedThreshold() {
      return this.getListenTime() >= PLAY_THRESHOLD_SECONDS;
    },
  };
}

export const AnalyticsEvents = {
  NUDGE_SHOWN: 'nudge_shown',
  NUDGE_COMPLETED: 'nudge_completed',
  NUDGE_DISMISSED: 'nudge_dismissed',
  NUDGE_FEEDBACK_SUBMITTED: 'nudge_feedback_submitted',
  MODAL_ADD_LINK_OPENED: 'modal_add_link_opened',
  MODAL_ADD_LINK_SUBMITTED: 'modal_add_link_submitted',
  MODAL_FLAG_TRACK_OPENED: 'modal_flag_track_opened',
  MODAL_FLAG_TRACK_SUBMITTED: 'modal_flag_track_submitted',
  MODAL_STRUCTURE_EDITOR_OPENED: 'modal_structure_editor_opened',
  MODAL_STRUCTURE_EDITOR_SUBMITTED: 'modal_structure_editor_submitted',
  LINK_REPORTED_BROKEN: 'link_reported_broken',
  LINK_REPORTED_WRONG_TRACK: 'link_reported_wrong_track',
  STRUCTURE_REPORTED: 'structure_reported',
  STRUCTURE_VOTED_UP: 'structure_voted_up',
  STRUCTURE_VOTED_DOWN: 'structure_voted_down',
  DISCOVERY_PAGE_VIEW: 'discovery_page_view',
  DISCOVERY_SECTION_VIEW: 'discovery_section_view',
  DISCOVERY_TRACK_PLAY: 'discovery_track_play',
  DISCOVERY_STYLE_CLICK: 'discovery_style_click',
  DISCOVERY_TO_SEARCH: 'discovery_to_search',
  DISCOVERY_TO_CLASSIFY: 'discovery_to_classify',
  DISCOVERY_PLAYLIST_PLAY: 'discovery_playlist_play',
  DISCOVERY_PLAYLIST_VIEW_ALL: 'discovery_playlist_view_all',
} as const;
