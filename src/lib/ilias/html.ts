import sanitizeHtml from "sanitize-html";
export function sanitizeIliasHtml(html: string, sourceUrl: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "a",
      "h2",
      "h3",
      "h4",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "sub",
      "sup",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      ol: ["start"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => {
        let href: string | undefined;
        try {
          const u = new URL(attrs.href || "", sourceUrl);
          if (
            ["https:", "http:", "mailto:"].includes(u.protocol) &&
            !u.username &&
            !u.password
          )
            href = u.href;
        } catch {
          /* Drop malformed links. */
        }
        return {
          tagName: "a",
          attribs: href
            ? {
                href,
                target: "_blank",
                rel: "noopener noreferrer",
                ...(attrs.title ? { title: attrs.title } : {}),
              }
            : {},
        };
      },
    },
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "iframe",
      "object",
      "embed",
      "svg",
      "math",
    ],
  });
}
