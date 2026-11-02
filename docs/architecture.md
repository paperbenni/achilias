# Code organization

Routes orchestrate server loaders; loaders adapt ILIAS into typed data; feature components render that data using the installed shadcn components. Keep upstream markup and session secrets out of browser components.

| Responsibility                                                    | Location                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| App routes, HTTP endpoints, and Server Actions                    | `src/app`                                                                |
| Shared account metadata and empty page state                      | `src/lib/ilias/workspace-context.ts`                                     |
| Course/dashboard loading                                          | `src/lib/ilias/workspace.ts`                                             |
| Forum loading and authorized upstream actions                     | `src/lib/ilias/forum.ts`                                                 |
| ILIAS HTML adaptation and forum body sanitization                 | `src/lib/ilias/parser.ts`, `forum-parser.ts`                             |
| Authenticated requests, redirect boundaries, and cookie rotation  | `src/lib/ilias/client.ts`                                                |
| Session encryption, cookies, claims, and per-session locks        | `src/lib/ilias/session.ts`                                               |
| Sign-in windows and laptop helper transfers                       | `login.ts`, `browser-login.ts`, `remote-login.ts`, `remote-client.ts`    |
| Object labels, support classification, identity, and destinations | `src/lib/ilias/items.ts`                                                 |
| Shared reference/thread/post ID validation                        | `src/lib/ilias/identifiers.ts`                                           |
| Saved/recent item validation, merging, and updates                | `src/lib/ilias/library.ts`                                               |
| Browser storage snapshots and subscriptions                       | `src/lib/browser-store.ts`, `src/hooks/use-browser-store.ts`             |
| Bookmark/history actions and feedback                             | `src/hooks/use-library.ts`                                               |
| Workspace composition and local interaction state                 | `src/components/workspace/workspace-view.tsx`                            |
| Sidebar/account menu, resource lists, and settings                | `navigation.tsx`, `item-list.tsx`, `settings-view.tsx` in that directory |
| Shared resource opening, upstream handoffs, and refresh           | `src/components/navigation`                                              |
| Forum list/thread presentation                                    | `src/components/forums`                                                  |
| Installed shadcn primitives                                       | `src/components/ui`                                                      |

## Adding a feature

1. Adapt the upstream representation in `src/lib/ilias`, with representative HTML fixtures when parsing a new layout. Preserve restricted objects and unknown counts instead of silently hiding them. Features that parse upstream HTML must display `ParsedHtmlNotice` with the exact source URL and an original-page button, including in failure states. Mark their Settings entries HTML-based too. Do not apply the label to local-only interactions or direct download transport.
2. Add or update its capability in `items.ts`. Resource links, capability badges, browse-route validation, and activity dialogs use that shared classification. A supported downloadable file is distinct from a navigable course or forum.
3. Build a feature loader using `getWorkspaceContext`. It reads account metadata without fetching ILIAS. Return only the `workspace` and feature data to browser components; the returned server session contains private cookies.
4. Compose the feature UI from shadcn components. Reuse `OriginalLink`, `ItemAction`, and `RefreshButton` for the established handoffs and navigation behavior. Resource rows use the same shadcn Item composition as forum rows. `SidebarInset` already renders the main landmark; do not nest another main inside it.
5. Add the route and expose limitations in the interface and Settings feature list. Keep account-wide features that have no course object explicit there too.

Metadata-only pages use `getWorkspaceMetadata`; they should not fetch the upstream dashboard. Production navigation briefly reuses visited pages in the browser. Live course/forum links deliberately disable speculative prefetch because an upstream GET can record visits, read events, or view preferences. Refresh and successful native mark-read actions invalidate that recent-page cache. Account changes perform a full navigation to discard prior client-router content. See [navigation measurements and policy](performance/README.md).

## Local state

Saved items and recent history are scoped to a connection's hashed storage key, with a separate demo key. Restored items are validated, duplicates are removed, and recent history is bounded. Current server metadata takes precedence over saved copies in search. Pure updates in `library.ts` operate on the latest snapshot so bookmark and history changes do not overwrite one another.

`useBrowserStore` uses React's external-store subscription API, with stable snapshots and an empty server snapshot for hydration. It observes same-document changes and native storage events across tabs. Demo read markers use session storage through the same store. If persistence is blocked, the current document remains usable and the action reports the failure. Media queries and the browser origin also use external-store snapshots instead of effects that copy external values into React state.

## Session coordination

Single-use local connection claims, local and remote sign-in completion, cookie rotation writes, and deletion share `withSessionLock`, keyed by session ID. Claims reread and consume the token while holding that lock. Local sign-in completion verifies that the session is still pending. Cookie writes merge only the response’s changes into the latest jar, preserving concurrent rotations and refusing to recreate a deleted session. The shared pairing parser defines the wire format for both local links and helper codes; their distinct authorization and expiry checks remain in the owning service.

These locks coordinate one server process (including its development reloads). The encrypted file store and in-process sign-in jobs are intended for a single server deployment. Multiple replicas would require a shared session store and distributed coordination.

## Verification

Run `bun run lint`, `bun run typecheck`, and `bun run test`. Generated Next output is excluded from lint. Unit tests cover storage validation and synchronization, current-data precedence, object capabilities, encrypted sessions, concurrent/replayed/cancelled claims, concurrent cookie rotation, disconnect races, and the upstream adapters. Session tests share an isolated-process runner so their environment-bound data directories and module mocks cannot leak into one another.

With `next dev` running, `bun run test:e2e` covers courses, cross-tab bookmarks, downloads, forums, and headless pairing. Wait for a destination's heading before asserting shared item text: the same resource can appear on both sides of a client navigation. A link visible on the outgoing page is not proof that navigation completed.

Run `bun run test:navigation` against a production server to check real prefetch behavior and account cache clearing. Use `ACHILIAS_BUILD_DIR=.next-build` for a separate build while development is running. Authenticated Freiburg compatibility still needs a real account; fixture and demo tests do not establish it.
