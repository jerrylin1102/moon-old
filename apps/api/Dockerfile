FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci

# --- 開發：tsx watch，原始碼由 bind mount 提供 ---
FROM deps AS dev
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@moon/api"]

# --- 正式：直接用 tsx 跑 TypeScript 原始碼 ---
# 這個規模不值得再多一層 build/bundle；換成編譯產物只是換掉 CMD。
FROM deps AS prod
COPY packages/shared packages/shared
COPY apps/api apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@moon/api"]
