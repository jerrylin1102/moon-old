import nodemailer, { type Transporter } from 'nodemailer';
import { env, mailEnabled } from '../env';

/**
 * 寄信管道。
 *
 * 沒設 SMTP_HOST 時走 nodemailer 的 jsonTransport：信會被組出來、寫進 log，
 * 但不會真的寄出去。開發與 CI 都能跑完整流程，不必依賴外部服務，也不會誤寄給真人。
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = mailEnabled
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });

  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** 寄一封信。回傳是否真的送出去了（log 模式回 false） */
export async function sendMail(mail: Mail): Promise<boolean> {
  const info = await getTransporter().sendMail({
    from: env.MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });

  if (!mailEnabled) {
    // log 模式的重點就是看得到信長什麼樣，不然等於什麼都沒發生
    console.info(`[mail:log] → ${mail.to}\n主旨：${mail.subject}\n${mail.text}\n`);
    return false;
  }

  return Boolean(info.accepted?.length);
}
