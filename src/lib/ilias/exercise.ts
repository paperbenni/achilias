import { assessmentProblem, unitProblem } from "./exercise-validation";
import { load } from "cheerio";
import { sanitizeIliasHtml } from "./html";
import { fetchAuthenticatedHtml, fetchUpstream, IliasError } from "./client";
import { objectUrl, upstreamUrl } from "./config";
import { validObjectId } from "./identifiers";
import { emptyPage, getWorkspaceContext } from "./workspace-context";
import type { Session } from "./session";
import type {
  AssessmentInput,
  ExerciseState,
  UnitInput,
} from "./exercise-types";
import {
  exerciseCommand,
  exerciseControls,
  exerciseLink,
  exerciseVersion,
  formFields,
  parseCreateLink,
  parseExerciseUnits,
  parseGrading,
  parseUnitForm,
  type ParsedForm,
} from "./exercise-parser";
import { demoExercise } from "./exercise-demo";
function validIds(...ids: string[]) {
  if (!ids.every(validObjectId))
    throw new IliasError("Invalid exercise address.", 400);
}
function scopedUnitUrl(
  instance: string,
  source: string,
  exerciseId: string,
  unitId: string,
) {
  const url = upstreamUrl(instance, source);
  if (
    !exerciseCommand(
      url.href,
      ["ilexercisemanagementgui"],
      ["members"],
      exerciseId,
    )
  )
    throw new IliasError("The exercise did not offer a submissions page.", 403);
  for (const key of [
    "member_id",
    "part_id",
    "action",
    "file",
    "delivered",
    "cmdMode",
  ])
    url.searchParams.delete(key);
  url.searchParams.set("ass_id", unitId);
  return url.href;
}
export async function fetchExercise(
  session: Session,
  exerciseId: string,
  unitId?: string,
  creating = false,
  details = true,
) {
  validIds(exerciseId, ...(unitId ? [unitId] : []));
  const root = await fetchAuthenticatedHtml(
    session,
    objectUrl(session.instance, "exc", exerciseId),
  );
  const controls = exerciseControls(root.html, root.url, exerciseId);
  const catalog =
    (details || creating) && controls.editorUrl
      ? await fetchAuthenticatedHtml(session, controls.editorUrl)
      : root;
  const rootUnits = parseExerciseUnits(root.html, root.url, exerciseId);
  const units = new Map(
    [
      ...rootUnits,
      ...parseExerciseUnits(catalog.html, catalog.url, exerciseId),
    ].map((unit) => [unit.id, unit]),
  );
  const createUrl = parseCreateLink(catalog.html, catalog.url, exerciseId);
  let members = controls.membersUrl
    ? await fetchAuthenticatedHtml(session, controls.membersUrl)
    : null;
  if (members)
    for (const unit of parseExerciseUnits(
      members.html,
      members.url,
      exerciseId,
    ))
      if (!units.has(unit.id)) units.set(unit.id, unit);
  if (unitId && !units.has(unitId))
    throw new IliasError(
      "ILIAS has not offered this exercise unit to your account.",
      403,
    );
  if (members && unitId)
    members = await fetchAuthenticatedHtml(
      session,
      scopedUnitUrl(session.instance, members.url, exerciseId, unitId),
    );
  const selectedId =
    unitId ||
    (members && new URL(members.url).searchParams.get("ass_id")) ||
    [...units.keys()][0];
  const grading =
    members && selectedId
      ? parseGrading(members.html, members.url, exerciseId, selectedId)
      : null;
  const unit = unitId ? units.get(unitId) : undefined;
  const editorUrl = creating ? createUrl : details ? unit?.editUrl : undefined;
  const editor = editorUrl
    ? await fetchAuthenticatedHtml(session, editorUrl)
    : null;
  const settings = editor
    ? parseUnitForm(editor.html, editor.url, exerciseId, creating)
    : null;
  if (
    editor &&
    unitId &&
    new URL(editor.url).searchParams.get("ass_id") !== unitId
  )
    throw new IliasError(
      "ILIAS returned a different exercise unit. Open the original editor.",
      409,
    );
  if (unit && settings && editor)
    unit.instructions = sanitizeIliasHtml(
      settings.settings.instruction,
      editor.url,
    );
  return {
    root,
    catalog,
    units: [...units.values()],
    members,
    grading,
    editor,
    settings,
    createUrl,
    controls,
  };
}
export async function getExerciseState(
  exerciseId: string,
  unitId?: string,
  demo = false,
  creating = false,
): Promise<ExerciseState> {
  const { workspace, session } = await getWorkspaceContext(demo);
  workspace.page = {
    ...emptyPage(
      objectUrl(workspace.instance, "exc", exerciseId),
      "Übungen / Exercises",
    ),
    authenticated: workspace.mode === "live",
  };
  const state: ExerciseState = {
    workspace,
    exerciseId,
    unitId,
    creating,
    units: [],
    submissions: [],
    submissionsKnown: false,
    settings: null,
    canCreate: false,
    tutor: false,
    recognized: false,
    hasMore: false,
    sourceUrl: workspace.page.sourceUrl,
  };
  if (demo) return demoExercise(state);
  if (session?.status !== "connected") return state;
  try {
    const result = await fetchExercise(session, exerciseId, unitId, creating);
    workspace.page = { ...result.root.page, items: [] };
    workspace.fetchedAt = new Date().toISOString();
    workspace.userName = result.root.page.userName || workspace.userName;
    const sourceUrl =
      (creating
        ? result.editor?.url
        : unitId
          ? result.members?.url || result.editor?.url
          : undefined) || result.root.url;
    workspace.page.sourceUrl = sourceUrl;
    return {
      ...state,
      units: result.units,
      submissions: unitId ? result.grading?.submissions || [] : [],
      submissionsKnown: result.grading?.recognized || false,
      settings: result.settings?.settings || null,
      canCreate: !!result.createUrl,
      tutor: !!result.controls.membersUrl,
      recognized:
        result.units.length > 0 ||
        !!result.controls.editorUrl ||
        !!result.grading?.recognized,
      hasMore: result.grading?.hasMore || false,
      sourceUrl,
    };
  } catch (error) {
    workspace.error =
      error instanceof Error ? error.message : "Could not load this exercise.";
    return state;
  }
}
export function validateAssessment(input: AssessmentInput) {
  const problem = assessmentProblem(input);
  if (problem) throw new IliasError(problem, 400);
}
function submitFields(form: ParsedForm) {
  const fields = new URLSearchParams(form.fields);
  if (form.command) fields.set(...form.command);
  return fields;
}
async function postForm(
  session: Session,
  form: ParsedForm,
  fields: URLSearchParams,
) {
  const { response, url } = await fetchUpstream(session, form.action, {
    form: fields,
  });
  const html = await response.text();
  const $ = load(html);
  if (
    $('.ilFormAlert, .alert-danger, .ilFailureMessage, [aria-invalid="true"]')
      .length
  )
    throw new IliasError(
      "ILIAS did not accept these changes. Check the original form for validation details.",
      422,
    );
  return { html, url };
}
export async function saveAssessment(
  session: Session,
  exerciseId: string,
  unitId: string,
  memberId: string,
  input: AssessmentInput,
) {
  validIds(exerciseId, unitId, memberId);
  validateAssessment(input);
  const current = await fetchExercise(
    session,
    exerciseId,
    unitId,
    false,
    false,
  );
  const row = current.grading?.submissions.find((row) => row.id === memberId);
  const form = current.grading?.form;
  if (!row?.canAssess || !form)
    throw new IliasError(
      "ILIAS has not granted assessment access to this participant or team.",
      403,
    );
  if (row.version !== input.version)
    throw new IliasError(
      "This assessment changed since you opened it. Refresh before editing it again.",
      409,
    );
  if (
    (input.mark !== undefined && row.mark === null) ||
    (input.notice !== undefined && row.notice === null)
  )
    throw new IliasError(
      "ILIAS has not exposed those assessment fields. Use the original view.",
      409,
    );
  const fields = submitFields(form);
  // ILIAS loops over listed_part_ids, not selected checkboxes. Send exactly one row.
  for (const name of [...new Set([...fields.keys()])])
    if (
      /^(?:listed_part_ids|sel_part_ids|listed_idl_ids|status|mark|notice)(?:\[|$)/.test(
        name,
      )
    )
      fields.delete(name);
  fields.set("listed_part_ids[]", memberId);
  fields.set(`status[${memberId}]`, input.status);
  if (input.mark !== undefined) fields.set(`mark[${memberId}]`, input.mark);
  if (input.notice !== undefined)
    fields.set(`notice[${memberId}]`, input.notice);
  await postForm(session, form, fields);
  const updated = await fetchExercise(
    session,
    exerciseId,
    unitId,
    false,
    false,
  );
  const saved = updated.grading?.submissions.find((row) => row.id === memberId);
  if (
    !saved ||
    saved.status !== input.status ||
    (input.mark !== undefined && saved.mark !== input.mark.trim()) ||
    (input.notice !== undefined && saved.notice !== input.notice.trim())
  )
    throw new IliasError(
      "The request was submitted, but its saved values could not be confirmed. Refresh or check ILIAS before retrying.",
      409,
    );
  return saved;
}
export function validateUnit(input: UnitInput) {
  const problem = unitProblem(input);
  if (problem) throw new IliasError(problem, 400);
}
const plainHtml = (text: string) =>
  text
    .split(/\r?\n/)
    .map(
      (line) =>
        `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`,
    )
    .join("");
export async function saveExerciseUnit(
  session: Session,
  exerciseId: string,
  unitId: string | undefined,
  input: UnitInput,
) {
  validateUnit(input);
  const current = await fetchExercise(session, exerciseId, unitId, !unitId);
  const editor = current.settings;
  if (!editor?.settings.canEdit)
    throw new IliasError(
      editor?.settings.limitation ||
        "ILIAS has not offered a supported exercise editor.",
      403,
    );
  if (unitId && editor.settings.version !== input.version)
    throw new IliasError(
      "This exercise unit changed since you opened it. Refresh before saving.",
      409,
    );
  const fields = submitFields(editor.form);
  fields.set("title", input.title.trim());
  if (input.instruction !== undefined)
    fields.set("instruction", plainHtml(input.instruction));
  fields.set("start_time", input.start);
  fields.set("deadline_mode", input.deadlineMode);
  // Preserve inactive date values, as the original form does.
  if (input.deadlineMode === "0") {
    fields.set("deadline", input.deadline);
    fields.set("deadline2", input.lateDeadline);
  }
  if (input.mandatory) fields.set("mandatory", "1");
  else fields.delete("mandatory");
  const posted = await postForm(session, editor.form, fields);
  const savedId =
    unitId || new URL(posted.url).searchParams.get("ass_id") || "";
  if (
    !validObjectId(savedId) ||
    (!unitId && current.units.some((unit) => unit.id === savedId))
  )
    throw new IliasError(
      "The request was submitted. Open ILIAS to check whether the new unit was created before retrying.",
      409,
    );
  const updated = await fetchExercise(session, exerciseId, savedId);
  const saved = updated.settings?.settings;
  if (
    !saved ||
    saved.title !== input.title.trim() ||
    saved.start !== input.start ||
    saved.deadlineMode !== input.deadlineMode ||
    saved.mandatory !== input.mandatory ||
    (input.instruction !== undefined &&
      saved.instructionText.trim() !== input.instruction.trim()) ||
    (input.deadlineMode === "0" &&
      (saved.deadline !== input.deadline ||
        saved.lateDeadline !== input.lateDeadline))
  )
    throw new IliasError(
      "The request was submitted, but the saved schedule could not be confirmed. Check ILIAS before retrying.",
      409,
    );
  return { unitId: savedId, settings: saved };
}
function feedbackHtml(text: string, contentType: string) {
  if (!contentType.includes("json")) return text;
  const value = JSON.parse(text);
  if (typeof value === "string") return value;
  if (typeof value.html === "string") return value.html;
  throw new IliasError(
    "This ILIAS feedback dialog needs the original interface.",
    409,
  );
}
async function feedbackForm(
  session: Session,
  exerciseId: string,
  unitId: string,
  memberId: string,
) {
  const current = await fetchExercise(
    session,
    exerciseId,
    unitId,
    false,
    false,
  );
  const row = current.grading?.submissions.find((row) => row.id === memberId);
  if (!row?.feedbackUrl)
    throw new IliasError(
      "ILIAS has not offered learner feedback for this participant or team.",
      403,
    );
  const { response, url } = await fetchUpstream(session, row.feedbackUrl);
  const $ = load(
    feedbackHtml(
      await response.text(),
      response.headers.get("content-type") || "",
    ),
  );
  const form = $("form")
    .filter((_, form) => $(form).find("textarea[name]").length === 1)
    .first();
  const action = exerciseLink(form.attr("action") || "", url);
  if (
    !action ||
    !exerciseCommand(
      action,
      ["ilexercisesubmissionfeedbackgui"],
      ["validateandsubmitfeedbackform"],
      exerciseId,
      unitId,
      memberId,
    )
  )
    throw new IliasError(
      "This ILIAS feedback form needs the original editor.",
      409,
    );
  const textarea = form.find("textarea[name]");
  const value = String(textarea.val() || "");
  return {
    value,
    version: exerciseVersion([memberId, value]),
    name: textarea.attr("name")!,
    form: { action, fields: formFields($, form) },
  };
}
export async function getLearnerFeedback(
  session: Session,
  exerciseId: string,
  unitId: string,
  memberId: string,
) {
  validIds(exerciseId, unitId, memberId);
  const { value, version } = await feedbackForm(
    session,
    exerciseId,
    unitId,
    memberId,
  );
  return { value, version };
}
export async function saveLearnerFeedback(
  session: Session,
  exerciseId: string,
  unitId: string,
  memberId: string,
  value: string,
  version: string,
) {
  validIds(exerciseId, unitId, memberId);
  if (
    typeof value !== "string" ||
    value.length > 4000 ||
    typeof version !== "string"
  )
    throw new IliasError(
      "Learner feedback is limited to 4,000 characters.",
      400,
    );
  const current = await feedbackForm(session, exerciseId, unitId, memberId);
  if (current.version !== version)
    throw new IliasError(
      "The learner feedback changed. Reopen the editor before saving.",
      409,
    );
  const fields = submitFields(current.form);
  fields.set(current.name, value);
  await postForm(session, current.form, fields);
  const saved = await feedbackForm(session, exerciseId, unitId, memberId);
  if (saved.value.replace(/\r\n/g, "\n") !== value.replace(/\r\n/g, "\n"))
    throw new IliasError(
      "Feedback was submitted but could not be confirmed. Check ILIAS before sending again.",
      409,
    );
  return { value: saved.value, version: saved.version };
}
