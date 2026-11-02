"use client";
import { useEffect, useState } from "react";
import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { loginUrl, normalizeInstance } from "@/lib/ilias/config";
import { useBrowserOrigin } from "@/hooks/use-browser-origin";
import {
  ArrowUpRight,
  Check,
  Copy,
  Laptop,
  Loader2,
  Monitor,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  const [method, setMethod] = useState("remote");
  const [localAvailable, setLocalAvailable] = useState(false);
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>();
  const origin = useBrowserOrigin();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/connect")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setLocalAvailable(data.localBrowserAvailable);
          setMethod(data.mode);
        }
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
          if (data.method === "remote") setMethod("remote");
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
        body: JSON.stringify({ instance: url, mode: method }),
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
  const remote = method === "remote";
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
            Sign in directly with your university. Your password stays on their
            page.
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
                Freiburg is ready to use. Other instances need to be added to
                the server configuration.
              </FieldDescription>
            </Field>
            {localAvailable && (
              <Field>
                <FieldLabel>Where to sign in</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={method}
                  onValueChange={(v) => v && setMethod(v)}
                  variant="outline"
                  spacing={0}
                  disabled={busy}
                  aria-label="Sign-in method"
                >
                  <ToggleGroupItem value="remote">
                    <Laptop />
                    On my computer
                  </ToggleGroupItem>
                  <ToggleGroupItem value="local">
                    <Monitor />
                    Server browser
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
            )}
            <div className="flex flex-col gap-4 py-2 text-sm">
              <div className="flex gap-3">
                {remote ? (
                  <Laptop className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <p>
                  {remote ? (
                    "Use the helper on your laptop to open the real university sign-in. The Achilias server can run without a desktop or browser."
                  ) : (
                    <>
                      A sign-in window opens on the computer running Achilias.
                      Choose <strong>Anmelden / Login</strong> and complete
                      myLogin.
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>
                  {remote
                    ? "Only your ILIAS session is transferred. The server checks it before connecting, and stores it encrypted."
                    : "Once you reach ILIAS, this page connects automatically. The session is stored encrypted on the server."}
                </p>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t connect</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {remote && status === "pending" && (
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
            {!remote && busy && (
              <Alert>
                <Loader2 className="animate-spin" />
                <AlertTitle>Waiting for university sign-in</AlertTitle>
                <AlertDescription>
                  Complete sign-in in the server’s browser window. This can take
                  up to five minutes.
                </AlertDescription>
              </Alert>
            )}
            {!busy && (
              <Button type="submit" size="lg">
                <ArrowUpRight data-icon="inline-start" />
                {remote
                  ? "Get a connection code"
                  : "Continue to university sign-in"}
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
