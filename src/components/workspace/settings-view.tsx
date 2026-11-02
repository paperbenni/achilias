"use client";

import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Workspace } from "@/lib/ilias/types";

import { OriginalLink } from "@/components/navigation/original-link";

export function SettingsView({
  data,
  onConnect,
  onClearHistory,
}: {
  data: Workspace;
  onConnect: () => void;
  onClearHistory: () => void;
}) {
  const demo = data.mode === "demo";
  return (
    <>
      <div>
        <p className="eyebrow">MAKE YOURSELF AT HOME</p>
        <h1 className="page-title mt-3">A clear view of what’s here.</h1>
        <p className="mt-3 text-muted-foreground">
          Your connection, your data, and what Achilias can do today.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your ILIAS connection</CardTitle>
            <CardDescription>{data.instanceName}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="break-all font-mono text-xs text-muted-foreground">
              {data.instance}
            </p>
            <Badge className="w-fit" variant="secondary">
              {data.mode === "live"
                ? "Connected"
                : demo
                  ? "Demo · no account connected"
                  : "Not connected"}
            </Badge>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign-in happens on the university’s own page. Only ILIAS cookies
              are copied; university identity-provider cookies stay in the
              sign-in browser. Sessions are encrypted on the server and expire
              here after 12 hours or earlier if ILIAS ends them.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={onConnect}>
              <ShieldCheck data-icon="inline-start" />
              {data.mode === "live" ? "Reconnect account" : "Connect account"}
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved on this browser</CardTitle>
            <CardDescription>
              A small, personal layer over ILIAS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Saved items and recently opened materials stay in this browser.
              They don’t change your ILIAS favorites or learning progress. They
              are separate for each connection and for the demo.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                onClearHistory();
                toast.success("Saved items and recent history cleared");
              }}
            >
              Clear saved items & history
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What works here</CardTitle>
          <CardDescription>
            Start with everyday learning. Keep the full platform within reach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y">
            {[
              [
                "Courses & groups",
                "Browse the items exposed on your dashboard and open their content.",
                true,
              ],
              [
                "Folders & categories",
                "Navigate nested materials and read plain-text course information.",
                true,
              ],
              [
                "Files",
                "Download files through your authenticated ILIAS session.",
                true,
              ],
              [
                "Search & saved items",
                "Search this page, recently opened content, and items saved in this browser.",
                true,
              ],
              [
                "Assignments, tests & surveys",
                "Visible in course content. Complete submissions, attempts, and surveys in ILIAS.",
                false,
              ],
              [
                "Forum reading",
                "Browse discussions, read formatted replies, navigate pages, and mark a thread read.",
                true,
              ],
              [
                "Forum posting, subscriptions & moderation",
                "Reply and new-topic links open the original editor. Attachments and media also use ILIAS.",
                false,
              ],
              [
                "Wikis & learning modules",
                "Visible as objects; interactive content opens in ILIAS.",
                false,
              ],
              [
                "Calendar, mail, grades & administration",
                "Use the original ILIAS interface. These areas are not synchronized here.",
                false,
              ],
              [
                "Rich content, pagination & custom plugins",
                "Plain-text content is shown. Layouts, embedded media, additional pages, and custom tools may require ILIAS.",
                false,
              ],
            ].map(([title, description, supported]) => (
              <div key={String(title)} className="flex items-start gap-4 py-4">
                <span className="mt-0.5 text-primary">
                  {supported ? (
                    <Check className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
                <Badge variant={supported ? "secondary" : "outline"}>
                  {supported ? "Available" : "In ILIAS"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <OriginalLink href={data.instance} />
        </CardFooter>
      </Card>
    </>
  );
}
