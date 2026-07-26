# --- 依賴層：只複製 manifest，讓 npm ci 能吃到快取 ---
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci

# --- 開發用：搭配 docker-compose.dev.yml 的 bind mount 跑 vite dev ---
FROM deps AS dev
ENV VITE_USE_POLLING=1
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=@moon/web"]

# --- 建置層 ---
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace=@moon/web

# --- 正式環境：nginx 靜態伺服 + /api 反向代理 ---
FROM nginx:1.27-alpine AS prod
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
