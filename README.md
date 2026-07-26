# 月老值班中

坐上神座，換你當月老。信眾一個個進廟上香、擺供品、跪拜、說願望、擲筊——你得即時處理。
目標是讓玩家笑著感受到「原來月老這麼累」。

本作為虛構娛樂創作，並非宗教儀式或教義的呈現。

## 現在的狀態

**M0–M5 完成。模式 A「初一十五」是完整可玩、可分享的循環，純前端、離線可跑。**

- monorepo、docker compose 三服務、資源模擬層與測試
- 神座第一人稱視角（桌機滑鼠／手機拖移），**鎖定水平 fov**（three 的 fov 是垂直的，直式手機會把橫向視野砍半）
- 廟宇場景：天井光柱、吊燈、燭光、香煙、香灰、匾額（canvas 貼圖，不打包中文字型）、Bloom 後製
- 信眾：進門 → 香爐上香 → 神桌擺供品 → 跪拜 → 說出願望 → 等你回應 → 過期就帶著怨氣離場
- 互動：點信眾聽願望，准／駁／轉單、擲筊三選、拖曳牽紅線配對、花香火施神通補全場耐心
  - 桌機：滑鼠環視（中央有死區，見下）＋ 1/2/3 批示、4/5/6 擲筊、空白鍵神通、Esc 取消
  - 手機：輕點選人、四顆大按鈕、從一位信眾拖到另一位牽紅線
  - 業務範圍會影響結果：准了不屬月老的願望是越權辦事，把自己該管的轉單出去則重罰怨氣

- 資源壓力：疲勞不是扣血條，而是讓你做不好事——願望文字被 `⋯` 蓋掉、畫面模糊、批示有冷卻、鏡頭晃、暗角收窄。
  信眾留在神桌上的供品可以點來偷吃回體力（代價是怨氣 +1）。怨氣滿＝香客散了，時間到＝打烊，兩種都會收班並結算。

- 月老日記：收班後依當日表現給稱號與總結，列出「今日最扯」的那則願望與你的處置，
  加上香客留言區（五星感謝信與一星負評混雜）。一鍵匯出 1080×1350 分享圖，純 canvas 繪製，離線可用。
- 願望池 105 則，分成 `core / love / life / absurd` 四個檔，感情類約佔一半，
  三成以上不屬月老業務——轉單機制才有戲唱。

**M6（後端）完成**：

- **投稿與三層審核**：`POST /api/wishes/submit` → 程式規則（電話／email／網址／身分證／社群帳號／灌水一律自動退件；髒話只標記不退件，交給人工）→ LLM 預審（寫進 `auto_flags`，掛掉時記成 `null`＝未預審，不是乾淨）→ 一律存成 `pending`。
  **只有 `POST /admin/review` 能產生 `approved`**，`GET /api/wishes/approved` 也只回 approved，未核准內容永遠不離開資料庫。
- **排行榜**：`GET/POST /api/scores`，暱稱另外過濾（只擋廣告與辱罵，不套願望的長度規則）。
- **AI 彩蛋**：`POST /api/blessing/rare` 代理 OpenAI。開機先驗證 `OPENAI_MODEL` 存在，
  三層限制（單 IP 每小時 5 次、全站每日上限、`max_completion_tokens`），生成結果再跑一次同一套過濾。
  任何一層失敗都靜默 fallback，前端自己用預寫池頂上。
- 前端全部走「失敗就當沒有後端」：拉不到社群願望就只用官方池，投稿／排行榜失敗只顯示提示，遊戲照跑。

