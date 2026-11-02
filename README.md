# Achilias

A calmer frontend for ILIAS, built with **Bun, Next.js App Router, React, Tailwind CSS, and shadcn/ui (Radix Nova)**. Freiburg’s ILIAS is the default instance. This is an independent project, not a university service.

## Screenshots

The course screens below use the demo workspace. All course names, materials, and activities are examples.

**A calmer starting point**

![Achilias welcome screen with university sign-in and a link to explore the demo](docs/screenshots/welcome.png)

**Courses at a glance**

![Demo overview showing four course cards, search, and bookmarks](docs/screenshots/overview.png)

**Materials and activities in one place**

![Demo course showing folders, a downloadable file, and activities labeled as available in ILIAS](docs/screenshots/course.png)

**Discussions without the maze**

![Demo forum with searchable topics, unread counts, and pinned and closed discussions](docs/screenshots/forum.png)

**A conversation you can follow**

![Demo thread reader with formatted posts, reply context, unread navigation, and individual post links](docs/screenshots/thread.png)

<details>
<summary>See the mobile course view</summary>

<img src="docs/screenshots/mobile-course.png" alt="Mobile demo course view with responsive navigation and learning materials" width="390" />

</details>

<details>
<summary>See the mobile forum view</summary>

<img src="docs/screenshots/mobile-forum.png" alt="Mobile demo forum with unread filtering and readable discussion rows" width="390" />

</details>

## Run locally

```sh
bun install
bun run browser:install
bun run dev --hostname 127.0.0.1
```

Open **http://127.0.0.1:3000**. Choose **Connect your ILIAS**. A Chromium window opens on the computer running the server. On Freiburg’s real ILIAS page, select **Anmelden / Login**, complete **myLogin**, and wait until you reach ILIAS. Achilias connects automatically. No university password is entered into Achilias.

The browser bridge needs a desktop display. Sign-in has a five-minute timeout; cancel and retry from the connection dialog if needed. Chromium’s `headless` option is deliberately disabled for interactive sign-in.

Try **http://127.0.0.1:3000/?demo=1** without an account. Example courses, activities, and PDFs are explicitly marked as demo content. Demo bookmarks are isolated from connected accounts.

## What works

- Server-rendered dashboard content, course/group browsing, nested folders and categories.
- Authenticated, streamed file downloads. Errors stay in the interface rather than opening a JSON error page.
- Course introduction text and original course-tool links.
- Native forum browsing and reading: thread search, unread filtering, pin/closed indicators, formatted posts, reply context, post links, chronological views, and thread/post pagination. Search and sorting apply to the loaded page.
- Explicit **Mark thread read** updates ILIAS using its currently offered action. Demo read status stays in this browser tab. Discussion links disable Next.js prefetch so unread/read requests happen when opened.
- Course filtering, grid/list views, and a keyboard-operated **Ctrl/Cmd+K** search palette. Search covers the current page, saved items, and recently opened objects; it is not a repository-wide search.
- Browser-local saved items and recently opened content, isolated per connection. These do not modify ILIAS favorites. Reconnecting creates a fresh connection and a separate saved-item namespace.
- Responsive navigation, loading/error/empty states, and explicit session-expiry handling.
- Unsupported objects remain visible with their original type and an **In ILIAS** handoff. Restricted objects retain their restrictions. The feature-status page explains the current coverage.

## What still opens in ILIAS

Assignments/submissions, tests, wikis, learning modules, surveys, sessions, custom objects, calendar, mail, grades, and administration use the original interface. Forum reading is native; replies, new topics, subscriptions, moderation, attachments, and embedded media still open in ILIAS. Reply and new-topic actions are shown only when the loaded ILIAS page offers them. Interactive activity controls and rich course-page layouts are not reproduced. Plain text is extracted from course introductions; links, embedded media, and formatting require the original page. Course listings with pagination show a visible notice and a link to the original listing. Forum thread and post pages have native pagination when ILIAS exposes readable page controls, with an original-page fallback otherwise.

