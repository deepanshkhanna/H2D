# OpsPilot AI — TanStack Start frontend (Bun)
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bunfig.toml ./
COPY bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["bun", "dist/server/server.js"]
