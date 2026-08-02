import { z } from 'zod';

/** 願望類別 */
export const WISH_CATEGORIES = [
  'love', // 感情
  'money', // 財運機運
  'exam', // 考試
  'ticket', // 搶票（其實不屬月老業務，正解是轉單）
  'health', // 健康
  'revenge', // 報復性許願
  'absurd', // 離譜願望
] as const;

/** 真正該管這件事的神明。模式 C（神明轉單）用來判定對錯 */
export const DEITY_DOMAINS = [
  'yuelao', // 月老：感情、姻緣
  'caishen', // 財神：財運
  'wenchang', // 文昌帝君：考試、學業
  'zhusheng', // 註生娘娘：求子
  'chenghuang', // 城隍爺：是非、冤屈
  'nobody', // 沒有神明管這個（離譜願望）
] as const;

export const wishCategorySchema = z.enum(WISH_CATEGORIES);
export const deityDomainSchema = z.enum(DEITY_DOMAINS);

/** 月老的三種批示 */
export const verdictSchema = z.enum(['approve', 'reject', 'transfer']);

/** 擲筊結果 */
export const divinationSchema = z.enum([
  'sheng', // 聖筊：一正一反，神明允了
  'xiao', // 笑筊：兩正，神明在笑（問題不清楚）
  'yin', // 陰筊：兩反，神明不允
]);

export const wishSchema = z.object({
  id: z.string().min(1),
  category: wishCategorySchema,
  domain: deityDomainSchema,
  /** 信眾說出口的願望 */
  text: z.string().min(4).max(140),
  /** 1-3，越高越耗月老的疲勞 */
  intensity: z.number().int().min(1).max(3),
  tags: z.array(z.string()).default([]),
  /** 三種批示各自的後果描述，日終結算時顯示 */
  resolutions: z.object({
    approve: z.string(),
    reject: z.string(),
    transfer: z.string(),
  }),
  /** 模式 B：隔天回訪的後續願望 id */
  followUp: z.string().optional(),
  /** 來源：官方預寫池 / 玩家投稿 / AI 生成的稀有信眾 / 贊助作者的彩蛋信眾 */
  source: z.enum(['official', 'community', 'ai', 'support']).default('official'),
  /**
   * 社群願望在資料庫裡的 id。有這個欄位才回報得了互動，
   * 官方池與 AI 願望沒有主人，所以是 undefined。
   */
  submissionId: z.string().uuid().optional(),
  /** 社群願望投稿者的頭像網址，貼在 NPC 臉上讓玩家知道這則願望來自社群 */
  avatarUrl: z.string().url().optional(),
});

export type Wish = z.output<typeof wishSchema>;
export type WishCategory = z.output<typeof wishCategorySchema>;
export type DeityDomain = z.output<typeof deityDomainSchema>;
export type Verdict = z.output<typeof verdictSchema>;
export type Divination = z.output<typeof divinationSchema>;

export const wishPoolSchema = z.array(wishSchema);
