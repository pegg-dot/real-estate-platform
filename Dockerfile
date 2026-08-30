# LOT — one image for any long-running Docker host (docker compose, Railway, Render, Fly, a VM). NOT Vercel:
# the web UI shells out to the engine CLIs (web/app/lib/engine.ts) and the engine shells out to the Python
# county ingestion (scripts/refresh-market.ts), so the image carries all three:
#   /app        repo root: engine (lib/, scripts/), tsx in node_modules, Python venv at /app/.venv
#   /app/web    the built Next.js app — the process runs from here so engine.ts's REPO=../ resolves to /app
# Boot: docker-entrypoint.sh waits for Postgres, applies pending migrations, then starts Next.
FROM node:22-bookworm-slim

# Python for the county ingestion (refresh-market.ts prefers .venv/bin/python, else python3).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Root deps — includes tsx (a devDependency the engine bridge needs at RUNTIME), so install dev too.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# 2) Web deps (its own node_modules; next build needs dev deps).
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --include=dev --no-audit --no-fund

# 3) Python deps into the venv the refresh script looks for (relative to the repo root).
COPY ingestion/requirements.txt ./ingestion/
RUN python3 -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r ingestion/requirements.txt

# 4) Source (node_modules / .next / .env / host .venv excluded via .dockerignore) + production web build.
COPY . .
RUN cd web && npm run build \
 && chmod +x /app/docker-entrypoint.sh /app/scripts/lot \
 && ln -s /app/scripts/lot /usr/local/bin/lot

# Runtime is production; tsx subprocesses inherit this env. Build happened above with dev deps present.
ENV NODE_ENV=production
# Run FROM web/ so the engine bridge's REPO=../ resolves to the repo root (/app). `next start` reads the
# port from $PORT (Railway/Render inject it) natively; default 3000. Exec-form CMD: no shell needed, so a
# host that runs the start command without a shell still works.
WORKDIR /app/web
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0"]
