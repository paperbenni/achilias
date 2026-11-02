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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

/** The marketing page shown before an account is connected. */
export function DisconnectedHero({ onConnect }: { onConnect: () => void }) {
  return (
    <>
      <section className="welcome-hero relative overflow-hidden rounded-2xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-lg">
          <Badge variant="outline" className="mb-6">
            <span className="size-1.5 rounded-full bg-primary" />
            MADE FOR YOUR LEARNING
          </Badge>
          <h1 className="hero-title">
            Less friction.
            <br />
            <span className="text-primary">More learning.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            A calmer home for your ILIAS courses. Find your materials, pick up
            where you left off, and get on with learning.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onConnect}>
              Connect your ILIAS
              <ArrowUpRight data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link prefetch={true} href="/?demo=1">
                Take a look around
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Sign in securely through your university.
          </p>
        </div>
        <div className="hero-art hidden lg:block" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-orbit orbit-three" />
          <div className="art-book">
            <BookOpen className="size-14" />
            <span>
              A little more
              <br />
              room to learn.
            </span>
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
            title: "Your courses, together",
            text: "One clear starting point for the spaces and materials you use every day.",
          },
          {
            icon: Bookmark,
            title: "Keep the useful things close",
            text: "Save a lecture, a folder, or a reading. Come back without retracing your steps.",
          },
          {
            icon: ArrowUpRight,
            title: "The whole campus is still there",
            text: "When a feature needs ILIAS, you’ll see it here with a direct way to open it.",
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
              Ready for the University of Freiburg
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Works with your existing ILIAS account and myLogin.
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
