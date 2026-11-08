"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  ready: boolean;
  secure: boolean;
  installed: boolean;
  ios: boolean;
  workerSupported: boolean;
  canInstall: boolean;
  installing: boolean;
  install: () => Promise<void>;
  offlineStatus: "pending" | "ready" | "unavailable" | "failed";
  retrySetup: () => void;
  error: string;
};
const initialEnvironment = {
  ready: false, secure: false, installed: false, ios: false, workerSupported: false,
};
const defaultState: PwaState = {
  ...initialEnvironment, canInstall: false,
  installing: false, install: async () => {}, offlineStatus: "pending",
  retrySetup: () => {}, error: "",
};
const PwaContext = createContext<PwaState>(defaultState);
export const usePwa = () => useContext(PwaContext);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvironment] = useState(initialEnvironment);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<PwaState["offlineStatus"]>(
    process.env.NODE_ENV === "production" ? "pending" : "unavailable",
  );
  const [retry, setRetry] = useState(0);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const reloadOnUpdate = useRef(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const legacyStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    const syncDisplay = () => setEnvironment((state) => ({
      ...state, ready: true, secure: window.isSecureContext,
      workerSupported: "serviceWorker" in navigator,
      installed: displayMode.matches || !!legacyStandalone,
      ios: /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    }));
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const installed = () => {
      setInstallEvent(null);
      setEnvironment((state) => ({ ...state, installed: true }));
    };
    const syncConnection = () => setOffline(!navigator.onLine);
    syncDisplay();
    syncConnection();
    displayMode.addEventListener("change", syncDisplay);
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);
    return () => {
      displayMode.removeEventListener("change", syncDisplay);
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  useEffect(() => {
    // A development worker would interfere with hot reload and cache testing.
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext ||
        !("serviceWorker" in navigator)) {
      return;
    }
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const removers: Array<() => void> = [];
    const showWaiting = () => {
      if (!disposed && registration?.waiting) {
        setWaiting(registration.waiting);
        setUpdateDismissed(false);
      }
    };
    const controllerChanged = () => {
      if (reloadOnUpdate.current) window.location.reload();
      else setWaiting(null);
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((result) => {
        if (disposed) return;
        registration = result;
        showWaiting();
        const trackInstalling = () => {
          const worker = result.installing;
          if (!worker) return;
          const stateChanged = () => {
            if (disposed) return;
            if (worker.state === "installed") showWaiting();
            if (worker.state === "redundant" && !result.active) setOfflineStatus("failed");
          };
          worker.addEventListener("statechange", stateChanged);
          removers.push(() => worker.removeEventListener("statechange", stateChanged));
        };
        result.addEventListener("updatefound", trackInstalling);
        removers.push(() => result.removeEventListener("updatefound", trackInstalling));
        trackInstalling();
        return navigator.serviceWorker.ready;
      })
      .then((result) => { if (result && !disposed) setOfflineStatus("ready"); })
      .catch(() => { if (!disposed) setOfflineStatus("failed"); });
    // Check again when returning to the app, at most once an hour.
    let checkedAt = Date.now();
    const checkUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine &&
          Date.now() - checkedAt > 60 * 60_000) {
        checkedAt = Date.now();
        void registration?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", checkUpdate);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      document.removeEventListener("visibilitychange", checkUpdate);
      for (const remove of removers) remove();
    };
  }, [retry]);

  async function install() {
    if (!installEvent) return;
    setInstalling(true);
    setError("");
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      setError("Installation couldn't open. You can also use your browser's install menu.");
    } finally {
      setInstallEvent(null);
      setInstalling(false);
    }
  }

  return (
    <PwaContext.Provider value={{
      ...environment, canInstall: !!installEvent, installing, install,
      offlineStatus: environment.ready && (!environment.secure || !environment.workerSupported)
        ? "unavailable" : offlineStatus,
      retrySetup: () => {
        setOfflineStatus("pending");
        setRetry((value) => value + 1);
      }, error,
    }}>
      {children}
      {(offline || (waiting && !updateDismissed)) && <div className="h-32" aria-hidden="true" />}
      {(offline || (waiting && !updateDismissed)) && (
        <aside className="app-notice fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-5 py-3 shadow-lg backdrop-blur-sm" aria-label="App status">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
            {offline ? (
              <p role="status" className="flex items-center gap-2 text-sm">
                <WifiOff className="size-4 shrink-0" />
                You’re offline. Reconnect to load content or save changes.
              </p>
            ) : (
              <>
                <p role="status" className="mr-auto text-sm">An Achilias update is ready. Save your work before reloading.</p>
                <Button size="sm" disabled={updating} onClick={() => {
                  reloadOnUpdate.current = true;
                  setUpdating(true);
                  waiting?.postMessage({ type: "SKIP_WAITING" });
                }}><RefreshCw /> Reload to update</Button>
                <Button size="sm" variant="ghost" onClick={() => setUpdateDismissed(true)}>Later</Button>
              </>
            )}
          </div>
        </aside>
      )}
    </PwaContext.Provider>
  );
}
