# Imagen de producción de la API.
# Etapa 1: instala, compila y genera una carpeta autocontenida con `pnpm deploy` (sin enlaces de pnpm).
# Etapa 2: solo Node y lo generado. Sin herramientas de compilación ni código fuente.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @arkanium/api... build \
 && pnpm --filter @arkanium/api deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