The dashboard adapter reads the courses and groups ILIAS exposes on your dashboard. If a course is missing, add it to the dashboard in ILIAS. This first version does not crawl every enrollment or invent deadlines/progress from incomplete data. New or custom themes may require selector changes. A course always retains an **Open in ILIAS** link.

The temporary sign-in browser and your normal browser have separate cookie stores. Opening original ILIAS links in your normal browser can require another university sign-in.

## Reading forums

Open a forum from a course or a saved item. Try [the example forum](http://127.0.0.1:3000/forums/402?demo=1) and [an example discussion](http://127.0.0.1:3000/forums/402/threads/902?demo=1) locally.

- Find a topic or author, filter unread discussions, or sort the current page. Pinned threads stay at the top when sorting locally.
- Follow the reply tree in **Conversation** view, or switch to **Oldest first** / **Newest first**. Parent links are shown only when the loaded tree establishes the relationship.
- Use **Jump to unread**, search the current posts, or copy a link to a specific post. Unread badges reflect the loaded ILIAS page, rather than inferred browser history.
- Choose **Mark thread read** when finished. This is an explicit upstream change, protected by a same-origin POST; simply opening a thread does not trigger that action from Achilias. ILIAS may still record normal visits/read events according to its settings.
- **Reply in ILIAS** opens the original editor, respecting the page’s available actions. Drafts are not presented as published posts. Closed threads retain ILIAS’s restrictions.

Post formatting includes paragraphs, lists, code, quotes, links, and tables. Bodies are sanitized before rendering; scripts, event handlers, remote images, and embeds are excluded. Posts with embedded content show a visible original-page handoff. Author aliases, moderation notices, and approval status are preserved from ILIAS. An unsupported layout or selected subtree produces a visible notice.

## Connection command and session import

You can also initiate sign-in from the terminal, while the app is running:

```sh
bun run connect
```

Complete university sign-in in the opened browser. Open the **single-use connection link** printed by the command within five minutes. The secret travels in a URL fragment, is removed from browser history immediately, and is claimed with a same-origin POST. Treat that link as private.

If the server has no display, import an existing **Playwright storageState JSON** or an exported cookie array:

```sh
bun run connect --cookies /absolute/path/to/cookies.json
```

Only cookies whose domain exactly matches the ILIAS instance are imported. The command checks the authenticated dashboard before creating a connection link. Do not commit cookie exports. Remove the export after importing it. Some ILIAS installations bind a session to its source IP; a remotely imported session may need the same network egress as its browser.

Run this command from the same checkout and with the same `ACHILIAS_DATA_DIR` as the app. `--instance https://your-instance.example/ilias/` and `--app http://127.0.0.1:3000` are supported. `bun run connect --help` describes the options.

## Configuration

Copy `.env.example` to `.env.local` when changing defaults. Bun loads `.env.local` for the connection command too.

| Variable                 | Purpose                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ILIAS_INSTANCES`        | Comma-separated additional HTTPS base URLs, including an installation subdirectory when applicable. Freiburg is always allowed. Only explicitly configured instances are fetched.     |
| `ACHILIAS_DATA_DIR`      | Directory for encrypted sessions and the encryption key. Default: `.local/` in the checkout.                                                                                          |
| `ACHILIAS_ORIGIN`        | Exact browser-visible app origin for mutation origin checks, especially behind a reverse proxy. Defaults to the local browser-visible host; configure this explicitly for remote use. |
| `ACHILIAS_SECURE_COOKIE` | Set `true` when serving over HTTPS. Leave unset for local HTTP.                                                                                                                       |
| `ACHILIAS_BROWSER_PATH`  | Optional path to a compatible local Chromium executable.                                                                                                                              |
| `ACHILIAS_BUILD_DIR`     | Optional separate build output directory, useful while `next dev` is running.                                                                                                         |

Restart the server after configuration changes. Additional instances appear through the URL field in the connection dialog; their specific themes/authentication have not been verified.

### Data and hosting

This version is intended for a **personal, local Node/Bun server**, not serverless hosting or a publicly shared sign-in service. The server must have a writable data directory. Run a single server process for login jobs and single-use connection claims.

ILIAS session jars stay server-side, encrypted using AES-256-GCM. The key and files have owner-only permissions; the directory is ignored by Git. The app browser gets an opaque HttpOnly, SameSite=Strict cookie. Achilias sessions expire after 12 hours, or earlier when ILIAS invalidates its session. Disconnect removes the active server-side session; it does not log out other university services. Expired session files are deleted when accessed. To remove all retained session data, stop the server and delete the `.local/` directory (or your configured data directory).

University identity-provider cookies are not copied into the ILIAS adapter. Server requests use an explicit instance boundary, validate each redirect, and never forward ILIAS cookies to an external identity provider. Personal pages and downloads use private/no-store responses. Downloaded content is served as an attachment with `nosniff` and sandbox headers. Saved titles and URLs remain in browser localStorage until cleared under **Features & connection**.

## Development and verification

```sh
bun run typecheck
bun run test
# Start the dev server first, then:
bun run test:e2e
# Production build:
bun run build
bun run start --hostname 127.0.0.1
```

`bun run test` checks ILIAS template parsing, restricted/unsupported content, cookie rotation, redirect credential boundaries, expired sessions, pairing validation, and encrypted session persistence. Forum fixtures follow the ILIAS 10 standard-item and post templates and check counts, hierarchy, sanitization, drafts, permissions, pagination, and action scoping. `bun run test:e2e` checks the demo flows in Chromium, including download, bookmarks across reloads, quick search, mobile navigation, single-use connection claims, session expiry, and reconnect/disconnect behavior. The last checks use a deliberately credential-free test session against the public Freiburg endpoint; they do not sign in to a real account. `bun run test:forums` runs the forum browser checks alone, including filters, reply context, post search, unread jumps, copied links, read-state persistence in the demo, closed topics, and mobile layouts. Set `ACHILIAS_TEST_URL` to test another local port.

While `next dev` is running, use `ACHILIAS_BUILD_DIR=.next-build bun run build` to preserve its `.next` directory. Start that build with the same variable if you want to run it.

### Refreshing screenshots

With the app running, run `bun run screenshots` to refresh the images in `docs/screenshots/`. The capture uses a fresh browser context and example content. Set `ACHILIAS_SCREENSHOT_URL` to capture from another local address, such as `http://127.0.0.1:3001` for a separate production preview.

### Integration status

The public Freiburg login/repository pages and upstream ILIAS templates were inspected during development. Automated integration fixtures are based on the upstream list-item, repository-card, standard-item, and ILIAS 10 forum structures. **Authenticated access, forum permissions, and the upstream mark-read action still need verification with a real Freiburg account.** Demo success does not establish account-specific compatibility.

Reference sources:

- [Freiburg ILIAS](https://ilias.uni-freiburg.de/)
- [Upstream ILIAS source](https://github.com/ILIAS-eLearning/ILIAS), especially `components/ILIAS/Container/templates/default/tpl.container_list_item.html`, `components/ILIAS/UI/src/templates/default/Card/tpl.card.html`, and `components/ILIAS/File/classes/class.ilObjFileAccess.php`.
- [shadcn/ui components](https://ui.shadcn.com/docs/components)

### Code map

`src/lib/ilias/parser.ts` owns ILIAS DOM adaptation. `forum-parser.ts` adapts the ILIAS forum pages and sanitizes posts, `forum.ts` resolves authenticated forum navigation, and `src/components/forums` renders the discussion reader. `client.ts` owns authenticated requests and redirects. `session.ts`, `login.ts`, and `pairing.ts` own session storage and browser sign-in. `src/app` contains server-rendered routes and API handlers. `src/components/workspace` composes the application interface from CLI-installed shadcn primitives in `src/components/ui`. Upstream ILIAS code is reference material, not vendored into the app.
