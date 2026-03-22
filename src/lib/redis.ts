import 'server-only';
import { env } from '../../env';
import Redis from 'ioredis';

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
});