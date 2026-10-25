import { useSyncExternalStore } from "react";
import { createApiClient } from "./api-client";
import {
  createAuthStore,
  memoryStorage,
  type Session,
  type SessionStorageLike,
} from "./auth-store";

function safeStorage(): SessionStorageLike {
  try {
    const probe = "__campus_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

/** Singletons shared by the whole app. Modules import `api` and the hooks, never fetch directly. */
export const authStore = createAuthStore(safeStorage());

export const api = createApiClient({
  getToken: authStore.getToken,
  onUnauthenticated: () => authStore.signOut(),
});

export function useSession(): Session | null {
  return useSyncExternalStore(authStore.subscribe, authStore.getSession, authStore.getSession);
}
