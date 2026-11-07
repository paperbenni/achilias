"use client";
import { useEffect, useId, useState } from "react";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { loginUrl, normalizeInstance } from "@/lib/ilias/config";
import { useBrowserOrigin } from "@/hooks/use-browser-origin";
import { cn } from "@/lib/utils";
import { Cookie, Copy, KeyRound, Laptop, Loader2 } from "lucide-react";
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

/**
 * The sign-in form shared by the homepage and the connection dialog.
 * It owns the whole flow so both surfaces behave identically.
 */
export function ConnectForm({
  instance,
  showNotice = true,
  className,
}: {
  instance: string;
  showNotice?: boolean;
  className?: string;
}) {
  const formId = useId();
  const [url, setUrl] = useState(instance);
  const [status, setStatus] = useState<ConnectStatus>("idle");
  const [error, setError] = useState("");
  const [method, setMethod] = useState<ConnectMethod>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [cookie, setCookie] = useState("");
  const [cookieBusy, setCookieBusy] = useState(false);
  const [code, setCode] = useState("");
  const origin = useBrowserOrigin();
  // Pick up a helper sign-in that was already started, for example after a
  // reload or when the dialog is reopened.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.status === "pending") {
          setStatus("pending");
          setMethod("helper");
        } else if (data.status === "failed") {
          setError(data.error);
        }
      })
      .catch(() => {
        /* A transient status check should not block the form. */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Only poll while a helper sign-in is actually waiting.
  useEffect(() => {
    if (status !== "pending") return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "connected") {
          // A full navigation clears any previous account's router cache.
          window.location.replace("/");
        } else if (data.status === "failed") {
          setStatus("idle");
          setCode("");
          setError(data.error);
        } else if (data.status === "disconnected") {
          setStatus("idle");
          setCode("");
        }
      } catch {
        /* Retry transient polling failures without caching any session data. */
      }
    }
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);
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
  const busy = status === "starting" || status === "pending";
  const formBusy = busy || passwordBusy || cookieBusy;
  const tabDisabled = (value: ConnectMethod) => formBusy && method !== value;
  const command = `npx achilias connect --server '${origin}'`;
  let originalInstance = instance;
  try {
    originalInstance = normalizeInstance(url);
  } catch {
    // Keep the existing instance link while a new address is incomplete.
  }
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Field>
        <FieldLabel htmlFor={`${formId}-instance`}>ILIAS instance</FieldLabel>
        <Input
          id={`${formId}-instance`}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={formBusy}
          spellCheck={false}
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
          <TabsTrigger value="password" disabled={tabDisabled("password")}>
            <KeyRound />
            Password
          </TabsTrigger>
          <TabsTrigger value="helper" disabled={tabDisabled("helper")}>
            <Laptop />
            Helper
          </TabsTrigger>
          <TabsTrigger value="cookies" disabled={tabDisabled("cookies")}>
            <Cookie />
            Cookies
          </TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-2">
          <form onSubmit={passwordConnect} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${formId}-username`}>Username</FieldLabel>
                <Input
                  id={`${formId}-username`}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={formBusy}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${formId}-password`}>Password</FieldLabel>
                <Input
                  id={`${formId}-password`}
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
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <KeyRound data-icon="inline-start" />
                )}
                {passwordBusy ? "Signing in…" : "Sign in"}
              </Button>
            </FieldGroup>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sent once and never stored. Only use on a server you control.
            </p>
          </form>
        </TabsContent>
        <TabsContent value="helper" className="mt-2">
          <div className="flex flex-col gap-4">
            {status === "pending" ? (
              <>
                <Field>
                  <FieldLabel htmlFor={`${formId}-command`}>
                    Run on your laptop
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`${formId}-command`}
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
                    No checkout needed. Chromium installs automatically on
                    first use; Bun users can run the same command with bunx.
                  </FieldDescription>
                </Field>
                {code ? (
                  <Field>
                    <FieldLabel htmlFor={`${formId}-code`}>
                      Paste this code when asked
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={`${formId}-code`}
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
                  Sign in through a browser on your laptop. Only your ILIAS
                  session is transferred.
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
              <FieldLabel htmlFor={`${formId}-cookie`}>
                Cookie header or session value
              </FieldLabel>
              <Textarea
                id={`${formId}-cookie`}
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
              Cookies are bearer credentials. Log out when finished.
            </p>
          </form>
        </TabsContent>
      </Tabs>
      {showNotice && (
        <ParsedHtmlNotice
          compact
          feature="connection"
          sourceUrl={loginUrl(originalInstance)}
        />
      )}
    </div>
  );
}
