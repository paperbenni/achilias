# Navigation measurements

These are **before/after measurements of Achilias**, not a comparison with the original Freiburg frontend. The baseline build used commit `aba00d0`; the optimized build uses the navigation changes described below.

The same desktop Chromium script ran against local production builds with demo data and an emulated **120 ms browser network latency**, 2 MB/s download, and 1 MB/s upload. It measures from the browser's click event until the destination heading appears and two animation frames have elapsed. Links have time to prefetch before the relevant clicks. These are a single illustrative run per build, not statistical benchmarks, first-load metrics, or live ILIAS account measurements.

| Navigation                 | Before | After |
| -------------------------- | -----: | ----: |
| Overview → Settings        | 344 ms | 43 ms |
| Settings → Saved           | 347 ms | 47 ms |
| Saved → Overview           | 347 ms | 47 ms |
| Overview → Course          | 163 ms | 46 ms |
| Course → Folder            | 147 ms | 46 ms |
| Folder → Overview          | 348 ms | 47 ms |
| Overview → Course (repeat) | 147 ms | 47 ms |
| Course → Forum             | 447 ms | 47 ms |
| Forum → Thread             | 164 ms | 49 ms |
| Thread → Forum (repeat)    | 147 ms | 47 ms |
| Forum → Thread (repeat)    | 147 ms | 47 ms |

The raw reports are [before](navigation-before.json) and [after](navigation-after.json). `rscRequests` counts all RSC requests during the measured interval, including background prefetches for other destinations revealed by the new page. It should not be interpreted as a count of requests for the clicked destination alone.

## What changed

- Course/folder/forum navigation uses actual Next.js Links instead of click-only buttons. The demo can fully prefetch its examples.
- Settings and Saved use local session metadata, without fetching the upstream ILIAS dashboard. These pages can be fully prefetched safely.
- Next's client router reuses recently visited pages for 30 seconds. This stays in the current browser; no personal content is cached in a shared server data cache.
- Live course, folder, and exercise destinations prefetch in full once their links are visible. Fetching those pages can record visits/read events or alter forum view preferences; forum links therefore stay unprefetched.
- Refresh and the forum UI's mark-read action invalidate cached navigation using a Server Action. Signing in or disconnecting performs a full navigation to discard the previous account's client router state.

The 30-second reuse currently uses Next 16.4.3's documented experimental `staleTimes` setting. Keep the production navigation regression test when upgrading Next. Automatic prefetching is a production optimization; `bun run dev` does not demonstrate its final behavior.

## Later changes (not re-measured)

The table above predates the following changes and was not re-run after them. They are listed so the measurements are not mistaken for results of the current build.

- Workspace pages are reused for 30 seconds per session on the server, keyed by session and upstream URL. Overview and My courses share one dashboard download and parse; Refresh and mark-read clear the reuse. Forum and exercise pages are excluded.
- Visible course, folder, and exercise links prefetch their full routes in production; previously only demo pages did. Forum links still do not prefetch because an upstream GET can record read state.
- The exercise loader requests the editor catalog and the members page in parallel instead of one after the other, removing one upstream round trip from exercise pages.

## Reproduce

Build and start a production preview on port 3001, then run:

```sh
bun run test:navigation
bun run benchmark:navigation
```

Use `ACHILIAS_TEST_URL` for another local address, `ACHILIAS_BENCH_LATENCY` to change simulated latency, and `ACHILIAS_BENCH_OUTPUT` to save a JSON report. Do not run a build into the output directory of a running server. Use `ACHILIAS_BUILD_DIR=.next-build` for a separate production build while the dev server uses `.next`.

The production regression test checks that a warmed destination does not request its content again on click (empty route-tree discovery probes are excluded), ordinary navigation preserves the document, Refresh completes, live metadata screens do not prefetch ILIAS-backed destinations, and disconnecting clears a previous account's warmed pages.

A real comparison still needs an authenticated Freiburg account, the same tasks on both frontends, and the same device/network conditions. First-time material and thread loads still wait for ILIAS and can include redirect and parsing overhead. These figures do not establish that cold live loads are faster than the original frontend.
