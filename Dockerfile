# LOT — single-image deploy for a long-running Node host (Railway/Render/Fly), NOT Vercel.
# The web UI (web/) shells out to the engine CLIs via tsx (web/app/lib/engine.ts):
#   REPO = process.cwd()/..  ·  TSX = REPO/node_modules/.bin/tsx  ·  runs scripts/*.ts from REPO.
# So the image must carry BOTH the repo root (scripts/ + lib/ + tsx in root node_modules) AND the
# built web/ app, and the process must start with cwd=web/ so REPO resolves to the repo root.
FROM node:22-bookworm-slim
WORKDIR /app

# 1) Root deps — includes tsx (a devDependency the engine bridge needs at RUNTIME), so install dev too.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# 2) Web deps (its own node_modules; next build needs dev deps). Use `npm install` (not `npm ci`):
# the lockfile is generated on macOS and omits linux-only optional deps (@emnapi/*), which strict
# `npm ci` would reject. `npm install` resolves the correct per-platform binaries on each build.
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm install --no-audit --no-fund --include=dev

# 3) Source (node_modules / .next / .env excluded via .dockerignore) + production web build.
COPY . .
RUN cd web && npm run build

# Runtime is production; tsx subprocesses inherit this env. Build happened above with dev deps present.
ENV NODE_ENV=production
EXPOSE 3000
# Start from web/ so the engine bridge's REPO=../ points at the repo root. Bind $PORT (Railway-injected) on 0.0.0.0.
CMD ["sh", "-c", "cd web && node_modules/.bin/next start -p ${PORT:-3000} -H 0.0.0.0"]
