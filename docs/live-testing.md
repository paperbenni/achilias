# Testing with a real ILIAS account

Start with local browsing. **Live changes are disabled by default**, including assessments, exercise creation/settings, learner feedback, and explicit forum mark-as-read. The server checks this before contacting ILIAS for these actions; disabling a button is not the security boundary. The demo remains interactive.

This is an early third-party client, not an audited university service. Authenticated Freiburg compatibility has not yet been established with a real account. A successful demo or fixture test does not verify your instance’s permissions, theme, timezone, team expansion, or notification behavior.

## First connection

1. Leave **Read-only mode** enabled in **Features & connection → Preferences**. Run locally with `bun run dev` (binds to `127.0.0.1`), or use the documented SSH tunnel for a headless server. For ongoing use, build and run the production app. Do not expose a development server publicly.
2. Complete university sign-in in the dedicated browser. Achilias imports ILIAS cookies, not your university password. The machine running Achilias can act with your ILIAS account: use a machine you trust. Protect `.local/` or `ACHILIAS_DATA_DIR` as credentials; it contains both encrypted sessions and their key. Do not share cookies, pairing codes, database/session files, or screenshots containing student data.
3. Browse a course, a forum/thread, an exercise, and a unit’s submissions. Compare participant/team names, submission counts, status, private versus learner-visible feedback, and deadline/timezone values using **Open original in ILIAS**. Missing/unknown fields should stay visibly unknown. Stop using an affected feature if these disagree.
4. Try a submission download and verify the participant/team and file in the original. Files come from authenticated ILIAS and should be handled with the same care as normal downloads.
5. Disconnect when finished. Disconnect removes the local session; it does not log every other university browser out.

Browsing is **not guaranteed side-effect-free**. ILIAS can record visits, downloads and read status, or store table/view preferences on GET requests. The protection blocks Achilias’s explicit mutation features, not all possible ILIAS behavior. Links to the original open the normal interface, where your usual permissions apply.

## Controlled editing test

Use a disposable exercise/forum and test participants, with permission to alter their data. Do not start by changing actual students’ grades or live deadlines. If no suitable test exercise is available, leave editing disabled and use the original ILIAS editor.

In **Features & connection → Preferences**, turn off **Read-only mode** in the browser used for the test. This enables supported editing features for that browser's signed-in account; it does not change ILIAS permissions or other users' browser preferences. No server restart or environment variable is needed.

Test one change at a time, compare the result in the original, and check for unintended effects:

- Assess one test participant, then a test team. A team assessment can affect every member. Confirm other rows remain unchanged and private notes stay private.
- Save learner feedback separately. ILIAS may notify learners/team members; an email cannot be undone by restoring the text. Saving unchanged feedback does not send another POST.
- Create a test unit and change a test deadline. Confirm title, instructions, timezone, mandatory status, and unrelated settings in the original. Relative, individual or locked schedules require the original editor.
- Mark a test discussion as read and confirm its state in ILIAS.

Achilias rediscovers authorized forms and fresh tokens, rejects conflicting IDs and stale values, and reads back saved values. These checks reduce mistakes; HTML adaptation cannot prove every upstream side effect. Concurrent changes made in the original between the fresh check and the save remain possible. There is no general undo or exactly-once guarantee.

If a request times out, verification fails, or a POST redirect would repeat the write, **check the original before retrying**. The first request may already have succeeded. Do not automatically retry unit creation or feedback. Turn Read-only mode back on after testing.

## Deployment and dependency limits

Use loopback plus SSH, or HTTPS with `ACHILIAS_ORIGIN` set to the public HTTPS origin. HTTPS origins automatically use Secure session cookies. Session files are private to the OS account, but encryption does not protect them from an administrator who can read both the files and key. Backups need the same protection.

`bun audit` was checked during this safety pass, but do not treat that as a clean dependency audit or a penetration test. Re-run `bun audit` before deploying and review updates rather than forcing incompatible transitive major versions.
