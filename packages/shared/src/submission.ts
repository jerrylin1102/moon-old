import { z } from 'zod';
import { wishCategorySchema } from './wish';

/**
 * 玩家投稿願望。前後端共用同一份規則：
 * 前端表單即時驗證，後端再驗一次（前端驗證永遠不能當安全邊界）。
 */
export const submissionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(6, '至少要寫 6 個字，月老聽不懂太短的願望')
    .max(120, '太長了，月老今天很忙'),
  category: wishCategorySchema,
});

export type SubmissionInput = z.output<typeof submissionInputSchema>;

export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export type SubmissionStatus = z.output<typeof submissionStatusSchema>;

/** 自動過濾的結果，寫進 DB 供人工審核參考 */
export const autoFlagsSchema = z.object({
  /** 程式規則命中的項目，例如 'profanity' | 'phone' | 'email' | 'url' | 'national_id' */
  rules: z.array(z.string()).default([]),
  /** LLM 預審結論；LLM 掛掉時為 null，代表「未預審」而非「乾淨」 */
  llm: z
    .object({
      harassment: z.boolean(),
      personalInfo: z.boolean(),
      offTopic: z.boolean(),
      note: z.string().max(200).optional(),
    })
    .nullable()
    .default(null),
});

export type AutoFlags = z.output<typeof autoFlagsSchema>;

/** 三種玩法模式 */
export const gameModeSchema = z.enum(['rush', 'story', 'sorting']);
export type GameMode = z.output<typeof gameModeSchema>;

export const difficultySchema = z.enum(['easy', 'normal', 'hard']);

/**
 * 一場值班的結果。排行榜與個人遊玩紀錄共用這份資料。
 * guestId 只有未登入時才帶——登入者的身分從 session cookie 來，不接受前端自稱。
 */
export const playSessionSchema = z.object({
  nickname: z.string().trim().min(1).max(16),
  mode: gameModeSchema,
  difficulty: difficultySchema,
  score: z.number().int().min(0).max(1_000_000),
  wishesHandled: z.number().int().min(0).max(100_000),
  ignored: z.number().int().min(0).max(100_000),
  matched: z.number().int().min(0).max(100_000),
  peakFatigue: z.number().min(0).max(100),
  title: z.string().max(32).optional(),
  guestId: z.string().uuid().optional(),
});

export type PlaySessionInput = z.output<typeof playSessionSchema>;
export type Difficulty = z.output<typeof difficultySchema>;
