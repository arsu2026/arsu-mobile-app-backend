// ─────────────────────────────────────────────────────────────────────────────
// Global TypeScript types and augmented Express interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;       // User ID
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface SortQuery {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type ID = string;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncHandler = (...args: any[]) => Promise<any>;
