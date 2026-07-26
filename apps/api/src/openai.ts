import { z } from 'zod';
import { env } from './env';

/**
 * 唯一碰 OpenAI API key 的檔案。
 *
 * key 只存在這個程序的環境變數裡，永遠不會出現在回應中；
 * 前端拿到的只有生成好的文字。
 */

const OPENAI_BASE = 'https://api.openai.com/v1';

export class OpenAiUnavailable extends Error {}

async function callOpenAi(path: string, init: RequestInit, timeoutMs = 12_000): Promise<Response> {
  if (!env.OPENAI_API_KEY) throw new OpenAiUnavailable('OPENAI_API_KEY 未設定');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${OPENAI_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 開機時確認設定的 model 真的存在。
 * 不驗證的話，打錯字會變成執行期一個看不出原因的 500。
 */
export async function verifyModel(): Promise<{ ok: boolean; reason?: string }> {
  if (!env.OPENAI_API_KEY) return { ok: false, reason: '未設定 OPENAI_API_KEY，AI 功能關閉' };

  try {
    const res = await callOpenAi(`/models/${encodeURIComponent(env.OPENAI_MODEL)}`, {
      method: 'GET',
    });
    if (res.ok) return { ok: true };
    if (res.status === 404) {
      return {
        ok: false,
        reason: `OPENAI_MODEL="${env.OPENAI_MODEL}" 在這個帳號下不存在。請改成可用的 model id。`,
      };
    }
    return { ok: false, reason: `OpenAI 回應 ${res.status}` };
  } catch (error) {
    return { ok: false, reason: `連不上 OpenAI：${(error as Error).message}` };
  }
}

interface ChatOptions {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
  maxTokens: number;
}

export interface ChatResult<T> {
  data: T;
  usage: { prompt: number; completion: number };
}

/** 要求結構化輸出。拿不到合法 JSON 就當作失敗，由呼叫端 fallback */
export async function chatJson<T>(
  options: ChatOptions,
  parser: z.ZodType<T>,
): Promise<ChatResult<T>> {
  const res = await callOpenAi('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      max_completion_tokens: options.maxTokens,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: options.schema.name, strict: true, schema: options.schema.schema },
      },
    }),
  });

  if (!res.ok) {
    throw new OpenAiUnavailable(`OpenAI 回應 ${res.status}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new OpenAiUnavailable('OpenAI 沒有回傳內容');

  return {
    data: parser.parse(JSON.parse(content)),
    usage: {
      prompt: body.usage?.prompt_tokens ?? 0,
      completion: body.usage?.completion_tokens ?? 0,
    },
  };
}
