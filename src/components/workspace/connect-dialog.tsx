"use client";
import { useEffect, useState } from "react";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { loginUrl, normalizeInstance } from "@/lib/ilias/config";
import { useBrowserOrigin } from "@/hooks/use-browser-origin";
import {
  Cookie,
  Copy,
  KeyRound,
  Laptop,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ConnectMethod = "password" | "helper" | "cookies";
type ConnectStatus = "idle" | "starting" | "pending";

export function ConnectDialog({
  open,
  onOpenChange,
  instance,
  passwordAvailable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: string;
  passwordAvailable: boolean;
}) {
  const [url, setUrl] = useState(instance);
  const [status, setStatus] = useState<ConnectStatus>("idle");
  const [error, setError] = useState("");
  const [method, setMethod] = useState<ConnectMethod>(() =>
    passwordAvailable ? "password" : "helper",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [cookie, setCookie] = useState("");
  const [cookieBusy, setCookieBusy] = useState(false);
  const [code, setCode] = useState("");
  const origin = useBrowserOrigin();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "connected" && status === "pending") {
          setStatus("idle");
          setCode("");
          // A full navigation clears any previous account's router cache.
          window.location.replace("/");
          onOpenChange(false);
        } else if (data.status === "pending") {
          setStatus("pending");
          setMethod("helper");
        } else if (data.status === "failed") {
          setStatus("idle");
          setCode("");
          setError(data.error);
        } else if (data.status === "disconnected" && status === "pending") {
          setStatus("idle");
          setCode("");
        }
      } catch {
        /* Retry transient polling failures without caching any session data. */
      }
    }
    void poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, onOpenChange, status]);
  async function connect() {
    setError("");
    setMethod("helper");
    setStatus("starting");
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCode(data.code || "");
      setStatus("pending");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Could not start sign-in.");
    }
  }
  async function passwordConnect(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPasswordBusy(true);
    try {
      const res = await fetch("/api/connect/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: url, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not sign in.");
      setPassword("");
      // A full navigation clears any previous account's router cache.
      window.location.replace("/");
      onOpenChange(false);
    } catch (e) {
      setPassword("");
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setPasswordBusy(false);
    }
  }
  async function cookieConnect(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setCookieBusy(true);
    try {
      const res = await fetch("/api/connect/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: url, cookies: cookie }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not connect.");
      setCookie("");
      // A full navigation clears any previous account's router cache.
      window.location.replace("/");
      onOpenChange(false);
    } catch (e) {
      setCookie("");
      setError(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setCookieBusy(false);
    }
  }
  async function cancel() {
    try {
      const res = await fetch("/api/session", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStatus("idle");
      setError("");
      setCode("");
    } catch {
      setError("Could not cancel sign-in. Try again.");
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError(
        "Could not copy automatically. Select and copy the text instead.",
      );
    }
  }
  function handleOpenChange(next: boolean) {
    if (!next) {
      setError("");
      setMethod(passwordAvailable ? "password" : "helper");
    }
    onOpenChange(next);
  }
  const busy = status === "starting" || status === "pending";
  const formBusy = busy || passwordBusy || cookieBusy;
  const tabDisabled = (value: ConnectMethod) => formBusy && method !== value;
  const command = `bun run connect --server '${origin}'`;
  let originalInstance = instance;
  try {
    originalInstance = normalizeInstance(url);
  } catch {
    // Keep the existing instance link while a new address is incomplete.
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle>Sign in to ILIAS</DialogTitle>
          <DialogDescription>Use your university account.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="instance">ILIAS instance</FieldLabel>
          <Input
            id="instance"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={formBusy}
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn’t connect</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Tabs
          value={method}
          onValueChange={(value) => setMethod(value as ConnectMethod)}
        >
          <TabsList className="w-full">
            {passwordAvailable && (
              <TabsTrigger
                value="password"
                disabled={tabDisabled("password")}
              >
                <KeyRound />
                Password
              </TabsTrigger>
            )}
            <TabsTrigger value="helper" disabled={tabDisabled("helper")}>
              <Laptop />
              Helper
            </TabsTrigger>
            <TabsTrigger value="cookies" disabled={tabDisabled("cookies")}>
              <Cookie />
              Cookies
            </TabsTrigger>
          </TabsList>
          {passwordAvailable && (
            <TabsContent value="password" className="mt-2">
              <form onSubmit={passwordConnect} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="university-username">
                      Username
                    </FieldLabel>
                    <Input
                      id="university-username"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={formBusy}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="university-password">
                      Password
                    </FieldLabel>
                    <Input
                      id="university-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={formBusy}
                      required
                    />
                  </Field>
                  <Button type="submit" disabled={formBusy || !url}>
                    {passwordBusy ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <KeyRound data-icon="inline-start" />
                    )}
                    {passwordBusy ? "Signing in…" : "Sign in"}
                  </Button>
                </FieldGroup>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Sent once and never stored. Only use on a server you
                  control.
                </p>
              </form>
            </TabsContent>
          )}
          <TabsContent value="helper" className="mt-2">
            <div className="flex flex-col gap-4">
              {status === "pending" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="helper-command">
                      Run on your laptop
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="helper-command"
                        readOnly
                        value={command}
                        className="font-mono text-xs"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label="Copy helper command"
                          onClick={() => copy(command)}
                        >
                          <Copy />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      First time: bun install, then bun run browser:install.
                    </FieldDescription>
                  </Field>
                  {code ? (
                    <Field>
                      <FieldLabel htmlFor="connection-code">
                        Paste this code when asked
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="connection-code"
                          aria-label="Connection code"
                          readOnly
                          value={code}
                          autoComplete="off"
                          spellCheck={false}
                          className="font-mono text-xs"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-xs"
                            aria-label="Copy connection code"
                            onClick={() => copy(code)}
                          >
                            <Copy />
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldDescription>
                        Expires in ten minutes. Single use.
                      </FieldDescription>
                    </Field>
                  ) : (
                    <Alert>
                      <AlertTitle>A connection is already waiting</AlertTitle>
                      <AlertDescription>
                        Use the code you already copied, or generate a new one.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <Loader2 className="animate-spin" />
                    <AlertTitle>Waiting for your helper</AlertTitle>
                    <AlertDescription>
                      Complete sign-in in the browser on your laptop.
                    </AlertDescription>
                  </Alert>
                  {!code && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => connect()}
                    >
                      Generate a new connection code
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={cancel}>
                    Cancel sign-in
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Sign in through a browser on your laptop. Only your
                    ILIAS session is transferred.
                  </p>
                  <Button
                    type="button"
                    onClick={() => connect()}
                    disabled={formBusy || !url}
                  >
                    {status === "starting" ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <Laptop data-icon="inline-start" />
                    )}
                    {status === "starting"
                      ? "Starting…"
                      : "Get a connection code"}
                  </Button>
                </>
              )}
            </div>
          </TabsContent>
          <TabsContent value="cookies" className="mt-2">
            <form onSubmit={cookieConnect} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="cookie-value">
                  Cookie header or session value
                </FieldLabel>
                <Textarea
                  id="cookie-value"
                  rows={4}
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  disabled={formBusy}
                  placeholder="PHPSESSID=… or just the session value"
                  spellCheck={false}
                  required
                  className="font-mono text-xs"
                />
                <FieldDescription>
                  Paste the ILIAS Cookie header, just the session value, or a
                  Playwright export.
                </FieldDescription>
              </Field>
              <Button
                type="submit"
                variant="outline"
                disabled={formBusy || !url}
              >
                {cookieBusy ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Cookie data-icon="inline-start" />
                )}
                {cookieBusy ? "Verifying…" : "Connect with cookies"}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Cookies are bearer credentials. Disconnect when finished.
              </p>
            </form>
          </TabsContent>
        </Tabs>
        <ParsedHtmlNotice
          compact
          feature="connection"
          sourceUrl={loginUrl(originalInstance)}
        />
      </DialogContent>
    </Dialog>
  );
}
