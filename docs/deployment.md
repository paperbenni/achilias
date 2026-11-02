# Multi-user deployment

Achilias supports independent users on one server process. Each browser profile has one active ILIAS connection, with its own encrypted cookie jar and temporary login codes. Users can enter different public HTTPS ILIAS base URLs, including installations under a path. No shared university account or Achilias registration is required. ILIAS remains responsible for account permissions.

## Sign-in experience

The server never launches a browser. Users enter their instance URL in **Connect your learning space** and either request a connection code for the laptop helper or paste an existing ILIAS cookie. The helper opens their university’s real login/SSO page and transfers only that ILIAS instance’s cookies to their browser’s pending server session. The direct cookie form accepts a `Cookie` header or a Playwright/cookie JSON export; the server keeps only exact-instance cookies and verifies the dashboard before connecting. Users enter their university credentials on the university page; by default, Achilias has no password form.

By default, sign-in requires Bun, this checkout, and the browser helper on the user’s computer. It is **not a browser-only login service**. Native university SSO cannot simply be embedded into a third-party origin. Session portability, MFA and IP-binding depend on the instance; the README documents the optional SOCKS workaround. Confirm the flow with a real test account before inviting users.

A single-user deployment can opt into `ACHILIAS_PASSWORD_LOGIN=true`. In that mode the server receives the username and password in memory, submits the instance’s real myLogin/IdP form over HTTPS, and stores only the resulting ILIAS cookies. It is disabled by default, restricted to configured instances, and should never be enabled on a shared or public deployment: the operator can see credentials that may unlock more than ILIAS, and credential proxying may violate the university’s SSO terms. MFA and JavaScript-only sign-in pages are not supported.

## Run behind HTTPS

Use Node >=22.19 and Bun. Run one production app process, with persistent private session storage. For example:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

Set these in `.env.local` before building/starting, replacing the example origin and directory:

```dotenv
ACHILIAS_ORIGIN=https://learn.example.org
ACHILIAS_DATA_DIR=/var/lib/achilias
# Only enable behind a trusted proxy that overwrites X-Forwarded-For.
ACHILIAS_TRUST_PROXY=true
# Leave this unset during initial browsing/compatibility tests.
# ACHILIAS_WRITE_TARGETS=https://ilias.example.edu/goto.php?target=exc_12345
```

The app binds `127.0.0.1` by default. Forward your HTTPS reverse proxy to it. A typical Nginx location inside your existing TLS virtual host is:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Overwrite, do not append untrusted client-supplied addresses.
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 300k;
    proxy_read_timeout 60s;
    proxy_buffering off;
    proxy_cache off;
}
```

Terminate TLS at the proxy and keep the app port inaccessible directly. Use a dedicated unprivileged OS account and a session directory owned by it with mode `0700`. HTTPS origins automatically cause Secure, HttpOnly, SameSite=Strict session cookies. Set the exact public origin so API origin checks work. Avoid subpath hosting: current routes expect the app at `/`.

## Instance and network policy

Public HTTPS hostnames on port 443 are accepted by default. Private networks, IP literals, single-label/local hostnames and reserved addresses are rejected. Every TLS connection resolves the hostname, rejects the entire answer if any IP is non-public, and pins the vetted addresses to that connection. Same-instance redirects cannot send cookies elsewhere; redirects that would repeat a POST are refused. There is no environment-proxy bypass in this transport.

For a curated service, optionally restrict the accepted instances:

```dotenv
ACHILIAS_RESTRICT_INSTANCES=true
ILIAS_INSTANCES=https://another-university.edu/ilias/
```

Freiburg is always on the curated list. The restriction does not allow private-network destinations. Other institutions may have unsupported HTML, SSO or permissions: being able to enter an instance URL is not a compatibility guarantee.

## Isolation, limits, and operations

- Session IDs are random bearer secrets in an HttpOnly browser cookie; encrypted files are separate per connection. Login codes are scoped, expire and are single-use. Only exact-instance cookies are imported, excluding identity-provider cookies.
- Personal pages and downloads use `private, no-store`. Authenticated upstream reads bypass Next’s shared fetch cache. Connection changes reload the document to clear the browser router cache. Saved items/history are stored in the browser under a separate key for each connection; separate browser profiles are still appropriate on a shared computer.
- Mutations check the current cookie/session and connection identity. Object URLs, members and units are revalidated against fresh authorized upstream forms. ILIAS permissions are never granted by an Achilias UI control.
- Live changes remain disabled unless the administrator lists specific canonical exercise/forum URLs in `ACHILIAS_WRITE_TARGETS`. This is a server-wide feature allowlist, not a per-user grant: each user still needs upstream rights. Follow [controlled live testing](live-testing.md) before allowing real grades or notifications.
- In-process sign-in limits allow 12 starts and 60 helper/claim requests per client per ten minutes, with separate global ceilings and eight simultaneous verifications. Without a trusted proxy, clients share the anonymous limit. Do not enable proxy trust when clients can reach the app port or supply the forwarding header. Add edge/proxy throttling for an Internet-facing service; these bounds do not replace DDoS protection.
- Text responses are limited to 8 MiB after decompression before parsing, upstream response bodies to 512 MiB, and requests have timeouts. Larger content should use the original ILIAS interface. Downloads stream on the server; the current browser download helper buffers the finished file.
- Sessions expire logically after twelve hours, and cancellation/disconnection deletes their files. New connections periodically clean abandoned files whose last modification is older than twelve hours. Keep storage backed up only if necessary: both encrypted session files and their key are credential material. Losing the key requires everyone to reconnect.

**Run a single app process / replica.** Session locks, rate limits, login verification concurrency and cookie-rotation coordination are in process. File storage supports concurrent users in that process; sharing it between replicas or clustering workers is not supported. For horizontal scaling, replace the session/locking/limits layer with shared transactional storage first. The server operator can decrypt sessions with the stored key; users must trust the operator.

The deployment and isolation checks are automated with synthetic accounts. They are not a penetration test, and authenticated Freiburg behavior still needs real-account validation. Keep the dependency audit and Next.js security updates under review before a public launch.
