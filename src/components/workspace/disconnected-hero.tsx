"use client";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  GraduationCap,
  ShieldCheck,
  University,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

/** Account connection and feature overview before sign-in. */
export function DisconnectedHero({ onConnect }: { onConnect: () => void }) {
  return (
    <>
      <section className="welcome-hero relative overflow-hidden rounded-2xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-lg">
          <h1 className="hero-title">Connect to ILIAS</h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Access courses, files, forums and exercises using your existing
            ILIAS account.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onConnect}>
              Connect your ILIAS
              <ArrowUpRight data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link prefetch={true} href="/?demo=1">
                Try the demo
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Sign in on your university’s website.
          </p>
        </div>
        <div className="hero-art hidden lg:block" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-orbit orbit-three" />
          <div className="art-book">
            <BookOpen className="size-14" />
          </div>
          <span className="art-star star-one">✳</span>
          <span className="art-star star-two">✳</span>
          <span className="art-dot" />
        </div>
      </section>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            icon: GraduationCap,
            title: "Courses and files",
            text: "Browse your ILIAS courses and open course materials.",
          },
          {
            icon: Bookmark,
            title: "Bookmarks",
            text: "Bookmark files and activities. Bookmarks stay in this browser.",
          },
          {
            icon: ArrowUpRight,
            title: "Other ILIAS tools",
            text: "Unsupported activities have a link to open them in ILIAS.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-3 size-5 text-primary" />
              <CardTitle>{title}</CardTitle>
              <CardDescription className="leading-relaxed">
                {text}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <University className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Default instance: University of Freiburg
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You can choose another ILIAS instance when connecting.
            </p>
          </div>
        </div>
        <Button variant="link" asChild>
          <Link prefetch={true} href="/settings">
            See supported features
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </>
  );
}
