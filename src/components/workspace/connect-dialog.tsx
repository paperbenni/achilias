"use client";
import { useEffect, useState } from "react";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { loginUrl, normalizeInstance } from "@/lib/ilias/config";
import { useBrowserOrigin } from "@/hooks/use-browser-origin";
import {
  ArrowUpRight,
  Check,
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
export function ConnectDialog({
  open,
  onOpenChange,
  instance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: string;
}) {
  const [url, setUrl] = useState(instance);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [passwordAvailable, setPasswordAvailable] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [cookie, setCookie] = useState("");
  const [cookieBusy, setCookieBusy] = useState(false);
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>();
  const origin = useBrowserOrigin();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/connect")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setPasswordAvailable(Boolean(data.passwordLoginAvailable));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);
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
        } else if (data.status === "failed") {
          setStatus("idle");
          setCode("");
          setError(data.error);
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
  async function connect(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
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
      setExpiresAt(data.expiresAt);
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
      setExpiresAt(undefined);
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
  const command = `bun run connect --server '${origin}'`;
  let originalInstance = instance;
  try {
    originalInstance = normalizeInstance(url);
  } catch {
    // Keep the existing instance link while a new address is incomplete.
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle>Connect your learning space</DialogTitle>
          <DialogDescription>
            Use the helper on your laptop so your university password never
            reaches this server. You can also paste an existing ILIAS cookie.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={connect}>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="instance">ILIAS instance</FieldLabel>
              <Input
                id="instance"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                aria-invalid={!!error}
              />
              <FieldDescription>
                Enter your university’s public HTTPS ILIAS address, including
                its installation path if needed. Freiburg is prefilled.
              </FieldDescription>
            </Field>
            <div className="flex flex-col gap-4 py-2 text-sm">
              <div className="flex gap-3">
                <Laptop className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>
                  Use the helper on your computer to open the real university
                  sign-in. This currently requires Bun and an Achilias checkout
                  on your computer; the server runs without a desktop or
                  browser.
                </p>
              </div>
              <div className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>
                  Only your ILIAS session is transferred. The server checks it
                  before connecting, and stores it encrypted.
                </p>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t connect</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {status === "pending" && (
              <>
                <Field>
                  <FieldLabel htmlFor="helper-command">
                    1. Run on your laptop, from an Achilias checkout
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
                    First-time setup: bun install, then bun run browser:install.
                    The helper needs a browser on your laptop.
                  </FieldDescription>
                </Field>
                {code ? (
                  <Field>
                    <FieldLabel htmlFor="connection-code">
                      2. Paste this code when the helper asks
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
                      This code connects this browser only. It expires{" "}
                      {expiresAt
                        ? `at ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "after ten minutes"}{" "}
                      and is used once.
                    </FieldDescription>
                  </Field>
                ) : (
                  <Alert>
                    <AlertTitle>A connection is already waiting</AlertTitle>
                    <AlertDescription>
                      Use the code you already copied, or generate a new one.
                      Generating a code invalidates the previous code.
                    </AlertDescription>
                  </Alert>
                )}
                <Alert>
                  <Loader2 className="animate-spin" />
                  <AlertTitle>Waiting for your local helper</AlertTitle>
                  <AlertDescription>
                    Complete myLogin on your laptop, then return here. This page
                    connects automatically.
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
              </>
            )}
            {!busy && (
              <Button type="submit" size="lg">
                <ArrowUpRight data-icon="inline-start" />
                Get a connection code
              </Button>
            )}
            {status === "starting" && (
              <Button disabled>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Starting connection…
              </Button>
            )}
            {busy && (
              <Button type="button" variant="ghost" onClick={cancel}>
                Cancel sign-in
              </Button>
            )}
          </FieldGroup>
        </form>
        <details className="rounded-lg border p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-heading text-sm font-medium">
            <Cookie className="size-4" />
            Use cookies from your browser
          </summary>
          <form onSubmit={cookieConnect} className="mt-4 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Paste the ILIAS <code>Cookie</code> request header from your
              browser’s DevTools, or a Playwright storageState/cookie JSON
              export. Only cookies for the exact ILIAS host are kept, and the
              server verifies the dashboard before connecting.
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cookie-value">
                  Cookie header or JSON export
                </FieldLabel>
                <Textarea
                  id="cookie-value"
                  rows={4}
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  disabled={busy || passwordBusy || cookieBusy}
                  placeholder="PHPSESSID=…; other=…"
                  spellCheck={false}
                  required
                  className="font-mono text-xs"
                />
                <FieldDescription>
                  Cookies are bearer credentials. Remove any export file after
                  using it, and disconnect when finished.
                </FieldDescription>
              </Field>
              <Button
                type="submit"
                variant="outline"
                disabled={busy || passwordBusy || cookieBusy || !url}
              >
                {cookieBusy ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Cookie data-icon="inline-start" />
                )}
                {cookieBusy ? "Verifying cookies…" : "Connect with cookies"}
              </Button>
            </FieldGroup>
          </form>
        </details>
        {passwordAvailable && (
          <form
            onSubmit={passwordConnect}
            className="flex flex-col gap-4 rounded-lg border p-4"
          >
            <div>
              <h3 className="font-heading text-sm font-medium">
                Use your university password
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Only enable this on a server you control. Achilias sends these
                credentials to your university’s sign-in page, uses them once,
                and never stores them. Accounts with a second factor must use
                the browser helper.
              </p>
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="university-username">
                  University username
                </FieldLabel>
                <Input
                  id="university-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={passwordBusy || busy || cookieBusy}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="university-password">Password</FieldLabel>
                <Input
                  id="university-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={passwordBusy || busy || cookieBusy}
                  required
                />
              </Field>
              <Button
                type="submit"
                disabled={passwordBusy || busy || cookieBusy || !url}
              >
                {passwordBusy ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <KeyRound data-icon="inline-start" />
                )}
                {passwordBusy
                  ? "Signing in…"
                  : "Sign in with university account"}
              </Button>
            </FieldGroup>
          </form>
        )}
        <ParsedHtmlNotice
          feature="connection"
          sourceUrl={loginUrl(originalInstance)}
        />
        <p className="text-xs text-muted-foreground">
          For a remote server, use HTTPS or an SSH tunnel. If ILIAS rejects a
          transferred session, the helper can sign in through an SSH SOCKS proxy
          to the server; see the README.
        </p>
      </DialogContent>
    </Dialog>
  );
}
