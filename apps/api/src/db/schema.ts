import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { DEITY_DOMAINS, SUBMISSION_STATUSES, WISH_CATEGORIES } from '@moon/shared';

export const submissionStatus = pgEnum('submission_status', SUBMISSION_STATUSES);
export const wishCategory = pgEnum('wish_category', WISH_CATEGORIES);
export const deityDomain = pgEnum('deity_domain', DEITY_DOMAINS);
export const wishPoolType = pgEnum('wish_pool_type', ['official', 'story']);
export const gameMode = pgEnum('game_mode', ['rush', 'story', 'sorting']);
/** 玩家對一則願望做了什麼 */
export const interactionAction = pgEnum('interaction_action', [
  'approve',
  'reject',
  'transfer',
  'sheng',
  'xiao',
  'yin',
  'thread',
  'ignored',
]);
export const reportTarget = pgEnum('report_target', ['comment', 'wish']);
export const appealStatus = pgEnum('appeal_status', ['open', 'resolved']);
export const notificationKind = pgEnum('notification_kind', ['first', 'digest']);

/**
 * 帳號。Google 登入建立，是願望、留言、檢舉的歸屬對象。
 * 沒有帳號也能玩遊戲與上排行榜，只是不能投稿與留言。
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Google 的使用者識別碼，是唯一可靠的帳號主鍵；email 可能被使用者更改 */
  googleSub: varchar('google_sub', { length: 64 }).notNull().unique(),
  email: varchar('email', { length: 254 }).notNull(),
  displayName: varchar('display_name', { length: 16 }).notNull(),
  avatarUrl: text('avatar_url'),
  /** 願望被互動時要不要寄信 */
  emailOptIn: boolean('email_opt_in').notNull().default(true),
  /** 教學卡片看過了沒 */
  introSeen: boolean('intro_seen').notNull().default(false),
  blocked: boolean('blocked').notNull().default(false),
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
  blockedReason: text('blocked_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 玩家投稿的願望。預設 pending，只有人工審核能改成 approved。
 * 未核准的內容絕不回傳給其他玩家。
 */
export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** null 代表 M6 時期的匿名投稿 */
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    text: varchar('text', { length: 200 }).notNull(),
    category: wishCategory('category').notNull(),
    status: submissionStatus('status').notNull().default('pending'),
    /** 程式規則 + LLM 預審的結果，供人工審核參考 */
    autoFlags: jsonb('auto_flags').notNull().default(sql`'{"rules":[],"llm":null}'::jsonb`),
    /** 核准時人工補上的三種後果文字；沒補就用通用版本 */
    resolutions: jsonb('resolutions'),
    moderationNote: text('moderation_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** 作者自己收回。收回後不再出現在遊戲裡，也不佔用 50 則額度 */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** IP 的 HMAC，只為濫用防治，不存原始 IP */
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  },
  (t) => [
    index('submissions_status_created_idx').on(t.status, t.createdAt),
    index('submissions_author_idx').on(t.authorId, t.deletedAt),
  ],
);

/** 別人在遊戲裡對這則願望做了什麼。訪客也會留下紀錄，只是不具名 */
export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** 訪客的匿名指紋，只用來去重，不能反查身分 */
    actorGuestHash: varchar('actor_guest_hash', { length: 64 }),
    action: interactionAction('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('interactions_submission_idx').on(t.submissionId, t.createdAt)],
);

/** 留言。需要登入——留言要能被檢舉、被通知、被追責 */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 300 }).notNull(),
    /** 後台隱藏的留言不再回傳給任何人 */
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comments_submission_idx').on(t.submissionId, t.createdAt)],
);

/** 讚與倒讚。目前只寫進資料庫，不影響任何排序或顯示以外的行為 */
export const commentVotes = pgTable(
  'comment_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    voterId: uuid('voter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** +1 讚、-1 倒讚 */
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('comment_votes_once').on(t.commentId, t.voterId)],
);

/**
 * 檢舉。unique 約束確保同一人對同一則內容只算一次，
 * 否則一個人連按三下就能把別人封鎖掉。
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetType: reportTarget('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    /** 被檢舉內容的作者，封鎖判定用它累計 */
    targetAuthorId: uuid('target_author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('reports_once_per_person').on(t.targetType, t.targetId, t.reporterId),
    index('reports_author_idx').on(t.targetAuthorId),
  ],
);

/** 被封鎖的人申請解鎖 */
export const appeals = pgTable(
  'appeals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: varchar('message', { length: 500 }).notNull(),
    status: appealStatus('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('appeals_status_idx').on(t.status, t.createdAt)],
);

/**
 * 待寄與已寄的通知。
 * sent_at 為 null 代表還沒寄——每日彙總就是把這些收集起來寄一封。
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_pending_idx').on(t.userId, t.sentAt)],
);

/**
 * 每一場值班的結果。排行榜與個人遊玩紀錄共用這一份，
 * 沒必要為了排行榜再開一張表。
 */
export const playSessions = pgTable(
  'play_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** 訪客的本機識別碼雜湊，讓沒登入的人也能有一條連續的紀錄 */
    guestHash: varchar('guest_hash', { length: 64 }),
    nickname: varchar('nickname', { length: 16 }).notNull(),
    mode: gameMode('mode').notNull(),
    difficulty: varchar('difficulty', { length: 16 }).notNull(),
    score: integer('score').notNull(),
    handled: integer('handled').notNull(),
    ignored: integer('ignored').notNull(),
    matched: integer('matched').notNull(),
    peakFatigue: real('peak_fatigue').notNull(),
    /** 月老日記給的稱號 */
    title: varchar('title', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  },
  (t) => [
    index('play_sessions_leaderboard_idx').on(t.mode, t.score),
    index('play_sessions_user_idx').on(t.userId, t.createdAt),
  ],
);

/**
 * 官方題庫（信眾願望）。取代原本只存在 apps/web JSON 檔的做法——
 * 資料庫是編輯的真相來源，後台可以直接 CRUD；JSON 檔降級為開發/離線 fallback 快照。
 * `legacyId` 對應舊 JSON 裡的 `id`，讓前端既有的存檔/歷程資料不用跟著換一套 id 系統。
 */
export const wishBank = pgTable(
  'wish_bank',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legacyId: varchar('legacy_id', { length: 64 }).notNull().unique(),
    category: wishCategory('category').notNull(),
    domain: deityDomain('domain').notNull(),
    text: varchar('text', { length: 140 }).notNull(),
    /** 1-3，越高越耗月老的疲勞 */
    intensity: smallint('intensity').notNull(),
    tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
    resolutions: jsonb('resolutions').notNull(),
    /** 模式 B 用：隔天回訪的後續願望 legacyId，沒有就是 null */
    followUp: varchar('follow_up', { length: 64 }),
    /** 官方一般池，或模式 B（凡人故事）專用池 */
    poolType: wishPoolType('pool_type').notNull().default('official'),
    /** 下架用軟開關，不做硬刪除——避免刪掉一則正在被玩家遊玩中引用的題目 */
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('wish_bank_pool_active_idx').on(t.poolType, t.active),
    index('wish_bank_category_active_idx').on(t.category, t.active),
  ],
);

/** AI 呼叫紀錄：rate limit 與成本追蹤都靠這張表 */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
    model: varchar('model', { length: 64 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_usage_created_idx').on(t.createdAt)],
);
