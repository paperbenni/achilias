"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ShieldCheck,
  University,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppearanceButton } from "@/components/navigation/appearance-button";
import { ConnectForm } from "./connect-form";
import { SettingsView } from "./settings-view";
import { Brand } from "./brand";
import type { WorkspaceViewName } from "./nav-items";
import type { Workspace } from "@/lib/ilias/types";

/** Full-screen sign-in and settings chrome used while no account is connected. */
export function DisconnectedView({
  data,
  view,
  onClearHistory,
}: {
  data: Workspace;
  view: WorkspaceViewName;
  onClearHistory: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;
  if (view === "settings")
    return (
      <main className="flex min-h-svh flex-col">
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b px-5 lg:px-10">
          <Brand />
          <div className="flex items-center gap-2">
            <AppearanceButton />
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft data-icon="inline-start" />
                Back to sign in
              </Link>
            </Button>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 lg:px-10 lg:py-10">
          <SettingsView
            data={data}
            onConnect={() => router.push("/")}
            onClearHistory={onClearHistory}
          />
        </div>
      </main>
    );
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <section className="flex flex-col px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <AppearanceButton />
        </div>
        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Sign in to ILIAS
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Use your existing university account. There is no new password to
              remember.
            </p>
            <div className="mt-8">
              <ConnectForm
                instance={data.instance}
                showNotice={false}
                returnTo={returnTo}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Button variant="link" className="h-auto p-0" asChild>
                <Link prefetch={true} href="/?demo=1">
                  Explore the demo
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                variant="link"
                className="h-auto p-0 text-muted-foreground"
                asChild
              >
                <Link prefetch={true} href="/settings">
                  See supported features
                </Link>
              </Button>
              <Button
                variant="link"
                className="h-auto p-0 text-muted-foreground lg:hidden"
                asChild
              >
                <a
                  href={data.instance}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open ILIAS
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <aside className="hidden border-l bg-muted/30 lg:flex lg:flex-col lg:justify-center lg:px-16 xl:px-24">
        <div className="max-w-md">
          <p className="eyebrow">A calmer ILIAS</p>
          <h2 className="mt-4 text-balance text-4xl font-medium leading-tight tracking-tight">
            Your courses, files and forums without the clutter.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Achilias keeps the parts of ILIAS you use every day and opens
            everything else in the original.
          </p>
          <ul className="mt-8 flex flex-col gap-4 text-sm">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Your password is used once and never stored.</span>
            </li>
            <li className="flex items-start gap-3">
              <Bookmark className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Bookmarks and recent history stay in this browser.</span>
            </li>
            <li className="flex items-start gap-3">
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Anything unsupported opens in the original ILIAS.</span>
            </li>
          </ul>
          <div className="mt-10 flex items-center gap-3 border-t pt-6 text-xs text-muted-foreground">
            <University className="size-4 shrink-0" />
            <span>Default instance: {data.instanceName}</span>
            <a
              href={data.instance}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto underline-offset-4 hover:text-foreground hover:underline"
            >
              Open ILIAS
            </a>
          </div>
        </div>
      </aside>
    </main>
  );
}
