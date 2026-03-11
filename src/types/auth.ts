export interface AuthUser {
  email: string;
  name: string;
  picture: string | null;
  isAdmin: boolean;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}
