import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../../env';

/**
 * Limit nawiazania polaczenia (w sekundach). Domyslne 30 s rowna sie calemu `maxDuration`
 * webhooka Stripe — nieosiagalna baza ubilaby funkcje bez logu zamiast zwrocic 500.
 */
const CONNECT_TIMEOUT_SECONDS = 5;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(env.DATABASE_URL, {
    prepare: false,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
});
export const db = drizzle(client);
