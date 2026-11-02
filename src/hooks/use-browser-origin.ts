"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const getSnapshot = () => window.location.origin;
const getServerSnapshot = () => "";

/** Browser-only origin, with a stable server snapshot for hydration. */
export function useBrowserOrigin() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
