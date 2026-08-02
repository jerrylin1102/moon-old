import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { aiEnabled, authEnabled, dbEnabled, env, mailEnabled, minioEnabled } from './env';
import { ensureAvatarBucket } from './storage/minio';
import { authRoutes } from './routes/auth';
import { interactionRoutes } from './routes/interactions';
import { commentRoutes } from './routes/comments';
import { startNotificationLoop } from './mail/dispatch';
import { closeDb, pingDb, runMigrations } from './db/client';
import { seedWishBankIfEmpty } from './db/seedWishBank';
import { verifyModel } from './openai';
import { wishRoutes } from './routes/wishes';
import { wishBankRoutes } from './routes/wishBank';
import { scoreRoutes } from './routes/scores';
import { adminRoutes } from './routes/admin';
import { blessingRoutes } from './routes/blessing';

const app = Fastify({
  logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  // nginx 在前面，要信任它帶進來的 X-Forwarded-For，否則所有人的 IP 都一樣
  trustProxy: true,
});

const started = { db: false, ai: false, aiReason: undefined as string | undefined };
let notificationLoop: NodeJS.Timeout | null = null;

app.get('/health', async () => ({
  ok: true,
  service: 'moon-old-api',
  env: env.NODE_ENV,
  // 讓部署時一眼看出哪些功能實際上是開的
  features: {
    db: started.db,
    ai: started.ai,
    model: started.ai ? env.OPENAI_MODEL : null,
    aiReason: started.aiReason,
    auth: authEnabled,
    mail: mailEnabled,
    minio: minioEnabled,
  },
}));

const start = async () => {
  try {
    // 全域保底限流；個別端點再各自收緊
    await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
    // session cookie 需要簽章金鑰；cookie 本身是 httpOnly，前端讀不到
    await app.register(cookie, { secret: env.SESSION_SECRET });

    await app.register(authRoutes);
    await app.register(wishRoutes);
    await app.register(wishBankRoutes);
    await app.register(interactionRoutes);
    await app.register(commentRoutes);
    await app.register(scoreRoutes);
    await app.register(blessingRoutes);
    await app.register(adminRoutes, { prefix: '' });

    if (dbEnabled) {
      started.db = await pingDb();
      if (started.db) {
        await runMigrations();
        app.log.info('資料庫 migration 完成');
        await seedWishBankIfEmpty(app.log);
        // 通知排程：即時信在入列時就會寄，這個迴圈負責彙總與補漏
        notificationLoop = startNotificationLoop(app.log);
        if (!mailEnabled) app.log.warn('未設定 SMTP_HOST，通知信只會寫進 log 不會真的寄出');
      } else {
        app.log.error('設定了 DATABASE_URL 但連不上資料庫，相關端點會回 503');
      }
    } else {
      app.log.warn('未設定 DATABASE_URL，投稿與排行榜停用');
    }

    if (minioEnabled) {
      await ensureAvatarBucket(app.log);
    } else {
      app.log.warn('未設定 MinIO，社群願望頭像會直接沿用 Google 提供的網址，不做快取');
    }

    if (aiEnabled) {
      // 開機就確認 model id，不要等到第一個請求才變成神秘的 500
      const result = await verifyModel();
      started.ai = result.ok;
      started.aiReason = result.reason;
      if (!result.ok) app.log.error(`AI 彩蛋停用：${result.reason}`);
    } else {
      app.log.warn('未設定 OPENAI_API_KEY，AI 彩蛋停用');
    }

    await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void (async () => {
      if (notificationLoop) clearInterval(notificationLoop);
      await app.close();
      await closeDb();
      process.exit(0);
    })();
  });
}

void start();
