import type { CheerioAPI } from "cheerio";

/** Static successful controls for ILIAS forms (no file uploads). An optional
 * submitter can be included for flows that require the clicked button.
 * Kept deliberately small: Cheerio's serializeArray uses option labels for
 * multi-selects and does not inherit disabled fieldsets; jsdom FormData includes
 * disabled options. Chromium parity tests cover these compatibility boundaries. */
export function formFields(
  $: CheerioAPI,
  form: ReturnType<CheerioAPI>,
  options: { submitter?: boolean } = {},
): [string, string][] {
  if (form.length !== 1 || !form.is("form")) return [];
  const fields: [string, string][] = [];
  let submitter: [string, string] | undefined;
  const id = form.attr("id");
  const ownsId =
    id &&
    $("form[id]")
      .toArray()
      .find((node) => $(node).attr("id") === id) === form[0];
  $("input[name], select[name], textarea[name], button[name]").each(
    (_, node) => {
      const control = $(node);
      const owner = control.attr("form");
      if (
        owner !== undefined
          ? !ownsId || owner !== id
          : control.closest("form")[0] !== form[0]
      )
        return;
      if (control.is("[disabled]")) return;
      // A disabled fieldset exempts descendants of its first legend child.
      if (
        control
          .parents("fieldset[disabled]")
          .toArray()
          .some((fieldset) => {
            const legend = $(fieldset).children("legend").first()[0];
            return !legend || !$.contains(legend, node);
          })
      )
        return;
      const name = control.attr("name")!;
      if (!name) return;
      const type = (control.attr("type") || "").toLowerCase();
      const isSubmit =
        type === "submit" || (control.is("button") && !control.attr("type"));
      if (
        control.is("button") ||
        ["submit", "button", "image", "file", "reset"].includes(type)
      ) {
        if (options.submitter && !submitter && isSubmit)
          submitter = [
            name,
            control.is("button")
              ? (control.attr("value") ??
                control.text().replace(/\s+/g, " ").trim())
              : (control.attr("value") ?? ""),
          ];
        return;
      }
      if (["checkbox", "radio"].includes(type) && !control.is(":checked"))
        return;
      if (control.is("select")) {
        const enabled = (option: ReturnType<CheerioAPI>) =>
          !option.is("[disabled]") &&
          !option.closest("optgroup[disabled]").length;
        let options = control.find("option[selected]");
        if (!control.is("[multiple]")) {
          options = options.last();
          if (!options.length && Number(control.attr("size") || 1) <= 1)
            options = control
              .find("option")
              .filter((_, node) => enabled($(node)))
              .first();
        }
        options.each((_, node) => {
          const option = $(node);
          if (enabled(option))
            fields.push([
              name,
              node.attribs.value ?? option.text().replace(/\s+/g, " ").trim(),
            ]);
        });
      } else {
        const value = ["checkbox", "radio"].includes(type)
          ? (control.attr("value") ?? "on")
          : (control.val() ?? "");
        fields.push([name, String(value)]);
      }
    },
  );
  if (submitter) fields.push(submitter);
  return fields;
}
