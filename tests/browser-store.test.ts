import { afterEach, expect, test } from "bun:test";
import { createBrowserStore } from "../src/lib/browser-store";
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
function browser() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const window = Object.assign(new EventTarget(), { localStorage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: window,
  });
  return { window, values, localStorage };
}
const decode = (value: unknown) =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
const fallback: string[] = [];

test("browser stores keep stable snapshots, notify same-document consumers and respect account keys", () => {
  const { values } = browser();
  const first = createBrowserStore(
    "account-a",
    "localStorage",
    decode,
    fallback,
  );
  const second = createBrowserStore(
    "account-a",
    "localStorage",
    decode,
    fallback,
  );
  const other = createBrowserStore(
    "account-b",
    "localStorage",
    decode,
    fallback,
  );
  const unsubscribe = first.subscribe(() => {});
  let changes = 0;
  const stop = second.subscribe(() => {
    changes++;
  });
  expect(first.getServerSnapshot()).toBe(fallback);
  expect(first.update(() => ["saved"])).toBe(true);
  expect(second.getSnapshot()).toEqual(["saved"]);
  expect(second.getSnapshot()).toBe(second.getSnapshot());
  expect(changes).toBe(1);
  expect(other.getSnapshot()).toBe(fallback);
  expect(values.get("account-a")).toBe('["saved"]');
  stop();
  unsubscribe();
  first.update((current) => [...current, "recent"]);
  expect(changes).toBe(1);
});
test("cross-tab writes and clearing storage notify subscribers, and invalid JSON recovers", () => {
  const { window, values, localStorage } = browser();
  const store = createBrowserStore(
    "account-a",
    "localStorage",
    decode,
    fallback,
  );
  let seen = store.getSnapshot();
  const stop = store.subscribe(() => {
    seen = store.getSnapshot();
  });
  values.set("account-a", '["from other tab"]');
  window.dispatchEvent(
    Object.assign(new Event("storage"), {
      key: "account-a",
      storageArea: localStorage,
    }),
  );
  expect(seen).toEqual(["from other tab"]);
  values.clear();
  window.dispatchEvent(
    Object.assign(new Event("storage"), {
      key: null,
      storageArea: localStorage,
    }),
  );
  expect(seen).toBe(fallback);
  values.set("account-a", "broken JSON");
  expect(store.getSnapshot()).toBe(fallback);
  stop();
});
test("blocked storage preserves usable memory state and reports that persistence failed", () => {
  const { localStorage } = browser();
  localStorage.getItem = () => {
    throw new Error("blocked");
  };
  localStorage.setItem = () => {
    throw new Error("blocked");
  };
  const store = createBrowserStore(
    "account-a",
    "localStorage",
    decode,
    fallback,
  );
  expect(store.update(() => ["saved in memory"])).toBe(false);
  expect(store.getSnapshot()).toEqual(["saved in memory"]);
});
