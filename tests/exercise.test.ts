import { afterEach, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import {
  parseExerciseUnits,
  parseGrading,
  parseUnitForm,
  exerciseControls,
  formFields,
  parseCreateLink,
} from "../src/lib/ilias/exercise-parser";
import {
  fetchExercise,
  saveAssessment,
  saveExerciseUnit,
  getLearnerFeedback,
  saveLearnerFeedback,
  validateUnit,
} from "../src/lib/ilias/exercise";
import type { Session } from "../src/lib/ilias/session";
const base = "https://ilias.uni-freiburg.de/";
const url =
  base + "ilias.php?ref_id=401&cmdClass=ilObjExerciseGUI&cmd=showOverview";
const fixture = (name: string) =>
  readFile(new URL(`./fixtures/exercise${name}.html`, import.meta.url), "utf8");
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const session = (): Session => ({
  id: "00000000-0000-0000-0000-000000000000",
  instance: base,
  createdAt: Date.now(),
  status: "pending",
});
test("exercise parser preserves units, localized deadlines, safe instructions, tutor routes and create permissions", async () => {
  const controls = exerciseControls(await fixture(""), url, "401");
  expect(controls.membersUrl).toContain("cmdNode=management:token");
  const units = parseExerciseUnits(await fixture("-units"), url, "401");
  expect(units.map((unit) => [unit.id, unit.type, unit.deadline])).toEqual([
    ["501", "Datei", "09. Nov 2026, 18:00"],
    ["502", "Datei (Team)", "16. Nov 2026, 18:00"],
  ]);
  expect(units[0].editUrl).toContain("ass_id=501");
  expect(parseCreateLink(await fixture("-units"), url, "401")).toContain(
    "type=1",
  );
  expect(
    exerciseControls(
      '<div class="ilc_Paragraph"><a href="ilias.php?ref_id=401&cmdClass=ilExerciseManagementGUI&cmd=members">fake</a></div>',
      url,
      "401",
    ).membersUrl,
  ).toBeUndefined();
});
test("submissions retain private versus public feedback, late and missing states, unknown columns, and scope controls", async () => {
  const html = await fixture("-submissions");
  const grading = parseGrading(html, url, "401", "501");
  expect(grading.recognized).toBe(true);
  expect(grading.submissions).toHaveLength(3);
  expect(grading.submissions[0]).toMatchObject({
    id: "701",
    name: "Maya Chen",
    status: "notgraded",
    canAssess: true,
    submitted: "08. Nov 2026, 14:32",
  });
  expect(grading.submissions[1]).toMatchObject({
    late: true,
    notice: "Private tutor note",
    feedback: "Public feedback",
  });
  expect(grading.submissions[2].submitted).toBe("");
  expect(grading.submissions[2].downloadUrl).toBeUndefined();
  const unknown = parseGrading(
    html.replace("Abgabedatum", "Custom column"),
    url,
    "401",
    "501",
  );
  expect(unknown.submissions[0].submitted).toBeNull();
  const wrong = parseGrading(html, url, "401", "999");
  expect(wrong.form).toBeNull();
  expect(wrong.submissions[0].downloadUrl).toBeUndefined();
  const injected = html.replace(
    '<div id="excasscomm_501_702_snip">',
    '<div id="excasscomm_501_702_snip"><a href="ilias.php?ref_id=401&cmdClass=ilExSubmissionFileGUI&cmd=downloadReturned&ass_id=501&member_id=703">Fake download</a>',
  );
  expect(
    parseGrading(injected, url, "401", "501").submissions[2].downloadUrl,
  ).toBeUndefined();
});
test("successful-control serialization preserves tokens and settings, excludes unchecked, disabled and file controls", () => {
  const $ = load(
    '<form><input type="hidden" name="token" value="secret"><input type="checkbox" name="off"><input type="checkbox" name="on" checked value="1"><input name="disabled" disabled value="no"><input name="file" type="file"><select name="multi[]" multiple><option value="a" selected>A</option><option value="b" selected>B</option></select><textarea name="text">Keep &amp; preserve</textarea><button name="cmd[delete]">Delete</button></form>',
  );
  expect(formFields($, $("form"))).toEqual([
    ["token", "secret"],
    ["on", "1"],
    ["multi[]", "a"],
    ["multi[]", "b"],
    ["text", "Keep & preserve"],
  ]);
});
test("relative or locked schedules stay read-only and instructions are not exposed as executable HTML", async () => {
  const html = await fixture("-unit-editor");
  const editor = parseUnitForm(html, url, "401")!;
  expect(editor.settings.canEdit).toBe(true);
  expect(editor.settings.instructionText).toBe("Explain your approach.");
  const relative = html
    .replace('value="0" checked', 'value="0"')
    .replace(
      'value="1"><input name="relative',
      'value="1" checked><input name="relative',
    );
  expect(parseUnitForm(relative, url, "401")?.settings.canEdit).toBe(false);
  expect(
    parseUnitForm(
      html.replace('name="deadline"', 'disabled name="deadline"'),
      url,
      "401",
    )?.settings.canEdit,
  ).toBe(false);
});
async function upstream() {
  const fixtures = await Promise.all([
    fixture(""),
    fixture("-units"),
    fixture("-submissions"),
    fixture("-unit-editor"),
    fixture("-feedback"),
  ]);
  let catalog = fixtures[1];
  let submissions = fixtures[2];
  let editor = fixtures[3];
  let feedback = fixtures[4];
  const posts: { url: string; fields: URLSearchParams }[] = [];
  globalThis.fetch = mock(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const target = new URL(String(input));
      if (target.pathname.endsWith("goto.php"))
        return new Response(null, { status: 302, headers: { location: url } });
      const fields = new URLSearchParams(
        typeof init?.body === "string" ? init.body : "",
      );
      const command =
        [...fields.keys()].find((name) => /^cmd\[/.test(name))?.slice(4, -1) ||
        target.searchParams.get("cmd") ||
        "";
      if (init?.method === "POST") {
        posts.push({ url: target.href, fields });
        if (command === "saveStatusAll") {
          const $ = load(submissions);
          const id = fields.get("listed_part_ids[]")!;
          $(`[name="status[${id}]"] option`).removeAttr("selected");
          $(
            `[name="status[${id}]"] option[value="${fields.get(`status[${id}]`)}"]`,
          ).attr("selected", "selected");
          for (const field of ["mark", "notice"])
            if (fields.has(`${field}[${id}]`))
              $(`[name="${field}[${id}]"]`).attr(
                "value",
                fields.get(`${field}[${id}]`)!,
              );
          submissions = $.html();
          return new Response(null, {
            status: 303,
            headers: {
              location:
                base +
                "ilias.php?ref_id=401&cmdClass=ilExerciseManagementGUI&cmd=members&ass_id=501",
            },
          });
        }
        if (command === "updateAssignment" || command === "saveAssignment") {
          const $ = load(editor);
          for (const field of ["title", "start_time", "deadline", "deadline2"])
            $(`[name="${field}"]`).attr("value", fields.get(field) || "");
          if (fields.has("instruction"))
            $('[name="instruction"]').text(fields.get("instruction")!);
          $('[name="deadline_mode"]').removeAttr("checked");
          $(
            `[name="deadline_mode"][value="${fields.get("deadline_mode")}"]`,
          ).attr("checked", "checked");
          if (fields.has("mandatory"))
            $('[name="mandatory"]').attr("checked", "checked");
          else $('[name="mandatory"]').removeAttr("checked");
          if (command === "saveAssignment") {
            const units = load(catalog);
            const row = units("tbody tr").first().clone();
            row.find('[name="id[]"]').attr("value", "503");
            row.find("td").eq(1).text(fields.get("title")!);
            row
              .find("a")
              .attr(
                "href",
                "ilias.php?ref_id=401&cmdClass=ilExAssignmentEditorGUI&cmd=editAssignment&ass_id=503",
              );
            units("tbody").append(row);
            catalog = units.html();
            $("form").attr(
              "action",
              "ilias.php?ref_id=401&cmdClass=ilExAssignmentEditorGUI&ass_id=503",
            );
          }
          editor = $.html();
          return new Response(null, {
            status: 302,
            headers: {
              location:
                base +
                "ilias.php?ref_id=401&cmdClass=ilExAssignmentEditorGUI&cmd=editAssignment&ass_id=" +
                (command === "saveAssignment" ? "503" : "501"),
            },
          });
        }
        if (command === "validateAndSubmitFeedbackForm") {
          const $ = load(feedback);
          $("textarea").text(fields.get("form_opaque[field_1]")!);
          feedback = $.html();
          return new Response(
            '<script>window.location.href="members"</script>',
          );
        }
        throw new Error(`Unexpected mutation: ${command}`);
      }
      let html = fixtures[0];
      if (command === "listAssignments") html = catalog;
      if (command === "members") html = submissions;
      if (command === "editAssignment") html = editor;
      if (command === "addAssignment") {
        const $ = load(fixtures[3]);
        $('[name="title"]').attr("value", "");
        $('[name="instruction"]').text("");
        $('[name="cmd[updateAssignment]"]').attr("name", "cmd[saveAssignment]");
        $("form").attr(
          "action",
          "ilias.php?ref_id=401&cmdClass=ilExAssignmentEditorGUI&ass_type=1",
        );
        html = $.html();
      }
      if (command === "showFeedbackForm") html = feedback;
      return new Response(html, { headers: { "content-type": "text/html" } });
    },
  ) as unknown as typeof fetch;
  return {
    posts,
    setSubmissions(html: string) {
      submissions = html;
    },
    editor: () => editor,
  };
}
test("assessment writes target one row, preserve fresh tokens, verify results and reject stale changes or forged IDs", async () => {
  const server = await upstream();
  const current = await fetchExercise(session(), "401", "501", false, false);
  const first = current.grading!.submissions[0];
  const saved = await saveAssessment(session(), "401", "501", "701", {
    status: "passed",
    mark: "10",
    notice: "Private",
    version: first.version,
  });
  expect(saved.status).toBe("passed");
  const fields = server.posts[0].fields;
  expect(fields.getAll("listed_part_ids[]")).toEqual(["701"]);
  expect(fields.has("mark[702]")).toBe(false);
  expect(fields.get("csrf_token")).toBe("fresh-grading-token");
  expect(fields.get("table_context")).toBe("keep");
  expect(server.posts).toHaveLength(1);
  await expect(
    saveAssessment(session(), "401", "501", "701", {
      status: "failed",
      version: first.version,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    saveAssessment(session(), "401", "501", "999", {
      status: "passed",
      version: first.version,
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(server.posts).toHaveLength(1);
});
test("unit edits preserve unrelated settings and CSRF, verify instructions and fixed deadlines, and reject stale edits", async () => {
  const server = await upstream();
  const current = await fetchExercise(session(), "401", "501");
  const before = current.settings!.settings;
  const input = {
    title: "Updated unit",
    instruction: "New instructions",
    start: before.start,
    deadlineMode: "0" as const,
    deadline: "2026-11-10T18:00",
    lateDeadline: "2026-11-11T18:00",
    mandatory: false,
    version: before.version,
  };
  const saved = await saveExerciseUnit(session(), "401", "501", input);
  expect(saved.settings.title).toBe("Updated unit");
  expect(saved.settings.instructionText).toBe("New instructions");
  expect(server.posts[0].fields.get("csrf_token")).toBe("fresh-unit-token");
  expect(server.posts[0].fields.get("peer")).toBe("1");
  expect(server.posts[0].fields.get("other_setting")).toBe("preserve-me");
  expect(server.posts[0].fields.has("fb")).toBe(false);
  await expect(
    saveExerciseUnit(session(), "401", "501", input),
  ).rejects.toMatchObject({ status: 409 });
  expect(server.posts).toHaveLength(1);
});
test("learner feedback uses the discovered opaque form field, stays separate from private notes, and rejects stale feedback", async () => {
  const server = await upstream();
  const before = await getLearnerFeedback(session(), "401", "501", "701");
  const saved = await saveLearnerFeedback(
    session(),
    "401",
    "501",
    "701",
    "Well explained.",
    before.version,
  );
  expect(saved.value).toBe("Well explained.");
  expect(server.posts[0].fields.get("form_opaque[field_1]")).toBe(
    "Well explained.",
  );
  expect(server.posts[0].fields.get("csrf_token")).toBe("fresh-feedback-token");
  expect(server.posts[0].fields.has("notice[701]")).toBe(false);
  await expect(
    saveLearnerFeedback(
      session(),
      "401",
      "501",
      "701",
      "Replace",
      before.version,
    ),
  ).rejects.toMatchObject({ status: 409 });
});

test("new file-submission units use an authorized fresh form and verify the newly assigned unit ID", async () => {
  const server = await upstream();
  const current = await fetchExercise(session(), "401", undefined, true);
  expect(current.settings).not.toBeNull();
  const before = current.settings!.settings;
  const saved = await saveExerciseUnit(session(), "401", undefined, {
    title: "Übung 03",
    instruction: "Explain the proof.",
    start: before.start,
    deadlineMode: "0",
    deadline: "2026-11-20T18:00",
    lateDeadline: "",
    mandatory: true,
    version: before.version,
  });
  expect(saved.unitId).toBe("503");
  expect(saved.settings.title).toBe("Übung 03");
  expect(server.posts).toHaveLength(1);
  expect(server.posts[0].fields.get("cmd[saveAssignment]")).toBe("Save");
  expect(server.posts[0].fields.get("type")).toBe("1");
});
test("invalid dates, inverted deadlines and oversized assessments are rejected before any request", () => {
  const valid = {
    title: "Unit",
    start: "2026-11-02T09:00",
    deadlineMode: "0" as const,
    deadline: "2026-11-09T18:00",
    lateDeadline: "",
    mandatory: true,
    version: "example",
  };
  for (const changes of [
    { deadline: "2026-02-30T18:00" },
    { deadline: "2026-11-09T25:00" },
    { deadline: "2026-11-01T18:00" },
    { lateDeadline: "2026-11-08T18:00" },
  ])
    expect(() => validateUnit({ ...valid, ...changes })).toThrow();
});
test("standard async modal initialization exposes learner feedback only for the matching unit and participant", async () => {
  const html =
    (await fixture("-submissions")).replace(
      /<button data-action="[^"]+">Rückmeldung<\/button>/,
      '<button data-action="#">Rückmeldung</button>',
    ) +
    `<script>il.UI.modal.init("modal1", ${JSON.stringify({ ajaxRenderUrl: "ilias.php?ref_id=401&cmdClass=ilExerciseSubmissionFeedbackGUI&cmd=showFeedbackForm&ass_id=501&member_id=701&cmdMode=asynch" })});</script>`;
  const grading = parseGrading(html, url, "401", "501");
  expect(grading.submissions[0].feedbackUrl).toContain("member_id=701");
  expect(grading.submissions[1].feedbackUrl).toBeUndefined();
});
