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
const action =
  instance +
  "ilias.php?ref_id=401&ass_id=501&cmdClass=ilExAssignmentEditorGUI&cmd=updateAssignment";
const originalFetch = upstreamTransport.fetch;
const session: Session = {
  id: "00000000-0000-0000-0000-000000000000",
  instance,
  status: "pending",
  createdAt: Date.now(),
};
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
  delete session.readOnly;
});
const fixture = (name: string) =>
  readFile(
    new URL(`./fixtures/exercise-${name}.html`, import.meta.url),
    "utf8",
  );

test("live changes are denied by default and follow each request's user preference", () => {
  expect(liveWriteAllowed(session, "exc", "401")).toBe(false);
  expect(liveWriteAllowed(null, "frm", "401")).toBe(false);
  expect(liveWriteAllowed({ ...session, readOnly: true }, "exc", "401")).toBe(false);
  expect(liveWriteAllowed({ ...session, readOnly: false }, "exc", "401")).toBe(true);
  expect(liveWriteAllowed({ ...session, readOnly: false }, "frm", "402")).toBe(true);
  expect(liveWriteAllowed({ ...session, readOnly: false }, "exc", "../401")).toBe(false);
});
test("read-only search posts bypass the mutation preference only for the search controller", async () => {
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
  await fetchUpstream(
    session,
    instance +
      "ilias.php?baseClass=ilSearchControllerGUI&cmdClass=ilSearchGUI&cmd=remoteSearch",
    { form: new URLSearchParams({ queryString: "Gruppe 02" }), readOnlyForm: true },
  );
  expect(request).toHaveBeenCalledTimes(2);
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
  for (const rejected of [
    // ilCtrl would dispatch to another command class.
    "ilias.php?baseClass=ilSearchControllerGUI&cmdClass=ilExAssignmentEditorGUI&cmd=updateAssignment",
    // Duplicate routing fields: PHP keeps the last value, we would read the first.
    "ilias.php?baseClass=ilSearchControllerGUI&cmdClass=ilSearchGUI&cmdClass=ilExAssignmentEditorGUI&cmd=remoteSearch",
    "ilias.php?baseClass=ilSearchControllerGUI&cmdClass=ilSearchGUI&cmd=remoteSearch&cmd=updateAssignment",
    // ilCtrl falls back to fallbackCmd when cmd is not callable.
    "ilias.php?baseClass=ilSearchControllerGUI&cmdClass=ilSearchGUI&cmd=remoteSearch&fallbackCmd=updateAssignment",
    // A different base class or another entry script.
    "ilias.php?baseClass=ilRepositoryGUI&cmdClass=ilSearchGUI&cmd=remoteSearch",
    "goto.php?baseClass=ilSearchControllerGUI&cmdClass=ilSearchGUI&cmd=remoteSearch",
  ])
    await expect(
      fetchUpstream(session, instance + rejected, {
        form: new URLSearchParams({ queryString: "Gruppe 02" }),
        readOnlyForm: true,
      }),
    ).rejects.toThrow("not an ILIAS repository search");
  expect(request).toHaveBeenCalledTimes(2);
});
test("every live mutation and raw POST is rejected before contacting ILIAS when disabled", async () => {
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
    session.readOnly = false;
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
