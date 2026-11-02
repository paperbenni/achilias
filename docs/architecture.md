# Code organization

Routes orchestrate server loaders; loaders adapt ILIAS into typed data; feature components render that data using the installed shadcn components. Keep upstream markup and session secrets out of browser components.

| Responsibility                                                                       | Location                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| App routes, HTTP endpoints, and Server Actions                                       | `src/app`                                                                |
| Shared account metadata and empty page state                                         | `src/lib/ilias/workspace-context.ts`                                     |
| Course/dashboard loading                                                             | `src/lib/ilias/workspace.ts`                                             |
| Repository search form discovery, read-only POST, and demo index                     | `src/lib/ilias/search.ts`                                                |
| Exercise unit discovery, grading, feedback, and verified form submissions            | `src/lib/ilias/exercise.ts`                                              |
| Exercise HTML adaptation, successful-control serialization, and version fingerprints | `src/lib/ilias/exercise-parser.ts`                                       |
| Exercise payload validation shared by browser and server                             | `src/lib/ilias/exercise-validation.ts`                                   |
| Tutor workspace and scoped editors                                                   | `src/components/exercises`                                               |
| Forum loading and authorized upstream actions                                        | `src/lib/ilias/forum.ts`                                                 |
| ILIAS HTML adaptation and forum body sanitization                                    | `src/lib/ilias/parser.ts`, `forum-parser.ts`                             |
| Authenticated requests, redirect boundaries, and cookie rotation                     | `src/lib/ilias/client.ts`                                                |
| Session encryption, cookies, claims, and per-session locks                           | `src/lib/ilias/session.ts`                                               |
| Laptop helper and direct cookie sign-in                                              | `scripts/browser-login.ts` (helper), `remote-login.ts`, `remote-client.ts`, `cookie-login.ts` |
| Opt-in myLogin form sign-in over HTTP                                                 | `password-login.ts`, `app/api/connect/password`                          |
| Object labels, support classification, identity, and destinations                    | `src/lib/ilias/items.ts`                                                 |
| Shared reference/thread/post ID validation                                           | `src/lib/ilias/identifiers.ts`                                           |
| Saved/recent item validation, merging, and updates                                   | `src/lib/ilias/library.ts`                                               |
| Browser storage snapshots and subscriptions                                          | `src/lib/browser-store.ts`, `src/hooks/use-browser-store.ts`             |
| Bookmark/history actions and feedback                                                | `src/hooks/use-library.ts`                                               |
| Workspace composition and local interaction state                                    | `src/components/workspace/workspace-view.tsx`                            |
| Sidebar/account menu, resource lists, and settings                                   | `navigation.tsx`, `item-list.tsx`, `settings-view.tsx` in that directory |
| Shared resource opening, upstream handoffs, and refresh                              | `src/components/navigation`                                              |
| Forum list/thread presentation                                                       | `src/components/forums`                                                  |
| Installed shadcn primitives                                                          | `src/components/ui`                                                      |

## Adding a feature

1. Adapt the upstream representation in `src/lib/ilias`, with representative HTML fixtures when parsing a new layout. Preserve restricted objects and unknown counts instead of silently hiding them. Features that parse upstream HTML must display `ParsedHtmlNotice` with the exact source URL and an original-page button, including in failure states. Mark their Settings entries HTML-based too. Do not apply the label to local-only interactions or direct download transport.
2. Add or update its capability in `items.ts`. Resource links, capability badges, browse-route validation, and activity dialogs use that shared classification. A supported downloadable file is distinct from a navigable course or forum.
3. Build a feature loader using `getWorkspaceContext`. It reads account metadata without fetching ILIAS. Return only the `workspace` and feature data to browser components; the returned server session contains private cookies.
4. Compose the feature UI from shadcn components. Reuse `OriginalLink`, `ItemAction`, and `RefreshButton` for the established handoffs and navigation behavior. Resource rows use the same shadcn Item composition as forum rows. `SidebarInset` already renders the main landmark; do not nest another main inside it.
5. Add the route and expose limitations in the interface and Settings feature list. Keep account-wide features that have no course object explicit there too.

Metadata-only pages use `getWorkspaceMetadata`; they should not fetch the upstream dashboard. Production navigation briefly reuses visited pages in the browser. Visible course, folder, and exercise links prefetch their full route, so a click usually reuses an already-loaded ILIAS page; forum links still avoid speculative GETs because those can record read state. Fetching live pages can also record visits in ILIAS. Refresh and successful native mark-read actions invalidate that recent-page cache. Account changes perform a full navigation to discard prior client-router content. See [navigation measurements and policy](performance/README.md).

Workspace page loads are also reused for 30 seconds inside the server process, keyed by session and upstream URL, so Overview and My courses share one dashboard download and parse and a repeat visit skips both. Entries are bounded, never shared across sessions, and cleared by Refresh and mark-read. Forum and exercise loaders bypass this reuse because their pages carry read state and per-view preferences. The exercise loader fetches the editor catalog and the members page in parallel, since both depend only on the exercise root.

## Local state

