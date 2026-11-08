import Link from "next/link";
import { ConnectForm } from "@/components/workspace/connect-form";
import { safeReturnTo } from "@/lib/auth-navigation";
import { FREIBURG } from "@/lib/ilias/config";
import { currentSession } from "@/lib/ilias/session";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [params, session] = await Promise.all([searchParams, currentSession()]);
  const returnTo = safeReturnTo(params.returnTo);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 p-6">
      <Link href="/" className="text-sm text-muted-foreground">
        Achilias
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in to continue</h1>
        <p className="text-sm text-muted-foreground">
          Your session is missing or has expired. Connect your ILIAS account to
          continue to the page you opened.
        </p>
      </div>
      <ConnectForm instance={session?.instance || FREIBURG} returnTo={returnTo} />
    </main>
  );
}
