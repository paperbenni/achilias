import { normalizeInstance } from "@/lib/ilias/config";
import { publicHostname } from "@/lib/ilias/upstream-transport";
import {
  createSession,
  currentSession,
  deleteSession,
  saveSession,
} from "@/lib/ilias/session";
import {
  RequestLimitError,
  withVerificationLimit,
} from "@/lib/ilias/request-limits";
import { noStore } from "@/lib/api";
import type { SerializedCookieJar } from "tough-cookie";

export class ConnectRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function assertPublicInstance(input: string) {
  const target = normalizeInstance(input);
  if (!publicHostname(new URL(target).hostname))
    throw new ConnectRequestError(
      "Enter a public Internet HTTPS ILIAS hostname. Private networks and IP addresses are not supported.",
    );
  return target;
}

export function connectFailure(
  error: unknown,
  known: (error: unknown) => error is Error & { status: number },
  fallback: string,
) {
  const isKnown = known(error);
  return Response.json(
    { error: isKnown ? error.message : fallback },
    {
      status: isKnown ? error.status : 400,
      headers: {
        ...noStore,
        ...(error instanceof RequestLimitError
          ? { "Retry-After": "600" }
          : {}),
      },
    },
  );
}

/** Replace the current connection only after the candidate session verifies. */
export async function connectWithVerifiedJar(
  target: string,
  verify: () => Promise<{ jar: SerializedCookieJar; userName?: string }>,
) {
  const previous = await currentSession();
  if (previous) await deleteSession(previous.id);
  const session = await createSession(target);
  try {
    const result = await withVerificationLimit(verify);
    session.jar = result.jar;
    session.userName = result.userName;
    session.status = "connected";
    await saveSession(session);
    return Response.json({ status: "connected" }, { headers: noStore });
  } catch (error) {
    await deleteSession(session.id);
    throw error;
  }
}
