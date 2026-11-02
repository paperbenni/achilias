import { createHash } from "node:crypto";
import { load } from "cheerio";
import { formFields } from "./html-forms";
export { formFields } from "./html-forms";
import { scriptStringProperties } from "./script-config";
import { cleanText as clean } from "./text";
import { upstreamLink } from "./links";
import { validObjectId } from "./identifiers";
import { sanitizeIliasHtml } from "./html";
import type {
  AssessmentStatus,
  ExerciseUnit,
  Submission,
  UnitSettings,
} from "./exercise-types";

/** The table column holding the submission date, in English or German UIs. */
const submissionDateColumn =
  /submission.*date|abgabe|abgegeben|eingereicht|date.*submission/;

export function exerciseVersion(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 24);
}
export function exerciseCommand(
  url: string,
  classes: string[],
  commands: string[],
  exerciseId: string,
  unitId?: string,
  memberId?: string,
) {
  const u = new URL(url);
  const routing = [
    "ref_id",
    "ass_id",
    "member_id",
    "cmdClass",
    "cmd",
    "cmdNode",
    "baseClass",
  ];
  const seen = new Set<string>();
  for (const key of u.searchParams.keys()) {
    const base = key.toLowerCase().replace(/[ .]/g, "_").replace(/\[.*$/, "");
    if (!routing.some((name) => name.toLowerCase() === base)) continue;
    if (seen.has(base) || key.includes("[") || /[\x00-\x1f]/.test(key))
      return false;
    seen.add(base);
  }
  return (
    u.pathname.endsWith("/ilias.php") &&
    u.searchParams.get("ref_id") === exerciseId &&
    classes.includes((u.searchParams.get("cmdClass") || "").toLowerCase()) &&
    commands.includes((u.searchParams.get("cmd") || "").toLowerCase()) &&
    (!unitId || u.searchParams.get("ass_id") === unitId) &&
    (!memberId || u.searchParams.get("member_id") === memberId)
  );
}
export function exerciseControls(
  html: string,
  source: string,
  exerciseId: string,
) {
  const $ = load(html);
  const links = $(
    "#ilTab a[href], .il-tabs a[href], #ilSubTab a[href], .ilToolbar a[href], .ilToolbar button[data-action]",
  )
    .toArray()
    .flatMap((node) => {
      const url = upstreamLink(
        $(node).attr("href") || $(node).attr("data-action") || "",
        source,
      );
      return url ? [url] : [];
    });
  const editorUrl = links.find((url) =>
    exerciseCommand(
      url,
      ["ilexassignmenteditorgui"],
      ["listassignments"],
      exerciseId,
    ),
  );
  const membersUrl = links.find((url) =>
    exerciseCommand(url, ["ilexercisemanagementgui"], ["members"], exerciseId),
  );
  return { editorUrl, membersUrl };
}
export function parseExerciseUnits(
  html: string,
  source: string,
  exerciseId: string,
): ExerciseUnit[] {
  const $ = load(html);
  const units = new Map<string, ExerciseUnit>();
  $('table[id*="excass"] tbody tr, table[id*="excass"] > tr').each((_, row) => {
    const cells = $(row).children("td");
    const id = $(row).find('input[name="id[]"]').val();
    if (typeof id !== "string" || !validObjectId(id)) return;
    const editUrl = $(row)
      .find("a[href]")
      .toArray()
      .map((a) => upstreamLink($(a).attr("href")!, source))
      .find(
        (url) =>
          url &&
          exerciseCommand(
            url,
            ["ilexassignmenteditorgui"],
            ["editassignment"],
            exerciseId,
            id,
          ),
      );
    if (!editUrl || cells.length < 9) return;
    units.set(id, {
      id,
      title: clean(cells.eq(1).text()),
      type: clean(cells.eq(2).text()),
      start: clean(cells.eq(4).text()),
      deadline: clean(cells.eq(5).text()),
      mandatory: clean(cells.eq(6).text()),
      instructions: sanitizeIliasHtml(cells.eq(8).html() || "", source),
      sourceUrl: editUrl,
      editUrl,
    });
  });
  $(".il-item").each((_, row) => {
    const link = $(row).find(".il-item-title a[href]").first();
    const url = upstreamLink(link.attr("href") || "", source);
    const id = url && new URL(url).searchParams.get("ass_id");
    if (
      !url ||
      !id ||
      !validObjectId(id) ||
      new URL(url).searchParams.get("ref_id") !== exerciseId ||
      units.has(id)
    )
      return;
    const properties = $(row)
      .find(".il-item-property-name")
      .toArray()
      .map((name) => ({
        name: clean($(name).text()),
        value: clean($(name).siblings(".il-item-property-value").text()),
      }));
    const property = (pattern: RegExp) =>
      properties.find((p) => pattern.test(p.name))?.value || "";
    units.set(id, {
      id,
      title: clean(link.text()),
      type: property(/type|typ|art/i),
      start: "",
      deadline: property(/deadline|abgabe|termin|frist/i),
      mandatory: property(/requirement|pflicht|verpflicht/i),
      instructions: "",
      sourceUrl: url,
    });
  });
  $('select[name="ass_id"] option').each((_, option) => {
    const id = $(option).attr("value") || "";
    if (validObjectId(id) && !units.has(id))
      units.set(id, {
        id,
        title: clean($(option).text()),
        type: "",
        start: "",
        deadline: "",
        mandatory: "",
        instructions: "",
        sourceUrl: source,
      });
  });
  // A single-unit exercise has no unit selector. Its authorized grading form
  // still identifies the current unit, even when the learner overview hides it.
  const gradingTable = $('table[id*="exc_mem"]').first();
  const gradingAction = upstreamLink(
    gradingTable.closest("form").attr("action") || "",
    source,
  );
  if (
    gradingAction &&
    exerciseCommand(
      gradingAction,
      ["ilexercisemanagementgui", "ilparticipantsperassignmenttablegui"],
      ["savestatusall"],
      exerciseId,
    )
  ) {
    const id = new URL(gradingAction).searchParams.get("ass_id") || "";
    if (validObjectId(id) && !units.has(id))
      units.set(id, {
        id,
        title: `Exercise unit ${id}`,
        type: "",
        start: "",
        deadline: "",
        mandatory: "",
        instructions: "",
        sourceUrl: source,
      });
  }
  return [...units.values()];
}
export type ParsedForm = {
  action: string;
  fields: [string, string][];
  command?: [string, string];
};
/** Hidden routing controls must agree with the independently verified action URL. */
export function formScopeMatches(action: string, fields: [string, string][]) {
  const query = new URL(action).searchParams;
  const routing = new Set([
    "ref_id",
    "ass_id",
    "member_id",
    "part_id",
    "cmdclass",
    "cmdnode",
    "baseclass",
  ]);
  const seen = new Set<string>();
  for (const [name, value] of fields) {
    const key = name.toLowerCase().replace(/[ .]/g, "_").replace(/\[.*$/, "");
    if (!routing.has(key)) continue;
    const queryKey = [...query.keys()].find((k) => k.toLowerCase() === key);
    if (
      name.includes("[") ||
      /[\x00-\x1f]/.test(name) ||
      seen.has(key) ||
      !queryKey ||
      query.get(queryKey) !== value
    )
      return false;
    seen.add(key);
  }
  return true;
}
export function parseGrading(
  html: string,
  source: string,
  exerciseId: string,
  unitId: string,
) {
  const $ = load(html);
  const table = $('table[id*="exc_mem"]').first();
  const form = table.closest("form");
  const action = upstreamLink(form.attr("action") || "", source);
  const fields = form.length ? formFields($, form) : [];
  const command = form
    .find('button[name="cmd[saveStatusAll]"], input[name="cmd[saveStatusAll]"]')
    .filter(
      (_, node) =>
        !$(node).is(":disabled") &&
        !$(node).closest("fieldset[disabled]").length,
    )
    .first();
  const allowed =
    action &&
    command.length > 0 &&
    formScopeMatches(action, fields) &&
    exerciseCommand(
      action,
      ["ilexercisemanagementgui", "ilparticipantsperassignmenttablegui"],
      ["savestatusall", "", "members"],
      exerciseId,
      unitId,
    );
  const headers = table
    .find("thead tr")
    .first()
    .children("th, td")
    .toArray()
    .map((th) => clean($(th).text()).toLowerCase());
  const column = (pattern: RegExp) =>
    headers.findIndex((label) => pattern.test(label));
  // Standard ILIAS roundtrip modals keep their URLs in JSON initialization code,
  // outside the table; they are not always present on the trigger button.
  const modalFeedbackUrls = $("script")
    .filter((_, script) => !$(script).closest("table, .ilc_Paragraph").length)
    .toArray()
    .flatMap((script) =>
      scriptStringProperties($(script).text(), "ajaxRenderUrl"),
    )
    .flatMap((href) => {
      const url = upstreamLink(href, source);
      return url ? [url] : [];
    });
  const submissions: Submission[] = [];
  table.find("tbody tr").each((_, row) => {
    const r = $(row);
    const id = r.find('input[name="listed_part_ids[]"]').attr("value") || "";
    if (!validObjectId(id)) return;
    const cells = r.children("td");
    const cellText = (pattern: RegExp) => {
      const index = column(pattern);
      return index >= 0 ? clean(cells.eq(index).text()) : "";
    };
    const team = headers.some((h) => /^team(?:$|\s)/i.test(h));
    const name =
      cellText(/^(name|team|teilnehm|participant)/) || `Participant ${id}`;
    const statusControl = r.find(`select[name="status[${id}]"]`);
    const status = statusControl.val();
    const mark = r.find(`input[name="mark[${id}]"]`);
    const notice = r.find(`input[name="notice[${id}]"]`);
    // Never accept links from a participant's free-text feedback as action controls.
    const actions = cells.last();
    const actionLinks = actions
      .find("a[href], button[data-action]")
      .toArray()
      .flatMap((a) => {
        const url = upstreamLink(
          $(a).attr("href") || $(a).attr("data-action") || "",
          source,
        );
        return url ? [url] : [];
      });
    const downloadUrl = actionLinks.find((url) =>
      exerciseCommand(
        url,
        ["ilexsubmissionfilegui"],
        ["downloadreturned"],
        exerciseId,
        unitId,
        id,
      ),
    );
    const feedbackUrl = [...actionLinks, ...modalFeedbackUrls].find((url) =>
      exerciseCommand(
        url,
        ["ilexercisesubmissionfeedbackgui"],
        ["showfeedbackform"],
        exerciseId,
        unitId,
        id,
      ),
    );
    const rowFeedback = r.find(`[id="excasscomm_${unitId}_${id}_snip"]`);
    const entry: Submission = {
      id,
      name,
      login: cellText(/^login|benutzername/),
      team,
      submitted:
        column(submissionDateColumn) < 0
          ? null
          : cellText(submissionDateColumn),
      late:
        column(submissionDateColumn) < 0
          ? null
          : cells
              .eq(column(submissionDateColumn))
              .find(".warning").length > 0,
      status: ["notgraded", "passed", "failed"].includes(String(status))
        ? (status as AssessmentStatus)
        : null,
      mark:
        mark.length &&
        !mark.is(":disabled") &&
        !mark.closest("fieldset[disabled]").length
          ? String(mark.val() || "")
          : null,
      notice:
        notice.length &&
        !notice.is(":disabled") &&
        !notice.closest("fieldset[disabled]").length
          ? String(notice.val() || "")
          : null,
      feedback: rowFeedback.length ? clean(rowFeedback.text()) : null,
      downloadUrl,
      feedbackUrl,
      originalUrl: source,
      canAssess:
        !!allowed &&
        ["notgraded", "passed", "failed"].includes(String(status)) &&
        statusControl.length > 0 &&
        !statusControl.is(":disabled") &&
        !statusControl.closest("fieldset[disabled]").length,
      version: "",
    };
    entry.version = exerciseVersion([
      entry.id,
      entry.name,
      entry.status,
      entry.mark,
      entry.notice,
    ]);
    submissions.push(entry);
  });
  const possibleRows = table
    .find("tbody tr")
    .filter((_, row) => $(row).children("td").length >= 3).length;
  return {
    submissions,
    recognized:
      table.length > 0 && (submissions.length > 0 || possibleRows === 0),
    hasMore:
      table
        .closest(".ilTableOuter")
        .find(".ilTableNav, .il-viewcontrol-pagination").length > 0 ||
      $('[name*="exc_mem_trows"]').length > 0 ||
      possibleRows > submissions.length,
    form: allowed
      ? {
          action: action!,
          fields,
          command: command.length
            ? (["cmd[saveStatusAll]", command.attr("value") || "1"] as [
                string,
                string,
              ])
            : undefined,
        }
      : null,
  };
}
export function parseUnitForm(
  html: string,
  source: string,
  exerciseId: string,
  creating = false,
  expectedUnitId?: string,
) {
  const $ = load(html);
  const form = $('input[name="title"]')
    .closest("form")
    .filter(
      (_, node) => $(node).find('textarea[name="instruction"]').length > 0,
    )
    .first();
  const action = upstreamLink(form.attr("action") || "", source);
  const fields = form.length ? formFields($, form) : [];
  const commandName = creating ? "saveAssignment" : "updateAssignment";
  const submit = form.find(`[name="cmd[${commandName}]"]`).first();
  if (
    !action ||
    !exerciseCommand(
      action,
      ["ilexassignmenteditorgui"],
      ["", "editassignment", "addassignment", commandName.toLowerCase()],
      exerciseId,
      creating ? undefined : expectedUnitId,
    ) ||
    !formScopeMatches(action, fields) ||
    submit.is(":disabled") ||
    !submit.length
  )
    return null;
  const values = new URLSearchParams(fields);
  const deadlineMode = values.get("deadline_mode") || "unsupported";
  const instruction = String(form.find('[name="instruction"]').val() || "");
  const settings: UnitSettings = {
    title: values.get("title") || "",
    instruction,
    instructionText: load(
      instruction.replace(/<\/(?:p|div|li)>|<br\s*\/?>/gi, "\n"),
    )
      .text()
      .trim(),
    start: values.get("start_time") || "",
    deadlineMode,
    deadline: values.get("deadline") || "",
    lateDeadline: values.get("deadline2") || "",
    mandatory: values.has("mandatory"),
    version: "",
    canEdit: ["-1", "0"].includes(deadlineMode),
  };
  const disabledSchedule =
    form.find('[name="deadline_mode"]:disabled, [name="deadline"]:disabled')
      .length > 0;
  const protectedSettings =
    !form.find('input[name="mandatory"]').length ||
    form.find(
      '[name="mandatory"]:disabled, [name="title"]:disabled, [name="instruction"]:disabled',
    ).length > 0;
  if (
    disabledSchedule ||
    protectedSettings ||
    !["-1", "0"].includes(deadlineMode)
  ) {
    settings.canEdit = false;
    settings.limitation =
      "Relative or individual deadlines and locked or protected settings need the original ILIAS editor. Existing settings are kept without simplifying them.";
  }
  settings.version = exerciseVersion(settings);
  return {
    settings,
    form: {
      action,
      fields,
      command: [submit.attr("name")!, submit.attr("value") || "1"] as [
        string,
        string,
      ],
    },
  };
}
export function parseCreateLink(
  html: string,
  source: string,
  exerciseId: string,
) {
  const $ = load(html);
  const form = $('select[name="type"] option[value="1"]').closest("form");
  const action = upstreamLink(form.attr("action") || "", source);
  if (
    !action ||
    !exerciseCommand(
      action,
      ["ilexassignmenteditorgui"],
      ["addassignment", "listassignments", ""],
      exerciseId,
    )
  )
    return undefined;
  const url = new URL(action);
  url.searchParams.set("cmd", "addAssignment");
  url.searchParams.set("type", "1");
  return url.href;
}
