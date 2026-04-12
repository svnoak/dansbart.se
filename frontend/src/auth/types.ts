export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
}
