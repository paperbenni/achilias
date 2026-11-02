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

import { ParsedHtmlNotice } from "@/components/navigation/parsed-html-notice";
import { dashboardUrl, loginUrl } from "@/lib/ilias/config";
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
        <h1 className="page-title">Features & connection</h1>
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
            <ParsedHtmlNotice
              feature="connection"
              sourceUrl={loginUrl(data.instance)}
            />
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
            <CardTitle>Bookmarks on this browser</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Bookmarks and recently opened materials stay in this browser. They
              don’t change your ILIAS favorites or learning progress. They are
              separate for each connection and for the demo.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                onClearHistory();
                toast.success("Bookmarks and recent history cleared");
              }}
            >
              Clear bookmarks & history
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Feature support</CardTitle>
          <CardDescription>
            Features marked “HTML-based” read ILIAS pages and may break or miss
            details after ILIAS or theme updates. Use their original-page
            buttons to check the source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y">
            {[
              {
                title: "Courses & groups",
                description:
                  "Browse the items exposed on your dashboard and open their content.",
                supported: true,
                htmlBased: true,
              },
              {
                title: "Folders & categories",
                description:
                  "Navigate nested materials and read plain-text course information.",
                supported: true,
                htmlBased: true,
              },
              {
                title: "Files",
                description:
                  "Open PDFs in the browser and download other files through your ILIAS session.",
                supported: true,
                htmlBased: false,
              },
              {
                title: "Search & bookmarks",
                description:
                  "Filter this page, recently opened content, and bookmarks instantly. Search all your courses through ILIAS's repository search, with each result's course path shown.",
                supported: true,
                htmlBased: true,
              },
              {
                title: "Exercises and tutor review",
                description:
                  "Browse Übungseinheiten and Abgaben, download submissions, assess individuals or teams, keep private tutor notes, send learner feedback, and create or edit file-submission units with fixed deadlines.",
                supported: true,
                htmlBased: true,
              },
              {
                title: "Advanced exercise workflows",
                description:
                  "Learner uploads, unit deletion, team membership, feedback attachments, bulk downloads, peer review, and relative or individual deadlines use ILIAS.",
                supported: false,
                htmlBased: true,
              },
              {
                title: "Tests & surveys",
                description:
                  "Visible in course content. Complete attempts and surveys in ILIAS.",
                supported: false,
                htmlBased: false,
              },
              {
                title: "Forum reading",
                description:
                  "Browse discussions, read formatted replies, navigate pages, and mark a thread read.",
                supported: true,
                htmlBased: true,
              },
              {
                title: "Forum posting, subscriptions & moderation",
                description:
                  "Reply and new-topic links are discovered in ILIAS HTML and open the original editor. Attachments and media also use ILIAS.",
                supported: false,
                htmlBased: true,
              },
              {
                title: "Wikis & learning modules",
                description:
                  "Visible as objects; interactive content opens in ILIAS.",
                supported: false,
                htmlBased: false,
              },
              {
                title: "Calendar, mail, grades & administration",
                description:
                  "Use the original ILIAS interface. These areas are not synchronized here.",
                supported: false,
                htmlBased: false,
              },
              {
                title: "Rich content, pagination & custom plugins",
                description:
                  "Plain-text content is shown. Layouts, embedded media, additional pages, and custom tools may require ILIAS.",
                supported: false,
                htmlBased: false,
              },
            ].map(({ title, description, supported, htmlBased }) => (
              <div key={String(title)} className="flex items-start gap-4 py-4">
                <span className="mt-0.5 text-primary">
                  {supported ? (
                    <Check className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{title}</p>
                    {htmlBased && <Badge variant="outline">HTML-based</Badge>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  {htmlBased && (
                    <div className="mt-3">
                      <OriginalLink href={dashboardUrl(data.instance)} compact>
                        Open ILIAS
                      </OriginalLink>
                    </div>
                  )}
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
