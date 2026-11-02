"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function ClaimSession() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", "/connect");
    if (!token) {
      setError("Open the connection link printed by bun run connect.");
      return;
    }
    void fetch("/api/session/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error);
        router.replace("/");
        router.refresh();
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not connect."),
      );
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {error
              ? "Connection needs another try"
              : "Connecting your learning space…"}
          </CardTitle>
          <CardDescription>
            {error || "Your ILIAS session is being connected to this browser."}
          </CardDescription>
        </CardHeader>
        {error && (
          <CardContent>
            <Button asChild>
              <a href="/">Back to overview</a>
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
