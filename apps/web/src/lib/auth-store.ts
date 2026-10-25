import { type JwtPayload, JwtPayloadSchema } from "@campus/contracts";

export interface Session {
  accessToken: string;
  user: JwtPayload;
}

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = "campus-space.session";

/**
 * Persists the session and notifies subscribers. Framework-free so it can be unit tested and
 * consumed through useSyncExternalStore in React.
 */
export function createAuthStore(storage: SessionStorageLike) {
  let session: Session | null = read();
  const listeners = new Set<() => void>();

  function read(): Session | null {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { accessToken?: unknown; user?: unknown };
      if (typeof parsed.accessToken !== "string") return null;
      const user = JwtPayloadSchema.safeParse(parsed.user);
      return user.success ? { accessToken: parsed.accessToken, user: user.data } : null;
    } catch {
      return null;
    }
  }

  function emit(): void {
    for (const listener of listeners) listener();
  }

  return {
    getSession: (): Session | null => session,
    getToken: (): string | null => session?.accessToken ?? null,
    signIn(next: Session): void {
      session = next;
      storage.setItem(KEY, JSON.stringify(next));
      emit();
    },
    signOut(): void {
      session = null;
      storage.removeItem(KEY);
      emit();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;

/** In-memory fallback when localStorage is unavailable (private mode, blocked storage). */
export function memoryStorage(): SessionStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
