# Achilias

A calmer frontend for ILIAS, built with **Bun, Next.js App Router, React, Tailwind CSS, and shadcn/ui (Radix Nova)**. Freiburg’s ILIAS is the default instance. This is an independent project, not a university service.

## Before connecting a real account

Live changes are **disabled by default**. Browse locally first and compare the parsed data with the original. ILIAS can still record visits, downloads, or read status while browsing. Follow the [real-instance testing guide](docs/live-testing.md) before enabling any grade, deadline, feedback, or explicit mark-as-read changes. Authenticated Freiburg compatibility still needs a controlled real-account test.

## Multiple users and instances

One server process supports separate user sessions and user-entered public HTTPS ILIAS base URLs. Users can sign in with the university password form, the laptop helper, or an existing ILIAS cookie; see [Sign-in methods](#sign-in-methods). See the [multi-user deployment guide](docs/deployment.md) for HTTPS/proxy configuration, account isolation, supported instance policy, and the single-process limit.

## Screenshots

The course and forum screens below use the demo workspace. All course names, materials, discussions, and saved items are examples. The connection screenshot shows the default username/password form.

**A calmer starting point**

![Achilias welcome screen with university sign-in and a link to explore the demo](docs/screenshots/welcome.png)

**Courses at a glance**

![Demo overview showing four course cards, search, and bookmarks](docs/screenshots/overview.png)

<details>
<summary>Dark mode</summary>

![Dark demo overview with readable course cards and navigation](docs/screenshots/overview-dark.png)

Choose **Light**, **Dark**, or **System** from the account menu at the bottom of the sidebar. Before connecting, use **Appearance** in the same place. The preference stays on this browser and follows the operating system when set to System.

</details>

**Materials and activities in one place**

![Demo course showing folders, a downloadable file, and activities labeled as available in ILIAS](docs/screenshots/course.png)

**Discussions without the maze**

![Demo forum with searchable topics, unread counts, and pinned and closed discussions](docs/screenshots/forum.png)

<details>
<summary>See the unread-only forum view</summary>

![Demo forum filtered to its two unread discussions, with the HTML-based feature notice and original ILIAS button](docs/screenshots/forum-unread.png)

</details>

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

<details>
<summary>See the mobile thread reader</summary>

<img src="docs/screenshots/mobile-thread.png" alt="Mobile demo thread with unread navigation, formatted replies, reply context, and original-post links" width="390" />

</details>

<details>
<summary>See saved folders, files, and forums</summary>

![Saved demo items showing a folder, downloadable file, and forum together](docs/screenshots/saved.png)

</details>

<details>
<summary>See feature support and HTML-based integration labels</summary>

![Connection and feature settings distinguishing available features, HTML-based integrations, and activities that open in ILIAS](docs/screenshots/settings.png)

</details>

<details>
<summary>See the sign-in dialog</summary>

<img src="docs/screenshots/connection.png" alt="Connection dialog with the default university username/password form and a link to the original ILIAS page" width="512" />

</details>

<details>
<summary>See exercise units and tutor submission review</summary>

![Demo exercise units with deadlines and links to review submissions](docs/screenshots/exercises.png)

![Tutor review of demo submissions with assessment, missing/late filters, downloads, marks, and separate private and learner feedback](docs/screenshots/submissions.png)

</details>

<details>
<summary>See assessment and unit deadline editing</summary>

<img src="docs/screenshots/assessment.png" alt="Demo assessment editor separating pass/fail, marks, and private tutor notes, with an original ILIAS fallback" width="560" />

![Exercise unit editor showing instructions, opening time, fixed deadline, late-submission deadline, and completion requirement](docs/screenshots/unit-settings.png)

</details>

<details>
<summary>See team submission review on mobile</summary>

<img src="docs/screenshots/mobile-submissions.png" alt="Mobile tutor view showing team submissions, review filters, and scoped assessment actions" width="390" />

</details>

## Run locally

```sh
bun install
bun run dev --hostname 127.0.0.1
```

Open **http://127.0.0.1:3000**. Choose **Connect your ILIAS** and pick a method. Local use defaults to the password form. See [Sign-in methods](#sign-in-methods) for requirements and security notes.

Try **http://127.0.0.1:3000/?demo=1** without an account. Example courses, activities, and PDFs are explicitly marked as demo content. Demo bookmarks are isolated from connected accounts.

## Sign-in methods

The connection dialog offers three tabs:

| Method | Default | What it needs | Notes |
| --- | --- | --- | --- |
| **Password** | On by default; set `ACHILIAS_PASSWORD_LOGIN=false` to hide it | Your university username and password | Achilias submits the real myLogin form over HTTPS, uses the password once, and keeps only ILIAS cookies. The password is never stored. Only use this on a server you control; accounts with MFA must use the helper. |
| **Helper** | Always available; default when password sign-in is disabled | Bun, an Achilias checkout, and Chromium on your laptop | Opens the real university sign-in in a browser on your laptop and transfers only the resulting ILIAS cookies. The server needs no display or browser. |
| **Cookies** | Always available | An existing ILIAS session | Paste the `Cookie` header, just the session value, or a Playwright storageState/cookie JSON export. Achilias keeps only cookies for the exact ILIAS host and verifies the dashboard before connecting. |

Password sign-in accepts any public HTTPS ILIAS instance the user selects. Do **not** use it on a shared or public deployment: the server sees your university password, which may unlock more than ILIAS, and myLogin/SSO terms may prohibit credential proxying. Set `ACHILIAS_PASSWORD_LOGIN=false` to disable it.

Cookies are bearer credentials: remove any export file after use and disconnect when finished. A server that cannot reach the same ILIAS network as your browser may reject the session.

The helper’s temporary connection code lasts ten minutes. Cancel and retry from the dialog if needed. On Freiburg’s real ILIAS page, select **Anmelden / Login**, complete **myLogin**, and wait until you reach ILIAS. The helper connects automatically.

## What works

- Server-rendered dashboard content, course/group browsing, nested folders and categories.
- Authenticated, streamed file downloads. Errors stay in the interface rather than opening a JSON error page.
- Course introduction text and original course-tool links.
- Native exercise/tutor workspace: Übungseinheiten, submission review and downloads, assessment status and marks, private tutor notes, learner feedback, and unit creation/fixed-deadline editing.
- Native forum browsing and reading: topic cards with discussion-text previews, thread search, unread filtering, pin/closed indicators, formatted posts, reply context, post links, chronological views, and thread/post pagination. Search and sorting apply to the loaded page.
- Explicit **Mark thread read** updates ILIAS using its currently offered action. Demo read status stays in this browser tab. Fresh live discussion links disable background data prefetch so unread/read requests happen when opened. Demo links may be prefetched.
- Course filtering, grid/list views, a dedicated **My courses** overview, and a keyboard-operated **Ctrl/Cmd+K** search palette. Search automatically includes enrolled courses and groups, even when they were never visited or bookmarked, alongside the current page, bookmarks, and recent history. Title matches rank first; accents and punctuation are ignored. After a short typing pause, search widens automatically into the current course or folder and its descendants, then across the **ILIAS repository**. Results show their paths and group current-container and enrolled-course matches ahead of other matches. Coverage depends on ILIAS' search index and your access permissions. Run `bun run test:search` for browser regression checks.
- Browser-local saved items and recently opened content, isolated per connection. These do not modify ILIAS favorites. Reconnecting creates a fresh connection and a separate saved-item namespace.
- Responsive navigation, loading/error/empty states, and explicit session-expiry handling.
- Unsupported objects remain visible with their original type and an **In ILIAS** handoff. Restricted objects retain their restrictions. The feature-status page explains the current coverage.

## What still opens in ILIAS

Learner submission/upload, advanced exercise workflows, tests, wikis, learning modules, surveys, sessions, custom objects, calendar, mail, overall grades, and administration use the original interface. Forum reading is native; replies, new topics, subscriptions, moderation, attachments, and embedded media still open in ILIAS. Reply and new-topic actions are shown only when the loaded ILIAS page offers them. Interactive activity controls and rich course-page layouts are not reproduced. Plain text is extracted from course introductions; links, embedded media, and formatting require the original page. Course listings with pagination show a visible notice and a link to the original listing. Forum thread and post pages have native pagination when ILIAS exposes readable page controls, with an original-page fallback otherwise.

The dashboard adapter reads the courses and groups ILIAS exposes on your dashboard. If a course is missing, add it to the dashboard in ILIAS. This first version does not crawl every enrollment or invent deadlines/progress from incomplete data. New or custom themes may require selector changes. A course always retains an **Open in ILIAS** link.

The helper’s sign-in browser and your normal browser have separate cookie stores. Opening original ILIAS links in your normal browser can require another university sign-in.

## Reading forums

Open a forum from a course or a saved item. Try [the example forum](http://127.0.0.1:3000/forums/402?demo=1) and [an example discussion](http://127.0.0.1:3000/forums/402/threads/902?demo=1) locally.

- Find a topic or author, filter unread discussions, or sort the current page. Pinned threads stay at the top when sorting locally.
- Each topic card shows a preview of the discussion text. Long previews are clamped; open the card to read the complete discussion. Live previews load on demand as cards become visible, without ILIAS’s mark-read action.
- Follow the reply tree in **Conversation** view, or switch to **Oldest first** / **Newest first**. Parent links are shown only when the loaded tree establishes the relationship.
- Use **Jump to unread**, search the current posts, or copy a link to a specific post. Unread badges reflect the loaded ILIAS page, rather than inferred browser history.
- Choose **Mark thread read** when finished. This is an explicit upstream change, protected by a same-origin POST; simply opening a thread does not trigger that action from Achilias. ILIAS may still record normal visits/read events according to its settings.
- **Reply in ILIAS** opens the original editor, respecting the page’s available actions. Drafts are not presented as published posts. Closed threads retain ILIAS’s restrictions.

Post formatting includes paragraphs, lists, code, quotes, links, and tables. Bodies are sanitized before rendering; scripts, event handlers, remote images, and embeds are excluded. Posts with embedded content show a visible original-page handoff. Author aliases, moderation notices, and approval status are preserved from ILIAS. An unsupported layout or selected subtree produces a visible notice.

## Tutoring: Übungseinheiten and Abgaben

Open an **Exercise / Übung** from your course or saved items. The [example tutor workspace](http://127.0.0.1:3000/exercises/401?demo=1) and [example submissions](http://127.0.0.1:3000/exercises/401/units/501?demo=1) work without an account.

- Browse exercise units, instructions, opening times, deadlines, and completion requirements.
- Review the participant/team rows exposed to your account. Filter for unassessed, missing, or late submissions, or search the loaded names/logins/marks. Counts cover the loaded rows and any ILIAS-side filters; absent columns remain unknown. Further pagination and upstream filters remain available through the original-page button.
- Download a participant or team’s submission through the authenticated proxy. The server rediscovers the authorized download link instead of accepting arbitrary upstream URLs.
- Save **Not assessed / Passed / Failed**, a mark or points string, and a **private tutor note**. The adapter sends exactly one `listed_part_ids` row so an individual edit cannot accidentally save the whole table. ILIAS applies a team assessment to its members; the editor calls this out explicitly.
- Write **learner-visible feedback** separately. ILIAS may notify the learner or team on save. The adapter supports recognized feedback forms, including standard async modal URLs and opaque field names; unsupported forms keep their original-page fallback.
- Create file-submission units and edit supported units’ title, instructions, start, fixed deadline, late-submission deadline, and required/optional setting. Times use the ILIAS profile’s timezone. Editing instructions uses plain text; leaving them unchanged preserves existing rich formatting.

Tutor actions are bound to the displayed account connection, so changing accounts invalidates an open tutor form. Every live write reloads the offered form, retains fresh tokens and unrelated settings, checks the displayed version for stale edits where applicable, and verifies the saved values. A failed or ambiguous verification asks you to check ILIAS before retrying. Live links disable speculative prefetch; mutations invalidate recent page reuse. Server Actions authenticate the session, and ILIAS retains its permission checks.

Relative/individual/locked deadlines, protected requirements, learner uploads, instruction/feedback files, peer review, team membership, unit deletion, and bulk downloads stay in the original interface with visible handoffs. These integrations are **HTML-based**, not an official ILIAS API. **Live tutor permissions and writes still need verification against an authenticated Freiburg account.** Stateful fixture tests and the demo do not establish that compatibility. Demo changes stay in the current browser tab and never grade or notify real learners.

## Navigation speed and freshness

Achilias uses Next.js client-side navigation and production prefetching. Settings and Bookmarks can be prepared in the background without calling ILIAS. Recently visited pages can be reused for **30 seconds** in the current browser, making return visits quick; filters and post search stay local.

Fresh live course, folder, and forum pages load when opened. They are not fetched in the background because ILIAS can record visits/read events or change forum view preferences during a read. Forum topic previews are the exception: they load only while the overview is open, for cards near the viewport, and are cached briefly so returning to the overview stays fast. Demo content can be prefetched freely. Use **Refresh** to fetch current content and invalidate recent pages. The forum UI’s mark-read action invalidates the cache too. Sign-in and disconnect clear the client router state so another account does not inherit it.

A production demo run with 120 ms of simulated browser network latency improved Settings navigation from **344 ms to 43 ms**, and repeat course/thread navigation from approximately **147 ms to 47 ms**. This compares Achilias before and after optimization; **it is not a benchmark against authenticated Freiburg ILIAS**. First-time live content still depends on ILIAS responding.

See the [measurements, limitations, and reproduction steps](docs/performance/README.md). Test prefetching with a production build; development mode does not represent its final performance.

## Running on a headless server

The server can run without a display, Xvfb, VNC, or Chromium. You complete Freiburg’s interactive myLogin step on your laptop, then the helper transfers only the resulting ILIAS cookies to the server. University passwords and identity-provider cookies are not transferred. The server validates the dashboard from its own network before connecting your account.

On the server, install dependencies, build, and start the app. The server never needs a display or Chromium. Set these in its `.env.local` when serving over HTTPS:

```dotenv
ACHILIAS_ORIGIN=https://your-achilias.example
ACHILIAS_SECURE_COOKIE=true
```

Bind the server to loopback behind your reverse proxy and keep the private data directory persistent.

1. Open Achilias in your normal browser, choose **Connect your ILIAS**, open **Helper**, and select **Get a connection code**.
2. On your laptop, use an Achilias checkout, run `bun install` and `bun run browser:install` once, then run the helper command shown in the dialog:

   ```sh
   bun run connect --server https://your-achilias.example
   ```

3. Paste the code into the helper’s terminal prompt. It is read from stdin, rather than a shell argument or URL. Complete myLogin in the local browser window. Achilias connects automatically when the server verifies the transferred session.

No shared filesystem or cookie-export file is needed. The code is bound to the browser connection that requested it, expires after ten minutes, and cannot be reused after success. Cancelling the connection or generating a new code invalidates the old code. The helper sends codes in an Authorization header, refuses redirects, and accepts only HTTPS or loopback HTTP. You need to repeat sign-in after the ILIAS/Achilias session expires; the helper flow is not unattended password-based login. (The local password form is a separate method; see [Sign-in methods](#sign-in-methods).)

### Using SSH, including IP-bound sessions

You can keep the app private and avoid setting up public HTTPS by forwarding it over SSH. From your laptop:

```sh
ssh -N -L 3000:127.0.0.1:3000 -D 1080 user@your-server
```

Open **http://127.0.0.1:3000** in your normal browser. Leave `ACHILIAS_SECURE_COOKIE` unset for loopback HTTP and set `ACHILIAS_ORIGIN=http://127.0.0.1:3000` if you configure an origin explicitly. The external connection is protected by SSH.

If ILIAS rejects a transferred session because login and server requests originate from different IPs, use the same SSH tunnel as a SOCKS proxy for the helper’s university browser:

```sh
bun run connect --server http://127.0.0.1:3000 --proxy socks5://127.0.0.1:1080
```

The login browser’s university traffic then exits through your server, while its window remains on your laptop. This accommodates address-bound sessions without a server display. It still depends on the installation’s authentication policy and needs verification with an actual Freiburg account. [Shibboleth supports session address checks](https://shibboleth.atlassian.net/wiki/spaces/SHIB2/pages/2577072330); the exact Freiburg configuration is not known.

If you already have a cookie export, `--server` also accepts `--cookies /absolute/path/to/cookies.json`. The server still verifies it. Using `--proxy` cannot change the source IP of a session that was already created elsewhere; sign in again through the helper if necessary.

## Connection command and session import

You can also initiate sign-in from the terminal, while the app is running:

```sh
bun run connect
```

Complete university sign-in in the opened browser. Open the **single-use connection link** printed by the command within five minutes. The secret travels in a URL fragment, is removed from browser history immediately, and is claimed with a same-origin POST. Treat that link as private.

As an alternative, the same-machine command can import an existing **Playwright storageState JSON** or an exported cookie array:

```sh
bun run connect --cookies /absolute/path/to/cookies.json
```

Only cookies whose domain exactly matches the ILIAS instance are imported. The command checks the authenticated dashboard before creating a connection link. Do not commit cookie exports. Remove the export after importing it. Some ILIAS installations bind a session to its source IP; a remotely imported session may need the same network egress as its browser.

Without `--server`, run this command from the same checkout and with the same `ACHILIAS_DATA_DIR` as the app. With `--server`, run it on your laptop; no shared data directory is used. `--instance https://your-instance.example/ilias/` and `--app http://127.0.0.1:3000` are supported. `bun run connect --help` describes the options.

## Configuration

Copy `.env.example` to `.env.local` when changing defaults. Bun loads `.env.local` for the connection command too.

| Variable                      | Purpose                                                                                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACHILIAS_WRITE_TARGETS`      | Comma-separated canonical exercise/forum URLs allowed to make live changes. Unset means disabled. See [live testing](docs/live-testing.md).                                                                                  |
| `ACHILIAS_TRUST_PROXY`        | Set `true` only behind a proxy that overwrites `X-Forwarded-For` and prevents direct app access. Enables per-client sign-in limits.                                                                                          |
| `ACHILIAS_DATA_DIR`           | Directory for encrypted sessions and the encryption key. Default: `.local/` in the checkout.                                                                                                                                 |
| `ACHILIAS_ORIGIN`             | Exact browser-visible **Achilias app** origin for mutation origin checks, especially behind a reverse proxy. This is not the ILIAS instance; users choose that in the dialog. Defaults to the local browser-visible host.      |
| `ACHILIAS_SECURE_COOKIE`      | Automatically enabled for an HTTPS `ACHILIAS_ORIGIN`; set `true` to force it. Leave unset for local HTTP.                                                                                                                    |
| `ACHILIAS_PASSWORD_LOGIN`     | Set `false` to hide the university password form. On by default; only use on a single-user server you control. See [Sign-in methods](#sign-in-methods).                                                                       |
| `ACHILIAS_BUILD_DIR`          | Optional separate build output directory, useful while `next dev` is running.                                                                                                                                                |

Restart the server after configuration changes. Users choose the ILIAS instance in the connection dialog; its specific theme/authentication may differ.

### Data and hosting

This version supports **multiple users on one persistent Node server process**, locally or behind an HTTPS reverse proxy. It needs a writable private data directory. Serverless hosting, multiple workers and multiple replicas are not supported. Follow the [deployment guide](docs/deployment.md) for public hosting, proxy trust and sign-in limits.

ILIAS session jars stay server-side, encrypted using AES-256-GCM. The key and files have owner-only permissions; the directory is ignored by Git. The app browser gets an opaque HttpOnly, SameSite=Strict cookie. Achilias sessions expire after 12 hours, or earlier when ILIAS invalidates its session. Disconnect removes the active server-side session; it does not log out other university services. Expired session files are deleted when accessed. To remove all retained session data, stop the server and delete the `.local/` directory (or your configured data directory).

University identity-provider cookies are not copied into the ILIAS adapter. Remote session uploads are limited to 256 KiB, filtered to the exact ILIAS host, verified server-side, and discarded if the connection expires or is cancelled during verification. Server requests use an explicit instance boundary, validate each redirect, and never forward ILIAS cookies to an external identity provider. Personal pages and downloads use private/no-store responses. Downloaded content is served as an attachment with `nosniff` and sandbox headers. Saved titles and URLs remain in browser localStorage until cleared under **Features & connection**.

## HTML-based features

Sign-in/session verification, course listings, materials and availability, course information/tool links, forum content/actions, and exercise/tutor tools depend on parsing ILIAS HTML. These screens and their feature entries are marked **HTML-based**: ILIAS or theme updates can make them incomplete or incorrect. Each screen keeps an **Open original in ILIAS** button beside the notice, including on load errors. Item detail dialogs also label parsed metadata and link to the original object. Demo notices explain that the displayed content is an example and link to the real instance.

File downloads use the authenticated download endpoint; local bookmarks and instant filtering operate on browser/current-page data. Their item details can still originate from parsed HTML. Repository-wide search submits ILIAS' read-only main-menu search form and renders the returned results, so deep results follow the same **HTML-based** limits as the listings above.

## Development and verification

```sh
bun run lint
bun run typecheck
bun run test
# Start the dev server first, then:
bun run test:e2e
bun run test:search
# Production build:
bun run build
bun run start --hostname 127.0.0.1
# Production-only checks (start a preview on port 3001 first):
bun run test:navigation
bun run benchmark:navigation
bun run test:search-prefetch
```

`bun run test` checks browser-store synchronization, restored-item validation, current-data precedence and repository-path merging, object capabilities, concurrent connection claims, cookie-update and disconnect races, ILIAS template parsing (including search-result paths and hidden dialog items), restricted/unsupported content, cookie rotation, redirect credential boundaries, expired sessions, pairing validation, demo repository search, the read-only search-form allowlist, and encrypted session persistence. Forum fixtures follow the ILIAS 10 standard-item and post templates and check counts, hierarchy, sanitization, drafts, permissions, pagination, and action scoping. `bun run test:e2e` checks the demo flows in Chromium, including download, bookmarks across reloads and tabs, the courses overview, quick search with course-path deep search, mobile navigation, single-use connection claims, session expiry, and reconnect/disconnect behavior. The last checks use a deliberately credential-free test session against the public Freiburg endpoint; they do not sign in to a real account. `bun run test:forums` runs the forum browser checks alone, including filters, reply context, post search, unread jumps, copied links, read-state persistence in the demo, closed topics, and mobile layouts. `bun run test:headless` exercises the pairing UI, code renewal/cancellation, remote CLI over stdin, and rejection of an unauthenticated transfer. Unit tests mock successful validation to check replay protection and cancellation races; no real account is used. `bun run test:search` runs the search checks that work against the dev server. For production-only checks, start a preview on port 3001 (`bun run start --hostname 127.0.0.1 -p 3001`) and run `bun run test:navigation`, `bun run benchmark:navigation`, and `bun run test:search-prefetch`. `bun run test:exercises` runs the tutor browser flows alone: saved exercise navigation, review filters, assessment/private-note persistence, learner feedback, downloads, unit editing/creation, team scope, mobile layout, and unauthenticated download rejection. Stateful exercise fixtures verify fresh-token POSTs, single-row scope, preserved settings, stale-edit rejection, and save confirmation. `bun run test:forms` compares the static form adapter with Chromium; see [dependency and adaptation boundaries](docs/architecture.md#dependencies-and-adaptation-boundaries) for which parsing and validation work is delegated to libraries. Set `ACHILIAS_TEST_URL` to test another local port.

While `next dev` is running, use `ACHILIAS_BUILD_DIR=.next-build bun run build` to preserve its `.next` directory. Start that build with the same variable if you want to run it.

### Visual feedback during development

[Agentation](https://www.agentation.com/install) is available in the bottom-right corner on desktop when running `bun run dev`. Activate it, click an element, add a note, then copy the feedback and paste it into your coding agent. This uses the simple local setup with no MCP server or endpoint; the toolbar is excluded from production.

### Refreshing screenshots

With the app running, run `bun run screenshots` to refresh the images in `docs/screenshots/`. Each capture uses a fresh browser context and example content. The script also captures unread filtering, mobile thread reading, seeded demo bookmarks, feature support, the headless sign-in dialog without creating a connection code, and exercise units, submission review, assessment, and deadline settings. Set `ACHILIAS_SCREENSHOT_URL` to capture from another local address, such as `http://127.0.0.1:3001` for a separate production preview.

### Integration status

The public Freiburg login/repository pages and upstream ILIAS templates were inspected during development. Automated integration fixtures are based on the upstream list-item, repository-card, standard-item, and ILIAS 10 forum structures. **Authenticated access, remote session portability, SOCKS-assisted sign-in, forum permissions, the upstream mark-read action, and exercise/tutor permissions and write actions still need verification with a real Freiburg account.** Demo success does not establish account-specific compatibility.

Reference sources:

- [Freiburg ILIAS](https://ilias.uni-freiburg.de/)
- [Upstream ILIAS source](https://github.com/ILIAS-eLearning/ILIAS), especially `components/ILIAS/Container/templates/default/tpl.container_list_item.html`, `components/ILIAS/UI/src/templates/default/Card/tpl.card.html`, and `components/ILIAS/File/classes/class.ilObjFileAccess.php`.
- [shadcn/ui components](https://ui.shadcn.com/docs/components)

### Code map

See [code organization and feature development](docs/architecture.md) for the module map, shared object capabilities, browser-state rules, session coordination, and verification guidance. The workspace composes separate navigation, resource-list, and settings components from CLI-installed shadcn primitives. Course and forum loaders share account context, while their parsers own the upstream HTML adaptation. Upstream ILIAS code is reference material, not vendored into the app.

PDF titles open a new browser tab through the authenticated file proxy, including from saved items and quick search. The proxy checks the actual PDF signature before allowing inline display; other content remains an attachment. No custom PDF viewer or PDF parsing service is used. Browser PDF settings can still choose downloading instead of previewing. `bun run test:pdf-theme` checks native Chromium preview plus theme persistence, system preference, cross-tab updates and mobile access.

Quick search reuses encrypted, per-login listing responses in `.local/workspace-cache.sqlite` (or `ACHILIAS_DATA_DIR`): 30 seconds for navigation, 10 minutes for discovering items. Nearby folders stream into search independently of the slower global ILIAS query. Refresh and disconnect clear the current login’s cached listings. See [listing memoization and progressive search](docs/architecture.md#listing-memoization-and-progressive-search) for storage, limits, and freshness.
