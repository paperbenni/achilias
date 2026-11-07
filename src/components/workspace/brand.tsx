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
            d="M4 18 11.5 5 19 18M7 13h9M16 5l4 7"
            stroke="currentColor"
            strokeWidth="2"
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
