import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { afterEach, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { liveWriteAllowed } from "../src/lib/ilias/write-policy";
import { fetchUpstream } from "../src/lib/ilias/client";
import {
  saveAssessment,
  saveExerciseUnit,
  saveLearnerFeedback,
} from "../src/lib/ilias/exercise";
import { markForumThreadRead } from "../src/lib/ilias/forum";
import {
  exerciseCommand,
  formScopeMatches,
  parseGrading,
  parseUnitForm,
} from "../src/lib/ilias/exercise-parser";
import type { Session } from "../src/lib/ilias/session";
const instance = "https://ilias.uni-freiburg.de/";
const exercise = instance + "goto.php?target=exc_401";
const action =
  instance +
  "ilias.php?ref_id=401&ass_id=501&cmdClass=ilExAssignmentEditorGUI&cmd=updateAssignment";
const originalFetch = upstreamTransport.fetch;
const originalTargets = process.env.ACHILIAS_WRITE_TARGETS;
const session: Session = {
  id: "00000000-0000-0000-0000-000000000000",
  instance,
  status: "pending",
  createdAt: Date.now(),
};
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
  if (originalTargets === undefined) delete process.env.ACHILIAS_WRITE_TARGETS;
  else process.env.ACHILIAS_WRITE_TARGETS = originalTargets;
});
const fixture = (name: string) =>
  readFile(
    new URL(`./fixtures/exercise-${name}.html`, import.meta.url),
    "utf8",
  );

test("live changes default to denied and allowlists bind object kind, installation and ID", () => {
  delete process.env.ACHILIAS_WRITE_TARGETS;
  expect(liveWriteAllowed(instance, "exc", "401")).toBe(false);
  process.env.ACHILIAS_WRITE_TARGETS =
    exercise + ",https://other.example/ilias/goto.php?target=frm_401";
  expect(liveWriteAllowed(instance, "exc", "401")).toBe(true);
  expect(liveWriteAllowed(instance, "exc", "402")).toBe(false);
  expect(liveWriteAllowed(instance, "frm", "401")).toBe(false);
  expect(liveWriteAllowed("https://other.example/", "exc", "401")).toBe(false);
  expect(liveWriteAllowed("https://other.example/ilias/", "frm", "401")).toBe(
    true,
  );
  process.env.ACHILIAS_WRITE_TARGETS = "*,401," + exercise + "&cmd=delete";
  expect(liveWriteAllowed(instance, "exc", "401")).toBe(false);
});
test("read-only search posts bypass the write allowlist only for the search controller", async () => {
  delete process.env.ACHILIAS_WRITE_TARGETS;
  const searchAction =
    instance +
    "ilias.php?baseClass=ilSearchController&cmd=post&fallbackCmd=remoteSearch&rtoken=test";
  const request = mock(
    async () => new Response("search results", { status: 200 }),
  );
  upstreamTransport.fetch = request as unknown as typeof fetch;
  await fetchUpstream(session, searchAction, {
    form: new URLSearchParams({ queryString: "Gruppe 02" }),
    readOnlyForm: true,
  });
  expect(request).toHaveBeenCalledTimes(1);
  await expect(
    fetchUpstream(session, action, {
      form: new URLSearchParams({ title: "Not a search" }),
      readOnlyForm: true,
    }),
  ).rejects.toThrow("not an ILIAS repository search");
  await expect(
    fetchUpstream(
      session,
      instance +
        "ilias.php?baseClass=ilSearchController&cmd=post&fallbackCmd=delete",
      {
        form: new URLSearchParams({ queryString: "Gruppe 02" }),
        readOnlyForm: true,
      },
    ),
  ).rejects.toThrow("not an ILIAS repository search");
  expect(request).toHaveBeenCalledTimes(1);
});
test("every live mutation and raw POST is rejected before contacting ILIAS when disabled", async () => {
  delete process.env.ACHILIAS_WRITE_TARGETS;
  const request = mock(() => {
    throw new Error("Must not contact ILIAS");
  });
  upstreamTransport.fetch = request as unknown as typeof fetch;
  await expect(
    saveAssessment(session, "401", "501", "701", {
      status: "passed",
      version: "fresh",
    }),
  ).rejects.toThrow("Live changes are disabled");
  await expect(
    saveExerciseUnit(session, "401", "501", {
      title: "Unit",
      start: "",
      deadlineMode: "-1",
      deadline: "",
      lateDeadline: "",
      mandatory: false,
      version: "fresh",
    }),
  ).rejects.toThrow("Live changes are disabled");
  await expect(
    saveLearnerFeedback(session, "401", "501", "701", "Feedback", "fresh"),
  ).rejects.toThrow("Live changes are disabled");
  await expect(markForumThreadRead(session, "401", "601")).rejects.toThrow(
    "Live changes are disabled",
  );
  await expect(
    fetchUpstream(session, action, { form: new URLSearchParams() }),
  ).rejects.toThrow("Live changes are disabled");
  expect(request).not.toHaveBeenCalled();
});
for (const status of [307, 308])
  test(`POST ${status} redirects never replay an ambiguous write`, async () => {
    process.env.ACHILIAS_WRITE_TARGETS = exercise;
    const request = mock(
      async () => new Response(null, { status, headers: { location: action } }),
    );
    upstreamTransport.fetch = request as unknown as typeof fetch;
    await expect(
      fetchUpstream(session, action, {
        form: new URLSearchParams({ title: "New" }),
      }),
    ).rejects.toThrow("did not replay");
    expect(request).toHaveBeenCalledTimes(1);
  });
test("hidden routing fields and duplicate query IDs cannot override verified form scope", async () => {
  expect(
    formScopeMatches(action, [
      ["ref_id", "401"],
      ["ass_id", "501"],
    ]),
  ).toBe(true);
  for (const fields of [
    [["ref_id", "999"]],
    [["ref.id", "999"]],
    [["ref id", "999"]],
    [["ass_id", "502"]],
    [["ref_id[]", "401"]],
    [
      ["ref_id", "401"],
      ["ref_id", "401"],
    ],
    [["member_id", "701"]],
  ] as [string, string][][])
    expect(formScopeMatches(action, fields)).toBe(false);
  expect(
    exerciseCommand(
      action + "&ref_id=999",
      ["ilexassignmenteditorgui"],
      ["updateassignment"],
      "401",
      "501",
    ),
  ).toBe(false);
  expect(
    exerciseCommand(
      action + "&ref.id=999",
      ["ilexassignmenteditorgui"],
      ["updateassignment"],
      "401",
      "501",
    ),
  ).toBe(false);
  const html = await fixture("unit-editor");
  expect(parseUnitForm(html, action, "401", false, "502")).toBeNull();
  expect(
    parseUnitForm(
      html.replace(
        '<input type="hidden" name="csrf_token"',
        '<input type="hidden" name="ref_id" value="999"><input type="hidden" name="csrf_token"',
      ),
      action,
      "401",
      false,
      "501",
    ),
  ).toBeNull();
  const grading = await fixture("submissions");
  const noSave = grading.replaceAll("cmd[saveStatusAll]", "cmd[delete]");
  const parsed = parseGrading(noSave, action, "401", "501");
  expect(parsed.form).toBeNull();
  expect(parsed.submissions.every((row) => !row.canAssess)).toBe(true);
});