Saved items and recent history are scoped to a connection's hashed storage key, with a separate demo key. Restored items are validated, duplicates are removed, and recent history is bounded. Current server metadata takes precedence over saved copies in search; a saved copy's repository path can still fill a missing `context` without overriding current metadata. Pure updates in `library.ts` operate on the latest snapshot so bookmark and history changes do not overwrite one another.

`useBrowserStore` uses React's external-store subscription API, with stable snapshots and an empty server snapshot for hydration. It observes same-document changes and native storage events across tabs. Demo read markers use session storage through the same store. If persistence is blocked, the current document remains usable and the action reports the failure. Media queries and the browser origin also use external-store snapshots instead of effects that copy external values into React state.

## Session coordination

Single-use local connection claims, helper and direct-cookie sign-in completion, cookie rotation writes, and deletion share `withSessionLock`, keyed by session ID. Claims reread and consume the token while holding that lock. Helper completion verifies that the session is still pending. Cookie writes merge only the response’s changes into the latest jar, preserving concurrent rotations and refusing to recreate a deleted session. The shared pairing parser defines the wire format for both the same-machine link and helper codes; their distinct authorization and expiry checks remain in the owning service.

These locks coordinate one server process (including its development reloads). The encrypted file store and in-process sign-in limits are intended for a single server deployment. Multiple replicas would require a shared session store and distributed coordination.

## Verification

Run `bun run lint`, `bun run typecheck`, and `bun run test`. Generated Next output is excluded from lint. Unit tests cover storage validation and synchronization, current-data precedence, object capabilities, encrypted sessions, concurrent/replayed/cancelled claims, concurrent cookie rotation, disconnect races, and the upstream adapters. Session tests share an isolated-process runner so their environment-bound data directories and module mocks cannot leak into one another.

With `next dev` running, `bun run test:e2e` covers courses, cross-tab bookmarks, downloads, forums, and headless pairing. Wait for a destination's heading before asserting shared item text: the same resource can appear on both sides of a client navigation. A link visible on the outgoing page is not proof that navigation completed.

Run `bun run test:navigation` against a production server to check real prefetch behavior and account cache clearing. Use `ACHILIAS_BUILD_DIR=.next-build` for a separate build while development is running. Authenticated Freiburg compatibility still needs a real account; fixture and demo tests do not establish it.

## Tutor actions

Exercise routes consume `ExerciseState`; browser components never receive upstream form tokens or cookie jars. Native tutor actions accept object/unit/member IDs, typed values, and the displayed connection key. They reject a changed account connection before contacting ILIAS, rediscover the current authorized form, preserve unrelated successful controls, and submit its actual command. Assessment saves restrict `listed_part_ids[]` to one row; this is the list ILIAS actually iterates, rather than selected checkboxes. Marks, private tutor notes, and learner-visible feedback remain distinct. ILIAS can expand an assessment or learner feedback to the selected participant’s team.

Grading and unit editing compare fingerprints of the currently displayed fields to detect stale drafts; this is a fresh-read check, not a cross-system transaction lock. Changes made concurrently in another client can still race at the upstream server. Post-save reads verify the result. Never automatically retry a write after a timeout or uncertain verification, especially creation or feedback notifications. Unknown or protected form layouts require the original interface rather than guessed commands. Tests use stateful ILIAS 10-shaped fixtures; live Freiburg tutor compatibility requires an authenticated account.

The shared upstream client supports URL-encoded POSTs and browser redirect semantics: 301/302/303 return to GET, while 307/308 preserve the method within the configured instance boundary. Cookies and credentials never follow cross-instance redirects. HTML instructions reuse the same sanitization policy as forum posts. File and exercise downloads share private attachment-response handling.

Form POSTs otherwise require the write allowlist. The single exception is ILIAS' main-menu repository search: the client verifies the discovered action targets the search controller's `remoteSearch` fallback before accepting a `readOnlyForm` submission, so a spoofed form action can never bypass the write policy. Later result pages follow the paging links ILIAS rendered for that search, verified to target the search controller's read-only `switchResultPage`, so the token and sortation are the ones the server issued. ILIAS only renders a next link when another page exists, which is what `hasMore` reports. Paging is only accepted for the query the session last searched; ILIAS keeps the query server-side, so a page request without a matching search is rejected instead of returning another query's results. Search result items keep ILIAS' repository path as `context`, which flows into saved items, recent history, and the command palette.

The command palette loads `/api/search/items` when opened. Its authenticated, private response comes from `ilMembershipOverviewGUI`, independently of dashboard favorites and browser history. In the local ILIAS source, `ilMembershipBlockGUI` uses the membership provider and `ilDashboardBlockGUI::init` sets its limit to `PHP_INT_MAX`. Loads reuse the existing 30-second session-scoped page cache, including refresh invalidation. Closing search or switching accounts cancels the client request; course data stays in account-scoped component state. Course-list failures offer retry without blocking local or repository search. Local matches use normalized accents and punctuation, rank title matches first, and offer all matches beyond the initial 16.

