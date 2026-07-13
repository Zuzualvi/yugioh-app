# syntax=docker/dockerfile:1
# ============================================================
# Yu-Gi-Oh Edison — Production Docker image (API-only)
# Serves: REST API + card catalog + /images from volume
# The SPA is served separately by Vercel.
# One always-on Machine on Fly.io.
# ============================================================

# ---- Stage 1: build ----------------------------------------
FROM node:22 AS builder
WORKDIR /app

# Copy workspace manifests first (layer cache)
COPY package.json package-lock.json ./
COPY packages/contracts/package.json  packages/contracts/
COPY packages/engine/package.json     packages/engine/
COPY packages/card-data/package.json  packages/card-data/
COPY packages/server/package.json     packages/server/
COPY packages/web/package.json        packages/web/

# Install ALL deps (dev deps needed for esbuild).
# In sandboxed environments with a corporate CA, pass the CA bundle as a BuildKit secret:
#   docker build --secret id=cacert,src=/etc/ssl/certs/ca-certificates.crt .
# On standard internet (e.g. Fly.io builder), the secret is absent and npm ci works normally.
RUN --mount=type=secret,id=cacert \
    if [ -f /run/secrets/cacert ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; \
    fi && \
    npm ci

# Copy root tsconfig files (esbuild needs them to resolve extends)
COPY tsconfig.json tsconfig.base.json ./

# Copy source (after npm ci so the layer above is cached)
COPY packages/ packages/
COPY prod-server.ts ./

# Bundle production server (TypeScript → single ESM file).
# --banner:js provides createRequire so CJS packages (express, body-parser, debug)
# can use require() for Node.js built-ins inside the ESM bundle.
# External: native modules that must be installed in runtime stage.
RUN node_modules/.bin/esbuild prod-server.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
  --external:better-sqlite3 \
  --external:"@node-rs/argon2" \
  --outfile=dist/server.mjs

# ---- Stage 2: runtime --------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

# Copy bundled server entry
COPY --from=builder /app/dist/server.mjs ./server.mjs

# Copy card catalog JSON (baked into image — NOT the image blobs)
COPY --from=builder /app/packages/card-data/out/edison-card-catalog.json \
     ./packages/card-data/out/edison-card-catalog.json
COPY --from=builder /app/packages/card-data/out/alias-index.json \
     ./packages/card-data/out/alias-index.json

# Image seeder (run post-deploy via `fly ssh console -C "node /app/deploy/seed-images.mjs"`).
# Standalone: Node builtins + fetch only; reads the baked-in catalog, writes to the volume.
COPY deploy/seed-images.mjs ./deploy/seed-images.mjs

# Install ONLY native binary dependencies (everything else is bundled).
# better-sqlite3 and @node-rs/argon2 are C/Rust native addons — cannot be bundled.
COPY deploy/native-package.json ./package.json
RUN --mount=type=secret,id=cacert \
    if [ -f /run/secrets/cacert ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; \
    fi && \
    npm install --omit=dev

# Runtime config
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/yugioh.db
ENV IMAGES_PATH=/data/images

# /data is the Fly.io persistent volume mount point
VOLUME /data
EXPOSE 8080

CMD ["node", "server.mjs"]
