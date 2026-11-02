"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
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
  const router = useRouter();
  const [url, setUrl] = useState(instance);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (
          data.status === "connected" &&
          (status === "pending" || status === "starting")
        ) {
          setStatus("idle");
          router.replace("/");
          router.refresh();
          onOpenChange(false);
        } else if (data.status === "pending") setStatus("pending");
        else if (data.status === "failed") {
          setStatus("idle");
          setError(data.error);
        }
      } catch {
        /* Transient failures are retried; no session data is cached in the browser. */
      }
    }
    void poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, router, onOpenChange, status]);
  async function connect(event: React.FormEvent) {
    event.preventDefault();
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
    } catch {
      setError("Could not cancel sign-in. Try again.");
    }
  }
  const busy = status === "starting" || status === "pending";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            <div className="flex flex-col gap-4 py-2 text-sm">
              <div className="flex gap-3">
                <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>
                  A sign-in window opens on the computer running Achilias.
                  Choose <strong>Anmelden / Login</strong> and complete myLogin.
                </p>
              </div>
              <div className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>
                  Once you reach ILIAS, this page connects automatically. The
                  session is stored encrypted on your computer.
                </p>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Couldn’t connect</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {busy && (
              <Alert>
                <Loader2 className="animate-spin" />
                <AlertTitle>Waiting for university sign-in</AlertTitle>
                <AlertDescription>
                  Complete sign-in in the browser window. This can take up to
                  five minutes.
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ArrowUpRight data-icon="inline-start" />
              )}
              {busy ? "Waiting for you…" : "Continue to university sign-in"}
            </Button>
            {busy && (
              <Button type="button" variant="ghost" onClick={cancel}>
                Cancel sign-in
              </Button>
            )}
          </FieldGroup>
        </form>
        <p className="text-xs text-muted-foreground">
          Designed for local use. Running this on a remote server? Use the
          session import workflow in the README.
        </p>
      </DialogContent>
    </Dialog>
  );
}
