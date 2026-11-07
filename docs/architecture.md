# Code organization

Routes orchestrate server loaders; loaders adapt ILIAS into typed data; feature components render that data using the installed shadcn components. Keep upstream markup and session secrets out of browser components.

Keep exact constants and file inventories in the code; this document records the invariants, operational boundaries, and upstream behavior that are expensive to rediscover.

Statements about ILIAS internals below are version-sensitive; the revision used during development is pinned under [Exercise adapter reference](#exercise-adapter-reference).

## Where things live

| Responsibility | Location |
| --- | --- |
| App routes, HTTP endpoints, and Server Actions | `src/app` |
| Dashboard/course loading and shared account context | `src/lib/ilias/workspace.ts`, `workspace-context.ts` |
| Feature loaders and adapters | `src/lib/ilias/forum.ts`, `exercise.ts`, `search.ts` |
| Upstream HTML adaptation | `src/lib/ilias/parser.ts`, `forum-parser.ts`, `exercise-parser.ts` |
| Session, transport, and write policy | `src/lib/ilias/session.ts`, `client.ts`, `upstream-transport.ts`, `write-policy.ts` |
| Listing cache and search projection | `src/lib/ilias/workspace-store.ts`, `page-cache.ts`, `search-index.ts`, `nearby-search.ts` |
| Shared object capabilities | `src/lib/ilias/items.ts` |
| Browser storage and hooks | `src/lib/browser-store.ts`, `src/hooks` |
| Feature and shared UI | `src/components` |
| Helper and CLI | `scripts` |
| Tests | `tests`, `scripts/*-smoke.ts` |

## Adding a feature

1. Adapt the upstream representation in `src/lib/ilias`, with representative HTML fixtures when parsing a new layout. Preserve restricted objects and unknown counts instead of silently hiding them. Features that parse upstream HTML must display `ParsedHtmlNotice` with the exact source URL and an original-page button, including in failure states. Mark their Settings entries HTML-based too. Do not apply the label to local-only interactions or direct download transport.
2. Add or update its capability in `items.ts`. Resource links, capability badges, browse-route validation, and activity dialogs use that shared classification. A supported downloadable file is distinct from a navigable course or forum.
3. Build a feature loader using `getWorkspaceContext`. It reads account metadata without fetching ILIAS. Return only the `workspace` and feature data to browser components; the returned server session contains private cookies.
4. Compose the feature UI from shadcn components. Reuse `OriginalLink`, `ItemAction`, and `RefreshButton` for the established handoffs and navigation behavior. Resource rows use the same shadcn Item composition as forum rows. `SidebarInset` already renders the main landmark; do not nest another main inside it.
5. Add the route and expose limitations in the interface and Settings feature list. Keep account-wide features that have no course object explicit there too.

## Navigation and freshness

Production navigation prefetches course, folder, and exercise routes once their links are visible, so a click usually reuses an already-loaded ILIAS page. Forum links stay unprefetched because an upstream GET can record read state or change view preferences. Demo content can be prefetched freely. Metadata-only pages use `getWorkspaceMetadata` and do not fetch the upstream dashboard.

Visited pages are reused for 30 seconds in the browser and in the server process, keyed by session and upstream URL. Overview and My courses therefore share one dashboard download and parse. Refresh and native mark-read invalidate the reuse; forum and exercise loaders bypass it because their pages carry read state and per-view preferences. Account changes perform a full navigation to discard prior client-router content. Fetching live pages can still record visits in ILIAS.

Workspace routes live in the `(workspace)` route group. Its layout owns the sidebar and account dialogs, so navigation does not remount unchanged chrome; `loading.tsx` sits inside that layout and only replaces the page area. The layout resolves both live and demo metadata; the client shell selects one from the URL because layouts cannot read `searchParams`.

## Local state

Saved items and recent history are scoped to a connection's hashed storage key, with a separate demo key. Restored items are validated, duplicates are removed, and history is bounded. Current server metadata takes precedence over saved copies in search; a saved copy's repository path can still fill a missing `context` without overriding current metadata. Updates operate on the latest snapshot so bookmark and history changes do not overwrite one another.

The browser store observes same-document changes and native storage events across tabs. Demo read markers use session storage. If persistence is blocked, the current document remains usable and the action reports the failure.

## Session coordination

Single-use connection claims, sign-in completion, cookie rotation, and deletion share a per-session lock. Claims reread and consume the token while holding it; helper completion verifies the session is still pending. Cookie writes merge only the response's changes into the latest jar, preserving concurrent rotations and refusing to recreate a deleted session.

These locks coordinate one server process. The encrypted file store and in-process sign-in limits are intended for a single deployment; multiple replicas would need a shared session store and distributed coordination.

## Verification

Run `bun run lint`, `bun run typecheck`, and `bun run test`. Unit tests cover storage validation and synchronization, current-data precedence, object capabilities, encrypted sessions, concurrent/replayed/cancelled claims, cookie rotation, disconnect races, and the upstream adapters. Session tests use an isolated-process runner so environment-bound data directories and module mocks do not leak between tests.

With `next dev` running, `bun run test:e2e` covers courses, cross-tab bookmarks, downloads, forums, and headless pairing. Wait for a destination's heading before asserting shared item text: the same resource can appear on both sides of a client navigation, and a link visible on the outgoing page is not proof that navigation completed.

Run `bun run test:navigation` against a production server to check real prefetch behavior and account cache clearing. Use `ACHILIAS_BUILD_DIR=.next-build` for a separate build while development is running. Authenticated Freiburg compatibility still needs a real account; fixture and demo tests do not establish it.

## Tutor actions

Exercise routes consume `ExerciseState`; browser components never receive upstream form tokens or cookie jars. Native tutor actions accept object/unit/member IDs, typed values, and the displayed connection key. They reject a changed account connection before contacting ILIAS, rediscover the current authorized form, preserve unrelated successful controls, and submit its actual command. Assessment saves are scoped to one row rather than the selected checkboxes. Marks, private tutor notes, and learner-visible feedback remain distinct, and ILIAS can expand an assessment or feedback to the participant's team.

Grading and unit editing compare fingerprints of the displayed fields to detect stale drafts; this is a fresh-read check, not a cross-system transaction lock. Concurrent changes in another client can still race upstream. Post-save reads verify the result. Never automatically retry a write after a timeout or uncertain verification, especially creation or feedback notifications. Unknown or protected form layouts require the original interface rather than guessed commands. Tests use stateful ILIAS 10-shaped fixtures; live Freiburg tutor compatibility requires an authenticated account.

### Exercise adapter reference

ILIAS 10, commit `d8dd98bc6cd09446465b2999199594f574babab3`: [exercise management and single-row assessment semantics](https://github.com/ILIAS-eLearning/ILIAS/blob/d8dd98bc6cd09446465b2999199594f574babab3/components/ILIAS/Exercise/classes/class.ilExerciseManagementGUI.php), [unit creation and schedule forms](https://github.com/ILIAS-eLearning/ILIAS/blob/d8dd98bc6cd09446465b2999199594f574babab3/components/ILIAS/Exercise/Assignment/class.ilExAssignmentEditorGUI.php), and [learner feedback and team notification semantics](https://github.com/ILIAS-eLearning/ILIAS/blob/d8dd98bc6cd09446465b2999199594f574babab3/components/ILIAS/Exercise/Submission/class.ilExerciseSubmissionFeedbackGUI.php).

## Upstream ILIAS assumptions

These are the version-sensitive upstream behaviors the adapters rely on. They were checked against the ILIAS 10 source used during development; the revision is pinned under [Exercise adapter reference](#exercise-adapter-reference).

- **Dashboard membership:** the command palette's course list comes from `ilMembershipOverviewGUI`, independently of dashboard favorites and browser history. `ilMembershipBlockGUI` uses the membership provider, and `ilDashboardBlockGUI::init` sets the block limit to `PHP_INT_MAX`.
- **Repository search:** `ilSearchGUI::remoteSearch` sets the search cache root and deletes/replaces the account's saved search cache; `ilLucenePathFilter` tests descendants; `switchResultPage` handles paging; echoed terms and `syncFilterScope` detect stale searches, including stale scopes for the same query. Searches must stay serialized because the controller keeps one active search per session.
- **Exercises:** `listed_part_ids[]` is the list ILIAS iterates for assessment, so scoping it to one row prevents an individual edit from saving the whole table. Team assessments and learner feedback can expand to every team member, and feedback can notify learners.

## Upstream client and write policy

The shared client supports URL-encoded POSTs and browser redirect semantics: 301/302/303 return to GET, while 307/308 preserve the method within the configured instance boundary. Cookies and credentials never follow cross-instance redirects. HTML instructions reuse the same sanitization policy as forum posts. File and exercise downloads share private attachment-response handling.

Form POSTs otherwise require the write allowlist. The single exception is ILIAS' main-menu repository search: the client verifies the discovered action targets the search controller's `remoteSearch` fallback before accepting a `readOnlyForm` submission, so a spoofed action cannot bypass the write policy. Later result pages follow the paging links ILIAS rendered for that search, verified to target the read-only `switchResultPage`, so the token and sortation are the ones the server issued. ILIAS only renders a next link when another page exists, which is what `hasMore` reports. Paging is accepted only for the query the session last searched; ILIAS keeps the query server-side, so a page request without a matching search is rejected instead of returning another query's results. Search result items keep ILIAS' repository path as `context`, which flows into saved items, recent history, and the command palette.

`upstream-transport.ts` owns the HTTPS transport and DNS-to-socket public-address validation; `client.ts` owns scoped redirects, cookie rotation, bounded text reads, and ambiguous-write handling. Tests replace the explicit transport seam instead of the process-wide fetch function. User instance URLs must never be fetched through a different transport. `request-limits.ts` bounds sign-in endpoints and verification concurrency; it trusts forwarded addresses only when explicitly configured.

`write-policy.ts` is shared by server mutation guards and UI capability state. `requireWorkspaceConnection` binds actions to the displayed connection to reject stale tabs after an account switch; UI-only disabling is insufficient. Sessions, locks, and rate limits currently support concurrent users in one process; see [deployment](deployment.md) before hosting or considering replicas.

## Dependencies and adaptation boundaries

HTML syntax is parsed by **Cheerio/parse5**, and rich content is sanitized by **sanitize-html**. Selectors, localized labels, and ILIAS controller scoping are application adaptation code; a general HTML library cannot supply those mappings. JavaScript modal configuration uses **Acorn + acorn-walk** to read literal properties without evaluating scripts or matching comments/quoted examples.

Exercise action schemas and their TypeScript input types share **Zod** definitions. ISO calendar validation belongs to Zod; wall-clock timezone policy, deadline ordering, and field limits belong to the app. **rate-limiter-flexible** owns the in-process sign-in counters and expiry; the app chooses limits and which proxy headers to trust. These memory limits still require one process.

`html-forms.ts` retains a small static-form compatibility adapter. Cheerio's built-in serializer incorrectly reads multi-select labels and disabled fieldsets; jsdom's FormData currently includes disabled options. Neither reduced the compatibility burden in testing. `bun run test:forms` compares the retained adapter with Chromium, covering the supported form controls. Uploads, script-generated controls, and unsupported ILIAS workflows remain in the original UI. Do not replace this adapter without running those browser comparisons.

Cookies, HTTPS, and IP classification use **tough-cookie**, **Undici**, and **ipaddr.js**. Session encryption uses Node's authenticated **AES-GCM** implementation; there is no handwritten cipher. The file envelope, account binding, and single-use pairing are application policy, so a general authentication framework would not remove the ILIAS session-transfer integration.

## Native PDF opening and appearance

File titles use a normal anchor to the authenticated proxy with `view=1`, avoiding both the unsupported-object dialog and Next prefetching file bodies. The proxy peeks at the `%PDF-` signature without buffering the document. Only that response becomes `application/pdf` with inline disposition; other content remains a sandboxed attachment. Native PDF viewers cannot run under CSP sandbox, so signature-matching PDF responses omit that directive while retaining `default-src 'none'`, nosniff, private/no-store, and frame restrictions. Browser PDF preferences still apply. HTTP filename parsing/formatting is delegated to `content-disposition` on both the server and browser.

Appearance uses the standard `next-themes` provider (`class` attribute, system default, persistence, and transition suppression). Its shadcn radio menu lives with the account controls in the sidebar, with a separate Appearance entry before sign-in. Semantic color variables, including course icon tones, provide the dark palette; UI components do not implement their own theme state.

## Listing memoization and progressive search

`workspace-store.ts` owns a disposable SQLite response cache at `$ACHILIAS_DATA_DIR/workspace-cache.sqlite` (`.local` by default). It uses the runtime's `node:sqlite` driver, prepared statements, WAL, and the existing private storage key. URLs and parsed page payloads are encrypted with AES-256-GCM; account and URL lookup keys are SHA-256 hashes. Cookies and credentials are not cached. `private-storage.ts` owns the key shared with the encrypted session files.

There is one cached parsed listing per login and URL. `page-cache.ts` coalesces concurrent downloads and reuses a response for **30 seconds** for navigation. `search-index.ts` derives searchable items and parent/child relationships from those same snapshots for **10 minutes**; it has no independent persistent index to synchronize. Recently visited parents make unopened siblings discoverable: opening Tutorate, then Gruppe 02, retains the Gruppe 04 entry from Tutorate. A fresh listing replaces the old snapshot rather than appending obsolete children. The cache is bounded per login and globally, with per-entry and total-size caps (current values in `workspace-store.ts`); expired rows are removed on subsequent writes and checked on reads. It survives restarts and may be deleted to reset this disposable data. Keep its directory private and on a local persistent volume.

Search results use the same `canPrefetchItem` policy as ordinary resource links. A result becomes a Next `Link` with full prefetching enabled only after hover or DOM focus. This warms page content, rather than just the loading shell. Selection still goes through cmdk's shared handler, preserving keyboard navigation and recent-item recording. Live forum reads, file downloads, external/unsupported objects, and restricted items are excluded. Next owns request deduplication and router-cache expiry.

Quick search combines three independent paths:

1. Current page, bookmarks, recent history, and discovered items filter immediately in the browser, scoped to the current account's storage key. Browser discovery is bounded to 4,000 items and is not written to localStorage. Local matches use normalized accents and punctuation, rank title matches first, and offer all matches beyond the initial 16.
2. On opening search, `/api/search/nearby` begins bounded container discovery before a query is submitted. Parents of recent/current folders precede other courses. Two workers visit at most 12 listings and descend at most two levels beyond their starting folders. Fresh responses are memoized; each completed listing streams as an NDJSON event. Keystrokes filter incoming items and reuse this work. Closing search stops scheduling new work; up to two already-started reads may finish and populate the cache. Browsing folders can record normal ILIAS visits.
3. After a 450 ms typing pause (2–200 characters), ILIAS repository search supplies broader matches and pagination. It scopes the first query to the current container with `root_id`, then widens to the repository. It runs alongside discovery, without gating nearby results. Authenticated page loads prime the main-menu search form cache, avoiding a redundant dashboard download before the first query. Its tokens stay in server memory for at most five minutes. Completed first pages are memoized per login/query/scope for 30 seconds; concurrent identical searches coalesce through the existing search queue. An uncached global search still takes however long ILIAS needs to render it. Query changes and closing the palette cancel client requests. Failed container searches widen to the repository; failed wider searches retain earlier matches and offer retry.

ILIAS performs recursive subtree search, so nested folders do not require crawling, and it keeps one active search per session. Searches therefore remain serialized; parallel POSTs would corrupt paging. A canceled queued query is skipped; an already-running POST is drained before another begins because aborting HTTP does not guarantee PHP stopped mutating its cache. Cached paginated results are reusable only while the same query and scope remain active upstream. Independent container GETs never use the mutable search controller. No full-site crawler or background job is required.

Refresh and disconnect clear the current login's stored listings. In-flight loads cannot repopulate invalidated entries. Refresh also clears that login's repository result/form memoization; other users' caches remain intact. The SQLite cache does not remove the deployment's **single app process** requirement: session/search coordination and in-flight request sharing remain process-local. Activity contents, assessments, write forms, and download bodies are outside this cache and retain their existing freshness and permission checks.
