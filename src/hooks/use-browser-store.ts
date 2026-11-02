"use client";
import { useMemo, useSyncExternalStore } from "react";
import { createBrowserStore, type BrowserStorage } from "@/lib/browser-store";
const subscribeHydration = () => () => {};
const hydrated = () => true;
const serverHydrated = () => false;

export function useBrowserStore<T>(
  key: string,
  storage: BrowserStorage,
  decode: (value: unknown) => T,
  fallback: T,
) {
  const store = useMemo(
    () => createBrowserStore(key, storage, decode, fallback),
    [key, storage, decode, fallback],
  );
  const value = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribeHydration,
    hydrated,
    serverHydrated,
  );
  return { value, ready, update: store.update };
}
