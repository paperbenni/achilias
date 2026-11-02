import { mock } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const id = randomUUID();
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: id }) }),
}));
mock.module("next/cache", () => ({
  revalidatePath: () => {
    throw new Error("Rejected actions must not revalidate");
  },
}));
const { saveSession, deleteSession } =
  await import("../../src/lib/ilias/session");
const { getWorkspaceMetadata } = await import("../../src/lib/ilias/workspace");
await saveSession({
  id,
  instance: "https://ilias.uni-freiburg.de/",
  status: "connected",
  createdAt: Date.now(),
  userName: "Example tutor",
});
const current = await getWorkspaceMetadata();
let requests = 0;
globalThis.fetch = (async () => {
  requests++;
  throw new Error("No real ILIAS requests in account-boundary tests");
}) as unknown as typeof fetch;
const actions = await import("../../src/app/actions/exercises");
const unit = {
  title: "Unit",
  start: "",
  deadlineMode: "-1" as const,
  deadline: "",
  lateDeadline: "",
  mandatory: false,
  version: "example",
};
const rejected = await Promise.all([
  actions.assessSubmission(
    "401",
    "501",
    "701",
    { status: "passed", version: "example" },
    "previous-account",
  ),
  actions.updateExerciseUnit("401", undefined, unit, "previous-account"),
  actions.loadFeedback("401", "501", "701", "previous-account"),
  actions.sendFeedback(
    "401",
    "501",
    "701",
    "Feedback",
    "example",
    "previous-account",
  ),
]);
assert.ok(
  rejected.every((result) => result.error?.includes("connection changed")),
);
assert.equal(requests, 0);
const allowed = await actions.loadFeedback(
  "401",
  "501",
  "701",
  current.storageKey!,
);
assert.ok(allowed.error?.includes("could not be reached"));
assert.equal(requests, 1);
requests = 0;
await deleteSession(id);
const disconnected = await actions.assessSubmission(
  "401",
  "501",
  "701",
  { status: "passed", version: "example" },
  current.storageKey!,
);
assert.ok(disconnected.error?.includes("Reconnect"));
assert.equal(requests, 0);
console.log("verified");
