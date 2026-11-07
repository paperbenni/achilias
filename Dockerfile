# syntax=docker/dockerfile:1

# Bun-only build and runtime. No Node.js is installed or invoked; the
# `bun --bun` prefix makes Bun execute the Next.js CLI itself.
FROM oven/bun:1.4.4 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Full dependency tree, used only for the build.
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
ENV NODE_ENV=production \
    ACHILIAS_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun --bun next build

FROM base AS runtime
ENV NODE_ENV=production \
    ACHILIAS_DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next's standalone output contains server.js and only the traced runtime
# dependencies. Static assets are not included and must be copied separately.
# If a public/ directory is added, copy it here as well.
COPY --chown=bun:bun --from=build /app/.next/standalone ./
COPY --chown=bun:bun --from=build /app/.next/static ./.next/static

# All persistent state lives here: session.key, <uuid>.enc, workspace-cache.sqlite.
RUN mkdir -p /data \
    && chown bun:bun /data \
    && chmod 700 /data

USER bun
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "server.js"]
