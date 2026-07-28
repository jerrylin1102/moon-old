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

- **投稿即發佈**：`POST /api/wishes/submit` → 程式規則（電話／email／網址／身分證／社群帳號／灌水一律自動退件；髒話只標記不退件）→ LLM 預審（寫進 `auto_flags`，掛掉時記成 `null`＝未預審，僅供後台參考，不擋發佈）→ 通過硬性規則就直接存成 `approved`，立刻出現在 `GET /api/wishes/approved`。
  後台看得到所有投稿（含自動退件的），`POST /admin/review` 可以事後把已發佈的內容下架，或把退件的重新上架。
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

`/admin` 是標準帳號密碼登入（`ADMIN_USERNAME` / `ADMIN_PASSWORD`），換一張獨立的 httpOnly session cookie，
效期 12 小時。兩個環境變數缺一個，整組後台就不掛載。

**M9（模式 B「凡人故事」）完成**：

- **節奏**：一天固定 5–8 人（開局隨機擲），沒有打烊倒數——名額用完、在場的人都走完，這天才算收班
  （`sim/spawner.ts` 的 `MODE_TEMPO.story`、`sim/tick.ts` 新增的收班判斷）。
- **多段對話**：故事願望的 `text` 用 `\n`分段，願望氣泡與批示條都改用 `whitespace-pre-line` 呈現；
  疲勞遮字的 `muffle()` 保留換行不遮，模糊再重也看得出對話的段落。氣泡在這個模式也放寬了一點（`w-64`/`w-80`）。
- **獨立願望池** `content/wishes/story.json`（13 則，5 條兩天式故事線 + 3 則單日故事）：
  跟 `officialPool` 分開存放，不會混進 rush／sorting 的隨機池，也不受一般願望池「氣泡塞得下」
  （60 字）的長度測試限制——`storyPool` 另外有自己的測試。
- **跨天回訪與存檔**（`content/story.ts`）：收班時把「有回應、而且有 `followUp`」的願望排進明天的回訪佇列，
  存進 `localStorage`（`moon.story`）；下次開局優先讓回訪的人進來，剩下名額才從沒見過的角色裡補。
  純邏輯（`buildDayRoster`、`advanceStorySave`）跟讀寫 localStorage 的部分刻意分開，前者可以直接單元測試。
  準備頁會顯示「第幾天」，也能一鍵重新開始一段新故事（清存檔）。
  沒聽到的願望不會有下一集——故事得靠你真的回應了才會繼續。
- 這個模式**不出現 AI 稀有信眾**：角色是排好的名單，隨機生成會打亂回訪的故事線。

**M8（模式 C「神明轉單」）完成**：

- **業務範圍規則書**：`sim/rulebook.ts` 定義 category → 是否歸月老受理的參考表，初始值等於現實
  （感情／健康歸月老，財運轉財神、考試轉文昌帝君、報復轉城隍爺、搶票與離譜願望沒人管）。
  批示對錯永遠只看每則願望自己的 `domain` 欄位（`verdict.ts` 既有邏輯不變），規則書純粹是玩家看得到、
  可能被公文改得跟現實脫節的參考資料——照規則書辦事卻被現實打臉，就是這個模式的核心整人機制。
- **公文更新**：值班途中會收到 2–3 份公文，時間點依當天長度等比例排定，套用時規則書即時更新、
  推播成一則 outcome，也記進「今日公文」log。準備頁的規則書面板（右上角「規則書」按鈕）隨時可查目前狀態。
- **業務範圍判斷錯了**：除了原本的怨氣／功德懲罰，真正該管的神明會多跳出來抱怨一句
  （`complaintFor`，例如「財神託夢抗議」），沒人管的類別則是自嘲式吐槽，不牽拖到特定神明。
- **節奏**：中速，起始生成間隔比初一十五拉長、全程加速幅度也小很多——這個模式的壓力來自判斷而非人潮。
- `VerdictBar` 在模式 C 會多顯示一行「規則書目前怎麼寫」的提示，但不會告訴你規則書是不是跟現實一致。

**M7.5（帳號、許願牆與社群互動）完成**：

- **Google 登入**：ID token 由後端 `google-auth-library` 驗簽後換成自己的 session JWT，放 httpOnly cookie。
  訪客不用登入也能玩、能上排行榜，暱稱與教學已讀存在 localStorage。
  暱稱可以重複，排行榜用 `#a3f`（id 雜湊前三碼）區分。
- **首頁三條路**：值班、我要許願（需登入）、值班排行（免登入）。右上角未登入是 Google 按鈕，登入後是頭像 → 設定（改暱稱、Email 通知開關、登出）。
- **首次遊玩教學卡片**：四張，可略過；訪客記在本機，登入者記在 `users.intro_seen`。準備頁有「重看規則」。
- **許願牆** `/wishes`：投稿即發佈（同時最多 50 則，收回就能再投）、每則願望的互動統計（誰擲了什麼筊、幾個人沒聽到）與留言。
- **排行榜自動上榜**：值班結束就自動送出成績，不用手動按上傳；名字用帳號暱稱或訪客暱稱，兩者都在進遊戲前就已經問過了。
- **留言**：值班中（會暫停模擬，不然打字期間別人的耐心照跑）與日終結算都能留。留言需登入，內容跑跟投稿同一套過濾。
- **通知**：某則願望第一次被互動即時寄信，之後每天彙總一封；設定可關閉。
  沒設 `SMTP_HOST` 走 log transport，信會完整印在 log 裡但不真的寄。
- **治理**：留言可讚／倒讚（只寫 DB）與檢舉。同一作者被**三個不同帳號**檢舉即自動封鎖——
  同一人重複檢舉只算一次。被封鎖者照常玩遊戲與上排行榜，但不能投稿、留言、檢舉，可在許願頁送申訴。
  後台 `/admin` 有待審投稿、檢舉清單、封鎖清單（含申訴）與手動解鎖；解鎖會清掉舊檢舉，避免一被檢舉就又滿三次。

**M7（音效與環境音）完成**：

- **全部程序生成**（`apps/web/src/audio/`），零外部音檔、零授權風險：一個 AudioContext、一個總音量 GainNode，
  所有聲音都是振盪器與濾波噪音即時合成。詳見 `assets/CREDITS.md`。
- **具名音效**（`audio/sfx.ts`）：擲筊落地（聖／笑／陰筊音高節奏各不同）、批示結果（准／駁／轉單）、
  顯靈神通（上行琶音）、牽紅線成功、偷吃供品。全部掛在 `actions.ts` 那幾個統一入口，玩家做什麼就聽到什麼。
- **環境層**（`audio/ambience.ts`）：香爐嗡鳴 drone、隨機遠鐘／木魚、人在走動時偶爾聽到腳步，
  疲勞噪音層平常幾乎聽不到、累了才慢慢浮出來——聽覺版的「疲勞讓你聽不清楚」。
- HUD 有靜音切換，狀態存 localStorage。自動播放政策：AudioContext 在值班開始那次點擊裡建立並 resume，
  另外掛一次性手勢監聽保底。

M0–M9（含 M7.5）都做完了，三種模式都可玩。完整里程碑見 `~/.claude/plans/3d-indexed-harp.md`。

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
