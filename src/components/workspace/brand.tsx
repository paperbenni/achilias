import Link from "next/link";

export function Brand({ demo = false, prominent = false }: { demo?: boolean; prominent?: boolean }) {
  return (
    <Link
      prefetch={demo}
      href={demo ? "/?demo=1" : "/"}
      className={`flex w-fit items-center ${prominent ? "gap-4" : "gap-2.5"}`}
      aria-label="Achilias home"
    >
      <span className={`flex shrink-0 items-center justify-center bg-primary text-primary-foreground ${prominent ? "size-16 rounded-2xl sm:size-20" : "size-9 rounded-xl"}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={prominent ? "size-11 sm:size-14" : "size-6"}
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
      <span className={`font-semibold tracking-tight ${prominent ? "text-4xl sm:text-5xl" : "text-xl"}`}>
        achilias<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
