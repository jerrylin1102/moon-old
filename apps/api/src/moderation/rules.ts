/**
 * 第一層審核：程式規則。
 *
 * 這一層只負責攔明顯不該進池子的東西——個資、聯絡方式、髒話、灌水。
 * 它不判斷「好不好笑」或「像不像真的願望」，那是 LLM 預審與人工的事。
 *
 * 重要：這一層通過不代表可以上線。所有投稿一律 pending，只有人工能核准。
 */

/** 命中的規則代號 */
export type RuleFlag =
  | 'phone'
  | 'email'
  | 'url'
  | 'national_id'
  | 'social_handle'
  | 'profanity'
  | 'repetition'
  | 'too_few_chars';

const PATTERNS: { flag: RuleFlag; re: RegExp }[] = [
  // 台灣手機、市話，以及被空格或符號拆開的寫法
  { flag: 'phone', re: /(?:09[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{3})|(?:0\d[\s-]?\d{4}[\s-]?\d{4})/ },
  { flag: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { flag: 'url', re: /(https?:\/\/|www\.|\.com|\.tw\b|t\.me\/|line\.me)/i },
  // 身分證字號
  { flag: 'national_id', re: /\b[A-Za-z][12]\d{8}\b/ },
  { flag: 'social_handle', re: /(?:^|\s)@[A-Za-z0-9._]{3,}|(?:ig|line|fb|discord)\s*[:：]/i },
];

/**
 * 髒話清單刻意保守：只擋明確的辱罵字眼。
 * 願望本來就會抱怨前任，抱怨不是辱罵。
 */
const PROFANITY = [
  '幹你',
  '幹妳',
  '去死',
  '智障',
  '白癡',
  '低能',
  '腦殘',
  '婊子',
  '賤人',
  '雜碎',
  'fuck',
  'shit',
  'bitch',
];

/** 同一個字連續出現這麼多次就算灌水 */
const REPEAT_LIMIT = 6;

export function checkRules(text: string): RuleFlag[] {
  const flags: RuleFlag[] = [];
  const normalized = text.toLowerCase();

  for (const { flag, re } of PATTERNS) {
    if (re.test(text)) flags.push(flag);
  }

  if (PROFANITY.some((word) => normalized.includes(word))) flags.push('profanity');

  if (new RegExp(`(.)\\1{${REPEAT_LIMIT},}`).test(text)) flags.push('repetition');

  // 去掉標點與空白之後真的有內容嗎
  const meaningful = text.replace(/[\s\p{P}]/gu, '');
  if (meaningful.length < 5) flags.push('too_few_chars');

  return flags;
}

/**
 * 這幾種命中就直接退件，不佔用人工審核的時間。
 * 網址也在內——真心的願望不會夾連結，那是廣告的載體。
 */
const AUTO_REJECT: RuleFlag[] = [
  'phone',
  'email',
  'url',
  'national_id',
  'social_handle',
  'too_few_chars',
];

export function shouldAutoReject(flags: RuleFlag[]): boolean {
  return flags.some((f) => AUTO_REJECT.includes(f));
}

/**
 * 暱稱只檢查「會傷到別人」的那幾條。
 * 長度與重複字是給願望用的規則——暱稱本來就短，「值班月老」四個字完全正常。
 */
const NICKNAME_FLAGS: RuleFlag[] = [
  'phone',
  'email',
  'url',
  'national_id',
  'social_handle',
  'profanity',
];

export function checkNickname(nickname: string): RuleFlag[] {
  return checkRules(nickname).filter((f) => NICKNAME_FLAGS.includes(f));
}
