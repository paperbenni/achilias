"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function ClaimSession() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", "/connect");
    async function claim() {
      if (!token)
        throw new Error("Open the connection link printed by bun run connect.");
      const response = await fetch("/api/session/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      window.location.replace("/");
    }
    void claim().catch((error) =>
      setError(error instanceof Error ? error.message : "Could not connect."),
    );
  }, []);
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
              <Link href="/">Back to overview</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
