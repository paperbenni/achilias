import { parse } from "acorn";
import { simple } from "acorn-walk";

/** Read literal config properties without evaluating upstream JavaScript.
 * Comments, quoted code examples and dynamic expressions are not configuration. */
export function scriptStringProperties(script: string, property: string) {
  const values: string[] = [];
  try {
    const ast = parse(script, { ecmaVersion: "latest", sourceType: "script" });
    simple(ast, {
      Property(node) {
        const key =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal"
              ? node.key.value
              : undefined;
        if (
          !node.computed &&
          node.kind === "init" &&
          key === property &&
          node.value.type === "Literal" &&
          typeof node.value.value === "string"
        )
          values.push(node.value.value);
      },
    });
  } catch {
    // Unsupported/incomplete scripts need the original interface; never eval.
  }
  return values;
}
