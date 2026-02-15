export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}
