import { createHmac } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from './env';

/**
 * 濫用防治用的 IP 指紋。
 *
 * 刻意只存 HMAC，不存原始 IP；salt 再混入當天日期，
 * 所以同一個 IP 每天的雜湊都不同，無法跨日追蹤同一個人。
 */
export function ipHash(request: FastifyRequest): string {
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.ip || 'unknown';
  return createHmac('sha256', `${env.IP_HASH_SALT}:${day}`).update(ip).digest('hex').slice(0, 64);
}
