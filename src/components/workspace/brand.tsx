import Link from "next/link";

export function Brand({ demo = false }: { demo?: boolean }) {
  return (
    <Link
      prefetch={demo}
      href={demo ? "/?demo=1" : "/"}
      className="flex items-center gap-2.5"
      aria-label="Achilias home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="size-6"
        >
          <path
            d="m11 3-1 7c-.3 2-2 4-2 6 0 2 1.5 3 3.5 3H20c1.2 0 1.5-1.6.5-2.3L15 13.5 16 3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m2 9.5 4 4.5m-.2-4 .2 4-4.2.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-xl font-semibold tracking-tight">
        achilias<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
