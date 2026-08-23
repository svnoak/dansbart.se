export interface AuthUser {
  id: string;
  username: string;
  role: string;
  /** Private — how many tracks this user has helped confirm the style of. Shown only
   *  to the user themselves, never as a public/leaderboard stat. */
  confirmedTrackCount?: number;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
}