### 後端本機開發

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm run dev:api
```

api 啟動時會自動跑 Drizzle migration（冪等，重開機安全）。改了 `src/db/schema.ts` 之後：

```bash
npm run db:generate --workspace=@moon/api
```

`/admin/*` 需要 `Authorization: Bearer $ADMIN_TOKEN`；沒設 `ADMIN_TOKEN` 整組後台不掛載，
避免不小心開一個沒有保護的審核介面。

**M7.5（帳號、許願牆與社群互動）完成**：

- **Google 登入**：ID token 由後端 `google-auth-library` 驗簽後換成自己的 session JWT，放 httpOnly cookie。
  訪客不用登入也能玩、能上排行榜，暱稱與教學已讀存在 localStorage。
  暱稱可以重複，排行榜用 `#a3f`（id 雜湊前三碼）區分。
- **首頁三條路**：值班、我要許願（需登入）、值班排行（免登入）。右上角未登入是 Google 按鈕，登入後是頭像 → 設定（改暱稱、Email 通知開關、登出）。
- **首次遊玩教學卡片**：四張，可略過；訪客記在本機，登入者記在 `users.intro_seen`。準備頁有「重看規則」。
- **許願牆** `/wishes`：投稿（同時最多 50 則，收回就能再投）、每則願望的互動統計（誰擲了什麼筊、幾個人沒聽到）與留言。
- **留言**：值班中（會暫停模擬，不然打字期間別人的耐心照跑）與日終結算都能留。留言需登入，內容跑跟投稿同一套過濾。
- **通知**：某則願望第一次被互動即時寄信，之後每天彙總一封；設定可關閉。
  沒設 `SMTP_HOST` 走 log transport，信會完整印在 log 裡但不真的寄。
- **治理**：留言可讚／倒讚（只寫 DB）與檢舉。同一作者被**三個不同帳號**檢舉即自動封鎖——
  同一人重複檢舉只算一次。被封鎖者照常玩遊戲與上排行榜，但不能投稿、留言、檢舉，可在許願頁送申訴。
  後台 `/admin` 有待審投稿、檢舉清單、封鎖清單（含申訴）與手動解鎖；解鎖會清掉舊檢舉，避免一被檢舉就又滿三次。

下一步是 M7（音效與音樂）、M8（模式 C）、M9（模式 B）。完整里程碑見 `~/.claude/plans/3d-indexed-harp.md`。

效能現況（1280×720，dpr 2）：69–73 draw call、4.3k triangle、120fps；手機尺寸 61 call。
draw call 預算是 100，其中約 8 個是後製 pass。柱子、香、信眾都走 `InstancedMesh`。

### 兩個踩過的坑（改場景前先看）

1. **`InstancedMesh` 的 `boundingSphere` 會快取**。實例每帧都在動時，必須每帧 `mesh.boundingSphere = null`，
   否則視錐剔除與 raycast 都拿第一帧的舊球判斷——第一帧信眾藏在地板下，結果整批人永遠不被畫出來、也永遠點不到。
2. **神桌會在跪拜區投下視線死角**。桌沿高度、神座高度、跪拜距離三者互相牽制；
   改任何一個都要重算，否則信眾會被桌面切成一顆頭。目前是神座 3.7m、桌高 1.05m、跪拜區 z=0.8。
3. **滑鼠同時要環視與點選，會互相打架**。游標往信眾移動 → 鏡頭跟著轉 → 信眾跑掉。
   解法是 `DeityCamera` 的中央死區：畫面中間 34% 不轉頭，靠近邊緣才漸進轉。改靈敏度前先讀那段。
4. **跪姿的可點面積很小**。信眾另外有一層看不見的命中盒（`colorWrite: false` 的 instanced box）專門接指標事件，
   點選判定走它，不要改回直接點衣袍。

開發時 `window.__moon`（場景／相機／renderer／`state()`）與 `window.__moonLook(yaw, pitch)` 只在 dev 模式掛載，
用來寫自動化檢查；`preserveDrawingBuffer` 也只有 dev 開，方便從 canvas 取樣像素驗證畫面。

## 快速開始

複製環境變數範本：

```bash
cp .env.example .env
```

### 本機開發（最快）

```bash
npm install
npm run dev
```

前端在 http://localhost:5173 。要一起跑後端：

```bash
npm run dev:api
```

### Docker 開發（HMR + tsx watch + Postgres）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Docker 正式環境

```bash
docker compose up --build
```

網站在 http://localhost:8080 ，nginx 會把 `/api` 反向代理到 api 容器。

## 架構

```
瀏覽器 (SPA)          官方願望池打包進 bundle，遊戲主體離線可玩
   │  /api/*
   ▼
api (Fastify)         投稿審核、排行榜、AI 彩蛋（唯一持有 OpenAI key 的地方）
   ▼
postgres              只存玩家投稿與分數；官方願望池留在 repo 走版本控制
```

- `packages/shared` — 前後端共用的 Zod schema 與型別（投稿規則只有一份）
- `apps/web/src/sim` — 純 TypeScript 模擬層，不 import three、不 import react，可單獨測試
- `apps/web/src/scene` — R3F 場景，全部由內建幾何體程序生成，零外部 3D 模型
- `apps/api/src` — Fastify 路由、審核、Drizzle schema

## 指令

```bash
npm run test        # 模擬層單元測試（vitest）
npm run typecheck   # 全 workspace 型別檢查
npm run build       # 前端正式建置
```

## 環境變數

見 `.env.example`。重點：

- `OPENAI_API_KEY` / `OPENAI_MODEL` — 只給 api 容器；**前端 build 絕不可帶入任何密鑰**
- `AI_DAILY_CAP` — 全站每日 AI 呼叫上限，超過就靜默 fallback 回預寫願望池
- `ADMIN_TOKEN` — 投稿審核後台
- `IP_HASH_SALT` — 濫用防治用的 IP 雜湊 salt，不儲存原始 IP

沒設 `OPENAI_API_KEY` 就是關閉 AI 彩蛋功能，不是壞掉；`/health` 會回報哪些功能實際是開的。
