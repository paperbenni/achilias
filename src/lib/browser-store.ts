export type BrowserStorage = "localStorage" | "sessionStorage";
const changeEvent = "achilias:storage-change";

/** A React-compatible store with stable snapshots, hydration defaults, and tab sync. */
export function createBrowserStore<T>(
  key: string,
  storage: BrowserStorage,
  decode: (value: unknown) => T,
  fallback: T,
) {
  let raw: string | null | undefined;
  let snapshot = fallback;
  function getSnapshot() {
    try {
      const next = window[storage].getItem(key);
      if (next !== raw) {
        raw = next;
        try {
          snapshot = next === null ? fallback : decode(JSON.parse(next));
        } catch {
          snapshot = fallback;
        }
      }
    } catch {
      // Storage may be blocked; keep this document's in-memory state usable.
    }
    return snapshot;
  }
  return {
    getSnapshot,
    getServerSnapshot: () => fallback,
    subscribe(listener: () => void) {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        if (event.storageArea === window[storage]) listener();
      };
      const onChange = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.key === key && detail.storage === storage) listener();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(changeEvent, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(changeEvent, onChange);
      };
    },
    update(change: (current: T) => T) {
      const next = change(getSnapshot());
      const encoded = JSON.stringify(next);
      snapshot = next;
      let persisted = false;
      try {
        window[storage].setItem(key, encoded);
        raw = encoded;
        persisted = true;
      } catch {
        // Preserve the in-memory update and let the caller explain persistence failure.
      }
      window.dispatchEvent(
        new CustomEvent(changeEvent, { detail: { key, storage } }),
      );
      return persisted;
    },
  };
}