After a 450 ms typing pause (2–200 characters), search automatically queries the current course, group, folder, or category using `root_id`, then widens to the repository. ILIAS performs recursive subtree search (the local source's `ilSearchGUI::remoteSearch` sets the cache root and `ilLucenePathFilter` tests descendants), so nested folders do not require crawling. Results from each stage remain visible and deduplicate by object identity; current-container matches appear first, followed by enrolled-course path matches, then other repository matches. Pagination continues the final repository search. Query changes and closing the palette cancel client requests. The server serializes search operations per session because ILIAS maintains one active search; pagination is bound to both query and root. Cancelled queued requests are skipped. Echoed terms and the `syncFilterScope` onload call detect stale searches, including stale scopes for the same query. Failed container searches widen to the repository; failed wider searches retain earlier matches and offer retry. Coverage follows ILIAS' index and permissions.

Browser downloads use the same `downloadFile` helper for course materials and tutor submissions, so expired-session or permission errors stay in the app. The server streams the response; the current browser helper prepares a Blob before handing it to the download manager. Large submissions therefore use browser memory while preparing. Bulk archives remain available in the original interface.

Exercise adapter reference (ILIAS 10, commit `d8dd98bc6cd09446465b2999199594f574babab3`): [exercise management and single-row assessment semantics](https://github.com/ILIAS-eLearning/ILIAS/blob/d8dd98bc6cd09446465b2999199594f574babab3/components/ILIAS/Exercise/classes/class.ilExerciseManagementGUI.php), [unit creation and schedule forms](https://github.com/ILIAS-eLearning/ILIAS/blob/d8dd98bc6cd09446465b2999199594f574babab3/components/ILIAS/Exercise/Assignment/class.ilExAssignmentEditorGUI.php), and [learner feedback and team notification semantics](https://github.com/ILIAS-eLearning/ILIAS/blob/d8dd98bc6cd09446465b2999199594f574babab3/components/ILIAS/Exercise/Submission/class.ilExerciseSubmissionFeedbackGUI.php).

## Public multi-user boundary

`upstream-transport.ts` owns the HTTPS transport and DNS-to-socket public-address validation; `client.ts` owns scoped redirects, cookie rotation, bounded text reads and ambiguous-write handling. Tests replace the explicit transport seam instead of the process-wide fetch function. User instance URLs must never be fetched through a different transport. `request-limits.ts` bounds sign-in endpoints and verification concurrency; it trusts forwarded addresses only when explicitly configured.

`write-policy.ts` is shared by server mutation guards and UI capability state. `requireWorkspaceConnection` binds actions to the displayed connection to reject stale tabs after an account switch. UI-only disabling is insufficient. Sessions, locks and rate limits currently support concurrent users in one process; see [deployment](deployment.md) before hosting or considering replicas.

## Dependencies and adaptation boundaries

HTML syntax is parsed by **Cheerio/parse5**, and rich content is sanitized by **sanitize-html**. Selectors, localized labels and ILIAS controller scoping are application adaptation code; a general HTML library cannot supply those mappings. JavaScript modal configuration uses **Acorn + acorn-walk** to read literal properties without evaluating scripts or matching comments/quoted examples.

Exercise action schemas and their TypeScript input types share **Zod** definitions. ISO calendar validation belongs to Zod; wall-clock timezone policy, deadline ordering and field limits belong to the app. **rate-limiter-flexible** owns the in-process sign-in counters and expiry; the app chooses limits and which proxy headers to trust. These memory limits still require one process.

`html-forms.ts` retains a small static-form compatibility adapter. Cheerio’s built-in serializer incorrectly reads multi-select labels and disabled fieldsets; jsdom’s FormData currently includes disabled options. Neither reduced the compatibility burden in testing. `bun run test:forms` compares the retained adapter with Chromium, covering the supported form controls. Uploads, script-generated controls and unsupported ILIAS workflows remain in the original UI. Do not replace this adapter without running those browser comparisons.

Cookies, HTTPS and IP classification already use **tough-cookie**, **Undici** and **ipaddr.js**. Session encryption uses Node’s authenticated **AES-GCM** implementation; there is no handwritten cipher. The file envelope, account binding and single-use pairing are application policy, so adding a general authentication framework would not remove the ILIAS session-transfer integration.

## Native PDF opening and appearance

`itemOpenHref` is the common opening target for file links and command search; explicit download actions keep `itemHref`. File titles use a normal anchor to the authenticated proxy with `view=1`, avoiding both the unsupported-object dialog and Next prefetching file bodies. The proxy peeks at the `%PDF-` signature without buffering the document. Only that response becomes `application/pdf` with inline disposition; other content remains a sandboxed attachment. Native PDF viewers cannot run under CSP sandbox, so signature-matching PDF responses omit that directive while retaining `default-src 'none'`, nosniff, private/no-store and frame restrictions. Browser PDF preferences still apply. HTTP filename parsing/formatting is delegated to `content-disposition` on both the server and browser.

Appearance uses the standard `next-themes` provider (`class` attribute, system default, persistence and transition suppression). Its shadcn radio menu lives with the account controls in the sidebar, with a separate Appearance entry before sign-in. Semantic color variables, including course icon tones, provide the dark palette; UI components do not implement their own theme state.
